// Browser-side client for POST /api/trips. The Gemini key never reaches the browser.

export class TripRequestError extends Error {
    constructor(message, { status, retryAfterSeconds } = {}) {
        super(message);
        this.name = 'TripRequestError';
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

function fallbackMessage(status) {
    if (status === 504) return 'The request timed out. Please try again, or plan a shorter trip.';
    if (status === 429) return 'Too many requests. Please wait a minute and try again.';
    return `Something went wrong (HTTP ${status}). Please try again.`;
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
        throw new TripRequestError('Could not reach the server. Check your connection and try again.');
    }

    // Platform error pages (e.g. a gateway timeout) are not JSON.
    let data = null;
    try {
        data = await response.json();
    } catch (err) {
        if (err?.name === 'AbortError') throw err;
        data = null;
    }

    if (!response.ok || !data?.trip) {
        const retryAfterSeconds =
            Number(response.headers.get('Retry-After')) || Number(data?.retryAfter) || undefined;
        throw new TripRequestError(data?.error || fallbackMessage(response.status), {
            status: response.status,
            retryAfterSeconds,
        });
    }
    return data.trip;
}
