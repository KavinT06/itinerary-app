// The only module that reads process.env. Parses and validates configuration once
// and reports every problem together, so a misconfigured deployment is visible on the
// health endpoint instead of failing one request at a time.

import 'server-only';

// app/api/trips/route.js sets maxDuration = 60. The generation deadline must leave room to respond.
const MAX_TIMEOUT_MS = 55_000;
// The owner endpoints are not rate-limited, so the token must be long enough not to be guessed.
const MIN_ADMIN_TOKEN_LENGTH = 32;

function readInt(env, name, fallback, { min, max }, problems) {
    const raw = env[name]?.trim();
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
        problems.push(`${name} must be a whole number between ${min} and ${max}`);
        return fallback;
    }
    return value;
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {Readonly<object>} `problems` lists invalid settings; `ai.configured` is false when the
 *   key or model is missing. Neither throws: callers decide how to report it.
 */
export function loadConfig(env = process.env) {
    const problems = [];
    const warnings = [];
    const text = (name) => env[name]?.trim() || '';
    if (text('ADMIN_TOKEN') && text('ADMIN_TOKEN').length < MIN_ADMIN_TOKEN_LENGTH) {
        warnings.push(`ADMIN_TOKEN is shorter than ${MIN_ADMIN_TOKEN_LENGTH} characters and is ignored; the owner endpoints stay disabled`);
    }

    const provider = text('AI_PROVIDER') || 'groq';
    if (provider !== 'groq') problems.push('AI_PROVIDER must be "groq"');

    const apiKey = text('GROQ_API_KEY');
    const model = text('GROQ_MODEL');
    const reasoningEffort = text('GROQ_REASONING_EFFORT') || 'low';

    const storeUrl = text('UPSTASH_REDIS_REST_URL') || text('KV_REST_API_URL');
    const storeToken = text('UPSTASH_REDIS_REST_TOKEN') || text('KV_REST_API_TOKEN');
    if (Boolean(storeUrl) !== Boolean(storeToken)) {
        problems.push('The shared store needs both a URL and a token');
    }

    const config = {
        ai: {
            provider,
            apiKey,
            model,
            reasoningEffort,
            configured: Boolean(apiKey && model),
            timeoutMs: readInt(env, 'AI_TIMEOUT_MS', 50_000, { min: 5_000, max: MAX_TIMEOUT_MS }, problems),
            maxOutputTokens: readInt(env, 'AI_MAX_OUTPUT_TOKENS', 10_000, { min: 500, max: 65_536 }, problems),
        },
        budget: {
            dailyRequests: readInt(env, 'AI_DAILY_REQUEST_BUDGET', 900, { min: 1, max: 10_000_000 }, problems),
            dailyTokens: readInt(env, 'AI_DAILY_TOKEN_BUDGET', 180_000, { min: 1_000, max: 1_000_000_000 }, problems),
        },
        clientLimits: {
            perMinute: readInt(env, 'RATE_LIMIT_PER_MINUTE', 5, { min: 1, max: 1_000 }, problems),
            perDay: readInt(env, 'RATE_LIMIT_PER_DAY', 30, { min: 1, max: 100_000 }, problems),
            // About 5 fourteen-day or 13 three-day trips; at least six visitors are needed to use the daily budget.
            tokensPerDay: readInt(env, 'RATE_LIMIT_TOKENS_PER_DAY', 30_000, { min: 1_000, max: 1_000_000_000 }, problems),
        },
        cache: {
            ttlSeconds: readInt(env, 'CACHE_TTL_SECONDS', 86_400, { min: 0, max: 30 * 86_400 }, problems),
        },
        store: storeUrl && storeToken ? { url: storeUrl, token: storeToken } : null,
        adminToken: text('ADMIN_TOKEN').length >= MIN_ADMIN_TOKEN_LENGTH ? text('ADMIN_TOKEN') : '',
        isDevelopment: env.NODE_ENV === 'development',
        problems,
        warnings,
    };
    return Object.freeze(config);
}
