// Independent verification of validateItinerary against LLD section 3, one rule per test.
// Expected values come from the LLD table and the TripDay/Activity limits in LLD section 2.

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateItinerary, ItineraryFormatError } from '../../lib/domain/itinerary.js';
import { listDates } from '../../lib/domain/dates.js';
import { modelOutput, dayOf, activity, daysFromNow } from '../fixtures.js';

const start = daysFromNow(30);
const requestFor = (dayCount) => ({ destination: 'Fort Kochi, India', dates: listDates(start, dayCount) });
const request = requestFor(2);
const output = (overrides) => modelOutput(start, 2, overrides);
const rejects = (raw, rule, req = request) => assert.throws(() => validateItinerary(raw, req), (err) => {
    assert.ok(err instanceof ItineraryFormatError, `expected ItineraryFormatError, got ${err}`);
    assert.equal(err.rule, rule);
    return true;
});
/** A day whose activities are exactly the given list. */
const withActivities = (activities) => {
    const raw = output();
    raw.days[0].activities = activities;
    return raw;
};
const three = () => [activity('09:00', 'Fort walk'), activity('12:00', 'Lunch'), activity('18:00', 'Sunset')];

test('day_date: rejects when only the second day carries a date for another day', () => {
    const raw = output();
    raw.days[1].date = request.dates[0];
    rejects(raw, 'day_date');
});

test('day_date: rejects a plan that starts one day late, even though the day count is right', () => {
    const raw = output();
    const shifted = listDates(daysFromNow(31), 2);
    raw.days.forEach((day, i) => { day.date = shifted[i]; });
    rejects(raw, 'day_date');
});

test('day_count: a 14-day request answered with one day is rejected, not padded', () => {
    const fourteen = requestFor(14);
    const raw = modelOutput(start, 1);
    rejects(raw, 'day_count', fourteen);
});

test('activity_count: exactly three valid activities is accepted', () => {
    const result = validateItinerary(withActivities(three()), request);
    assert.equal(result.days[0].activities.length, 3);
});

test('activity_count: a day with two activities is rejected', () => {
    rejects(withActivities(three().slice(0, 2)), 'activity_count');
});

test('activity_count: exactly eight are kept whole; a ninth is cut', () => {
    const times = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
    const nine = times.map((t, i) => activity(t, `Stop ${i + 1}`));
    assert.equal(validateItinerary(withActivities(nine.slice(0, 8)), request).days[0].activities.length, 8);
    const kept = validateItinerary(withActivities(nine), request).days[0].activities;
    assert.deepEqual(kept.map((a) => a.title), nine.slice(0, 8).map((a) => a.title));
});

test('activity_time: repairs single-digit hours; drops every value that is not a 24-hour HH:MM', () => {
    const raw = withActivities([
        ...three(),
        activity('8:00', 'Repaired eight'),
        activity('7:05', 'Repaired seven'),
        activity('24:00', 'Hour 24'),
        activity('25:00', 'Hour 25'),
        activity('12:60', 'Minute 60'),
        activity('8:5', 'One-digit minute'),
        activity('8am', 'Free text am'),
        activity('Morning', 'Free text word'),
        activity('08:00:00', 'With seconds'),
        activity('', 'Empty time'),
    ]);
    const result = validateItinerary(raw, request).days[0].activities;
    assert.deepEqual(result.map((a) => [a.time, a.title]), [
        ['07:05', 'Repaired seven'],
        ['08:00', 'Repaired eight'],
        ['09:00', 'Fort walk'],
        ['12:00', 'Lunch'],
        ['18:00', 'Sunset'],
    ]);
});

test('activity_time: the last minute of the day is a valid time', () => {
    const result = validateItinerary(withActivities([...three(), activity('23:59', 'Night market')]), request);
    assert.equal(result.days[0].activities.at(-1).time, '23:59');
});

test('activity_order: the sort is stable, so equal times keep the model\'s order', () => {
    const raw = withActivities([
        activity('10:00', 'Zoo, listed first'),
        activity('09:00', 'Breakfast'),
        activity('10:00', 'Art gallery, listed second'),
        activity('11:00', 'Museum'),
    ]);
    const titles = validateItinerary(raw, request).days[0].activities.map((a) => a.title);
    assert.deepEqual(titles, ['Breakfast', 'Zoo, listed first', 'Art gallery, listed second', 'Museum']);
});

test('text_length: every activity and day field is truncated at its LLD limit, and a value at the limit is kept whole', () => {
    // LLD section 2: activity title 120, description 600, location 200, notes 400; day location 120.
    const limits = { title: 120, description: 600, location: 200, notes: 400 };
    const over = withActivities([
        activity('09:00', 'T'.repeat(500), { description: 'D'.repeat(5000), location: 'L'.repeat(5000), notes: 'N'.repeat(5000) }),
        ...three().slice(1),
    ]);
    over.days[0].location = 'P'.repeat(5000);
    const day = validateItinerary(over, request).days[0];
    for (const [field, limit] of Object.entries(limits)) assert.equal(day.activities[0][field].length, limit, field);
    assert.equal(day.location.length, 120, 'day location');

    const exact = withActivities([
        activity('09:00', 't'.repeat(120), { description: 'd'.repeat(600), location: 'l'.repeat(200), notes: 'n'.repeat(400) }),
        ...three().slice(1),
    ]);
    exact.days[0].location = 'p'.repeat(120);
    const kept = validateItinerary(exact, request).days[0];
    assert.equal(kept.activities[0].title, 't'.repeat(120));
    assert.equal(kept.activities[0].notes, 'n'.repeat(400));
    assert.equal(kept.activities[0].location, 'l'.repeat(200));
    assert.equal(kept.location, 'p'.repeat(120));
});

test('text_content: control, zero-width and bidirectional characters are removed from every activity and day field', () => {
    const dirty = (word) => `‮${word}​⁦x⁩﻿⁠`;
    const raw = withActivities([
        activity('09:00', dirty('Fort'), { description: `Walk\u0007${dirty('along')}`, location: dirty('Beach'), notes: dirty('Early') }),
        ...three().slice(1),
    ]);
    raw.days[0].location = dirty('Old Town');
    const day = validateItinerary(raw, request).days[0];
    assert.equal(day.activities[0].title, 'Fortx');
    assert.equal(day.activities[0].description, 'Walk alongx');
    assert.equal(day.activities[0].location, 'Beachx');
    assert.equal(day.activities[0].notes, 'Earlyx');
    assert.equal(day.location, 'Old Townx');
});

test('activity_title: a title made only of invisible characters is empty after cleaning, so the activity is dropped', () => {
    const raw = withActivities([...three(), activity('20:00', '​‮﻿ ⁠')]);
    const titles = validateItinerary(raw, request).days[0].activities.map((a) => a.title);
    assert.deepEqual(titles, ['Fort walk', 'Lunch', 'Sunset']);
});

test('budget: a negative or missing estimate becomes null; extra budget fields are not copied', () => {
    const budgetOf = (budget) => validateItinerary(output({ budget }), request).budget;
    assert.equal(budgetOf({ currency: 'INR', estimated: -500 }), null);
    assert.equal(budgetOf({ currency: 'INR' }), null);
    assert.equal(budgetOf(null), null);
    assert.equal(validateItinerary(output({ budget: undefined }), request).budget, null);
    assert.deepEqual(Object.keys(budgetOf({ currency: 'EUR', estimated: 300, perPerson: 150, html: '<b>' })), ['currency', 'estimated']);
});

test('authoritative fields: destination, dates and traveller supplied by the model never reach the result', () => {
    const raw = output({
        destination: 'Somewhere else', startDate: '1999-01-01', endDate: '1999-01-02', createdBy: 'Model Name', generatedAt: '1999-01-01T00:00:00Z',
    });
    raw.days[0] = dayOf(request.dates[0], { day: 7, extra: 'x' });
    const result = validateItinerary(raw, request);
    for (const field of ['destination', 'startDate', 'endDate', 'createdBy', 'generatedAt']) {
        assert.equal(Object.hasOwn(result, field), false, field);
    }
    assert.equal(result.days[0].day, 1);
    assert.equal(JSON.stringify(result).includes('Somewhere else'), false);
});

test('shape: days given as an object or the output given as a string is rejected', () => {
    rejects(output({ days: { 0: dayOf(request.dates[0]) } }), 'shape');
    rejects(JSON.stringify(output()), 'shape');
});
