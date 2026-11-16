// Cache key for a generated itinerary. It contains everything that changes the output
// and nothing personal: the traveller's name and the client are deliberately excluded.

import { createHash } from 'node:crypto';
import { PROMPT_VERSION } from './itinerary-prompt.js';

const KEY_FORMAT = 'v1';

/** Destinations that differ only by case, spacing or Unicode form share one entry. */
export function normalizeDestination(destination) {
    return destination.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * @param {{destination: string, startDate: string, endDate: string}} request
 * @param {{name: string, model: string}} provider
 */
export function tripCacheKey(request, provider) {
    const parts = [
        PROMPT_VERSION,
        provider.name,
        provider.model,
        normalizeDestination(request.destination),
        request.startDate,
        request.endDate,
    ];
    return `trip:${KEY_FORMAT}:${createHash('sha256').update(JSON.stringify(parts)).digest('hex')}`;
}
