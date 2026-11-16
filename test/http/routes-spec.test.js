// Independent verification of POST /api/trips and GET /api/health against LLD 4.7, 5 and 7 and
// HLD 8.4 / 9. Real route handlers and the real use case; the provider is scripted, or the real
// Groq adapter over a stubbed fetch. Each request uses its own client IP (x-real-ip). No network.
//
// The container cannot inject `sleep`, so tests that need a retry install a container whose use
// case is built with a recording sleep (installWithFakeSleep). All other tests use buildContainer.

import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../../app/api/trips/route.js';
import { GET as health } from '../../app/api/health/route.js';
import { buildContainer, setContainer } from '../../lib/infrastructure/container.js';
import { loadConfig } from '../../lib/infrastructure/config.js';
import { createGroqProvider } from '../../lib/infrastructure/ai/groq-provider.js';
import { createMemoryStore } from '../../lib/infrastructure/store/memory-store.js';
import { createResilientStore } from '../../lib/infrastructure/store/resilient-store.js';
import { createLimits, createUsage } from '../../lib/application/limits.js';
import { createGenerateTrip } from '../../lib/application/generate-trip.js';
import { AIProviderError } from '../../lib/application/errors.js';
import { fakeProvider, captureLogger, modelOutput, tripBody, daysFromNow } from '../fixtures.js';

const KEY = 'gsk_test_key_never_real_0000000000000000';
const NAME = 'Asha Traveller';
const DESTINATION = 'Zanzibar Stone Town';
const good = (request) => {
    const dates = /in order: (.*)$/m.exec(request.prompt)[1].split(', ');
    return modelOutput(dates[0], dates.length);
};
const oneDay = (request) => ({ ...good(request), days: good(request).days.slice(0, 1) });

function install({ script = [good], provider, env = {}, store, storeKind } = {}) {
    const logger = captureLogger();
    const theProvider = provider !== undefined ? provider : fakeProvider(script);
    const config = loadConfig({ GROQ_API_KEY: KEY, GROQ_MODEL: 'fake-model-1', ...env });
    const container = buildContainer({ config, logger, provider: theProvider, store });
    setContainer(storeKind ? { ...container, storeKind } : container);
    return { logger, provider: theProvider, store: container.store };
}

/** Same wiring as buildContainer, but the use case's back-off sleep is recorded instead of waited. */
function installWithFakeSleep({ script = [good], provider, env = {} } = {}) {
    const logger = captureLogger();
    const theProvider = provider !== undefined ? provider : fakeProvider(script);
    const config = loadConfig({ GROQ_API_KEY: KEY, GROQ_MODEL: 'fake-model-1', ...env });
    const base = buildContainer({ config, logger, provider: theProvider });
    const limits = createLimits({ store: base.store, clientLimits: config.clientLimits, budget: config.budget, providerName: theProvider?.name ?? 'groq' });
    const usage = createUsage({ store: base.store });
    const sleeps = [];
    const generateTrip = createGenerateTrip({
        provider: theProvider, store: base.store, limits, usage, logger,
        config: { timeoutMs: config.ai.timeoutMs, maxOutputTokens: config.ai.maxOutputTokens, cacheTtlSeconds: config.cache.ttlSeconds },
        sleep: async (ms) => { sleeps.push(ms); },
    });
    setContainer({ ...base, usage, generateTrip });
    return { logger, provider: theProvider, sleeps };
}

let ipCounter = 0;
const nextIp = () => { ipCounter += 1; return `203.0.113.${ipCounter}`; };
function post(body, { headers = {}, raw, ip = nextIp(), signal } = {}) {
    return POST(new Request('http://localhost/api/trips', {
        method: 'POST',
        // x-real-ip is the platform-set header the app trusts; x-forwarded-for is client-controlled
        // and ignored for identity, so it is sent only to show it changes nothing.
        headers: { 'content-type': 'application/json', 'x-real-ip': ip, 'x-forwarded-for': `${ip}, 10.0.0.1`, ...headers },
        body: raw ?? JSON.stringify(body),
        signal,
    }));
}
const tripLines = (logger) => logger.lines.filter((l) => l.event === 'trip_request');
const assertNoPersonalData = (logger, extra = []) => {
    const logged = JSON.stringify(logger.lines);
    for (const secret of [DESTINATION, 'Zanzibar', NAME, 'Asha', KEY, '203.0.113.', ...extra]) {
        assert.equal(logged.includes(secret), false, `log contains ${secret}`);
    }
};

// ---- LLD 5: headers and body on every response ----

test('every error response carries Cache-Control: no-store and an X-Request-Id equal to the body requestId', async () => {
    const cases = [];
    install();
    cases.push(['INVALID_JSON', 400, await post(null, { raw: '{"destination": ' })]);
    cases.push(['VALIDATION_FAILED', 400, await post(tripBody({ destination: '' }))]);
    cases.push(['FORBIDDEN_ORIGIN', 403, await post(tripBody(), { headers: { 'sec-fetch-site': 'cross-site' } })]);
    cases.push(['UNSUPPORTED_MEDIA_TYPE', 415, await post(tripBody(), { headers: { 'content-type': 'text/plain' } })]);
    cases.push(['PAYLOAD_TOO_LARGE', 413, await post(tripBody({ destination: 'x'.repeat(6000) }))]);
    const ip = nextIp();
    for (let i = 0; i < 5; i += 1) await post(tripBody(), { ip });
    cases.push(['RATE_LIMITED', 429, await post(tripBody(), { ip })]);
    install({ script: [new AIProviderError('auth', 'x')] });
    cases.push(['SERVICE_UNAVAILABLE', 503, await post(tripBody())]);
    install({ script: [new AIProviderError('timeout', 'x')] });
    cases.push(['AI_TIMEOUT', 504, await post(tripBody())]);
    install({ script: [new TypeError('boom')] });
    cases.push(['INTERNAL', 500, await post(tripBody())]);

    for (const [code, status, response] of cases) {
        const data = await response.json();
        assert.equal(response.status, status, code);
        assert.equal(data.code, code);
        assert.equal(typeof data.error, 'string', code);
        assert.equal(typeof data.retryable, 'boolean', code);
        assert.equal(response.headers.get('cache-control'), 'no-store', `${code} Cache-Control`);
        assert.match(response.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/, `${code} X-Request-Id`);
        assert.equal(response.headers.get('x-request-id'), data.requestId, `${code} requestId`);
    }
});

// ---- LLD 4.7 / HLD 8.4: every provider kind, with the spec's literal values ----

test('each AIProviderError kind gives the LLD 4.7 status, code, retryable flag and call count', async () => {
    // [kind, status, code, retryable, provider calls] — retried kinds are called twice (LLD 4.6).
    const table = [
        ['auth', 503, 'SERVICE_UNAVAILABLE', false, 1],
        ['model_not_found', 503, 'SERVICE_UNAVAILABLE', false, 1],
        ['invalid_request', 503, 'SERVICE_UNAVAILABLE', false, 1],
        ['context_length', 503, 'SERVICE_UNAVAILABLE', false, 1],
        ['quota_exhausted', 503, 'AI_QUOTA_EXHAUSTED', false, 1],
        ['unavailable', 502, 'AI_UNAVAILABLE', true, 2],
        ['connection', 502, 'AI_UNAVAILABLE', true, 2],
        ['timeout', 504, 'AI_TIMEOUT', true, 1],
        ['truncated', 502, 'AI_INVALID_RESPONSE', true, 1],
        ['invalid_output', 502, 'AI_INVALID_RESPONSE', true, 2],
        ['refused', 422, 'AI_REFUSED', false, 1],
        ['aborted', 499, 'CLIENT_CLOSED', false, 1],
    ];
    for (const [kind, status, code, retryable, calls] of table) {
        const { logger, provider } = installWithFakeSleep({ script: [new AIProviderError(kind, 'internal org_fixture000 detail')] });
        const response = await post(tripBody());
        const data = await response.json();
        assert.equal(response.status, status, kind);
        assert.equal(data.code, code, kind);
        assert.equal(data.retryable, retryable, kind);
        assert.equal(provider.calls.length, calls, `${kind} provider calls`);
        assert.equal(JSON.stringify(data).includes('org_fixture000'), false, kind);
        assert.equal(tripLines(logger).length, 1, kind);
        assert.equal(tripLines(logger)[0].providerKind, kind);
    }
});

test('AI_BUSY and RATE_LIMITED state the countdown in the message, the body and the Retry-After header', async () => {
    installWithFakeSleep({ script: [new AIProviderError('rate_limited', 'x', { retryAfterSeconds: 15 })] });
    const busy = await post(tripBody());
    const busyData = await busy.json();
    assert.equal(busy.status, 503);
    assert.equal(busyData.code, 'AI_BUSY');
    assert.equal(busyData.retryAfter, 15);
    assert.equal(busy.headers.get('retry-after'), '15');
    assert.match(busyData.error, /\b15 seconds\b/);

    install();
    const ip = nextIp();
    for (let i = 0; i < 5; i += 1) await post(tripBody(), { ip });
    const limited = await post(tripBody(), { ip });
    const limitedData = await limited.json();
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), String(limitedData.retryAfter));
    assert.ok(limitedData.retryAfter >= 1 && limitedData.retryAfter <= 60);
    assert.match(limitedData.error, new RegExp(`\\b${limitedData.retryAfter} seconds\\b`));
});

test('a 14-day request answered with one day: 502 AI_INVALID_RESPONSE after one retry', async () => {
    const { provider, logger } = installWithFakeSleep({ script: [oneDay] });
    const response = await post(tripBody({ startDate: daysFromNow(10), endDate: daysFromNow(23) }));
    const data = await response.json();
    assert.equal(response.status, 502);
    assert.equal(data.code, 'AI_INVALID_RESPONSE');
    assert.equal(data.retryable, true);
    assert.equal(provider.calls.length, 2);
    const [line] = tripLines(logger);
    assert.equal(line.days, 14);
    assert.equal(line.attempts, 2);
});

// ---- LLD 7: one metadata-only log line ----

test('exactly one trip_request line per request, and no destination, name, key or IP in any log line, on every path', async () => {
    const body = tripBody({ destination: DESTINATION, createdBy: NAME });
    const paths = [
        ['200 miss and hit', () => install(), async () => { await post(body); return post(body); }],
        ['VALIDATION_FAILED', () => install(), () => post({ ...body, createdBy: `${NAME} ${'x'.repeat(80)}` })],
        ['RATE_LIMITED', () => install(), async () => {
            const ip = nextIp();
            for (let i = 0; i < 5; i += 1) await post(body, { ip });
            return post(body, { ip });
        }],
        ['AI_BUSY', () => installWithFakeSleep({ script: [new AIProviderError('rate_limited', 'x', { retryAfterSeconds: 15 })] }), () => post(body)],
        ['AI_INVALID_RESPONSE', () => installWithFakeSleep({ script: [oneDay] }), () => post(body)],
        ['AI_QUOTA_EXHAUSTED', () => install({ script: [new AIProviderError('quota_exhausted', 'x')] }), () => post(body)],
    ];
    for (const [name, setup, run] of paths) {
        const { logger } = setup();
        const before = tripLines(logger).length;
        const response = await run();
        await response.json();
        const lines = tripLines(logger);
        assert.ok(lines.length > before, name);
        assert.equal(lines.at(-1).requestId, response.headers.get('x-request-id'), name);
        // One line per request: every request ID appears once.
        const ids = lines.map((l) => l.requestId);
        assert.equal(new Set(ids).size, ids.length, `${name}: a request logged twice`);
        assertNoPersonalData(logger);
    }
});

test('the log line has the LLD 7 fields', async () => {
    const { logger } = install();
    await post(tripBody());
    const [line] = tripLines(logger);
    for (const field of ['requestId', 'route', 'status', 'durationMs', 'code', 'cache', 'days', 'provider', 'model', 'attempts', 'inputTokens', 'outputTokens', 'providerKind']) {
        assert.ok(Object.hasOwn(line, field), field);
    }
    assert.equal(line.route, '/api/trips');
    assert.equal(line.inputTokens, 600);
    assert.equal(typeof line.durationMs, 'number');
});

test('an unexpected error whose message echoes request data does not put that data in the log line', async () => {
    const provider = fakeProvider([() => {
        throw new TypeError(`Cannot read properties of undefined (reading '${DESTINATION}' for ${NAME})`);
    }]);
    const { logger } = install({ provider });
    const response = await post(tripBody({ destination: DESTINATION, createdBy: NAME }));
    assert.equal(response.status, 500);
    assert.equal((await response.json()).code, 'INTERNAL');
    assert.equal(provider.calls.length, 1);
    assert.equal(tripLines(logger)[0].errorName, 'TypeError');
    assertNoPersonalData(logger);
});

// ---- LLD 4.5: clientId is a hash ----

test('store keys never contain the raw client IP, the traveller\'s name or the destination', async () => {
    const memory = createMemoryStore();
    const keys = new Set();
    const record = (op) => async (key, ...rest) => { keys.add(key); return memory[op](key, ...rest); };
    const store = { get: record('get'), set: record('set'), incr: record('incr'), ping: async () => {} };
    install({ store });
    const ip = '198.18.7.42';
    for (let i = 0; i < 6; i += 1) await post(tripBody({ destination: DESTINATION, createdBy: NAME }), { ip });
    assert.ok(keys.size > 0);
    for (const key of keys) {
        for (const secret of [ip, '198.18.', 'Zanzibar', 'zanzibar', 'Asha', 'asha']) assert.equal(key.includes(secret), false, `${key} contains ${secret}`);
    }
});

// ---- HLD 9: store outages ----

function failingPrimary(mode) {
    const fail = mode === 'hang' ? () => new Promise(() => {}) : async () => { throw new Error('store down'); };
    return { get: fail, set: fail, incr: fail, ping: fail };
}

for (const mode of ['throw', 'hang']) {
    test(`health: a shared store whose ping ${mode}s is reported as degraded, HTTP 200`, async () => {
        const store = createResilientStore({ primary: failingPrimary(mode), fallback: createMemoryStore(), timeoutMs: 5 });
        install({ store, storeKind: 'shared' });
        const response = await health(new Request('http://localhost/api/health'));
        const data = await response.json();
        assert.equal(response.status, 200);
        assert.deepEqual(data, { status: 'degraded', checks: { config: 'ok', store: 'degraded', ai: 'configured' } });
        assert.equal(response.headers.get('cache-control'), 'no-store');
    });

    test(`POST with the shared store ${mode}ing on every operation: 200, one log line, and per-client limits still apply`, async () => {
        const logger = captureLogger();
        const store = createResilientStore({
            primary: failingPrimary(mode), fallback: createMemoryStore(), timeoutMs: 5,
            onDegraded: (event, fields) => logger.warn(event, fields),
        });
        const config = loadConfig({ GROQ_API_KEY: KEY, GROQ_MODEL: 'fake-model-1' });
        const provider = fakeProvider([good]);
        setContainer({ ...buildContainer({ config, logger, provider, store }), storeKind: 'shared' });

        const ip = nextIp();
        const first = await post(tripBody({ destination: DESTINATION, createdBy: NAME }), { ip });
        assert.equal(first.status, 200);
        assert.equal(tripLines(logger).length, 1);
        assert.ok(logger.lines.some((l) => l.event === 'store_degraded'));
        for (let i = 0; i < 4; i += 1) assert.equal((await post(tripBody(), { ip })).status, 200);
        const sixth = await post(tripBody(), { ip });
        assert.equal(sixth.status, 429);
        assert.equal((await sixth.json()).code, 'RATE_LIMITED');
        assertNoPersonalData(logger);
    });
}

test('health: a reachable shared store is reported ok', async () => {
    const store = createResilientStore({ primary: createMemoryStore(), fallback: createMemoryStore(), timeoutMs: 50 });
    install({ store, storeKind: 'shared' });
    const data = await (await health(new Request('http://localhost/api/health'))).json();
    assert.deepEqual(data, { status: 'ok', checks: { config: 'ok', store: 'ok', ai: 'configured' } });
});

// ---- The real Groq adapter behind the route (stubbed fetch) ----

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
function groqWith(handler) {
    const requests = [];
    const fetchStub = async (url, init) => {
        if (String(url) !== ENDPOINT) throw new Error(`unexpected network access: ${url}`);
        requests.push(JSON.parse(init.body));
        return handler(requests.length, JSON.parse(init.body));
    };
    return { provider: createGroqProvider({ apiKey: KEY, model: 'openai/gpt-oss-120b', fetch: fetchStub }), requests };
}
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const datesIn = (body) => /in order: (.*)$/m.exec(body.messages[1].content)[1].split(', ');
const completion = (data) => ({
    id: 'chatcmpl-1', model: 'openai/gpt-oss-120b',
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(data) } }],
    usage: { prompt_tokens: 591, completion_tokens: 1599, total_tokens: 2190 },
});

test('json_validate_failed with a misspelt key in failed_generation: 200 from one provider call, then a cache hit', async () => {
    const { provider, requests } = groqWith((_n, body) => {
        const dates = datesIn(body);
        const generated = modelOutput(dates[0], dates.length);
        const { description, ...rest } = generated.days[1].activities[2];
        generated.days[1].activities[2] = { ...rest, 'Mal description': description };
        // The model invents its own dates and day numbers; the response must use the request's.
        generated.days.forEach((d) => { d.day = 9; });
        return json(400, { error: {
            type: 'invalid_request_error', code: 'json_validate_failed',
            message: "Generated JSON does not match the expected schema. Error: jsonschema: '/days/1/activities/2' missing properties: 'description'",
            failed_generation: JSON.stringify(generated),
        } });
    });
    const { logger } = install({ provider });
    const body = tripBody({ destination: DESTINATION, createdBy: NAME });
    const response = await post(body);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.cache, 'miss');
    assert.equal(requests.length, 1);
    assert.deepEqual(data.trip.days.map((d) => [d.day, d.date]), [[1, body.startDate], [2, body.endDate]]);
    assert.equal(data.trip.createdBy, NAME);
    assert.equal(JSON.stringify(requests[0]).includes('Asha'), false, 'the name was sent to the provider');

    const again = await (await post(body)).json();
    assert.equal(again.cache, 'hit');
    assert.equal(requests.length, 1);
    assertNoPersonalData(logger);
});

test('per-minute 429 (measured shape) followed by success: one wait of at least retry-after, then 200', async () => {
    const { provider, requests } = groqWith((n, body) => (n === 1
        ? json(429, { error: { type: 'tokens', code: 'rate_limit_exceeded', message: 'Rate limit reached for model `openai/gpt-oss-120b` in organization `org_fixture000` on tokens per minute (TPM): Limit 8000, Used 3720, Requested 6159. Please try again in 14.09s.' } }, { 'retry-after': '15' })
        : json(200, completion(modelOutput(datesIn(body)[0], datesIn(body).length)))));
    const { sleeps, logger } = installWithFakeSleep({ provider });
    const response = await post(tripBody());
    assert.equal(response.status, 200);
    assert.equal(requests.length, 2);
    assert.equal(sleeps.length, 1);
    assert.ok(sleeps[0] >= 15_000);
    assert.equal(tripLines(logger)[0].attempts, 2);
    assert.equal(JSON.stringify(logger.lines).includes('org_fixture000'), false);
});

test('per-day 429: 503 AI_QUOTA_EXHAUSTED without a countdown, and the next request does not reach Groq', async () => {
    const { provider, requests } = groqWith(() => json(429, {
        error: { type: 'tokens', code: 'rate_limit_exceeded', message: 'Rate limit reached on tokens per day (TPD): Limit 200000, Used 199000, Requested 6159.' },
    }, { 'retry-after': '5400' }));
    install({ provider });
    const first = await post(tripBody({ destination: 'Hampi' }));
    const data = await first.json();
    assert.equal(first.status, 503);
    assert.equal(data.code, 'AI_QUOTA_EXHAUSTED');
    assert.equal(data.retryable, false);
    assert.equal('retryAfter' in data, false);
    assert.equal(first.headers.get('retry-after'), null);

    const second = await post(tripBody({ destination: 'Mysuru' }));
    assert.equal(second.status, 503);
    assert.equal((await second.json()).code, 'AI_QUOTA_EXHAUSTED');
    assert.equal(requests.length, 1);
});

// ---- Cancellation before the request is handled ----

test('a request already cancelled when it arrives gets 499 CLIENT_CLOSED', async () => {
    const { provider } = install();
    const controller = new AbortController();
    controller.abort();
    const response = await post(tripBody(), { signal: controller.signal });
    assert.equal(response.status, 499);
    assert.equal((await response.json()).code, 'CLIENT_CLOSED');
    for (const call of provider.calls) assert.equal(call.signal.aborted, true);
});
