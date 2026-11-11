// Fixed-window, in-memory rate limiter.
//
// Limitation: state lives in a single server instance. On serverless hosts each
// warm instance has its own counters, so this is a best-effort guard against
// accidental hammering and casual abuse, not a hard global quota.

export function createRateLimiter({ limit, windowMs, maxKeys = 5000 }) {
    const windows = new Map(); // key -> { start, count }

    return function check(key, now = Date.now()) {
        let entry = windows.get(key);
        if (!entry || now - entry.start >= windowMs) {
            if (!entry && windows.size >= maxKeys) {
                // Bounded memory: drop expired windows, or the oldest one if none expired.
                for (const [k, v] of windows) {
                    if (now - v.start >= windowMs) windows.delete(k);
                }
                if (windows.size >= maxKeys) windows.delete(windows.keys().next().value);
            }
            entry = { start: now, count: 0 };
            windows.delete(key); // re-insert so Map order stays oldest-window-first
            windows.set(key, entry);
        }

        if (entry.count >= limit) {
            return {
                allowed: false,
                retryAfterSeconds: Math.max(1, Math.ceil((entry.start + windowMs - now) / 1000)),
            };
        }
        entry.count += 1;
        return { allowed: true, remaining: limit - entry.count };
    };
}

/**
 * Best-effort client identifier. On Vercel, x-forwarded-for / x-real-ip are set
 * by the platform; on other hosts make sure a trusted proxy sets them.
 */
export function clientKey(headers) {
    const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    return forwarded || headers.get('x-real-ip')?.trim() || 'unknown';
}
