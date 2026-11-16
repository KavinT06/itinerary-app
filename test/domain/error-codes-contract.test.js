// The error-code table checked value by value against LLD section 4.7, so that a status or a
// retry flag cannot drift. The existing route test compares the response to ERROR_CODES itself,
// which cannot detect a wrong entry in ERROR_CODES.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ERROR_CODES } from '../../lib/domain/error-codes.js';

// [code, HTTP status, retryable] — transcribed from LLD 4.7.
const LLD_4_7 = [
    ['VALIDATION_FAILED', 400, false],
    ['INVALID_JSON', 400, false],
    ['FORBIDDEN_ORIGIN', 403, false],
    ['PAYLOAD_TOO_LARGE', 413, false],
    ['UNSUPPORTED_MEDIA_TYPE', 415, false],
    ['RATE_LIMITED', 429, true],
    ['AI_BUSY', 503, true],
    ['AI_QUOTA_EXHAUSTED', 503, false],
    ['AI_UNAVAILABLE', 502, true],
    ['AI_TIMEOUT', 504, true],
    ['AI_INVALID_RESPONSE', 502, true],
    ['AI_REFUSED', 422, false],
    ['SERVICE_UNAVAILABLE', 503, false],
    ['CLIENT_CLOSED', 499, false],
    ['INTERNAL', 500, true],
];

test('every code in LLD 4.7 exists with the specified HTTP status and retryable flag, and there are no others', () => {
    assert.deepEqual(Object.keys(ERROR_CODES).sort(), LLD_4_7.map(([code]) => code).sort());
    for (const [code, status, retryable] of LLD_4_7) {
        assert.equal(ERROR_CODES[code].status, status, `${code} status`);
        assert.equal(ERROR_CODES[code].retryable, retryable, `${code} retryable`);
    }
});

test('the fixed messages that LLD 4.7 quotes verbatim are used verbatim', () => {
    const verbatim = {
        INVALID_JSON: 'Request body must be valid JSON.',
        FORBIDDEN_ORIGIN: 'Cross-site requests are not allowed.',
        PAYLOAD_TOO_LARGE: 'Request is too large.',
        UNSUPPORTED_MEDIA_TYPE: 'Content-Type must be application/json.',
        AI_QUOTA_EXHAUSTED: "We've reached today's limit for new itineraries. Please come back later.",
        AI_UNAVAILABLE: 'The AI service is temporarily unavailable. Please try again in a moment.',
        AI_TIMEOUT: 'Generating your itinerary took too long. Please try again, or plan a shorter trip.',
        AI_INVALID_RESPONSE: 'The AI returned an incomplete itinerary. Please try again.',
        AI_REFUSED: "We couldn't create an itinerary for that destination. Please check it and try again.",
        SERVICE_UNAVAILABLE: 'The itinerary service is not available right now. Please try again later.',
        INTERNAL: 'An unexpected error occurred. Please try again.',
    };
    for (const [code, message] of Object.entries(verbatim)) assert.equal(ERROR_CODES[code].message, message, code);
});
