// Error types. AIProviderError is thrown by provider adapters and never leaves the
// application layer. AppError is what use cases throw and the HTTP layer renders.

import { ERROR_CODES, waitMessage } from '../domain/error-codes.js';

/**
 * kind: not_configured | auth | model_not_found | invalid_request | context_length | rate_limited
 *     | quota_exhausted | unavailable | connection | timeout | aborted | truncated | invalid_output | refused
 */
export class AIProviderError extends Error {
    /**
     * @param {object} [options]
     * @param {boolean} [options.generated] the provider produced (and charged for) output before failing
     * @param {{inputTokens: number|null, outputTokens: number|null, totalTokens: number|null} | null} [options.usage]
     *        provider-reported usage for that output, when the provider reported it
     */
    constructor(kind, message, { status, retryAfterSeconds, cause, generated = false, usage = null } = {}) {
        super(message, { cause });
        this.name = 'AIProviderError';
        this.kind = kind;
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;
        this.generated = generated;
        this.usage = usage;
    }
}

export class AppError extends Error {
    /**
     * @param {keyof typeof ERROR_CODES} code
     * @param {object} [options]
     * @param {string} [options.message] overrides the code's default user-facing message
     * @param {number} [options.retryAfterSeconds]
     * @param {string} [options.field] request field at fault, for validation errors
     * @param {string} [options.providerKind] underlying AIProviderError.kind, for logs only
     * @param {unknown} [options.cause]
     */
    constructor(code, { message, retryAfterSeconds, field, providerKind, cause } = {}) {
        super(message ?? ERROR_CODES[code].message, { cause });
        this.name = 'AppError';
        this.code = code;
        this.status = ERROR_CODES[code].status;
        this.retryable = ERROR_CODES[code].retryable;
        this.retryAfterSeconds = retryAfterSeconds;
        this.field = field;
        this.providerKind = providerKind;
        /** Request metadata for the log line; filled in by the use case. */
        this.meta = {};
    }

    /**
     * A copy for one caller. Requests that join a shared generation receive the same error,
     * and each must attach its own log metadata without overwriting the others'.
     */
    forCaller(meta) {
        const copy = new AppError(this.code, {
            message: this.message, retryAfterSeconds: this.retryAfterSeconds, field: this.field,
            providerKind: this.providerKind, cause: this.cause,
        });
        copy.meta = meta;
        return copy;
    }
}

const KIND_TO_CODE = Object.freeze({
    not_configured: 'SERVICE_UNAVAILABLE',
    auth: 'SERVICE_UNAVAILABLE',
    model_not_found: 'SERVICE_UNAVAILABLE',
    invalid_request: 'SERVICE_UNAVAILABLE',
    context_length: 'SERVICE_UNAVAILABLE',
    rate_limited: 'AI_BUSY',
    quota_exhausted: 'AI_QUOTA_EXHAUSTED',
    unavailable: 'AI_UNAVAILABLE',
    connection: 'AI_UNAVAILABLE',
    timeout: 'AI_TIMEOUT',
    aborted: 'CLIENT_CLOSED',
    truncated: 'AI_INVALID_RESPONSE',
    invalid_output: 'AI_INVALID_RESPONSE',
    refused: 'AI_REFUSED',
});

/** Maps a provider failure to the application error the user sees. */
export function appErrorFromProvider(err) {
    const code = KIND_TO_CODE[err.kind] ?? 'AI_UNAVAILABLE';
    let message;
    if (code === 'AI_BUSY' && err.retryAfterSeconds) {
        message = waitMessage.AI_BUSY(err.retryAfterSeconds);
    }
    return new AppError(code, {
        message,
        retryAfterSeconds: code === 'AI_BUSY' ? err.retryAfterSeconds : undefined,
        providerKind: err.kind,
        cause: err,
    });
}
