// The trip-generation use case. It knows the order of operations and nothing about
// HTTP, Groq or Redis: those arrive as dependencies.

import { isoDateFromMs, addDays } from '../domain/dates.js';
import { parseTripRequest, MAX_START_DAYS_AHEAD } from '../domain/trip-request.js';
import { validateItinerary, ItineraryFormatError } from '../domain/itinerary.js';
import { AIProviderError, AppError, appErrorFromProvider } from './errors.js';
import { tripCacheKey } from './cache-key.js';
import { SYSTEM_INSTRUCTION, SCHEMA_NAME, ITINERARY_SCHEMA, buildPrompt, maxOutputTokensFor } from './itinerary-prompt.js';
import { withRetry, defaultSleep } from './retry.js';

// A retry is started only if this much of the deadline remains: the longest measured
// generation (14 days) took 13 s (docs/architecture/HLD.md section 8.6).
const MIN_ATTEMPT_MS = 15_000;
const RETRYABLE_KINDS = new Set(['unavailable', 'connection', 'invalid_output']);
// When the provider charged for a generation but did not report usage (a rejected generation, a
// timeout), the daily budget is charged this much on top of the output cap. Measured input is
// 575-680 tokens; this is an upper bound for budget safety, never reported as usage.
const UNREPORTED_INPUT_ALLOWANCE = 800;

function classifyForRetry(err) {
    if (err instanceof ItineraryFormatError) return { retry: true };
    if (!(err instanceof AIProviderError)) return { retry: false };
    if (err.kind === 'rate_limited') {
        const seconds = err.retryAfterSeconds;
        if (!seconds) return { retry: false };
        // Wait slightly longer than asked: the allowance refills continuously.
        return { retry: true, delayMs: seconds * 1000 + 500 };
    }
    return { retry: RETRYABLE_KINDS.has(err.kind) };
}

function toAppError(err) {
    if (err instanceof AppError) return err;
    if (err instanceof AIProviderError) return appErrorFromProvider(err);
    if (err instanceof ItineraryFormatError) {
        return new AppError('AI_INVALID_RESPONSE', { providerKind: `validation:${err.rule}`, cause: err });
    }
    return new AppError('INTERNAL', { cause: err });
}

/**
 * @param {object} deps
 * @param {import('./ports.js').AIProvider | null} deps.provider null when the AI is not configured
 * @param {import('./ports.js').Store} deps.store
 * @param {ReturnType<import('./limits.js').createLimits>} deps.limits
 * @param {ReturnType<import('./limits.js').createUsage>} deps.usage
 * @param {import('./ports.js').Logger} deps.logger
 * @param {{timeoutMs: number, maxOutputTokens: number, cacheTtlSeconds: number}} deps.config
 */
export function createGenerateTrip({
    provider, store, limits, usage, logger, config,
    now = Date.now, random = Math.random, sleep = defaultSleep,
}) {
    /** Generations running in this instance, by cache key. Identical requests join instead of paying twice. */
    const inFlight = new Map();

    /** A cache entry is store content, so it is validated like model output before use. A bad entry is a miss. */
    async function readCache(key, request) {
        if (config.cacheTtlSeconds <= 0) return null;
        try {
            const raw = await store.get(key);
            if (!raw) return null;
            const cached = JSON.parse(raw);
            const generatedAt = typeof cached?.generatedAt === 'string' && !Number.isNaN(Date.parse(cached.generatedAt))
                ? new Date(cached.generatedAt).toISOString()
                : null;
            if (!generatedAt) return null;
            return { ...validateItinerary(cached, request), generatedAt };
        } catch (err) {
            logger.warn('cache_read_failed', { error: err?.name });
            return null;
        }
    }

    async function writeCache(key, itinerary) {
        if (config.cacheTtlSeconds <= 0) return;
        try {
            await store.set(key, JSON.stringify(itinerary), { ttlSeconds: config.cacheTtlSeconds });
        } catch (err) {
            logger.warn('cache_write_failed', { error: err?.name });
        }
    }

    /**
     * Charges the daily budget for one provider call that generated output. Reported usage is
     * used when available; otherwise a conservative upper bound, so the budget never undercounts.
     */
    async function charge(reportedUsage, maxOutputTokens, meta, clientId) {
        const reported = reportedUsage?.totalTokens;
        if (Number.isFinite(reported)) {
            meta.inputTokens = (meta.inputTokens ?? 0) + (reportedUsage.inputTokens ?? 0);
            meta.outputTokens = (meta.outputTokens ?? 0) + (reportedUsage.outputTokens ?? 0);
        } else {
            meta.unreportedUsage = (meta.unreportedUsage ?? 0) + 1;
        }
        const tokens = Number.isFinite(reported) ? reported : maxOutputTokens + UNREPORTED_INPUT_ALLOWANCE;
        await limits.recordGeneration(tokens, clientId).catch((err) => logger.warn('budget_write_failed', { error: err?.name }));
    }

    /** One provider call plus validation. Throws AIProviderError or ItineraryFormatError. */
    async function attemptGeneration(request, signal, deadlineAt, meta, clientId) {
        const maxOutputTokens = maxOutputTokensFor(request.dates.length, config.maxOutputTokens);
        let result;
        try {
            result = await provider.generateStructured({
                system: SYSTEM_INSTRUCTION,
                prompt: buildPrompt(request),
                schemaName: SCHEMA_NAME,
                schema: ITINERARY_SCHEMA,
                maxOutputTokens,
                timeoutMs: Math.max(1000, deadlineAt - now()),
                signal,
            });
        } catch (err) {
            // Output the provider generated and then rejected is still charged by the provider.
            if (err instanceof AIProviderError && err.generated) await charge(err.usage, maxOutputTokens, meta, clientId);
            throw err;
        }
        meta.model = result.model;
        meta.recovered = meta.recovered || result.recovered;
        await charge(result.usage, maxOutputTokens, meta, clientId);
        return { ...validateItinerary(result.data, request), generatedAt: new Date(now()).toISOString() };
    }

    async function generate(request, signal, deadlineAt, meta, clientId) {
        if (!provider) throw new AIProviderError('not_configured', 'AI provider is not configured');
        await limits.checkCircuit();
        await limits.checkDailyBudget();
        try {
            return await withRetry(
                (attempt) => {
                    meta.attempts = attempt;
                    return attemptGeneration(request, signal, deadlineAt, meta, clientId);
                },
                { classify: classifyForRetry, deadlineAt, minAttemptMs: MIN_ATTEMPT_MS, now, random, sleep, signal },
            );
        } catch (err) {
            // Cancellation can surface as the abort reason (from a back-off sleep, for example).
            if (signal.aborted && !(err instanceof AIProviderError && err.kind === 'aborted')) {
                throw new AIProviderError('aborted', 'Generation was cancelled', { cause: err });
            }
            if (err instanceof AIProviderError && err.kind === 'quota_exhausted') {
                await limits.openCircuit(err.retryAfterSeconds).catch(() => {});
            }
            throw err;
        }
    }

    /**
     * Starts a generation shared by every caller with the same key, or joins the one running.
     * The cost of a generation is recorded once, when it settles, whoever is still waiting for it.
     */
    function joinOrStart(key, request, deadlineAt, model, clientId) {
        const running = inFlight.get(key);
        if (running && !running.controller.signal.aborted) return { entry: running, joined: true };

        const controller = new AbortController();
        const meta = { attempts: 0, inputTokens: null, outputTokens: null, recovered: false, unreportedUsage: 0, model };
        const entry = { key, controller, waiters: 0, meta, promise: null };
        const recordCost = (succeeded) => usage.record({
            generated: succeeded ? 1 : 0,
            input_tokens: meta.inputTokens ?? 0,
            output_tokens: meta.outputTokens ?? 0,
            retries: Math.max(0, meta.attempts - 1),
            recovered: meta.recovered ? 1 : 0,
            unreported_usage: meta.unreportedUsage,
        });
        entry.promise = generate(request, controller.signal, deadlineAt, meta, clientId)
            .then(
                async (itinerary) => {
                    await writeCache(key, itinerary);
                    await recordCost(true);
                    return itinerary;
                },
                async (err) => {
                    await recordCost(false);
                    throw err;
                },
            )
            .finally(() => {
                if (inFlight.get(key) === entry) inFlight.delete(key);
            });
        // Callers attach their own handlers; this keeps an abandoned failure from being unhandled.
        entry.promise.catch(() => {});
        inFlight.set(key, entry);
        return { entry, joined: false };
    }

    /** Waits for the shared generation, but lets this caller leave. The work stops when nobody is waiting. */
    function waitFor(entry, signal) {
        entry.waiters += 1;
        return new Promise((resolve, reject) => {
            const leave = () => {
                entry.waiters -= 1;
                if (entry.waiters === 0) {
                    entry.controller.abort();
                    // Nobody may join a generation that is being cancelled.
                    if (inFlight.get(entry.key) === entry) inFlight.delete(entry.key);
                }
                reject(new AppError('CLIENT_CLOSED'));
            };
            if (signal?.aborted) return leave();
            signal?.addEventListener('abort', leave, { once: true });
            entry.promise.then(resolve, reject).finally(() => signal?.removeEventListener('abort', leave));
        });
    }

    /**
     * @param {unknown} input the parsed JSON body
     * @param {{clientId: string, signal?: AbortSignal, startedAt?: number}} context
     *        startedAt (epoch ms) lets the generation deadline include time already spent on the request
     * @returns {Promise<{trip: object, meta: object}>} meta is for the log line; it holds no personal data
     * @throws {AppError} with `meta` attached
     */
    return async function generateTrip(input, { clientId, signal, startedAt }) {
        const meta = { cache: null, days: null, provider: provider?.name ?? null, model: provider?.model ?? null, attempts: 0, inputTokens: null, outputTokens: null, recovered: false };
        const counters = { requests: 1 };
        let generation = null; // { entry, joined } once this request needs a generation
        try {
            const todayUtc = isoDateFromMs(now());
            const parsed = parseTripRequest(input, {
                // One day of slack each way: the visitor's calendar day can differ from UTC.
                minStartDate: addDays(todayUtc, -1),
                maxStartDate: addDays(todayUtc, MAX_START_DAYS_AHEAD + 1),
            });
            if (!parsed.ok) throw new AppError('VALIDATION_FAILED', { message: parsed.error, field: parsed.field });
            const request = parsed.value;
            meta.days = request.dates.length;

            await limits.checkClient(clientId);

            const personal = { destination: request.destination, startDate: request.startDate, endDate: request.endDate, createdBy: request.createdBy };
            const key = tripCacheKey(request, { name: provider?.name ?? 'none', model: provider?.model ?? 'none' });

            const cached = await readCache(key, request);
            if (cached) {
                meta.cache = 'hit';
                counters.cache_hits = 1;
                return { trip: { ...cached, ...personal }, meta };
            }

            const deadlineAt = (startedAt ?? now()) + config.timeoutMs;
            generation = joinOrStart(key, request, deadlineAt, meta.model, clientId);
            meta.cache = generation.joined ? 'joined' : 'miss';
            const itinerary = await waitFor(generation.entry, signal);
            if (generation.joined) counters.joined = 1;
            return { trip: { ...itinerary, ...personal }, meta };
        } catch (err) {
            const appError = toAppError(err).forCaller(meta);
            if (appError.code === 'RATE_LIMITED') counters.rate_limited = 1;
            else if (appError.code !== 'VALIDATION_FAILED' && appError.code !== 'CLIENT_CLOSED') counters.failed = 1;
            counters[`error:${appError.code}`] = 1;
            throw appError;
        } finally {
            // The request that started the generation logs its cost (as far as it is known when it finishes).
            if (generation && !generation.joined) {
                const { attempts, inputTokens, outputTokens, recovered, model } = generation.entry.meta;
                Object.assign(meta, { attempts, inputTokens, outputTokens, recovered, model });
            }
            await usage.record(counters);
        }
    };
}
