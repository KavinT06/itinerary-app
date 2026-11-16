// AIProvider port on Groq. Everything Groq-specific lives here: request parameters,
// response parsing, and the mapping from Groq failures to AIProviderError kinds
// (docs/architecture/HLD.md section 8.4).

import 'server-only';
import Groq from 'groq-sdk';
import { AIProviderError } from '../../application/errors.js';

const PROVIDER_NAME = 'groq';
// A 429 that asks for a longer wait than this is treated as an exhausted daily quota.
const QUOTA_RETRY_AFTER_SECONDS = 60;
const DAILY_LIMIT_PATTERN = /per day|\((?:RPD|TPD|ASD)\)/i;

function header(headers, name) {
    if (!headers) return null;
    return typeof headers.get === 'function' ? headers.get(name) : headers[name] ?? null;
}

/** The SDK exposes the parsed response body as err.error; Groq nests details under "error". */
function errorDetails(err) {
    const body = err?.error;
    return (body && typeof body === 'object' && body.error) || body || {};
}

function parseJsonObject(text) {
    if (typeof text !== 'string' || !text.trim()) return null;
    try {
        const value = JSON.parse(text);
        return value !== null && typeof value === 'object' ? value : null;
    } catch {
        return null;
    }
}

/**
 * Maps an SDK error to an AIProviderError. Classification is by HTTP status first;
 * Groq's undocumented error codes only refine it. Provider messages are never copied
 * into our messages: they can contain the organisation ID.
 */
function classify(err, { timedOut, callerSignal }) {
    if (err instanceof AIProviderError) return err;
    if (callerSignal?.aborted) return new AIProviderError('aborted', 'Caller cancelled the request', { cause: err });
    if (timedOut() || err instanceof Groq.APIConnectionTimeoutError) {
        // Generation may have been under way; count it as charged so the daily budget errs on the safe side.
        return new AIProviderError('timeout', 'Groq request timed out', { cause: err, generated: true });
    }
    if (err instanceof Groq.APIUserAbortError) return new AIProviderError('aborted', 'Request was aborted', { cause: err });

    if (err instanceof Groq.APIError && typeof err.status === 'number') {
        const { status } = err;
        const details = errorDetails(err);
        const options = { status, cause: err };

        if (status === 401 || status === 403) return new AIProviderError('auth', 'Groq rejected the API key', options);
        if (status === 404) return new AIProviderError('model_not_found', 'Groq does not know the configured model', options);
        if (status === 413) return new AIProviderError('context_length', 'Request is too large for the model', options);
        // Groq generated (and charged for) output it then rejected. Error bodies carry no usage.
        if (status === 422) return new AIProviderError('invalid_output', 'Groq could not produce valid output', { ...options, generated: true });
        if (status === 400) {
            if (details.code === 'json_validate_failed') {
                const error = new AIProviderError('invalid_output', 'Groq rejected its own output for a schema error', { ...options, generated: true });
                error.failedGeneration = details.failed_generation;
                return error;
            }
            return new AIProviderError('invalid_request', 'Groq rejected the request', options);
        }
        if (status === 429) {
            const retryAfter = Number(header(err.headers, 'retry-after'));
            const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : undefined;
            const dailyRequestsLeft = header(err.headers, 'x-ratelimit-remaining-requests');
            const exhausted =
                DAILY_LIMIT_PATTERN.test(String(details.message ?? '')) ||
                (retryAfterSeconds ?? 0) > QUOTA_RETRY_AFTER_SECONDS ||
                dailyRequestsLeft === '0';
            return new AIProviderError(exhausted ? 'quota_exhausted' : 'rate_limited',
                exhausted ? 'Groq daily quota is exhausted' : 'Groq per-minute limit reached',
                { ...options, retryAfterSeconds });
        }
        if (status >= 500 || status === 498) return new AIProviderError('unavailable', `Groq is unavailable (HTTP ${status})`, options);
        return new AIProviderError('invalid_request', `Groq returned HTTP ${status}`, options);
    }
    if (err instanceof Groq.APIConnectionError) return new AIProviderError('connection', 'Could not reach Groq', { cause: err });
    return new AIProviderError('unavailable', 'Unexpected failure calling Groq', { cause: err });
}

/**
 * @param {object} options
 * @param {string} options.apiKey
 * @param {string} options.model
 * @param {string} [options.reasoningEffort]
 * @param {typeof fetch} [options.fetch] injected in tests
 * @param {() => number} [options.now]
 * @returns {import('../../application/ports.js').AIProvider}
 */
export function createGroqProvider({ apiKey, model, reasoningEffort = 'low', fetch: fetchImpl, now = Date.now }) {
    // maxRetries: 0 — the application's retry policy is the only one (see application/retry.js).
    const client = new Groq({ apiKey, maxRetries: 0, ...(fetchImpl && { fetch: fetchImpl }) });

    return {
        name: PROVIDER_NAME,
        model,

        async generateStructured({ system, prompt, schemaName, schema, maxOutputTokens, timeoutMs, signal }) {
            const startedAt = now();
            const timeoutSignal = AbortSignal.timeout(timeoutMs);
            const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
            const result = (data, completion, recovered) => ({
                data,
                usage: {
                    inputTokens: completion?.usage?.prompt_tokens ?? null,
                    outputTokens: completion?.usage?.completion_tokens ?? null,
                    totalTokens: completion?.usage?.total_tokens ?? null,
                },
                provider: PROVIDER_NAME,
                model: completion?.model ?? model,
                latencyMs: now() - startedAt,
                recovered,
            });

            let completion;
            try {
                completion = await client.chat.completions.create({
                    model,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: prompt },
                    ],
                    response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
                    reasoning_effort: reasoningEffort,
                    include_reasoning: false,
                    max_completion_tokens: maxOutputTokens,
                    temperature: 0.7,
                }, { signal: requestSignal, timeout: timeoutMs, maxRetries: 0 });
            } catch (err) {
                const error = classify(err, { timedOut: () => timeoutSignal.aborted, callerSignal: signal });
                // Groq returns the full text it rejected. Usually one field is wrong, so hand it to
                // the application's own validation rather than paying for a second generation.
                const salvaged = parseJsonObject(error.failedGeneration);
                if (salvaged) return result(salvaged, null, true);
                throw error;
            }

            // From here on Groq has generated output and charged for it, so every failure carries the usage.
            const ok = result(null, completion, false);
            const charged = { generated: true, usage: ok.usage };
            const choice = completion.choices?.[0];
            if (!choice) throw new AIProviderError('invalid_output', 'Groq returned no choices', charged);
            if (choice.message?.refusal) throw new AIProviderError('refused', 'The model declined the request', charged);
            if (choice.finish_reason === 'length') throw new AIProviderError('truncated', 'Output hit the token limit', charged);
            const data = parseJsonObject(choice.message?.content);
            if (!data) throw new AIProviderError('invalid_output', 'Groq returned content that is not a JSON object', charged);
            return { ...ok, data };
        },

        async checkAvailability({ signal } = {}) {
            const timeoutSignal = AbortSignal.timeout(5000);
            try {
                await client.models.retrieve(model, {
                    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
                    timeout: 5000,
                    maxRetries: 0,
                });
            } catch (err) {
                throw classify(err, { timedOut: () => timeoutSignal.aborted, callerSignal: signal });
            }
        },
    };
}
