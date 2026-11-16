import test from 'node:test';
import assert from 'node:assert/strict';
import { AIProviderError, AppError } from '../../lib/application/errors.js';
import { buildUseCase, fakeProvider, modelOutput, tripBody, daysFromNow } from '../fixtures.js';

const good = (request) => {
    const dates = /in order: (.*)$/m.exec(request.prompt)[1].split(', ');
    return modelOutput(dates[0], dates.length);
};
const ctx = (clientId = 'client-a', signal) => ({ clientId, signal });
const rejectsWith = async (promise, code) => {
    const err = await promise.then(() => null, (e) => e);
    assert.ok(err instanceof AppError, `expected AppError, got ${err}`);
    assert.equal(err.code, code);
    return err;
};

test('generates a trip: request fields are authoritative and the name never reaches the provider', async () => {
    const provider = fakeProvider([good]);
    const { generateTrip } = buildUseCase({ provider });
    const body = tripBody({ createdBy: 'Asha Traveller' });
    const { trip, meta } = await generateTrip(body, ctx());

    assert.equal(trip.destination, body.destination);
    assert.equal(trip.createdBy, 'Asha Traveller');
    assert.equal(trip.startDate, body.startDate);
    assert.equal(trip.days.length, 2);
    assert.ok(Date.parse(trip.generatedAt));
    assert.equal(meta.cache, 'miss');
    assert.equal(meta.attempts, 1);
    assert.equal(meta.outputTokens, 1500);

    const sent = JSON.stringify(provider.calls[0]);
    assert.equal(sent.includes('Asha'), false);
    assert.ok(provider.calls[0].prompt.includes(JSON.stringify(body.destination)));
    assert.equal(provider.calls[0].maxOutputTokens, 1000 + 600 * 2);
});

test('invalid input is rejected before any limit or provider call', async () => {
    const provider = fakeProvider([good]);
    const { generateTrip } = buildUseCase({ provider });
    const cases = [
        [tripBody({ destination: '' }), 'destination'],
        [tripBody({ startDate: daysFromNow(-3), endDate: daysFromNow(-2) }), 'startDate'],
        [tripBody({ endDate: daysFromNow(40) }), 'endDate'],
        [tripBody({ startDate: daysFromNow(900), endDate: daysFromNow(901) }), 'startDate'],
        ['not an object', 'body'],
    ];
    for (const [body, field] of cases) {
        const err = await rejectsWith(generateTrip(body, ctx()), 'VALIDATION_FAILED');
        assert.equal(err.field, field);
    }
    assert.equal(provider.calls.length, 0);
    // Validation failures do not consume the client's allowance.
    assert.equal((await generateTrip(tripBody(), ctx())).meta.cache, 'miss');
});

test('an identical request is served from the cache with the new caller\'s name', async () => {
    const provider = fakeProvider([good]);
    const { generateTrip } = buildUseCase({ provider });
    const first = await generateTrip(tripBody({ createdBy: 'Asha' }), ctx('a'));
    const second = await generateTrip(tripBody({ createdBy: 'Ravi', destination: '  FORT kochi,   Kochi, India ' }), ctx('b'));

    assert.equal(provider.calls.length, 1);
    assert.equal(second.meta.cache, 'hit');
    assert.equal(second.trip.createdBy, 'Ravi');
    assert.equal(second.trip.destination, 'FORT kochi, Kochi, India');
    assert.deepEqual(second.trip.days, first.trip.days);
    assert.equal(second.trip.generatedAt, first.trip.generatedAt);
});

test('the cache holds no personal data and different requests do not share entries', async () => {
    const provider = fakeProvider([good]);
    const { generateTrip, store } = buildUseCase({ provider });
    await generateTrip(tripBody({ createdBy: 'Asha Traveller' }), ctx());
    await generateTrip(tripBody({ destination: 'Paris, France' }), ctx());
    await generateTrip(tripBody({ endDate: daysFromNow(12) }), ctx());
    assert.equal(provider.calls.length, 3);

    const keys = [];
    const spy = { ...store, get: async (k) => { keys.push(k); return store.get(k); } };
    const again = buildUseCase({ provider, store: spy });
    await again.generateTrip(tripBody({ createdBy: 'Asha Traveller' }), ctx());
    const cacheKey = keys.find((k) => k.startsWith('trip:'));
    const stored = await store.get(cacheKey);
    assert.equal(stored.includes('Asha'), false);
    assert.equal(/Fort Kochi, Kochi, India/.test(cacheKey), false);
});

test('the cache expires after its TTL and can be switched off', async () => {
    const provider = fakeProvider([good]);
    const { generateTrip, clock } = buildUseCase({ provider, config: { cacheTtlSeconds: 60 } });
    await generateTrip(tripBody(), ctx());
    clock.now += 61_000;
    assert.equal((await generateTrip(tripBody(), ctx())).meta.cache, 'miss');

    const off = buildUseCase({ provider: fakeProvider([good]), config: { cacheTtlSeconds: 0 } });
    await off.generateTrip(tripBody(), ctx());
    assert.equal((await off.generateTrip(tripBody(), ctx())).meta.cache, 'miss');
});

test('concurrent identical requests share one generation', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const provider = fakeProvider([async (request) => { await gate; return good(request); }]);
    const { generateTrip, usage } = buildUseCase({ provider });

    const a = generateTrip(tripBody({ createdBy: 'Asha' }), ctx('a'));
    const b = generateTrip(tripBody({ createdBy: 'Ravi' }), ctx('b'));
    await new Promise((resolve) => setImmediate(resolve));
    release();
    const [ra, rb] = await Promise.all([a, b]);

    assert.equal(provider.calls.length, 1);
    assert.deepEqual([ra.meta.cache, rb.meta.cache].sort(), ['joined', 'miss']);
    assert.equal(ra.trip.createdBy, 'Asha');
    assert.equal(rb.trip.createdBy, 'Ravi');
    const counters = await usage.read(new Date().toISOString().slice(0, 10));
    assert.equal(counters.generated, 1);
    assert.equal(counters.joined, 1);
});

test('a caller who leaves gets CLIENT_CLOSED; the generation stops only when nobody is waiting', async () => {
    let release;
    let providerSignal;
    const gate = new Promise((resolve) => { release = resolve; });
    const provider = fakeProvider([async (request) => { providerSignal = request.signal; await gate; return good(request); }]);
    const { generateTrip } = buildUseCase({ provider });

    const leaving = new AbortController();
    const a = generateTrip(tripBody(), ctx('a', leaving.signal));
    const b = generateTrip(tripBody(), ctx('b'));
    await new Promise((resolve) => setImmediate(resolve));
    leaving.abort();
    await rejectsWith(a, 'CLIENT_CLOSED');
    assert.equal(providerSignal.aborted, false); // b is still waiting
    release();
    assert.equal((await b).trip.days.length, 2);

    // Alone and leaving: the provider call is cancelled.
    let release2;
    let signal2;
    const gate2 = new Promise((resolve) => { release2 = resolve; });
    const solo = buildUseCase({ provider: fakeProvider([async (request) => { signal2 = request.signal; await gate2; return good(request); }]) });
    const only = new AbortController();
    const c = solo.generateTrip(tripBody(), ctx('c', only.signal));
    await new Promise((resolve) => setImmediate(resolve));
    only.abort();
    await rejectsWith(c, 'CLIENT_CLOSED');
    assert.equal(signal2.aborted, true);
    release2();
});

test('per-client limit: the sixth request in a minute is refused with a wait, other clients are unaffected', async () => {
    const provider = fakeProvider([good]);
    const { generateTrip, clock } = buildUseCase({ provider });
    for (let i = 0; i < 5; i += 1) await generateTrip(tripBody(), ctx('busy'));
    const err = await rejectsWith(generateTrip(tripBody(), ctx('busy')), 'RATE_LIMITED');
    assert.ok(err.retryAfterSeconds >= 1 && err.retryAfterSeconds <= 60);
    assert.equal(err.status, 429);
    assert.equal((await generateTrip(tripBody(), ctx('other'))).meta.cache, 'hit');
    clock.now += 61_000;
    assert.equal((await generateTrip(tripBody(), ctx('busy'))).meta.cache, 'hit');
});

test('per-client daily limit', async () => {
    const { generateTrip, clock } = buildUseCase({ provider: fakeProvider([good]), clientLimits: { perMinute: 100, perDay: 3 } });
    for (let i = 0; i < 3; i += 1) await generateTrip(tripBody(), ctx('daily'));
    const err = await rejectsWith(generateTrip(tripBody(), ctx('daily')), 'RATE_LIMITED');
    assert.match(err.message, /today/i);
    clock.now += 61_000;
    await rejectsWith(generateTrip(tripBody(), ctx('daily')), 'RATE_LIMITED');
});

test('the global daily budget stops generation without calling the provider, but cache hits still work', async () => {
    const provider = fakeProvider([good]);
    const { generateTrip } = buildUseCase({ provider, budget: { dailyRequests: 2 } });
    await generateTrip(tripBody({ destination: 'A' }), ctx('a'));
    await generateTrip(tripBody({ destination: 'B' }), ctx('b'));
    const err = await rejectsWith(generateTrip(tripBody({ destination: 'C' }), ctx('c')), 'AI_QUOTA_EXHAUSTED');
    assert.equal(err.status, 503);
    assert.equal(err.retryable, false);
    assert.equal(provider.calls.length, 2);
    assert.equal((await generateTrip(tripBody({ destination: 'A' }), ctx('d'))).meta.cache, 'hit');

    const tokens = buildUseCase({ provider: fakeProvider([good]), budget: { dailyTokens: 2000 } });
    await tokens.generateTrip(tripBody({ destination: 'A' }), ctx('a')); // 2,100 tokens reported
    await rejectsWith(tokens.generateTrip(tripBody({ destination: 'B' }), ctx('b')), 'AI_QUOTA_EXHAUSTED');
});

test('a transient provider failure is retried once and then succeeds', async () => {
    for (const kind of ['unavailable', 'connection', 'invalid_output']) {
        const provider = fakeProvider([new AIProviderError(kind, 'x'), good]);
        const { generateTrip, sleeps } = buildUseCase({ provider });
        const { meta } = await generateTrip(tripBody(), ctx());
        assert.equal(provider.calls.length, 2, kind);
        assert.equal(meta.attempts, 2);
        assert.equal(sleeps.length, 1);
        assert.ok(sleeps[0] <= 4000);
    }
});

test('retries stop after two attempts', async () => {
    const provider = fakeProvider([new AIProviderError('unavailable', 'x')]);
    const { generateTrip } = buildUseCase({ provider });
    const err = await rejectsWith(generateTrip(tripBody(), ctx()), 'AI_UNAVAILABLE');
    assert.equal(provider.calls.length, 2);
    assert.equal(err.providerKind, 'unavailable');
    assert.equal(err.meta.attempts, 2);
});

test('a provider per-minute limit waits for the stated interval, then retries', async () => {
    const provider = fakeProvider([new AIProviderError('rate_limited', 'x', { retryAfterSeconds: 15 }), good]);
    const { generateTrip, sleeps } = buildUseCase({ provider });
    await generateTrip(tripBody(), ctx());
    assert.deepEqual(sleeps, [15_500]);
});

test('a provider limit that is still in force after the wait becomes AI_BUSY with the countdown', async () => {
    const provider = fakeProvider([new AIProviderError('rate_limited', 'x', { retryAfterSeconds: 14 })]);
    const { generateTrip } = buildUseCase({ provider });
    const err = await rejectsWith(generateTrip(tripBody(), ctx()), 'AI_BUSY');
    assert.equal(err.status, 503);
    assert.equal(err.retryAfterSeconds, 14);
    assert.equal(provider.calls.length, 2);
});

test('a wait too long for the deadline is not attempted', async () => {
    const provider = fakeProvider([new AIProviderError('rate_limited', 'x', { retryAfterSeconds: 45 })]);
    const { generateTrip, sleeps } = buildUseCase({ provider });
    await rejectsWith(generateTrip(tripBody(), ctx()), 'AI_BUSY');
    assert.equal(provider.calls.length, 1);
    assert.deepEqual(sleeps, []);
});

test('failures that a retry cannot fix are not retried', async () => {
    const cases = [
        ['auth', 'SERVICE_UNAVAILABLE'], ['model_not_found', 'SERVICE_UNAVAILABLE'], ['invalid_request', 'SERVICE_UNAVAILABLE'],
        ['context_length', 'SERVICE_UNAVAILABLE'], ['timeout', 'AI_TIMEOUT'], ['truncated', 'AI_INVALID_RESPONSE'],
        ['refused', 'AI_REFUSED'], ['quota_exhausted', 'AI_QUOTA_EXHAUSTED'],
    ];
    for (const [kind, code] of cases) {
        const provider = fakeProvider([new AIProviderError(kind, 'internal detail')]);
        const { generateTrip } = buildUseCase({ provider });
        const err = await rejectsWith(generateTrip(tripBody(), ctx()), code);
        assert.equal(provider.calls.length, 1, kind);
        assert.equal(err.message.includes('internal detail'), false);
    }
});

test('quota exhaustion opens the circuit: later requests fail fast without calling the provider', async () => {
    const provider = fakeProvider([new AIProviderError('quota_exhausted', 'x', { retryAfterSeconds: 1200 })]);
    const { generateTrip, clock } = buildUseCase({ provider });
    await rejectsWith(generateTrip(tripBody({ destination: 'A' }), ctx('a')), 'AI_QUOTA_EXHAUSTED');
    await rejectsWith(generateTrip(tripBody({ destination: 'B' }), ctx('b')), 'AI_QUOTA_EXHAUSTED');
    assert.equal(provider.calls.length, 1);
    clock.now += 1201_000;
    await rejectsWith(generateTrip(tripBody({ destination: 'C' }), ctx('c')), 'AI_QUOTA_EXHAUSTED');
    assert.equal(provider.calls.length, 2); // circuit closed again, provider asked again
});

test('model output that fails validation is retried once, then reported as an invalid response', async () => {
    const wrongCount = (request) => ({ ...good(request), days: good(request).days.slice(0, 1) });
    const recovering = fakeProvider([wrongCount, good]);
    const ok = buildUseCase({ provider: recovering });
    assert.equal((await ok.generateTrip(tripBody(), ctx())).trip.days.length, 2);
    assert.equal(recovering.calls.length, 2);

    const failing = fakeProvider([wrongCount]);
    const bad = buildUseCase({ provider: failing });
    const err = await rejectsWith(bad.generateTrip(tripBody(), ctx()), 'AI_INVALID_RESPONSE');
    assert.equal(err.providerKind, 'validation:day_count');
    assert.equal(failing.calls.length, 2);
    // A failed generation is never cached.
    await rejectsWith(bad.generateTrip(tripBody(), ctx()), 'AI_INVALID_RESPONSE');
    assert.equal(failing.calls.length, 4);
});

test('with no provider configured the request fails clearly', async () => {
    const { generateTrip } = buildUseCase({ provider: null });
    const err = await rejectsWith(generateTrip(tripBody(), ctx()), 'SERVICE_UNAVAILABLE');
    assert.equal(err.providerKind, 'not_configured');
});

test('an unexpected bug becomes INTERNAL', async () => {
    const provider = fakeProvider([new TypeError('boom')]);
    const { generateTrip } = buildUseCase({ provider });
    await rejectsWith(generateTrip(tripBody(), ctx()), 'INTERNAL');
});

test('a store that fails on every operation does not stop generation', async () => {
    const broken = {
        get: async () => { throw new Error('store down'); },
        set: async () => { throw new Error('store down'); },
        incr: async () => { throw new Error('store down'); },
        ping: async () => { throw new Error('store down'); },
    };
    const { createResilientStore } = await import('../../lib/infrastructure/store/resilient-store.js');
    const { createMemoryStore } = await import('../../lib/infrastructure/store/memory-store.js');
    const events = [];
    const store = createResilientStore({ primary: broken, fallback: createMemoryStore(), onDegraded: (e, f) => events.push(f.operation) });
    const provider = fakeProvider([good]);
    const { generateTrip } = buildUseCase({ provider, store });
    assert.equal((await generateTrip(tripBody(), ctx())).trip.days.length, 2);
    // The memory fallback still caches and still limits.
    assert.equal((await generateTrip(tripBody(), ctx())).meta.cache, 'hit');
    // The first failure is reported; later operations skip the failing store instead of waiting on it.
    assert.deepEqual(events, ['incr']);
    assert.equal(store.isDegraded(), true);
});

test('usage counters record requests, tokens, cache hits, retries and errors', async () => {
    const provider = fakeProvider([new AIProviderError('unavailable', 'x'), good]);
    const { generateTrip, usage } = buildUseCase({ provider });
    await generateTrip(tripBody(), ctx('a'));
    await generateTrip(tripBody(), ctx('b'));
    await generateTrip(tripBody({ destination: '' }), ctx('c')).catch(() => {});
    const counters = await usage.read(new Date().toISOString().slice(0, 10), ['error:VALIDATION_FAILED']);
    assert.equal(counters.requests, 3);
    assert.equal(counters.generated, 1);
    assert.equal(counters.cache_hits, 1);
    assert.equal(counters.retries, 1);
    assert.equal(counters.output_tokens, 1500);
    assert.equal(counters.failed, 0);
    assert.equal(counters['error:VALIDATION_FAILED'], 1);
});
