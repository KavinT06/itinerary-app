// Real-provider smoke test. It spends quota, so it is never part of `npm test` and
// refuses to run unless explicitly confirmed.
//
//   SMOKE_AI=1 npm run smoke:ai            one 2-day itinerary
//   SMOKE_AI=1 npm run smoke:ai -- 7       a 7-day itinerary
//
// Reads GROQ_API_KEY and GROQ_MODEL from the environment or .env.local. Prints
// metadata only: never the key, never the full itinerary.

import { readFileSync, existsSync } from 'node:fs';
import { loadConfig } from '../lib/infrastructure/config.js';
import { createGroqProvider } from '../lib/infrastructure/ai/groq-provider.js';
import { createMemoryStore } from '../lib/infrastructure/store/memory-store.js';
import { createLimits, createUsage } from '../lib/application/limits.js';
import { createGenerateTrip } from '../lib/application/generate-trip.js';

if (process.env.SMOKE_AI !== '1') {
    console.error('This makes a real, quota-consuming request. Re-run with SMOKE_AI=1 to confirm.');
    process.exit(2);
}

const env = { ...process.env };
if (existsSync('.env.local')) {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
        const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
        if (match && env[match[1]] === undefined) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
}

const config = loadConfig(env);
if (!config.ai.configured || config.problems.length) {
    console.error('Configuration problem:', config.problems.length ? config.problems.join('; ') : 'GROQ_API_KEY and GROQ_MODEL are required');
    process.exit(1);
}

const days = Math.min(14, Math.max(1, Number(process.argv[2]) || 2));
const iso = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const store = createMemoryStore();
const provider = createGroqProvider({ apiKey: config.ai.apiKey, model: config.ai.model, reasoningEffort: config.ai.reasoningEffort });
const logger = { info() {}, warn: (event, fields) => console.warn('warn', event, fields), error: (event, fields) => console.error('error', event, fields) };
const generateTrip = createGenerateTrip({
    provider, store, logger,
    limits: createLimits({ store, clientLimits: config.clientLimits, budget: config.budget, providerName: provider.name }),
    usage: createUsage({ store }),
    config: { timeoutMs: config.ai.timeoutMs, maxOutputTokens: config.ai.maxOutputTokens, cacheTtlSeconds: 0 },
});

const startedAt = Date.now();
try {
    const { trip, meta } = await generateTrip(
        { destination: process.env.SMOKE_DESTINATION || 'Lisbon, Portugal', createdBy: 'Smoke Test', startDate: iso(30), endDate: iso(30 + days - 1) },
        { clientId: 'smoke' },
    );
    const venues = trip.days.flatMap((d) => d.activities.map((a) => a.location.toLowerCase()));
    console.log(JSON.stringify({
        ok: true,
        model: meta.model,
        days: trip.days.length,
        activitiesPerDay: trip.days.map((d) => d.activities.length),
        ms: Date.now() - startedAt,
        attempts: meta.attempts,
        recovered: meta.recovered,
        inputTokens: meta.inputTokens,
        outputTokens: meta.outputTokens,
        budget: trip.budget,
        repeatedVenues: venues.length - new Set(venues).size,
        firstActivity: trip.days[0].activities[0],
    }, null, 2));
} catch (err) {
    console.error(JSON.stringify({ ok: false, code: err.code, providerKind: err.providerKind, ms: Date.now() - startedAt, attempts: err.meta?.attempts }, null, 2));
    process.exit(1);
}
