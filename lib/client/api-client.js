// Browser-side client for POST /api/trips. No provider code or key reaches the browser.

import { ERROR_CODES, CLIENT_ERROR_CODES, isKnownErrorCode } from '../domain/error-codes.js';

export class TripRequestError extends Error {
    /** @param {{code: string, status?: number, retryable?: boolean, retryAfterSeconds?: number, field?: string, requestId?: string}} details */
    constructor(message, { code, status, retryable, retryAfterSeconds, field, requestId }) {
        super(message);
        this.name = 'TripRequestError';
        this.code = code;
        this.status = status;
        this.retryable = retryable ?? false;
        this.retryAfterSeconds = retryAfterSeconds;
        this.field = field;
        this.requestId = requestId;
    }
}

/** Platform error pages (for example a gateway timeout) carry no code; infer one from the status. */
function codeForStatus(status) {
    if (status === 504 || status === 408) return 'AI_TIMEOUT';
    if (status === 429) return 'RATE_LIMITED';
    if (status === 413) return 'PAYLOAD_TOO_LARGE';
    return status >= 500 ? 'AI_UNAVAILABLE' : 'INTERNAL';
}

/** @returns {Promise<object>} the generated trip */
export async function requestTripItinerary(payload, { signal, fetchImpl = globalThis.fetch } = {}) {
    let response;
    try {
        response = await fetchImpl('/api/trips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal,
        });
    } catch (err) {
        if (err?.name === 'AbortError') throw err;
        throw new TripRequestError(CLIENT_ERROR_CODES.NETWORK.message, { code: 'NETWORK', retryable: CLIENT_ERROR_CODES.NETWORK.retryable });
    }

    let data = null;
    try {
        data = await response.json();
    } catch (err) {
        if (err?.name === 'AbortError') throw err;
    }

    if (response.ok && data?.trip) return data.trip;

    const code = isKnownErrorCode(data?.code) ? data.code : codeForStatus(response.status);
    const retryAfterSeconds = Number(response.headers.get('Retry-After')) || Number(data?.retryAfter) || undefined;
    throw new TripRequestError(typeof data?.error === 'string' ? data.error : ERROR_CODES[code].message, {
        code,
        status: response.status,
        retryable: typeof data?.retryable === 'boolean' ? data.retryable : ERROR_CODES[code].retryable,
        retryAfterSeconds,
        field: typeof data?.field === 'string' ? data.field : undefined,
        requestId: typeof data?.requestId === 'string' ? data.requestId : undefined,
    });
}
