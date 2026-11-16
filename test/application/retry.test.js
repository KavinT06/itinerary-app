// withRetry against LLD 4.6: "A cancelled request never retries".

import test from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../../lib/application/retry.js';

test('cancellation during the back-off wait: no further attempt starts', async () => {
    const controller = new AbortController();
    let calls = 0;
    const clock = { now: 0 };
    const outcome = await withRetry(async () => {
        calls += 1;
        throw new Error('transient');
    }, {
        classify: () => ({ retry: true }),
        deadlineAt: 50_000,
        now: () => clock.now,
        random: () => 0.5,
        // The caller cancels while the wait is in progress; the wait itself completes.
        sleep: async (ms) => { clock.now += ms; controller.abort(); },
        signal: controller.signal,
    }).then(() => 'resolved', (err) => err);
    assert.equal(calls, 1, 'a second attempt was started after the request was cancelled');
    assert.ok(outcome instanceof Error);
});

test('the computed back-off is full jitter: zero when random() is 0, never above maxDelayMs', async () => {
    const delays = [];
    for (const r of [0, 0.999999]) {
        let calls = 0;
        await withRetry(async () => {
            calls += 1;
            if (calls === 1) throw new Error('t');
            return 'ok';
        }, {
            classify: () => ({ retry: true }), deadlineAt: 1e12, now: () => 0, random: () => r,
            baseDelayMs: 10_000, maxDelayMs: 4000, sleep: async (ms) => { delays.push(ms); },
        });
    }
    assert.equal(delays[0], 0);
    assert.ok(delays[1] <= 4000 && delays[1] > 3900, `delay ${delays[1]}`);
});
