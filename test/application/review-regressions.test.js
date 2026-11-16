// Regression tests for the defects found in the independent code and architecture reviews
// (2026-11-16). Each test failed, or could not have been written, against the code before the fix.

import test from 'node:test';
import assert from 'node:assert/strict';
import { AIProviderError, AppError } from '../../lib/application/errors.js';
import { tripCacheKey } from '../../lib/application/cache-key.js';
import { parseTripRequest } from '../../lib/domain/trip-request.js';
import { buildUseCase, fakeProvider, modelOutput, tripBody, usageOf } from '../fixtures.js';

const good = (request) => {
    const dates = /in order: (.*)$/m.exec(request.prompt)[1].split(', ');
    return modelOutput(dates[0], dates.length);
};
const ctx = (clientId = 'client-a', signal, startedAt) => ({ clientId, signal, startedAt });
const today = () => new Date().toISOString().slice(0, 10);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const caught = (promise) => promise.then(() => null, (e) => e);

async function budgetCounters(store) {
    return { requests: Number(await store.get(`gen:d:${today()}`)) || 0, tokens: Number(await store.get(`tok:d:${today()}`)) || 0 };
}

test('R-01: a generation the provider charged for but that failed still counts against the daily budget', async () => {
    // Truncated: Groq answered 200 and reported its usage, then the output was unusable.
    const truncated = new AIProviderError('truncated', 'x', { generated: true, usage: usageOf(700, 9400) });
    const a = buildUseCase({ provider: fakeProvider([truncated]) });
    await caught(a.generateTrip(tripBody(), ctx()));
    assert.deepEqual(await budgetCounters(a.store), { requests: 1, tokens: 10_100 });
    const usageA = await a.usage.read(today());
    assert.equal(usageA.output_tokens, 9400);
    assert.equal(usageA.generated, 0);

    // A rejected generation reports no usage, so the budget is charged a conservative upper bound,
    // and the reported-usage counters stay honest (nothing invented).
    const rejected = new AIProviderError('invalid_output', 'x', { generated: true });
    const b = buildUseCase({ provider: fakeProvider([rejected]) });
    await caught(b.generateTrip(tripBody(), ctx())); // retried once, both rejected
    const budget = await budgetCounters(b.store);
    assert.equal(budget.requests, 2);
    assert.equal(budget.tokens, 2 * (1000 + 600 * 2 + 800));
    const usageB = await b.usage.read(today());
    assert.equal(usageB.output_tokens, 0);
    assert.equal(usageB.unreported_usage, 2);

    // A refusal before any generation (429 admission) is not charged.
    const c = buildUseCase({ provider: fakeProvider([new AIProviderError('rate_limited', 'x', { retryAfterSeconds: 45 })]) });
    await caught(c.generateTrip(tripBody(), ctx()));
    assert.deepEqual(await budgetCounters(c.store), { requests: 0, tokens: 0 });
});

test('R-01: an itinerary recovered from a rejected generation is charged at the upper bound', async () => {
    const provider = fakeProvider([good]);
    provider.generateStructured = async (request) => {
        provider.calls.push(request);
        return { data: good(request), usage: { inputTokens: null, outputTokens: null, totalTokens: null }, provider: 'fake', model: 'fake-model-1', latencyMs: 1, recovered: true };
    };
    const { generateTrip, store, usage } = buildUseCase({ provider });
    const { meta } = await generateTrip(tripBody(), ctx());
    assert.equal(meta.recovered, true);
    assert.deepEqual(await budgetCounters(store), { requests: 1, tokens: 1000 + 600 * 2 + 800 });
    const counters = await usage.read(today());
    assert.equal(counters.recovered, 1);
    assert.equal(counters.unreported_usage, 1);
});

test('R-02: after the only caller leaves, an identical request starts a fresh generation instead of joining the cancelled one', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const signals = [];
    const provider = fakeProvider([async (request) => {
        signals.push(request.signal);
        if (signals.length === 1) {
            await new Promise((_, reject) => request.signal.addEventListener('abort', () => reject(new AIProviderError('aborted', 'x'))));
        }
        await gate;
        return good(request);
    }]);
    const { generateTrip } = buildUseCase({ provider });

    const leaving = new AbortController();
    const first = generateTrip(tripBody(), ctx('a', leaving.signal));
    await tick();
    leaving.abort();
    assert.equal((await caught(first)).code, 'CLIENT_CLOSED');

    const second = generateTrip(tripBody(), ctx('a'));
    await tick();
    release();
    const result = await second;
    assert.equal(result.meta.cache, 'miss');
    assert.equal(result.trip.days.length, 2);
    assert.equal(provider.calls.length, 2);
    assert.equal(signals[1].aborted, false);
});

test('R-02: cancellation during the retry back-off is CLIENT_CLOSED, not INTERNAL', async () => {
    const controller = new AbortController();
    const provider = fakeProvider([new AIProviderError('unavailable', 'x')]);
    const { generateTrip } = buildUseCase({ provider });
    // Replace the test sleep with one that is cancelled the way the real one is.
    const realSleep = (ms, signal) => new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        setTimeout(() => controller.abort(), 5);
    });
    const withRealSleep = buildUseCase({ provider });
    void generateTrip;
    const { createGenerateTrip } = await import('../../lib/application/generate-trip.js');
    const generate = createGenerateTrip({
        provider, store: withRealSleep.store, limits: withRealSleep.limits, usage: withRealSleep.usage, logger: withRealSleep.logger,
        config: { timeoutMs: 50_000, maxOutputTokens: 10_000, cacheTtlSeconds: 0 }, random: () => 0.5, sleep: realSleep,
    });
    const err = await caught(generate(tripBody(), ctx('a', controller.signal)));
    assert.ok(err instanceof AppError);
    assert.equal(err.code, 'CLIENT_CLOSED');
});

test('R-03: generation cost is recorded even when the request that started it has left', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const provider = fakeProvider([async (request) => { await gate; return good(request); }]);
    const { generateTrip, usage } = buildUseCase({ provider });

    const leaving = new AbortController();
    const starter = generateTrip(tripBody(), ctx('a', leaving.signal));
    const joiner = generateTrip(tripBody(), ctx('b'));
    await tick();
    leaving.abort();
    await caught(starter);
    release();
    assert.equal((await joiner).meta.cache, 'joined');

    const counters = await usage.read(today());
    assert.equal(counters.generated, 1);
    assert.equal(counters.joined, 1);
    assert.equal(counters.output_tokens, 1500);
    assert.equal(counters.input_tokens, 600);
});

test('R-04: the generation deadline includes time the request already spent', async () => {
    const provider = fakeProvider([good]);
    const clock = { now: Date.now() };
    const { generateTrip } = buildUseCase({ provider, clock });
    await generateTrip(tripBody(), ctx('a', undefined, clock.now - 20_000));
    // 50 s deadline, 20 s already spent: the provider gets about 30 s, not 50.
    assert.ok(provider.calls[0].timeoutMs <= 30_000, `timeoutMs was ${provider.calls[0].timeoutMs}`);
});

test('R-05: callers sharing a failed generation each get their own error with their own log metadata', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const provider = fakeProvider([async () => { await gate; throw new AIProviderError('refused', 'x'); }]);
    const { generateTrip } = buildUseCase({ provider });
    const a = caught(generateTrip(tripBody(), ctx('a')));
    const b = caught(generateTrip(tripBody(), ctx('b')));
    await tick();
    release();
    const [ea, eb] = await Promise.all([a, b]);
    assert.notEqual(ea, eb);
    assert.deepEqual([ea.meta.cache, eb.meta.cache].sort(), ['joined', 'miss']);
    assert.equal(ea.code, 'AI_REFUSED');
});

test('A-03: a cache entry that fails validation is treated as a miss, never served', async () => {
    const provider = fakeProvider([good]);
    const { generateTrip, store } = buildUseCase({ provider });
    const body = tripBody();
    const parsed = parseTripRequest(body).value;
    const key = tripCacheKey(parsed, provider);
    await store.set(key, JSON.stringify({ title: '<injected>', days: [], generatedAt: new Date().toISOString(), extra: 'x' }), { ttlSeconds: 60 });

    const { trip, meta } = await generateTrip(body, ctx());
    assert.equal(meta.cache, 'miss');
    assert.equal(trip.days.length, 2);
    assert.equal('extra' in trip, false);

    // A well-formed entry is served, rebuilt field by field.
    const second = await generateTrip(body, ctx('b'));
    assert.equal(second.meta.cache, 'hit');
    assert.equal(provider.calls.length, 1);
});

test('A-07: the start-date window is a domain rule the form and server share', async () => {
    const { MAX_START_DAYS_AHEAD } = await import('../../lib/domain/trip-request.js');
    const { addDays } = await import('../../lib/domain/dates.js');
    assert.equal(MAX_START_DAYS_AHEAD, 730);
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
    assert.equal(addDays('2027-01-01', -1), '2026-12-31');
});

test('QA: a request already cancelled when it arrives never reaches the provider', async () => {
    const provider = fakeProvider([good]);
    const { generateTrip, store } = buildUseCase({ provider });
    const controller = new AbortController();
    controller.abort();
    const err = await caught(generateTrip(tripBody(), ctx('a', controller.signal)));
    assert.equal(err.code, 'CLIENT_CLOSED');
    assert.equal(provider.calls.length, 0);
    assert.deepEqual(await budgetCounters(store), { requests: 0, tokens: 0 });
});
