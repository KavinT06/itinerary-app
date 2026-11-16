// Validation of the trip request. Pure: used by the browser form and by the server,
// so the two cannot disagree about what a valid request is.

import { parseIsoDate, inclusiveDayCount, listDates } from './dates.js';
import { cleanText, isPlainObject } from './text.js';

export const MAX_TRIP_DAYS = 14;
export const MAX_DESTINATION_LENGTH = 150;
export const MAX_NAME_LENGTH = 80;
/** Trips may start up to about two years ahead. The form and the server both apply it. */
export const MAX_START_DAYS_AHEAD = 730;

/**
 * @param {unknown} body
 * @param {object} [options]
 * @param {string} [options.minStartDate] earliest allowed departure ("YYYY-MM-DD"); omitted = no check
 * @param {string} [options.maxStartDate] latest allowed departure ("YYYY-MM-DD"); omitted = no check
 * @returns {{ok: true, value: {destination: string, createdBy: string, startDate: string, endDate: string, dates: string[]}}
 *         | {ok: false, error: string, field: string}}
 *   `field` is the request field at fault: destination | createdBy | startDate | endDate | body.
 */
export function parseTripRequest(body, { minStartDate, maxStartDate } = {}) {
    const fail = (field, error) => ({ ok: false, error, field });

    if (!isPlainObject(body)) return fail('body', 'Request body must be a JSON object.');

    const destination = cleanText(body.destination);
    const createdBy = cleanText(body.createdBy);
    const { startDate, endDate } = body;

    if (!destination) return fail('destination', 'Destination is required.');
    if (destination.length > MAX_DESTINATION_LENGTH) {
        return fail('destination', `Destination must be at most ${MAX_DESTINATION_LENGTH} characters.`);
    }
    if (!createdBy) return fail('createdBy', 'Traveller name is required.');
    if (createdBy.length > MAX_NAME_LENGTH) {
        return fail('createdBy', `Name must be at most ${MAX_NAME_LENGTH} characters.`);
    }

    const startMs = parseIsoDate(startDate);
    const endMs = parseIsoDate(endDate);
    if (startMs === null) return fail('startDate', 'Departure date must be a valid date (YYYY-MM-DD).');
    if (endMs === null) return fail('endDate', 'Return date must be a valid date (YYYY-MM-DD).');
    if (minStartDate && startDate < minStartDate) return fail('startDate', 'Departure date cannot be in the past.');
    if (maxStartDate && startDate > maxStartDate) {
        return fail('startDate', 'Departure date is too far in the future. Please choose a date within two years.');
    }
    if (endMs < startMs) return fail('endDate', 'Return date must be on or after the departure date.');

    const dayCount = inclusiveDayCount(startMs, endMs);
    if (dayCount > MAX_TRIP_DAYS) return fail('endDate', `Trip duration cannot exceed ${MAX_TRIP_DAYS} days.`);

    return {
        ok: true,
        value: { destination, createdBy, startDate, endDate, dates: listDates(startDate, dayCount) },
    };
}
