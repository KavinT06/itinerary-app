// Independent verification of the trip use case against LLD 4.2 (step order), 4.5 (limits),
// 4.6 (retry table), 4.7 (codes) and HLD 8.4 / 9 (provider limits, store outages).
// Fakes, per LLD 9: scripted provider, injected clock and sleep, memory store.

import test from 'node:test';
import assert from 'node:assert/strict';
import { AIProviderError, AppError } from '../../lib/application/errors.js';
import { createMemoryStore } from '../../lib/infrastructure/store/memory-store.js';
import { createResilientStore } from '../../lib/infrastructure/store/resilient-store.js';
import { buildUseCase, fakeProvider, modelOutput, tripBody, daysFromNow } from '../fixtures.js';

const good = (request) => {
    const dates = /in order: (.*)$/m.exec(request.prompt)[1].split(', ');
    return modelOutput(dates[0], dates.length);
};
const oneDay = (request) => ({ ...good(request), days: good(request).days.slice(0, 1) });
const ctx = (clientId, signal) => ({ clientId, signal });
const failure = (promise) => promise.then(() => assert.fail('expected the request to fail'), (e) => e);
const rejectsWith = async (promise, code) => {
    const err = await failure(promise);
    assert.ok(err instanceof AppError, `expected AppError, got ${err}`);
    assert.equal(err.code, code);
    return err;
};
const utcDate = (ms) => new Date(ms).toISOString().slice(0, 10);
const counter = async (store, prefix, clock) => Number(await store.get(`${prefix}:${utcDate(clock.now)}`)) || 0;
const quota = (retryAfterSeconds) => new AIProviderError('quota_exhausted', 'daily', { status: 429, retryAfterSeconds });
const perMinute = (retryAfterSeconds) => new AIProviderError('rate_limited', 'tpm', { status: 429, retryAfterSeconds });

// ---- Provider circuit (LLD 4.2 steps 3 and 5) ----

test('circuit: a stated retry interval shorter than one minute still keeps the circuit open for one minute', async () => {
    const provider = fakeProvider([quota(5), good]);
    const { generateTrip, clock } = buildUseCase({ provider });
    await rejectsWith(generateTrip(tripBody({ destination: 'A' }), ctx('c1')), 'AI_QUOTA_EXHAUSTED');
    clock.now += 30_000;
    await rejectsWith(generateTrip(tripBody({ destination: 'B' }), ctx('c2')), 'AI_QUOTA_EXHAUSTED');
    assert.equal(provider.calls.length, 1, 'circuit must still be open 30 s after a 5 s retry-after');
    clock.now += 31_000; // 61 s after the refusal
    await generateTrip(tripBody({ destination: 'C' }), ctx('c3'));
    assert.equal(provider.calls.length, 2);
});

test('circuit: a stated retry interval longer than one hour is capped at one hour', async () => {
    const provider = fakeProvider([quota(7200), good]);
    const { generateTrip, clock } = buildUseCase({ provider });
    await rejectsWith(generateTrip(tripBody({ destination: 'A' }), ctx('c1')), 'AI_QUOTA_EXHAUSTED');
    clock.now += 3_599_000;
    await rejectsWith(generateTrip(tripBody({ destination: 'B' }), ctx('c2')), 'AI_QUOTA_EXHAUSTED');
    assert.equal(provider.calls.length, 1);
    clock.now += 2_000; // 3,601 s after the refusal
    assert.equal((await generateTrip(tripBody({ destination: 'C' }), ctx('c3'))).meta.cache, 'miss');
    assert.equal(provider.calls.length, 2);
});

test('circuit: the cache is consulted before the circuit, so a cached trip is still served while it is open', async () => {
    const provider = fakeProvider([good, quota(1200)]);
    const { generateTrip } = buildUseCase({ provider });
    await generateTrip(tripBody({ destination: 'A' }), ctx('c1'));
    await rejectsWith(generateTrip(tripBody({ destination: 'B' }), ctx('c2')), 'AI_QUOTA_EXHAUSTED');
    const { meta } = await generateTrip(tripBody({ destination: 'A' }), ctx('c3'));
    assert.equal(meta.cache, 'hit');
    assert.equal(provider.calls.length, 2);
});

test('circuit: AI_QUOTA_EXHAUSTED is 503, not retryable, and carries no countdown', async () => {
    const provider = fakeProvider([quota(1200)]);
    const { generateTrip } = buildUseCase({ provider });
    const fromProvider = await rejectsWith(generateTrip(tripBody({ destination: 'A' }), ctx('c1')), 'AI_QUOTA_EXHAUSTED');
    const fromCircuit = await rejectsWith(generateTrip(tripBody({ destination: 'B' }), ctx('c2')), 'AI_QUOTA_EXHAUSTED');
    for (const err of [fromProvider, fromCircuit]) {
        assert.equal(err.status, 503);
        assert.equal(err.retryable, false);
        assert.equal(err.retryAfterSeconds, undefined);
    }
});

// ---- Per-client limits (LLD 4.5) ----

test('RATE_LIMITED: Retry-After runs exactly to the end of the current minute window, and the message states it', async () => {
    const clock = { now: Math.floor(Date.now() / 60_000) * 60_000 + 18_000 }; // 18 s into a minute
    const { generateTrip } = buildUseCase({ provider: fakeProvider([good]), clock });
    for (let i = 0; i < 5; i += 1) await generateTrip(tripBody(), ctx('window'));
    const err = await rejectsWith(generateTrip(tripBody(), ctx('window')), 'RATE_LIMITED');
    assert.equal(err.retryAfterSeconds, 42);
    assert.equal(err.status, 429);
    assert.equal(err.retryable, true);
    assert.match(err.message, /\b42 seconds\b/);
});

// ---- Global counters (LLD 4.5) ----

test('tokens of generations that fail validation are still counted, since the provider charged them', async () => {
    const provider = fakeProvider([oneDay]); // the fake reports 2,100 total tokens per call
    const { generateTrip, store, clock } = buildUseCase({ provider });
    await rejectsWith(generateTrip(tripBody(), ctx('c1')), 'AI_INVALID_RESPONSE');
    assert.equal(provider.calls.length, 2);
    assert.equal(await counter(store, 'tok:d', clock), 4200);
    assert.equal(await counter(store, 'gen:d', clock), 2);
});

test('a provider 429 refusal is not a generation; cache hits and joined requests cost nothing', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const provider = fakeProvider([perMinute(15), good, async (request) => { await gate; return good(request); }]);
    const { generateTrip, store, clock } = buildUseCase({ provider });

    await generateTrip(tripBody(), ctx('c1')); // refused once, then generated
    assert.equal(await counter(store, 'gen:d', clock), 1);
    assert.equal(await counter(store, 'tok:d', clock), 2100);

    assert.equal((await generateTrip(tripBody(), ctx('c2'))).meta.cache, 'hit');
    const a = generateTrip(tripBody({ destination: 'Joined place' }), ctx('c3'));
    const b = generateTrip(tripBody({ destination: 'Joined place' }), ctx('c4'));
    await new Promise((resolve) => setImmediate(resolve));
    release();
    const caches = (await Promise.all([a, b])).map((r) => r.meta.cache).sort();
    assert.deepEqual(caches, ['joined', 'miss']);
    assert.equal(await counter(store, 'gen:d', clock), 2, 'one per real generation only');
    assert.equal(provider.calls.length, 3);
});

// ---- Retry table (LLD 4.6, HLD 8.4/8.5) ----

test('per-minute 429 with a wait that leaves time for a full generation inside the deadline is waited out and retried', async () => {
    // retry-after 31 s against the 50 s deadline leaves 19 s; the longest measured generation is 13 s (HLD 8.5).
    // HLD 8.4: "Once, after waiting retry-after, if it fits the deadline".
    const provider = fakeProvider([perMinute(31), good]);
    const { generateTrip, sleeps } = buildUseCase({ provider });
    const { meta } = await generateTrip(tripBody(), ctx('c1'));
    assert.equal(provider.calls.length, 2);
    assert.equal(meta.attempts, 2);
    assert.equal(sleeps.length, 1);
    assert.ok(sleeps[0] >= 31_000, `waited ${sleeps[0]} ms`);
});

test('per-minute 429 refused a second time: AI_BUSY, 503, retryable, with the latest interval as countdown and in the message', async () => {
    const provider = fakeProvider([perMinute(15), perMinute(12)]);
    const { generateTrip, sleeps } = buildUseCase({ provider });
    const err = await rejectsWith(generateTrip(tripBody(), ctx('c1')), 'AI_BUSY');
    assert.equal(provider.calls.length, 2);
    assert.equal(sleeps.length, 1);
    assert.equal(err.status, 503);
    assert.equal(err.retryable, true);
    assert.equal(err.retryAfterSeconds, 12);
    assert.match(err.message, /\b12 seconds\b/);
    assert.equal(err.providerKind, 'rate_limited');
});

test('aborted from the provider is never retried and becomes CLIENT_CLOSED', async () => {
    const provider = fakeProvider([new AIProviderError('aborted', 'x'), good]);
    const { generateTrip } = buildUseCase({ provider });
    const err = await rejectsWith(generateTrip(tripBody(), ctx('c1')), 'CLIENT_CLOSED');
    assert.equal(err.status, 499);
    assert.equal(provider.calls.length, 1);
});

test('a 14-day request answered with one day: retried once, then AI_INVALID_RESPONSE; nothing is cached', async () => {
    const provider = fakeProvider([oneDay]);
    const { generateTrip } = buildUseCase({ provider });
    const body = tripBody({ startDate: daysFromNow(10), endDate: daysFromNow(23) });
    const err = await rejectsWith(generateTrip(body, ctx('c1')), 'AI_INVALID_RESPONSE');
    assert.equal(err.status, 502);
    assert.equal(err.retryable, true);
    assert.equal(err.providerKind, 'validation:day_count');
    assert.equal(provider.calls.length, 2);
    assert.equal(provider.calls[0].maxOutputTokens, 9400); // LLD 4.3: 1,000 + 600 x 14
    await rejectsWith(generateTrip(body, ctx('c2')), 'AI_INVALID_RESPONSE');
    assert.equal(provider.calls.length, 4);
});

test('recovered output with a misspelt key or a missing field in one activity is used without a second call', async () => {
    const misspelt = (request) => {
        const data = good(request);
        const { description, ...rest } = data.days[1].activities[2];
        data.days[1].activities[2] = { ...rest, 'Mal description': description };
        return data;
    };
    const missingTitle = (request) => {
        const data = good(request);
        delete data.days[0].activities[1].title;
        return data;
    };
    for (const step of [misspelt, missingTitle]) {
        const provider = fakeProvider([step]);
        const { generateTrip, sleeps } = buildUseCase({ provider });
        const { trip, meta } = await generateTrip(tripBody(), ctx('c1'));
        assert.equal(provider.calls.length, 1);
        assert.equal(meta.attempts, 1);
        assert.deepEqual(sleeps, []);
        assert.equal(trip.days.length, 2);
    }
});

// ---- Cancellation ----

test('a request cancelled before it starts gets CLIENT_CLOSED and never reaches the provider with a live signal', async () => {
    const provider = fakeProvider([good]);
    const { generateTrip } = buildUseCase({ provider });
    const controller = new AbortController();
    controller.abort();
    const err = await rejectsWith(generateTrip(tripBody(), ctx('c1', controller.signal)), 'CLIENT_CLOSED');
    assert.equal(err.status, 499);
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(provider.calls.length <= 1);
    for (const call of provider.calls) assert.equal(call.signal.aborted, true);
});

// ---- Store outages (HLD 9 "Behaviour when the store fails") ----

/** The real memory store as the shared store, with chosen operations made to throw or hang. */
function flakyPrimary(clock) {
    const inner = createMemoryStore({ now: () => clock.now });
    const broken = new Set();
    const hanging = new Set();
    const wrap = (op) => async (...args) => {
        if (broken.has(op)) throw new Error('store down');
        if (hanging.has(op)) return new Promise(() => {});
        return inner[op](...args);
    };
    return { store: { get: wrap('get'), set: wrap('set'), incr: wrap('incr'), ping: wrap('ping') }, broken, hanging };
}
function resilient(clock) {
    const primary = flakyPrimary(clock);
    const events = [];
    const store = createResilientStore({
        primary: primary.store,
        fallback: createMemoryStore({ now: () => clock.now }),
        onDegraded: (event, fields) => events.push(`${event}:${fields.operation}`),
        timeoutMs: 5,
    });
    return { store, primary, events };
}

for (const mode of ['broken', 'hanging']) {
    test(`store ${mode} on get: the cache read is a miss and the request still succeeds`, async () => {
        const clock = { now: Date.now() };
        const { store, primary, events } = resilient(clock);
        const provider = fakeProvider([good]);
        const { generateTrip } = buildUseCase({ provider, store, clock });
        await generateTrip(tripBody(), ctx('c1')); // cached on the shared store
        primary[mode].add('get');
        const { meta } = await generateTrip(tripBody(), ctx('c2'));
        assert.equal(meta.cache, 'miss');
        assert.equal(provider.calls.length, 2);
        assert.ok(events.includes('store_degraded:get'));
    });

    test(`store ${mode} on set: the cache write is skipped and the request still succeeds`, async () => {
        const clock = { now: Date.now() };
        const { store, primary, events } = resilient(clock);
        primary[mode].add('set');
        const provider = fakeProvider([good]);
        const { generateTrip } = buildUseCase({ provider, store, clock });
        const { trip, meta } = await generateTrip(tripBody(), ctx('c1'));
        assert.equal(meta.cache, 'miss');
        assert.equal(trip.days.length, 2);
        assert.ok(events.includes('store_degraded:set'));
    });

    test(`store ${mode} on incr: per-client limits fall back to memory and still refuse the sixth request`, async () => {
        const clock = { now: Date.now() };
        const { store, primary, events } = resilient(clock);
        primary[mode].add('incr');
        const provider = fakeProvider([good]);
        const { generateTrip } = buildUseCase({ provider, store, clock });
        for (let i = 0; i < 5; i += 1) await generateTrip(tripBody(), ctx('outage'));
        const err = await rejectsWith(generateTrip(tripBody(), ctx('outage')), 'RATE_LIMITED');
        assert.equal(err.status, 429);
        assert.equal(provider.calls.length, 1);
        assert.ok(events.includes('store_degraded:incr'));
    });
}

test('store down on get after the circuit opened: the circuit read is treated as closed', async () => {
    const clock = { now: Date.now() };
    const { store, primary } = resilient(clock);
    const provider = fakeProvider([quota(1200), good]);
    const { generateTrip } = buildUseCase({ provider, store, clock });
    await rejectsWith(generateTrip(tripBody({ destination: 'A' }), ctx('c1')), 'AI_QUOTA_EXHAUSTED');
    await rejectsWith(generateTrip(tripBody({ destination: 'B' }), ctx('c2')), 'AI_QUOTA_EXHAUSTED');
    assert.equal(provider.calls.length, 1); // circuit open on the shared store
    primary.broken.add('get');
    assert.equal((await generateTrip(tripBody({ destination: 'C' }), ctx('c3'))).meta.cache, 'miss');
    assert.equal(provider.calls.length, 2);
});

test('a cache write that throws is logged and ignored (LLD 4.2 step 8)', async () => {
    const memory = createMemoryStore();
    const store = { ...memory, set: async () => { throw new Error('write refused'); } };
    const provider = fakeProvider([good]);
    const { generateTrip, logger } = buildUseCase({ provider, store });
    const { trip } = await generateTrip(tripBody(), ctx('c1'));
    assert.equal(trip.days.length, 2);
    assert.ok(logger.lines.some((l) => l.level === 'warn' && l.event === 'cache_write_failed'));
});

test('usage and budget counter writes that throw never fail the request', async () => {
    const memory = createMemoryStore();
    const store = {
        ...memory,
        incr: async (key, opts) => {
            if (/^(usage|gen|tok):/.test(key)) throw new Error('counter down');
            return memory.incr(key, opts);
        },
    };
    const provider = fakeProvider([good]);
    const { generateTrip } = buildUseCase({ provider, store });
    const { trip, meta } = await generateTrip(tripBody(), ctx('c1'));
    assert.equal(trip.days.length, 2);
    assert.equal(meta.cache, 'miss');
});

// ---- What is cached (LLD 2, 4.4) ----

test('the cached value is exactly a GeneratedItinerary: no destination, dates, name or other request field', async () => {
    const memory = createMemoryStore();
    const writes = [];
    const store = { ...memory, set: async (key, value, opts) => { writes.push([key, value]); return memory.set(key, value, opts); } };
    const { generateTrip } = buildUseCase({ provider: fakeProvider([good]), store });
    await generateTrip(tripBody({ destination: 'Hampi, Karnataka', createdBy: 'Asha Traveller' }), ctx('c1'));
    const tripWrites = writes.filter(([key]) => key.startsWith('trip:'));
    assert.equal(tripWrites.length, 1);
    const [key, value] = tripWrites[0];
    const cached = JSON.parse(value);
    assert.deepEqual(Object.keys(cached).sort(), ['budget', 'days', 'generatedAt', 'notes', 'title']);
    for (const secret of ['Asha', 'Traveller', 'gsk_']) {
        assert.equal(value.includes(secret), false, secret);
        assert.equal(key.includes(secret), false, secret);
    }
    assert.equal(key.toLowerCase().includes('hampi'), false);
});
