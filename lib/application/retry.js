// Bounded retry with one overall deadline. This is the only retry policy in the
// system: the provider SDK's own retries are switched off.

export const defaultSleep = (ms, signal) =>
    new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(signal.reason);
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        function onAbort() {
            clearTimeout(timer);
            reject(signal.reason);
        }
        signal?.addEventListener('abort', onAbort, { once: true });
    });

/**
 * @param {(attempt: number) => Promise<T>} operation attempt is 1-based
 * @param {object} policy
 * @param {(err: unknown) => {retry: boolean, delayMs?: number}} policy.classify
 *        delayMs, when given (e.g. from Retry-After), replaces the computed back-off
 * @param {number} policy.deadlineAt epoch ms after which no attempt may start
 * @param {number} [policy.maxAttempts] total attempts, including the first
 * @param {number} [policy.minAttemptMs] time an attempt needs to be worth starting
 * @template T
 * @returns {Promise<T>}
 */
export async function withRetry(operation, {
    classify,
    deadlineAt,
    maxAttempts = 2,
    baseDelayMs = 500,
    maxDelayMs = 4000,
    minAttemptMs = 3000,
    now = Date.now,
    random = Math.random,
    sleep = defaultSleep,
    signal,
}) {
    for (let attempt = 1; ; attempt += 1) {
        try {
            return await operation(attempt);
        } catch (error) {
            if (attempt >= maxAttempts || signal?.aborted) throw error;
            const decision = classify(error);
            if (!decision.retry) throw error;
            // Full jitter, so simultaneous failures do not retry in step.
            const delayMs = decision.delayMs ?? Math.round(random() * Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1)));
            if (now() + delayMs + minAttemptMs > deadlineAt) throw error;
            await sleep(delayMs, signal);
            if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : error;
        }
    }
}
