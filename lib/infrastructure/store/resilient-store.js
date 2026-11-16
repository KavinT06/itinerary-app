import 'server-only';

// Wraps the shared store so that an outage degrades protection instead of failing
// requests: on an error or a timeout, the operation runs on the memory store instead.

/**
 * @param {object} options
 * @param {import('../../application/ports.js').Store} options.primary
 * @param {import('../../application/ports.js').Store} options.fallback
 * @param {(event: string, fields: object) => void} [options.onDegraded]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.retryPrimaryAfterMs] after a failure, use the fallback without trying the
 *        primary for this long. Otherwise a hanging store adds a full timeout to every operation and
 *        can push a request past the function's time limit.
 * @param {() => number} [options.now]
 */
export function createResilientStore({ primary, fallback, onDegraded = () => {}, timeoutMs = 1000, retryPrimaryAfterMs = 30_000, now = Date.now }) {
    let degraded = false;
    let skipPrimaryUntil = 0;

    function withTimeout(promise) {
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('store timeout')), timeoutMs);
        });
        return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
    }

    async function run(operation, args) {
        if (now() < skipPrimaryUntil) return fallback[operation](...args);
        try {
            const result = await withTimeout(primary[operation](...args));
            degraded = false;
            return result;
        } catch (err) {
            degraded = true;
            skipPrimaryUntil = now() + retryPrimaryAfterMs;
            onDegraded('store_degraded', { operation, error: err?.message === 'store timeout' ? 'timeout' : err?.name });
            return fallback[operation](...args);
        }
    }

    return {
        get: (...args) => run('get', args),
        set: (...args) => run('set', args),
        incr: (...args) => run('incr', args),
        /** Unlike the others, ping reports failure: it exists to answer "is the shared store up?". */
        async ping() {
            try {
                await withTimeout(primary.ping());
                degraded = false;
                skipPrimaryUntil = 0;
            } catch (err) {
                degraded = true;
                throw err;
            }
        },
        isDegraded: () => degraded,
    };
}
