// Rate limits, the daily budget, the provider circuit and usage counters. All of it
// runs on the Store port, so the same code works on Redis and on the memory store.

import { AppError } from './errors.js';
import { isoDateFromMs } from '../domain/dates.js';
import { waitMessage } from '../domain/error-codes.js';

const MINUTE_MS = 60_000;
const DAY_SECONDS = 86_400;
const USAGE_TTL_SECONDS = 35 * DAY_SECONDS;

const utcDate = isoDateFromMs;
const secondsUntilNextMinute = (ms) => Math.max(1, Math.ceil((MINUTE_MS - (ms % MINUTE_MS)) / 1000));
const secondsUntilNextUtcDay = (ms) => Math.max(1, Math.ceil((DAY_SECONDS * 1000 - (ms % (DAY_SECONDS * 1000))) / 1000));

/**
 * @param {object} deps
 * @param {import('./ports.js').Store} deps.store
 * @param {{perMinute: number, perDay: number, tokensPerDay: number}} deps.clientLimits
 *        tokensPerDay stops one client spending the whole global daily budget within its request limits
 * @param {{dailyRequests: number, dailyTokens: number}} deps.budget
 * @param {string} deps.providerName
 * @param {() => number} [deps.now]
 */
export function createLimits({ store, clientLimits, budget, providerName, now = Date.now }) {
    const circuitKey = `circuit:${providerName}`;

    return {
        /** Per-client fixed windows. Throws RATE_LIMITED. */
        async checkClient(clientId) {
            const ms = now();
            const perMinute = await store.incr(`rl:m:${clientId}:${Math.floor(ms / MINUTE_MS)}`, { ttlSeconds: 120 });
            if (perMinute > clientLimits.perMinute) {
                const retryAfterSeconds = secondsUntilNextMinute(ms);
                throw new AppError('RATE_LIMITED', { message: waitMessage.RATE_LIMITED(retryAfterSeconds), retryAfterSeconds });
            }
            const date = utcDate(ms);
            const tokensToday = Number(await store.get(`rl:t:${clientId}:${date}`));
            const perDay = await store.incr(`rl:d:${clientId}:${date}`, { ttlSeconds: DAY_SECONDS + 3600 });
            if (perDay > clientLimits.perDay || tokensToday >= (clientLimits.tokensPerDay ?? Infinity)) {
                throw new AppError('RATE_LIMITED', {
                    message: waitMessage.RATE_LIMITED_DAILY,
                    retryAfterSeconds: secondsUntilNextUtcDay(ms),
                });
            }
        },

        /** Throws AI_QUOTA_EXHAUSTED while the provider has recently reported an exhausted quota. */
        async checkCircuit() {
            const until = Number(await store.get(circuitKey));
            if (until > now()) throw new AppError('AI_QUOTA_EXHAUSTED', { providerKind: 'quota_exhausted' });
        },

        /** Stop calling the provider for a while after it reports quota exhaustion. */
        async openCircuit(retryAfterSeconds) {
            const seconds = Math.min(3600, Math.max(60, Math.round(retryAfterSeconds || 600)));
            await store.set(circuitKey, String(now() + seconds * 1000), { ttlSeconds: seconds });
        },

        /** Throws AI_QUOTA_EXHAUSTED once today's global budget is used. */
        async checkDailyBudget() {
            const date = utcDate(now());
            const [requests, tokens] = await Promise.all([store.get(`gen:d:${date}`), store.get(`tok:d:${date}`)]);
            if (Number(requests) >= budget.dailyRequests || Number(tokens) >= budget.dailyTokens) {
                throw new AppError('AI_QUOTA_EXHAUSTED');
            }
        },

        /** Count one provider call and its tokens, globally and against the client that caused it. */
        async recordGeneration(totalTokens, clientId) {
            const date = utcDate(now());
            const ttl = { ttlSeconds: DAY_SECONDS + 3600 };
            await store.incr(`gen:d:${date}`, ttl);
            if (totalTokens > 0) {
                await store.incr(`tok:d:${date}`, { ...ttl, by: totalTokens });
                if (clientId) await store.incr(`rl:t:${clientId}:${date}`, { ...ttl, by: totalTokens });
            }
        },
    };
}

export const USAGE_FIELDS = Object.freeze([
    'requests', 'generated', 'cache_hits', 'joined', 'rate_limited', 'failed', 'recovered', 'retries',
    'input_tokens', 'output_tokens', 'unreported_usage',
]);

/** Best-effort daily counters. A failure here must never fail a request. */
export function createUsage({ store, now = Date.now, onError = () => {} }) {
    return {
        /** @param {Record<string, number>} fields e.g. { requests: 1, output_tokens: 5100 } */
        async record(fields) {
            const date = utcDate(now());
            const writes = Object.entries(fields)
                .filter(([, by]) => Number.isFinite(by) && by > 0)
                .map(([field, by]) => store.incr(`usage:${date}:${field}`, { ttlSeconds: USAGE_TTL_SECONDS, by }));
            try {
                await Promise.all(writes);
            } catch (err) {
                onError(err);
            }
        },

        async read(date, extraFields = []) {
            const fields = [...USAGE_FIELDS, ...extraFields];
            const values = await Promise.all(fields.map((field) => store.get(`usage:${date}:${field}`)));
            return Object.fromEntries(fields.map((field, i) => [field, Number(values[i]) || 0]));
        },
    };
}
