// Shared test helpers. Nothing here touches the network.

import { listDates } from '../lib/domain/dates.js';
import { createMemoryStore } from '../lib/infrastructure/store/memory-store.js';
import { createLimits, createUsage } from '../lib/application/limits.js';
import { createGenerateTrip } from '../lib/application/generate-trip.js';

const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" a number of days from today (UTC). The API rejects past dates, so tests use relative dates. */
export function daysFromNow(n, now = Date.now()) {
    return new Date(now + n * DAY_MS).toISOString().slice(0, 10);
}

export function tripBody(overrides = {}) {
    return {
        destination: 'Fort Kochi, Kochi, India',
        createdBy: 'Asha Traveller',
        startDate: daysFromNow(10),
        endDate: daysFromNow(11),
        ...overrides,
    };
}

export function activity(time, title, overrides = {}) {
    return { time, title, description: `About ${title}.`, location: `${title}, Old Town`, notes: 'Go early.', ...overrides };
}

export function dayOf(date, overrides = {}) {
    return {
        day: 1,
        date,
        location: 'Old Town',
        activities: [
            activity('08:00', 'Breakfast at Kashi Art Cafe'),
            activity('10:00', 'St Francis Church'),
            activity('13:00', 'Lunch at Fusion Bay'),
            activity('15:30', 'Chinese Fishing Nets'),
            activity('19:00', 'Dinner at Dal Roti'),
        ],
        ...overrides,
    };
}

/** Model output for a request, in the shape the schema asks for. */
export function modelOutput(startDate, dayCount, overrides = {}) {
    return {
        title: `${dayCount}-Day Fort Kochi Exploration`,
        notes: 'Pleasant weather. Carry cash.',
        budget: { currency: 'INR', estimated: 9000 },
        days: listDates(startDate, dayCount).map((date, i) => dayOf(date, { day: i + 1 })),
        ...overrides,
    };
}

export const usageOf = (input = 600, output = 1500) => ({ inputTokens: input, outputTokens: output, totalTokens: input + output });

/**
 * A provider whose behaviour is scripted per call. Each script entry is either a function
 * (request) => data, a plain data object, or an Error to throw.
 */
export function fakeProvider(script = []) {
    const calls = [];
    return {
        name: 'fake',
        model: 'fake-model-1',
        calls,
        async generateStructured(request) {
            calls.push(request);
            const step = script.length > 1 ? script.shift() : script[0];
            if (step instanceof Error) throw step;
            const data = typeof step === 'function' ? await step(request) : step;
            return { data, usage: usageOf(), provider: 'fake', model: 'fake-model-1', latencyMs: 1, recovered: false };
        },
        async checkAvailability() {},
    };
}

export function captureLogger() {
    const lines = [];
    const push = (level) => (event, fields = {}) => lines.push({ level, event, ...fields });
    return { lines, info: push('info'), warn: push('warn'), error: push('error') };
}

/** Builds the use case with fakes and a controllable clock. */
export function buildUseCase({ provider, store, clock = { now: Date.now() }, clientLimits, budget, config } = {}) {
    const now = () => clock.now;
    const theStore = store ?? createMemoryStore({ now });
    const logger = captureLogger();
    const sleeps = [];
    const limits = createLimits({
        store: theStore,
        clientLimits: { perMinute: 5, perDay: 30, ...clientLimits },
        budget: { dailyRequests: 900, dailyTokens: 180_000, ...budget },
        providerName: provider?.name ?? 'fake',
        now,
    });
    const usage = createUsage({ store: theStore, now });
    const generateTrip = createGenerateTrip({
        provider, store: theStore, limits, usage, logger,
        config: { timeoutMs: 50_000, maxOutputTokens: 10_000, cacheTtlSeconds: 86_400, ...config },
        now,
        random: () => 0.5,
        sleep: async (ms) => { sleeps.push(ms); clock.now += ms; },
    });
    return { generateTrip, store: theStore, limits, usage, logger, sleeps, clock };
}
