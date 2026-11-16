import test from 'node:test';
import assert from 'node:assert/strict';
import { requestTripItinerary, TripRequestError } from '../../lib/client/api-client.js';

const respond = (status, body, headers = {}) => async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
const failure = (fetchImpl, options) => requestTripItinerary({ destination: 'x' }, { fetchImpl, ...options }).then(() => null, (e) => e);

test('sends JSON to /api/trips and returns the trip', async () => {
    let seen;
    const trip = await requestTripItinerary({ destination: 'Paris' }, {
        fetchImpl: async (url, init) => { seen = { url, init }; return new Response(JSON.stringify({ success: true, trip: { title: 'T' } })); },
    });
    assert.deepEqual(trip, { title: 'T' });
    assert.equal(seen.url, '/api/trips');
    assert.equal(seen.init.method, 'POST');
    assert.equal(seen.init.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(seen.init.body), { destination: 'Paris' });
});

test('a coded error carries the code, message, retry information, field and request ID', async () => {
    const err = await failure(respond(429, { error: 'Too many requests. Please wait 42 seconds and try again.', code: 'RATE_LIMITED', retryable: true, retryAfter: 42, requestId: 'r-1' }, { 'Retry-After': '42' }));
    assert.ok(err instanceof TripRequestError);
    assert.deepEqual(
        { code: err.code, status: err.status, retryable: err.retryable, retryAfterSeconds: err.retryAfterSeconds, requestId: err.requestId, message: err.message },
        { code: 'RATE_LIMITED', status: 429, retryable: true, retryAfterSeconds: 42, requestId: 'r-1', message: 'Too many requests. Please wait 42 seconds and try again.' },
    );
    const invalid = await failure(respond(400, { error: 'Destination is required.', code: 'VALIDATION_FAILED', retryable: false, field: 'destination' }));
    assert.equal(invalid.field, 'destination');
    assert.equal(invalid.retryable, false);
});

test('quota exhaustion is distinguishable from a short wait', async () => {
    const quota = await failure(respond(503, { error: 'limit', code: 'AI_QUOTA_EXHAUSTED', retryable: false }));
    const busy = await failure(respond(503, { error: 'busy', code: 'AI_BUSY', retryable: true, retryAfter: 15 }));
    assert.deepEqual([quota.code, quota.retryable, quota.retryAfterSeconds], ['AI_QUOTA_EXHAUSTED', false, undefined]);
    assert.deepEqual([busy.code, busy.retryable, busy.retryAfterSeconds], ['AI_BUSY', true, 15]);
});

test('a platform error page with no JSON gets a code inferred from the status', async () => {
    const timeout = await failure(respond(504, '<html>Gateway Timeout</html>'));
    assert.equal(timeout.code, 'AI_TIMEOUT');
    assert.equal(timeout.retryable, true);
    assert.match(timeout.message, /took too long/);
    assert.equal((await failure(respond(500, 'oops'))).code, 'AI_UNAVAILABLE');
    assert.equal((await failure(respond(429, 'slow down'))).code, 'RATE_LIMITED');
});

test('an unknown code or a non-string error from the server is not trusted', async () => {
    const err = await failure(respond(502, { error: { nested: 'object' }, code: 'constructor' }));
    assert.equal(err.code, 'AI_UNAVAILABLE');
    assert.equal(typeof err.message, 'string');
});

test('a 200 without a trip is an error', async () => {
    assert.equal((await failure(respond(200, { success: true }))).code, 'INTERNAL');
});

test('a network failure is retryable; a cancelled request rethrows the abort', async () => {
    const offline = await failure(async () => { throw new TypeError('Failed to fetch'); });
    assert.equal(offline.code, 'NETWORK');
    assert.equal(offline.retryable, true);
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    assert.equal(await failure(async () => { throw abort; }), abort);
});
