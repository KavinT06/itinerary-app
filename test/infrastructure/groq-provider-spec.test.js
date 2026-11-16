// Independent verification of the Groq adapter against HLD 8.4, through the real groq-sdk with a
// stubbed fetch. The stub refuses any URL other than the chat-completions endpoint, so nothing can
// reach the network. Fixtures follow the shapes measured in HLD 8.4 and 8.6; no real key or org ID.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGroqProvider } from '../../lib/infrastructure/ai/groq-provider.js';
import { AIProviderError } from '../../lib/application/errors.js';
import { ITINERARY_SCHEMA } from '../../lib/application/itinerary-prompt.js';
import { validateItinerary, ItineraryFormatError } from '../../lib/domain/itinerary.js';
import { listDates } from '../../lib/domain/dates.js';
import { modelOutput, daysFromNow } from '../fixtures.js';

const KEY = 'gsk_test_key_never_real_0000000000000000';
const MODEL = 'openai/gpt-oss-120b';
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const json = (status, body, headers = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

function providerWith(handler) {
    const requests = [];
    const fetchStub = async (url, init) => {
        if (String(url) !== ENDPOINT) throw new Error(`unexpected network access: ${url}`);
        requests.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
        return handler(requests.length, init);
    };
    return { provider: createGroqProvider({ apiKey: KEY, model: MODEL, fetch: fetchStub }), requests };
}
const ask = (provider, maxOutputTokens = 2200) => provider.generateStructured({
    system: 'system text', prompt: 'user text', schemaName: 'itinerary', schema: ITINERARY_SCHEMA,
    maxOutputTokens, timeoutMs: 5000,
});
const failsWith = async (promise, kind) => {
    const err = await promise.then(() => assert.fail('expected a failure'), (e) => e);
    assert.ok(err instanceof AIProviderError, `expected AIProviderError, got ${err}`);
    assert.equal(err.kind, kind);
    return err;
};
const tpm429 = {
    error: {
        type: 'tokens', code: 'rate_limit_exceeded',
        message: 'Rate limit reached for model `openai/gpt-oss-120b` in organization `org_fixture000` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Used 3720, Requested 6159. Please try again in 14.09s.',
    },
};

test('429: retry-after of exactly 60 s is still rate_limited; 61 s is quota_exhausted (HLD 8.4 boundary)', async () => {
    const at60 = providerWith(() => json(429, tpm429, { 'retry-after': '60' }));
    const limited = await failsWith(ask(at60.provider), 'rate_limited');
    assert.equal(limited.retryAfterSeconds, 60);
    assert.equal(at60.requests.length, 1, 'the SDK must not retry a 429 itself');

    const at61 = providerWith(() => json(429, tpm429, { 'retry-after': '61' }));
    await failsWith(ask(at61.provider), 'quota_exhausted');
    assert.equal(at61.requests.length, 1);
});

test('429 with no retry-after and no per-day signal falls back to rate_limited (HLD 8.4)', async () => {
    const { provider, requests } = providerWith(() => json(429, { error: { type: 'requests', code: 'rate_limit_exceeded', message: 'Rate limit reached.' } }));
    const err = await failsWith(ask(provider), 'rate_limited');
    assert.equal(err.retryAfterSeconds, undefined);
    assert.equal(err.status, 429);
    assert.equal(requests.length, 1);
});

test('the provider\'s free-text message (which carries the organisation ID) is never copied into an error message', async () => {
    const leaky = { message: 'Problem in organization `org_fixture000` with request about Hampi', type: 'invalid_request_error' };
    const cases = [
        [400, { ...leaky }], [400, { ...leaky, code: 'json_validate_failed' }], [401, leaky], [404, leaky],
        [413, leaky], [422, leaky], [429, { ...leaky, code: 'rate_limit_exceeded' }], [500, leaky], [503, leaky],
    ];
    for (const [status, error] of cases) {
        const { provider } = providerWith(() => json(status, { error }));
        const err = await ask(provider).then(() => assert.fail('expected failure'), (e) => e);
        assert.ok(err instanceof AIProviderError, String(status));
        assert.equal(err.message.includes('org_fixture000'), false, `HTTP ${status}`);
        assert.equal(err.message.includes('Hampi'), false, `HTTP ${status}`);
        assert.equal(err.message.includes(KEY), false, `HTTP ${status}`);
    }
});

test('json_validate_failed whose failed_generation has a misspelt key: recovered in one call and kept by validation', async () => {
    const dates = listDates(daysFromNow(20), 3);
    const generated = modelOutput(dates[0], 3);
    const { description, ...rest } = generated.days[2].activities[2];
    generated.days[2].activities[2] = { ...rest, 'Mal description': description }; // as measured (HLD 8.6)
    const body = {
        error: {
            type: 'invalid_request_error', code: 'json_validate_failed',
            message: "Generated JSON does not match the expected schema. Error: jsonschema: '/days/2/activities/2' missing properties: 'description'",
            failed_generation: JSON.stringify(generated, null, 2),
        },
    };
    const { provider, requests } = providerWith(() => json(400, body));
    const result = await ask(provider);
    assert.equal(requests.length, 1);
    assert.equal(result.recovered, true);
    const itinerary = validateItinerary(result.data, { destination: 'Fort Kochi', dates });
    assert.equal(itinerary.days.length, 3);
    assert.equal(itinerary.days[2].activities.length, 5);
    assert.equal(itinerary.days[2].activities[2].description, '');
});

test('json_validate_failed whose failed_generation is missing a field: the bad activity is dropped and the trip kept', async () => {
    const dates = listDates(daysFromNow(20), 7);
    const generated = modelOutput(dates[0], 7);
    delete generated.days[4].activities[1].time; // a missing required field (HLD 8.6, 20b, 7 days)
    const body = {
        error: {
            type: 'invalid_request_error', code: 'json_validate_failed',
            message: "Generated JSON does not match the expected schema. Error: jsonschema: '/days/4/activities/1' missing properties: 'time'",
            failed_generation: JSON.stringify(generated),
        },
    };
    const { provider, requests } = providerWith(() => json(400, body));
    const result = await ask(provider);
    assert.equal(requests.length, 1);
    const itinerary = validateItinerary(result.data, { destination: 'Fort Kochi', dates });
    assert.equal(itinerary.days.length, 7);
    assert.equal(itinerary.days[4].activities.length, 4);
    assert.deepEqual(itinerary.days.map((d) => d.date), dates);
});

test('json_validate_failed with no failed_generation is invalid_output, so the use case may retry', async () => {
    const { provider, requests } = providerWith(() => json(400, { error: { type: 'invalid_request_error', code: 'json_validate_failed', message: 'x' } }));
    const err = await failsWith(ask(provider), 'invalid_output');
    assert.equal(err.status, 400);
    assert.equal(requests.length, 1);
});

test('a 14-day request answered with one day (HLD 8.6): the adapter returns it; validation rejects it on day_count', async () => {
    const dates = listDates(daysFromNow(20), 14);
    const oneDay = modelOutput(dates[0], 1);
    const { provider } = providerWith(() => json(200, {
        id: 'chatcmpl-1', model: 'openai/gpt-oss-20b',
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(oneDay) } }],
        usage: { prompt_tokens: 679, completion_tokens: 3675, total_tokens: 4354 },
    }));
    const result = await ask(provider, 9400);
    assert.equal(result.usage.totalTokens, 4354);
    assert.throws(() => validateItinerary(result.data, { destination: 'Fort Kochi', dates }), (err) => {
        assert.ok(err instanceof ItineraryFormatError);
        assert.equal(err.rule, 'day_count');
        return true;
    });
});
