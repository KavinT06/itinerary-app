import 'server-only';

// Store port in process memory. Used locally, in tests, and as the fallback when the
// shared store is unreachable. State is per instance, so limits here are best effort.

// Few keys, and evicting them would reset the global budget or the circuit.
const PROTECTED_PREFIXES = ['gen:', 'tok:', 'circuit:', 'usage:'];
const isProtected = (key) => PROTECTED_PREFIXES.some((prefix) => key.startsWith(prefix));

/** @param {{now?: () => number, maxKeys?: number}} [options] */
export function createMemoryStore({ now = Date.now, maxKeys = 10_000 } = {}) {
    const entries = new Map(); // key -> { value: string, expiresAt: number }

    function live(key) {
        const entry = entries.get(key);
        if (!entry) return null;
        if (entry.expiresAt <= now()) {
            entries.delete(key);
            return null;
        }
        return entry;
    }

    /** Bounded memory: drop expired entries, then the oldest, before adding a new key. */
    function makeRoom() {
        if (entries.size < maxKeys) return;
        const t = now();
        for (const [key, entry] of entries) {
            if (entry.expiresAt <= t) entries.delete(key);
        }
        for (const key of entries.keys()) {
            if (entries.size < maxKeys) break;
            if (!isProtected(key)) entries.delete(key);
        }
    }

    return {
        async get(key) {
            return live(key)?.value ?? null;
        },
        async set(key, value, { ttlSeconds }) {
            if (!entries.has(key)) makeRoom();
            entries.set(key, { value: String(value), expiresAt: now() + ttlSeconds * 1000 });
        },
        async incr(key, { ttlSeconds, by = 1 }) {
            const entry = live(key);
            if (entry) {
                entry.value = String(Number(entry.value) + by);
                return Number(entry.value);
            }
            makeRoom();
            entries.set(key, { value: String(by), expiresAt: now() + ttlSeconds * 1000 });
            return by;
        },
        async ping() {},
    };
}
