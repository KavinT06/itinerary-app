// Composition root: the one place that decides which adapters are in use and wires
// them into the use cases. Built once per server instance.

import 'server-only';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createGroqProvider } from './ai/groq-provider.js';
import { createMemoryStore } from './store/memory-store.js';
import { createRedisStore } from './store/redis-store.js';
import { createResilientStore } from './store/resilient-store.js';
import { createLimits, createUsage } from '../application/limits.js';
import { createGenerateTrip } from '../application/generate-trip.js';

/**
 * @param {object} [overrides] tests pass fakes here: { config, logger, provider, store }
 */
export function buildContainer(overrides = {}) {
    const config = overrides.config ?? loadConfig();
    const logger = overrides.logger ?? createLogger();
    for (const message of config.warnings ?? []) logger.warn('config_warning', { message });
    for (const message of config.problems) logger.error('config_problem', { message });

    let storeKind = 'memory';
    let store = overrides.store;
    if (!store) {
        const memory = createMemoryStore();
        if (config.store) {
            storeKind = 'shared';
            store = createResilientStore({
                primary: createRedisStore(config.store),
                fallback: memory,
                onDegraded: (event, fields) => logger.warn(event, fields),
            });
        } else {
            store = memory;
        }
    }

    const usable = config.ai.configured && config.problems.length === 0;
    const provider = overrides.provider !== undefined
        ? overrides.provider
        : usable
            ? createGroqProvider({ apiKey: config.ai.apiKey, model: config.ai.model, reasoningEffort: config.ai.reasoningEffort })
            : null;

    const limits = createLimits({
        store,
        clientLimits: config.clientLimits,
        budget: config.budget,
        providerName: provider?.name ?? config.ai.provider,
    });
    const usage = createUsage({ store, onError: (err) => logger.warn('usage_write_failed', { error: err?.name }) });
    const generateTrip = createGenerateTrip({
        provider, store, limits, usage, logger,
        config: { timeoutMs: config.ai.timeoutMs, maxOutputTokens: config.ai.maxOutputTokens, cacheTtlSeconds: config.cache.ttlSeconds },
    });

    return { config, logger, store, storeKind, provider, usage, generateTrip };
}

let instance = null;

export function getContainer() {
    instance ??= buildContainer();
    return instance;
}

/** Tests only: replace or clear the shared instance. */
export function setContainer(container) {
    instance = container;
}
