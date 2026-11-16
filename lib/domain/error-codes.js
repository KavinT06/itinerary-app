// The error contract shared by the server and the browser. One table, so the two
// cannot disagree about what a code means. `message` is the safe default shown to users;
// validation errors replace it with the specific validation message.

export const ERROR_CODES = Object.freeze({
    VALIDATION_FAILED: { status: 400, retryable: false, message: 'Please check the form and try again.' },
    INVALID_JSON: { status: 400, retryable: false, message: 'Request body must be valid JSON.' },
    FORBIDDEN_ORIGIN: { status: 403, retryable: false, message: 'Cross-site requests are not allowed.' },
    PAYLOAD_TOO_LARGE: { status: 413, retryable: false, message: 'Request is too large.' },
    UNSUPPORTED_MEDIA_TYPE: { status: 415, retryable: false, message: 'Content-Type must be application/json.' },
    RATE_LIMITED: { status: 429, retryable: true, message: 'Too many requests. Please wait a moment and try again.' },
    AI_BUSY: { status: 503, retryable: true, message: 'The itinerary service is busy right now. Please try again shortly.' },
    AI_QUOTA_EXHAUSTED: { status: 503, retryable: false, message: "We've reached today's limit for new itineraries. Please come back later." },
    AI_UNAVAILABLE: { status: 502, retryable: true, message: 'The AI service is temporarily unavailable. Please try again in a moment.' },
    AI_TIMEOUT: { status: 504, retryable: true, message: 'Generating your itinerary took too long. Please try again, or plan a shorter trip.' },
    AI_INVALID_RESPONSE: { status: 502, retryable: true, message: 'The AI returned an incomplete itinerary. Please try again.' },
    AI_REFUSED: { status: 422, retryable: false, message: "We couldn't create an itinerary for that destination. Please check it and try again." },
    SERVICE_UNAVAILABLE: { status: 503, retryable: false, message: 'The itinerary service is not available right now. Please try again later.' },
    CLIENT_CLOSED: { status: 499, retryable: false, message: 'Request cancelled.' },
    INTERNAL: { status: 500, retryable: true, message: 'An unexpected error occurred. Please try again.' },
});

/** Messages that include a wait time. Kept here so server and browser wording cannot drift. */
export const waitMessage = Object.freeze({
    RATE_LIMITED: (seconds) => `Too many requests. Please wait ${seconds} seconds and try again.`,
    RATE_LIMITED_DAILY: "You've reached today's limit for new itineraries. Please come back tomorrow.",
    AI_BUSY: (seconds) => `The itinerary service is busy right now. Please try again in ${seconds} seconds.`,
});

/** Codes that only the browser produces: the request never got a usable answer from the server. */
export const CLIENT_ERROR_CODES = Object.freeze({
    NETWORK: { retryable: true, message: 'Could not reach the server. Check your connection and try again.' },
});

/** True for a code this application defines. */
export function isKnownErrorCode(code) {
    return Object.hasOwn(ERROR_CODES, code);
}
