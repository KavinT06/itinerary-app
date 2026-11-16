// Exercises the real groq-sdk with a stubbed fetch. Response shapes are the ones measured
// against the live API on 2026-11-16 (docs/architecture/HLD.md section 8.6). No network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGroqProvider } from '../../lib/infrastructure/ai/groq-provider.js';
import { AIProviderError } from '../../lib/application/errors.js';
import { ITINERARY_SCHEMA } from '../../lib/application/itinerary-prompt.js';
import { modelOutput } from '../fixtures.js';

const KEY = 'gsk_test_key_never_real_0000000000000000';
const MODEL = 'openai/gpt-oss-120b';

const json = (status, body, headers = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const completion = (content, overrides = {}) => ({
    id: 'chatcmpl-1',
    model: MODEL,
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content }, ...overrides.choice }],
    usage: { prompt_tokens: 591, completion_tokens: 1599, total_tokens: 2190, completion_tokens_details: { reasoning_tokens: 116 } },
    ...overrides.top,
});

function providerWith(handler) {
    const requests = [];
    const fetchStub = async (url, init) => {
        requests.push({ url: String(url), init, body: init?.body ? JSON.parse(init.body) : null });
        return handler(requests.length, init);
    };
    return { provider: createGroqProvider({ apiKey: KEY, model: MODEL, fetch: fetchStub }), requests };
}

const ask = (provider, overrides = {}) => provider.generateStructured({
    system: 'system text', prompt: 'user text', schemaName: 'itinerary', schema: ITINERARY_SCHEMA,
    maxOutputTokens: 2200, timeoutMs: 5000, ...overrides,
});
const failsWith = async (promise, kind) => {
    const err = await promise.then(() => null, (e) => e);
    assert.ok(err instanceof AIProviderError, `expected AIProviderError, got ${err}`);
    assert.equal(err.kind, kind);
    return err;
};

test('sends a strict JSON-schema request with reasoning minimised and returns parsed data with usage', async () => {
    const data = modelOutput('2027-03-01', 2);
    const { provider, requests } = providerWith(() => json(200, completion(JSON.stringify(data))));
    const result = await ask(provider);

    assert.deepEqual(result.data, data);
    assert.deepEqual(result.usage, { inputTokens: 591, outputTokens: 1599, totalTokens: 2190 });
    assert.equal(result.provider, 'groq');
    assert.equal(result.model, MODEL);
    assert.equal(result.recovered, false);

    const [{ url, init, body }] = requests;
    assert.ok(url.endsWith('/openai/v1/chat/completions'));
    assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${KEY}`);
    assert.equal(body.model, MODEL);
    assert.deepEqual(body.messages.map((m) => m.role), ['system', 'user']);
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.reasoning_effort, 'low');
    assert.equal(body.include_reasoning, false);
    assert.equal(body.max_completion_tokens, 2200);
    assert.notEqual(body.stream, true);
});

test('the schema satisfies strict mode: every object lists all properties as required and forbids extras', () => {
    const check = (node, path) => {
        if (node.type === 'object') {
            assert.equal(node.additionalProperties, false, path);
            assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort(), path);
            for (const [key, child] of Object.entries(node.properties)) check(child, `${path}.${key}`);
        }
        if (node.type === 'array') {
            assert.equal('minItems' in node || 'maxItems' in node, false, path);
            check(node.items, `${path}[]`);
        }
    };
    check(ITINERARY_SCHEMA, '$');
});

test('does not retry inside the SDK: one failure is one request', async () => {
    const { provider, requests } = providerWith(() => json(503, { error: { message: 'down', type: 'service_unavailable' } }));
    await failsWith(ask(provider), 'unavailable');
    assert.equal(requests.length, 1);
});

test('maps HTTP statuses to provider error kinds', async () => {
    const cases = [
        [401, 'auth'], [403, 'auth'], [404, 'model_not_found'], [400, 'invalid_request'], [413, 'context_length'],
        [422, 'invalid_output'], [498, 'unavailable'], [500, 'unavailable'], [502, 'unavailable'],
    ];
    for (const [status, kind] of cases) {
        const { provider } = providerWith(() => json(status, { error: { message: 'detail', type: 'some_error' } }));
        const err = await failsWith(ask(provider), kind);
        assert.equal(err.status, status);
    }
});

test('per-minute 429 (as measured) is rate_limited with the wait; the provider message is not copied', async () => {
    const body = {
        error: {
            type: 'tokens', code: 'rate_limit_exceeded',
            message: 'Rate limit reached for model `openai/gpt-oss-20b` in organization `org_secret123` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Used 3720, Requested 6159. Please try again in 14.0925s.',
        },
    };
    const { provider } = providerWith(() => json(429, body, { 'retry-after': '15', 'x-ratelimit-remaining-requests': '997' }));
    const err = await failsWith(ask(provider), 'rate_limited');
    assert.equal(err.retryAfterSeconds, 15);
    assert.equal(err.message.includes('org_secret123'), false);
});

test('a daily 429 is quota_exhausted, however it is signalled', async () => {
    const signals = [
        [{ message: 'Rate limit reached on tokens per day (TPD): Limit 200000' }, { 'retry-after': '30' }],
        [{ message: 'Rate limit reached on requests per day (RPD)' }, {}],
        [{ message: 'Rate limit reached' }, { 'retry-after': '5400' }],
        [{ message: 'Rate limit reached' }, { 'retry-after': '10', 'x-ratelimit-remaining-requests': '0' }],
    ];
    for (const [error, headers] of signals) {
        const { provider } = providerWith(() => json(429, { error: { type: 'tokens', code: 'rate_limit_exceeded', ...error } }, headers));
        await failsWith(ask(provider), 'quota_exhausted');
    }
});

test('a schema rejection is recovered from failed_generation instead of failing', async () => {
    const generated = modelOutput('2027-03-01', 2);
    const body = {
        error: {
            type: 'invalid_request_error', code: 'json_validate_failed',
            message: "Generated JSON does not match the expected schema. Error: jsonschema: '/days/2/activities/2' missing properties: 'description'",
            failed_generation: JSON.stringify(generated, null, 2),
        },
    };
    const { provider } = providerWith(() => json(400, body));
    const result = await ask(provider);
    assert.deepEqual(result.data, generated);
    assert.equal(result.recovered, true);
    assert.deepEqual(result.usage, { inputTokens: null, outputTokens: null, totalTokens: null });
});

test('a schema rejection with no usable failed_generation is invalid_output', async () => {
    for (const failed_generation of [undefined, '{"title": "cut off', '"just a string"']) {
        const { provider } = providerWith(() => json(400, { error: { type: 'invalid_request_error', code: 'json_validate_failed', message: 'x', failed_generation } }));
        await failsWith(ask(provider), 'invalid_output');
    }
});

test('truncated, refused, empty and non-JSON responses are classified', async () => {
    const cases = [
        [completion('{"title":"cut', { choice: { finish_reason: 'length' } }), 'truncated'],
        [completion(null, { choice: { message: { role: 'assistant', content: null, refusal: 'I cannot help with that.' } } }), 'refused'],
        [completion(''), 'invalid_output'],
        [completion('Here is your itinerary!'), 'invalid_output'],
        [{ ...completion('x'), choices: [] }, 'invalid_output'],
    ];
    for (const [body, kind] of cases) {
        const { provider } = providerWith(() => json(200, body));
        await failsWith(ask(provider), kind);
    }
});

test('a network failure is a connection error', async () => {
    const { provider } = providerWith(() => { throw new TypeError('fetch failed'); });
    await failsWith(ask(provider), 'connection');
});

test('our deadline produces timeout; the caller leaving produces aborted', async () => {
    const hang = (_n, init) => new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
    const slow = providerWith(hang);
    await failsWith(ask(slow.provider, { timeoutMs: 40 }), 'timeout');

    const gone = providerWith(hang);
    const controller = new AbortController();
    const pending = ask(gone.provider, { signal: controller.signal });
    setTimeout(() => controller.abort(), 20);
    await failsWith(pending, 'aborted');
});

test('checkAvailability asks for the model without generating anything', async () => {
    const ok = providerWith(() => json(200, { id: MODEL, object: 'model' }));
    await ok.provider.checkAvailability();
    assert.ok(ok.requests[0].url.includes('/openai/v1/models/'));
    assert.equal(ok.requests[0].init.method.toUpperCase(), 'GET');

    const bad = providerWith(() => json(401, { error: { message: 'Invalid API Key', type: 'invalid_request_error' } }));
    await failsWith(bad.provider.checkAvailability(), 'auth');
});

test('the API key never appears in an error', async () => {
    const { provider } = providerWith(() => json(401, { error: { message: `Invalid API Key ${KEY}`, type: 'invalid_request_error' } }));
    const err = await failsWith(ask(provider), 'auth');
    assert.equal(err.message.includes(KEY), false);
});
