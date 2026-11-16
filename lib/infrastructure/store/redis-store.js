// Store port on Upstash Redis (HTTP REST, so no connection pool to manage).

import 'server-only';
import { Redis } from '@upstash/redis';

/**
 * @param {{url: string, token: string}} options
 * @param {object} [client] injected in tests
 */
export function createRedisStore({ url, token }, client) {
    // Values are stored and returned as plain strings; the application does its own JSON.
    // retries: 0: the resilient wrapper decides what to do on failure. The SDK default (5 retries
    // with back-off) would keep calling a failing store after the wrapper has already moved on.
    const redis = client ?? new Redis({ url, token, automaticDeserialization: false, retry: { retries: 0 } });

    return {
        async get(key) {
            const value = await redis.get(key);
            return value === null || value === undefined ? null : String(value);
        },
        async set(key, value, { ttlSeconds }) {
            await redis.set(key, String(value), { ex: ttlSeconds });
        },
        async incr(key, { ttlSeconds, by = 1 }) {
            // One atomic transaction. EXPIRE ... NX sets the TTL only when the key has none,
            // so the window starts at the first increment and is not extended by later ones.
            const [count] = await redis.multi().incrby(key, by).expire(key, ttlSeconds, 'NX').exec();
            return Number(count);
        },
        async ping() {
            await redis.ping();
        },
    };
}
