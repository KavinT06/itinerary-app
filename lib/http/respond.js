// Turns use-case results and errors into HTTP responses, and writes the one log line
// each request produces. The response contract is in docs/architecture/LLD.md section 5.

import 'server-only';
import { AppError } from '../application/errors.js';

const baseHeaders = (ctx) => ({ 'Cache-Control': 'no-store', 'X-Request-Id': ctx.requestId });

/** Fields safe to log: metadata only. Never the destination, the name, headers or model output. */
function logFields(ctx, status, meta = {}, now = Date.now) {
    return {
        requestId: ctx.requestId,
        route: ctx.route,
        status,
        durationMs: now() - ctx.startedAt,
        cache: meta.cache ?? null,
        days: meta.days ?? null,
        provider: meta.provider ?? null,
        model: meta.model ?? null,
        attempts: meta.attempts ?? 0,
        inputTokens: meta.inputTokens ?? null,
        outputTokens: meta.outputTokens ?? null,
        recovered: meta.recovered ?? false,
    };
}

export function respondOk(ctx, logger, { trip, meta }) {
    logger.info('trip_request', { ...logFields(ctx, 200, meta), code: null, providerKind: null });
    return Response.json(
        { success: true, trip, requestId: ctx.requestId, cache: meta.cache },
        { headers: baseHeaders(ctx) },
    );
}

/**
 * @param {object} [options]
 * @param {boolean} [options.showCause] local development only: append the internal cause to the message
 */
export function respondError(ctx, logger, err, { showCause = false } = {}) {
    const error = err instanceof AppError ? err : new AppError('INTERNAL', { cause: err });
    const fields = { ...logFields(ctx, error.status, error.meta), code: error.code, providerKind: error.providerKind ?? null };

    if (error.code === 'INTERNAL') {
        // The only place an unexpected error is recorded. Name and stack, never request data.
        // The first stack line repeats the message, which could contain request or provider text.
        const frames = String(error.cause?.stack ?? '').split('\n').slice(1).join('\n').slice(0, 1500);
        logger.error('trip_request', { ...fields, errorName: error.cause?.name, stack: frames });
    } else if (error.status >= 500) {
        logger.error('trip_request', fields);
    } else {
        logger.info('trip_request', fields);
    }

    const body = {
        error: showCause && error.providerKind ? `${error.message} (dev: ${error.providerKind})` : error.message,
        code: error.code,
        retryable: error.retryable,
        requestId: ctx.requestId,
    };
    const headers = baseHeaders(ctx);
    if (error.retryAfterSeconds) {
        body.retryAfter = error.retryAfterSeconds;
        headers['Retry-After'] = String(error.retryAfterSeconds);
    }
    if (error.field) body.field = error.field;
    return Response.json(body, { status: error.status, headers });
}
