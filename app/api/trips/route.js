// POST /api/trips — HTTP adapter only. The use case is lib/application/generate-trip.js.

import { getContainer } from '../../../lib/infrastructure/container.js';
import { createLogger } from '../../../lib/infrastructure/logger.js';
import { createRequestContext, assertSameOriginJson, readJsonBody } from '../../../lib/http/request.js';
import { respondOk, respondError } from '../../../lib/http/respond.js';

export const runtime = 'nodejs';
// Must stay above the generation deadline (AI_TIMEOUT_MS, at most 55 s). See lib/infrastructure/config.js.
export const maxDuration = 60;

const fallbackLogger = createLogger();

export async function POST(request) {
    const ctx = createRequestContext(request, '/api/trips');
    let container = null;
    try {
        container = getContainer();
        assertSameOriginJson(request);
        const body = await readJsonBody(request);
        const result = await container.generateTrip(body, { clientId: ctx.clientId, signal: ctx.signal, startedAt: ctx.startedAt });
        return respondOk(ctx, container.logger, result);
    } catch (err) {
        // Even if the container cannot be built, the caller gets a coded error and one log line.
        return respondError(ctx, container?.logger ?? fallbackLogger, err, { showCause: Boolean(container?.config.isDevelopment) });
    }
}
