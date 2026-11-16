import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIsoDate, inclusiveDayCount, listDates, todayLocalIso } from '../../lib/domain/dates.js';
import { cleanText, clip } from '../../lib/domain/text.js';
import { parseTripRequest, MAX_TRIP_DAYS } from '../../lib/domain/trip-request.js';
import { ERROR_CODES, isKnownErrorCode } from '../../lib/domain/error-codes.js';

test('dates: parses real calendar dates and rejects impossible ones', () => {
    assert.equal(parseIsoDate('2027-03-01'), Date.UTC(2027, 2, 1));
    assert.equal(parseIsoDate('2027-02-30'), null);
    assert.equal(parseIsoDate('2027-2-3'), null);
    assert.equal(parseIsoDate('not a date'), null);
    assert.equal(parseIsoDate(20270301), null);
});

test('dates: counts and lists days across a month and a leap day', () => {
    assert.equal(inclusiveDayCount(parseIsoDate('2028-02-27'), parseIsoDate('2028-03-01')), 4);
    assert.deepEqual(listDates('2028-02-27', 4), ['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01']);
    assert.throws(() => listDates('2028-02-31', 2));
});

test('dates: todayLocalIso formats the local calendar day', () => {
    assert.equal(todayLocalIso(new Date(2027, 0, 5, 23, 59)), '2027-01-05');
});

test('text: collapses whitespace, strips control and invisible characters, keeps joiners', () => {
    assert.equal(cleanText('  Fort\u0000Kochi \n\t India  '), 'Fort Kochi India');
    assert.equal(cleanText('Par‮is​﻿'), 'Paris');
    assert.equal(cleanText('क्‍ष'), 'क्‍ष'); // ZWJ inside an Indic conjunct survives
    assert.equal(cleanText(42), '');
    assert.equal(clip('abcdef', 3), 'abc');
});

const valid = { destination: 'Paris, France', createdBy: 'Asha', startDate: '2027-03-01', endDate: '2027-03-03' };

test('trip request: accepts a valid request and lists its dates', () => {
    const result = parseTripRequest(valid);
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.dates, ['2027-03-01', '2027-03-02', '2027-03-03']);
    assert.equal(result.value.destination, 'Paris, France');
});

test('trip request: each invalid input is rejected with the field at fault', () => {
    const cases = [
        [null, 'body'],
        [[], 'body'],
        [{ ...valid, destination: '   ' }, 'destination'],
        [{ ...valid, destination: 'x'.repeat(151) }, 'destination'],
        [{ ...valid, createdBy: '' }, 'createdBy'],
        [{ ...valid, createdBy: 'n'.repeat(81) }, 'createdBy'],
        [{ ...valid, startDate: '2027-02-30' }, 'startDate'],
        [{ ...valid, endDate: 'soon' }, 'endDate'],
        [{ ...valid, endDate: '2027-02-28' }, 'endDate'],
        [{ ...valid, endDate: '2027-03-15' }, 'endDate'], // 15 days
    ];
    for (const [body, field] of cases) {
        const result = parseTripRequest(body);
        assert.equal(result.ok, false, JSON.stringify(body));
        assert.equal(result.field, field);
        assert.equal(typeof result.error, 'string');
    }
});

test('trip request: the longest allowed trip is exactly MAX_TRIP_DAYS', () => {
    assert.equal(MAX_TRIP_DAYS, 14);
    assert.equal(parseTripRequest({ ...valid, endDate: '2027-03-14' }).ok, true);
});

test('trip request: enforces the earliest and latest departure when given', () => {
    assert.equal(parseTripRequest(valid, { minStartDate: '2027-03-02' }).error, 'Departure date cannot be in the past.');
    assert.equal(parseTripRequest(valid, { minStartDate: '2027-03-01' }).ok, true);
    assert.equal(parseTripRequest(valid, { maxStartDate: '2027-02-28' }).field, 'startDate');
});

test('trip request: cleans text before measuring it', () => {
    const result = parseTripRequest({ ...valid, destination: '  Paris,\n  France ', createdBy: 'A‮sha' });
    assert.equal(result.value.destination, 'Paris, France');
    assert.equal(result.value.createdBy, 'Asha');
});

test('error codes: every code has a status, a retry flag and a message', () => {
    for (const [code, entry] of Object.entries(ERROR_CODES)) {
        assert.ok(entry.status >= 400 && entry.status < 600, code);
        assert.equal(typeof entry.retryable, 'boolean', code);
        assert.ok(entry.message.length > 10, code);
    }
    // 429 is reserved for the client's own request rate; provider limits are 503.
    assert.equal(ERROR_CODES.RATE_LIMITED.status, 429);
    assert.equal(ERROR_CODES.AI_BUSY.status, 503);
    assert.equal(ERROR_CODES.AI_QUOTA_EXHAUSTED.status, 503);
    assert.equal(ERROR_CODES.AI_QUOTA_EXHAUSTED.retryable, false);
    assert.equal(isKnownErrorCode('AI_BUSY'), true);
    assert.equal(isKnownErrorCode('toString'), false);
});
