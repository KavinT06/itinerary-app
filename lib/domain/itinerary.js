// Validation of model output. Model output is untrusted: this turns it into a
// GeneratedItinerary or throws. Each rule either rejects (the content is wrong) or
// repairs (only the form is wrong). See docs/architecture/LLD.md section 3.

import { parseIsoDate } from './dates.js';
import { cleanText, clip, isPlainObject } from './text.js';

export const ACTIVITIES_PER_DAY = 5;
export const MIN_ACTIVITIES_PER_DAY = 3;
export const MAX_ACTIVITIES_PER_DAY = 8;

export const TEXT_LIMITS = Object.freeze({
    title: 120,
    notes: 1000,
    dayLocation: 120,
    activityTitle: 120,
    activityDescription: 600,
    activityLocation: 200,
    activityNotes: 400,
});

/** Raised when model output cannot be turned into a usable itinerary. `rule` names the failed rule. */
export class ItineraryFormatError extends Error {
    constructor(message, { rule } = {}) {
        super(message);
        this.name = 'ItineraryFormatError';
        this.rule = rule;
    }
}

const CLOCK_TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** "8:00" -> "08:00"; anything that is not a 24-hour clock time -> null. */
function normalizeTime(value) {
    const match = CLOCK_TIME.exec(cleanText(value));
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
}

function isKnownCurrency(code) {
    try {
        new Intl.NumberFormat('en', { style: 'currency', currency: code });
        return true;
    } catch {
        return false;
    }
}

function normalizeBudget(budget) {
    if (!isPlainObject(budget)) return null;
    const estimated = Number(budget.estimated);
    const currency = cleanText(budget.currency).toUpperCase();
    if (!Number.isFinite(estimated) || estimated <= 0 || estimated > 1e10) return null;
    if (!/^[A-Z]{3}$/.test(currency) || !isKnownCurrency(currency)) return null;
    return { currency, estimated: Math.round(estimated) };
}

function normalizeActivities(rawActivities) {
    const activities = [];
    for (const raw of rawActivities) {
        if (!isPlainObject(raw)) continue;
        const time = normalizeTime(raw.time);
        const title = clip(raw.title, TEXT_LIMITS.activityTitle);
        // An activity without a usable time or title is dropped; the day survives if enough remain.
        if (!time || !title) continue;
        activities.push({
            time,
            title,
            description: clip(raw.description, TEXT_LIMITS.activityDescription),
            location: clip(raw.location, TEXT_LIMITS.activityLocation),
            notes: clip(raw.notes, TEXT_LIMITS.activityNotes),
        });
    }
    // Array.prototype.sort is stable, so equal times keep the model's order.
    activities.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    return activities.slice(0, MAX_ACTIVITIES_PER_DAY);
}

/**
 * @param {unknown} raw parsed model output
 * @param {{destination: string, dates: string[]}} request the validated request
 * @returns {{title: string, notes: string, budget: {currency: string, estimated: number} | null,
 *            days: Array<{day: number, date: string, location: string, activities: object[]}>}}
 *   The result is rebuilt field by field, so unexpected fields never pass through. Day numbers
 *   and dates come from the request, never from the model.
 */
export function validateItinerary(raw, request) {
    if (!isPlainObject(raw)) throw new ItineraryFormatError('Itinerary is not a JSON object.', { rule: 'shape' });
    if (!Array.isArray(raw.days)) throw new ItineraryFormatError('Itinerary has no "days" array.', { rule: 'shape' });

    const { dates } = request;
    if (raw.days.length !== dates.length) {
        throw new ItineraryFormatError(`Expected ${dates.length} days but model returned ${raw.days.length}.`, { rule: 'day_count' });
    }

    const days = dates.map((date, i) => {
        const day = raw.days[i];
        if (!isPlainObject(day) || !Array.isArray(day.activities)) {
            throw new ItineraryFormatError(`Day ${i + 1} is malformed.`, { rule: 'day_shape' });
        }
        // If the model gave a real date for this position, it must be the requested one;
        // otherwise its content may belong to a different day.
        if (parseIsoDate(day.date) !== null && day.date !== date) {
            throw new ItineraryFormatError(`Day ${i + 1} is dated ${day.date}, expected ${date}.`, { rule: 'day_date' });
        }
        const activities = normalizeActivities(day.activities);
        if (activities.length < MIN_ACTIVITIES_PER_DAY) {
            throw new ItineraryFormatError(`Day ${i + 1} has ${activities.length} usable activities.`, { rule: 'activity_count' });
        }
        return { day: i + 1, date, location: clip(day.location, TEXT_LIMITS.dayLocation), activities };
    });

    return {
        title: clip(raw.title, TEXT_LIMITS.title) || `${dates.length}-day trip to ${request.destination}`,
        notes: clip(raw.notes, TEXT_LIMITS.notes),
        budget: normalizeBudget(raw.budget),
        days,
    };
}
