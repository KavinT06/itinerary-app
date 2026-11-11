import {
    parseTripRequest,
    buildPrompt,
    buildResponseSchema,
    parseModelJson,
    normalizeItinerary,
    ItineraryFormatError,
    SYSTEM_INSTRUCTION,
} from '../../../lib/itinerary.js';
import { generateJson, getModelName, AIServiceError } from '../../../lib/gemini.js';
import { createRateLimiter, clientKey } from '../../../lib/rate-limit.js';

export const runtime = 'nodejs';
// Long itineraries can take a while to generate. Must exceed GEMINI timeout (50s).
export const maxDuration = 60;

const RATE_LIMIT = { limit: 5, windowMs: 60_000 };
const checkRateLimit = createRateLimiter(RATE_LIMIT);

const NO_STORE = { 'Cache-Control': 'no-store' };

function errorResponse(status, error, extraHeaders = {}, extraBody = {}) {
    return Response.json({ error, ...extraBody }, { status, headers: { ...NO_STORE, ...extraHeaders } });
}

// User-facing messages are deliberately generic: internal details go to server logs only.
const AI_ERROR_RESPONSES = {
    not_configured: [503, 'The itinerary service is not available right now. Please try again later.'],
    auth: [503, 'The itinerary service is not available right now. Please try again later.'],
    model_not_found: [503, 'The itinerary service is not available right now. Please try again later.'],
    rate_limited: [429, 'The AI service is busy right now. Please wait a minute and try again.'],
    timeout: [504, 'Generating your itinerary took too long. Please try again, or plan a shorter trip.'],
    blocked: [422, "We couldn't create an itinerary for that destination. Please check the destination and try again."],
    truncated: [502, 'That itinerary was too long to generate in one go. Please try a shorter trip.'],
    upstream: [502, 'The AI service is temporarily unavailable. Please try again in a moment.'],
};

export async function POST(request) {
    // Only our own page may spend AI quota. Browsers send Sec-Fetch-Site; requiring JSON
    // forces a CORS preflight (which we never approve) for any cross-origin fetch.
    if (request.headers.get('sec-fetch-site') === 'cross-site') {
        return errorResponse(403, 'Cross-site requests are not allowed.');
    }
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        return errorResponse(415, 'Content-Type must be application/json.');
    }

    const rate = checkRateLimit(clientKey(request.headers));
    if (!rate.allowed) {
        return errorResponse(
            429,
            `Too many requests. Please wait ${rate.retryAfterSeconds} seconds and try again.`,
            { 'Retry-After': String(rate.retryAfterSeconds) },
            { retryAfter: rate.retryAfterSeconds }
        );
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse(400, 'Request body must be valid JSON.');
    }

    // Allow "yesterday" in UTC: users ahead of/behind UTC may legitimately be on a different calendar day.
    const minStartDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const parsed = parseTripRequest(body, { minStartDate });
    if (!parsed.ok) return errorResponse(400, parsed.error);
    const tripRequest = parsed.value;

    const startedAt = Date.now();
    try {
        const text = await generateJson({
            systemInstruction: SYSTEM_INSTRUCTION,
            prompt: buildPrompt(tripRequest),
            responseJsonSchema: buildResponseSchema(tripRequest.dates.length),
            signal: request.signal,
        });
        const trip = normalizeItinerary(parseModelJson(text), tripRequest);
        console.info('[trips] generated', { days: trip.days.length, model: getModelName(), ms: Date.now() - startedAt });
        return Response.json({ success: true, trip }, { headers: NO_STORE });
    } catch (err) {
        const log = { model: getModelName(), days: tripRequest.dates.length, ms: Date.now() - startedAt };

        if (err instanceof AIServiceError && err.kind === 'client_aborted') {
            // Nobody is listening for this response; not an error worth alerting on.
            console.info('[trips] client disconnected', log);
            return errorResponse(499, 'Request cancelled.');
        }
        if (err instanceof AIServiceError) {
            console.error('[trips] AI failure', { ...log, kind: err.kind, status: err.status, message: err.message });
            const [status, message] = AI_ERROR_RESPONSES[err.kind] ?? AI_ERROR_RESPONSES.upstream;
            // In local development, show the developer why (e.g. invalid key). AIServiceError
            // messages never contain key material. Production keeps the generic message.
            const shown = process.env.NODE_ENV === 'development' ? `${message} (dev: ${err.kind} — ${err.message})` : message;
            const headers = status === 429 ? { 'Retry-After': '60' } : {};
            return errorResponse(status, shown, headers, status === 429 ? { retryAfter: 60 } : {});
        }
        if (err instanceof ItineraryFormatError) {
            console.error('[trips] invalid model output', { ...log, message: err.message });
            return errorResponse(502, 'The AI returned an incomplete itinerary. Please try again.');
        }
        console.error('[trips] unexpected error', err);
        return errorResponse(500, 'An unexpected server error occurred. Please try again.');
    }
}
