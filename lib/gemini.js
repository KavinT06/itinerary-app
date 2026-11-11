// Server-only adapter around the Google Gen AI SDK (Gemini Developer API).
// Converts SDK/HTTP failures into AIServiceError with a small set of `kind`s that
// the API route maps to HTTP responses. Never import this from client components.

import 'server-only';
import { GoogleGenAI, ApiError } from '@google/genai';

// Verified live 2026-11-11: gemini-2.5-flash on v1beta, 2-day trip ~10s, 14-day ~31s
// (thinking off). The "gemini-flash-latest" alias hung on v1beta and is not served on v1.
// Override with GEMINI_MODEL when Google retires this model.
export const DEFAULT_MODEL = 'gemini-2.5-flash';
// v1 rejects systemInstruction ("Developer instruction is not enabled for api version v1").
const API_VERSION = 'v1beta';
const DEFAULT_TIMEOUT_MS = 50_000;
const MAX_TIMEOUT_MS = 55_000; // must stay below the route's maxDuration (60s)
const MAX_OUTPUT_TOKENS = 32_768;

const BLOCKED_FINISH_REASONS = new Set([
    'SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY',
]);

/**
 * kind: 'not_configured' | 'auth' | 'model_not_found' | 'rate_limited' | 'timeout' | 'client_aborted'
 *     | 'blocked' | 'truncated' | 'upstream'
 */
export class AIServiceError extends Error {
    constructor(kind, message, { cause, status } = {}) {
        super(message, { cause });
        this.name = 'AIServiceError';
        this.kind = kind;
        this.status = status;
    }
}

export function getModelName() {
    return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export function isAIConfigured() {
    return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function classifyError(err, model, { timeoutSignal, clientSignal }) {
    if (err instanceof AIServiceError) return err;
    // The SDK aborts with a generic AbortError regardless of the cause, so check which signal fired.
    if (timeoutSignal.aborted) {
        return new AIServiceError('timeout', 'Gemini request timed out', { cause: err });
    }
    if (clientSignal?.aborted || err?.name === 'AbortError') {
        return new AIServiceError('client_aborted', 'Client disconnected before generation finished', { cause: err });
    }
    if (err instanceof ApiError || (err?.name === 'ApiError' && typeof err.status === 'number')) {
        const { status } = err;
        const message = String(err.message || '');
        if (status === 429) return new AIServiceError('rate_limited', 'Gemini quota or rate limit exceeded', { cause: err, status });
        if (status === 401 || status === 403 || (status === 400 && /API[_ ]KEY/i.test(message))) {
            return new AIServiceError('auth', 'Gemini rejected the API key', { cause: err, status });
        }
        if (status === 404) {
            return new AIServiceError('model_not_found', `Gemini model "${model}" was not found; set GEMINI_MODEL to an available model`, { cause: err, status });
        }
        return new AIServiceError('upstream', `Gemini API error (HTTP ${status})`, { cause: err, status });
    }
    return new AIServiceError('upstream', `Could not reach Gemini: ${err?.message || err}`, { cause: err });
}

export function getTimeoutMs() {
    const configured = Number(process.env.GEMINI_TIMEOUT_MS);
    return configured > 0 ? Math.min(configured, MAX_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
}

/**
 * Requests a JSON response constrained by `responseJsonSchema` and returns the raw text.
 * `signal` (optional) cancels the upstream call, e.g. when the browser disconnects.
 * Throws AIServiceError on any failure, including blocked or truncated output.
 */
export async function generateJson({ systemInstruction, prompt, responseJsonSchema, signal }) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new AIServiceError('not_configured', 'GEMINI_API_KEY is not set');

    const model = getModelName();
    const timeoutSignal = AbortSignal.timeout(getTimeoutMs());
    const abortSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const ai = new GoogleGenAI({ apiKey, apiVersion: API_VERSION });
    // Thinking tokens cost ~40% of latency on 2.5 Flash with no visible benefit for itineraries.
    // Other families configure thinking differently, so leave them on their defaults.
    const thinkingConfig = model.startsWith('gemini-2.5-flash') ? { thinkingBudget: 0 } : undefined;

    let response;
    try {
        response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                systemInstruction,
                temperature: 0.7,
                maxOutputTokens: MAX_OUTPUT_TOKENS,
                ...(thinkingConfig && { thinkingConfig }),
                responseMimeType: 'application/json',
                responseJsonSchema,
                abortSignal,
            },
        });
    } catch (err) {
        throw classifyError(err, model, { timeoutSignal, clientSignal: signal });
    }

    const candidate = response.candidates?.[0];
    if (!candidate) {
        const reason = response.promptFeedback?.blockReason || 'no candidates returned';
        throw new AIServiceError('blocked', `Gemini returned no output (${reason})`);
    }
    if (BLOCKED_FINISH_REASONS.has(candidate.finishReason)) {
        throw new AIServiceError('blocked', `Gemini stopped generation (${candidate.finishReason})`);
    }
    if (candidate.finishReason === 'MAX_TOKENS') {
        throw new AIServiceError('truncated', 'Gemini output hit the token limit');
    }
    return response.text ?? '';
}
