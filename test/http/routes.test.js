// Route tests: the real handlers and the real use case, with a scripted provider and
// the memory store injected through the container. No network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../../app/api/trips/route.js';
import { GET as health } from '../../app/api/health/route.js';
import { GET as usageRoute } from '../../app/api/usage/route.js';
import { buildContainer, setContainer } from '../../lib/infrastructure/container.js';
import { loadConfig } from '../../lib/infrastructure/config.js';
import { AIProviderError } from '../../lib/application/errors.js';
import { ERROR_CODES } from '../../lib/domain/error-codes.js';
import { fakeProvider, captureLogger, modelOutput, tripBody } from '../fixtures.js';

const KEY = 'gsk_test_key_never_real_0000000000000000';
const good = (request) => {
    const dates = /in order: (.*)$/m.exec(request.prompt)[1].split(', ');
    return modelOutput(dates[0], dates.length);
};

function install({ script = [good], env = {}, provider } = {}) {
    const logger = captureLogger();
    const theProvider = provider !== undefined ? provider : fakeProvider(script);
    const config = loadConfig({ GROQ_API_KEY: KEY, GROQ_MODEL: 'fake-model-1', ...env });
    setContainer(buildContainer({ config, logger, provider: theProvider }));
    return { logger, provider: theProvider };
}

let ipCounter = 0;
function post(body, { headers = {}, raw, ip } = {}) {
    ipCounter += 1;
    return POST(new Request('http://localhost/api/trips', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': ip ?? `198.51.100.${ipCounter}`, ...headers },
        body: raw ?? JSON.stringify(body),
    }));
}

test('200: returns the trip with a request ID and no-store, and logs one metadata-only line', async () => {
    const { logger } = install();
    const body = tripBody({ destination: 'Zanzibar Stone Town', createdBy: 'Asha Traveller' });
    const response = await post(body);
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.cache, 'miss');
    assert.equal(data.trip.createdBy, 'Asha Traveller');
    assert.equal(data.trip.days.length, 2);
    assert.match(data.requestId, /^[0-9a-f-]{36}$/);
    assert.equal(response.headers.get('x-request-id'), data.requestId);
    assert.equal(response.headers.get('cache-control'), 'no-store');

    assert.equal(logger.lines.length, 1);
    const [line] = logger.lines;
    assert.deepEqual(
        { event: line.event, status: line.status, cache: line.cache, days: line.days, provider: line.provider, model: line.model, attempts: line.attempts, outputTokens: line.outputTokens, code: line.code, requestId: line.requestId },
        { event: 'trip_request', status: 200, cache: 'miss', days: 2, provider: 'fake', model: 'fake-model-1', attempts: 1, outputTokens: 1500, code: null, requestId: data.requestId },
    );
    const logged = JSON.stringify(logger.lines);
    for (const secret of ['Zanzibar', 'Asha', KEY, '198.51.100']) assert.equal(logged.includes(secret), false, secret);
});

test('second identical request is a cache hit', async () => {
    const { provider } = install();
    await post(tripBody());
    const data = await (await post(tripBody())).json();
    assert.equal(data.cache, 'hit');
    assert.equal(provider.calls.length, 1);
});

test('400 validation errors carry the message, the code and the field', async () => {
    install();
    const response = await post(tripBody({ destination: '' }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json().then(({ requestId, ...rest }) => rest), {
        error: 'Destination is required.', code: 'VALIDATION_FAILED', retryable: false, field: 'destination',
    });
});

test('400 malformed JSON, 403 cross-site, 415 wrong content type, 413 oversized body', async () => {
    const { provider } = install();
    const cases = [
        [await post(null, { raw: '{"destination": ' }), 400, 'INVALID_JSON'],
        [await post(tripBody(), { headers: { 'sec-fetch-site': 'cross-site' } }), 403, 'FORBIDDEN_ORIGIN'],
        [await post(tripBody(), { headers: { 'content-type': 'text/plain' } }), 415, 'UNSUPPORTED_MEDIA_TYPE'],
        [await post(tripBody({ destination: 'x'.repeat(6000) })), 413, 'PAYLOAD_TOO_LARGE'],
        // A body larger than the cap with a Content-Length that understates it is still cut off.
        [await post(null, { raw: JSON.stringify(tripBody({ destination: 'y'.repeat(6000) })), headers: { 'content-length': '10' } }), 413, 'PAYLOAD_TOO_LARGE'],
    ];
    for (const [response, status, code] of cases) {
        assert.equal(response.status, status, code);
        assert.equal((await response.json()).code, code);
    }
    assert.equal(provider.calls.length, 0);
});

test('same-site browser requests and requests without Sec-Fetch-Site are accepted', async () => {
    install();
    assert.equal((await post(tripBody(), { headers: { 'sec-fetch-site': 'same-origin' } })).status, 200);
    assert.equal((await post(tripBody())).status, 200);
});

test('429 for the client\'s own rate, with Retry-After in header and body', async () => {
    install();
    const ip = '203.0.113.50';
    for (let i = 0; i < 5; i += 1) assert.equal((await post(tripBody(), { ip })).status, 200);
    const response = await post(tripBody(), { ip });
    const data = await response.json();
    assert.equal(response.status, 429);
    assert.equal(data.code, 'RATE_LIMITED');
    assert.equal(data.retryable, true);
    assert.ok(data.retryAfter >= 1);
    assert.equal(response.headers.get('retry-after'), String(data.retryAfter));
});

test('each provider failure maps to its status, code and a fixed message with no internal detail', async () => {
    const cases = [
        ['auth', 503, 'SERVICE_UNAVAILABLE'], ['model_not_found', 503, 'SERVICE_UNAVAILABLE'],
        ['quota_exhausted', 503, 'AI_QUOTA_EXHAUSTED'], ['timeout', 504, 'AI_TIMEOUT'],
        ['truncated', 502, 'AI_INVALID_RESPONSE'], ['refused', 422, 'AI_REFUSED'],
    ];
    for (const [kind, status, code] of cases) {
        const { logger } = install({ script: [new AIProviderError(kind, 'internal org_secret detail')] });
        const response = await post(tripBody());
        const data = await response.json();
        assert.equal(response.status, status, kind);
        assert.equal(data.code, code);
        assert.equal(data.error, ERROR_CODES[code].message);
        assert.equal(data.retryable, ERROR_CODES[code].retryable);
        assert.equal(JSON.stringify(data).includes('org_secret'), false);
        assert.equal(logger.lines[0].providerKind, kind);
        assert.equal(logger.lines[0].code, code);
    }
});

test('provider busy after one wait: 503 AI_BUSY with the countdown, never 429', async () => {
    install({ script: [new AIProviderError('rate_limited', 'x', { retryAfterSeconds: 40 })] });
    const response = await post(tripBody());
    const data = await response.json();
    assert.equal(response.status, 503);
    assert.equal(data.code, 'AI_BUSY');
    assert.equal(data.retryAfter, 40);
    assert.equal(response.headers.get('retry-after'), '40');
});

test('not configured: 503 and nothing about the cause in production; the cause is shown only in development', async () => {
    install({ provider: null });
    const prod = await (await post(tripBody())).json();
    assert.equal(prod.code, 'SERVICE_UNAVAILABLE');
    assert.equal(prod.error, ERROR_CODES.SERVICE_UNAVAILABLE.message);

    install({ provider: null, env: { NODE_ENV: 'development' } });
    const dev = await (await post(tripBody())).json();
    assert.match(dev.error, /\(dev: not_configured\)$/);
});

test('an unexpected bug is a 500 with a generic message, logged with a stack and no request data', async () => {
    const { logger } = install({ script: [new TypeError('cannot read secret-detail')] });
    const response = await post(tripBody({ destination: 'Zanzibar' }));
    const data = await response.json();
    assert.equal(response.status, 500);
    assert.equal(data.code, 'INTERNAL');
    assert.equal(JSON.stringify(data).includes('secret-detail'), false);
    assert.equal(logger.lines[0].level, 'error');
    assert.equal(logger.lines[0].errorName, 'TypeError');
    assert.equal(JSON.stringify(logger.lines).includes('Zanzibar'), false);
});

test('a client that disconnects gets 499 and the provider call is cancelled', async () => {
    let providerSignal;
    install({ script: [(request) => new Promise((_, reject) => {
        providerSignal = request.signal;
        request.signal.addEventListener('abort', () => reject(new AIProviderError('aborted', 'x')));
    })] });
    const controller = new AbortController();
    const pending = POST(new Request('http://localhost/api/trips', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.77' },
        body: JSON.stringify(tripBody()), signal: controller.signal,
    }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();
    const response = await pending;
    assert.equal(response.status, 499);
    assert.equal((await response.json()).code, 'CLIENT_CLOSED');
    assert.equal(providerSignal.aborted, true);
});

test('health: reports configuration, store and AI without calling the provider or naming the model', async () => {
    const { provider } = install();
    const response = await health(new Request('http://localhost/api/health'));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(data, { status: 'ok', checks: { config: 'ok', store: 'memory', ai: 'configured' } });
    assert.equal(provider.calls.length, 0);
    assert.equal(JSON.stringify(data).includes('fake-model'), false);

    install({ provider: null });
    assert.equal((await (await health(new Request('http://localhost/api/health'))).json()).status, 'degraded');

    install({ env: { AI_TIMEOUT_MS: 'never' } });
    const broken = await health(new Request('http://localhost/api/health'));
    assert.equal(broken.status, 503);
    assert.equal((await broken.json()).checks.config, 'invalid');
});

test('health probe: needs the admin token, then checks the provider without generating', async () => {
    const provider = fakeProvider([good]);
    let probed = 0;
    provider.checkAvailability = async () => { probed += 1; };
    install({ provider, env: { ADMIN_TOKEN: 'admin-secret-0123456789abcdefghijklmnop' } });
    const probe = (auth) => health(new Request('http://localhost/api/health?probe=ai', { headers: auth ? { authorization: auth } : {} }));

    assert.equal((await probe()).status, 401);
    assert.equal((await probe('Bearer wrong')).status, 401);
    assert.equal(probed, 0);
    assert.equal((await (await probe('Bearer admin-secret-0123456789abcdefghijklmnop')).json()).checks.ai, 'reachable');
    assert.equal(provider.calls.length, 0);

    provider.checkAvailability = async () => { throw new AIProviderError('auth', 'x'); };
    const failed = await (await probe('Bearer admin-secret-0123456789abcdefghijklmnop')).json();
    assert.equal(failed.checks.ai, 'unreachable:auth');
    assert.equal(failed.status, 'degraded');
});

test('usage: hidden without an admin token, protected with one, and reports the day\'s counters', async () => {
    install();
    assert.equal((await usageRoute(new Request('http://localhost/api/usage'))).status, 404);

    install({ env: { ADMIN_TOKEN: 'admin-secret-0123456789abcdefghijklmnop' } });
    await post(tripBody());
    await post(tripBody());
    await post(tripBody({ destination: '' }));
    assert.equal((await usageRoute(new Request('http://localhost/api/usage'))).status, 401);
    const auth = { authorization: 'Bearer admin-secret-0123456789abcdefghijklmnop' };
    assert.equal((await usageRoute(new Request('http://localhost/api/usage?date=tomorrow', { headers: auth }))).status, 400);
    const data = await (await usageRoute(new Request('http://localhost/api/usage', { headers: auth }))).json();
    assert.equal(data.requests, 3);
    assert.equal(data.generated, 1);
    assert.equal(data.cache_hits, 1);
    assert.equal(data.output_tokens, 1500);
    assert.deepEqual(data.errors, { VALIDATION_FAILED: 1 });
    assert.equal(data.budget.dailyTokens, 180_000);
});
