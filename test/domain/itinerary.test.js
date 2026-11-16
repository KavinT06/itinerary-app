import test from 'node:test';
import assert from 'node:assert/strict';
import { validateItinerary, ItineraryFormatError } from '../../lib/domain/itinerary.js';
import { modelOutput, dayOf, activity } from '../fixtures.js';

const request = { destination: 'Fort Kochi, India', dates: ['2027-03-01', '2027-03-02'] };
const output = (overrides) => modelOutput('2027-03-01', 2, overrides);
const rejects = (raw, rule) => assert.throws(() => validateItinerary(raw, request), (err) => {
    assert.ok(err instanceof ItineraryFormatError);
    assert.equal(err.rule, rule);
    return true;
});

test('accepts well-formed output and rebuilds it field by field', () => {
    const raw = output({ unexpected: 'dropped', days: output().days.map((d) => ({ ...d, extra: 1 })) });
    const result = validateItinerary(raw, request);
    assert.deepEqual(Object.keys(result), ['title', 'notes', 'budget', 'days']);
    assert.deepEqual(Object.keys(result.days[0]), ['day', 'date', 'location', 'activities']);
    assert.deepEqual(Object.keys(result.days[0].activities[0]), ['time', 'title', 'description', 'location', 'notes']);
    assert.equal(result.days.length, 2);
    assert.equal(result.days[1].activities.length, 5);
});

test('day numbers and dates come from the request, not the model', () => {
    const raw = output();
    raw.days[0].day = 99;
    raw.days[1].date = 'the second day';
    const result = validateItinerary(raw, request);
    assert.deepEqual(result.days.map((d) => [d.day, d.date]), [[1, '2027-03-01'], [2, '2027-03-02']]);
});

test('rejects output that is not an object or has no days array', () => {
    rejects(null, 'shape');
    rejects([], 'shape');
    rejects({ title: 'x' }, 'shape');
});

test('rejects the wrong number of days, including too many', () => {
    rejects(output({ days: output().days.slice(0, 1) }), 'day_count');
    rejects(output({ days: [...output().days, dayOf('2027-03-03')] }), 'day_count');
});

test('rejects days that are out of order or dated for another day', () => {
    const raw = output();
    raw.days.reverse();
    rejects(raw, 'day_date');
});

test('rejects a malformed day', () => {
    rejects(output({ days: [output().days[0], 'day two'] }), 'day_shape');
    rejects(output({ days: [output().days[0], { date: '2027-03-02', activities: 'none' }] }), 'day_shape');
});

test('repairs clock times and drops activities whose time is not a clock time', () => {
    const raw = output();
    raw.days[0].activities[0].time = '8:00';
    raw.days[0].activities[4].time = '19:0\n\n0'; // seen in a real rejected generation
    const result = validateItinerary(raw, request);
    assert.equal(result.days[0].activities[0].time, '08:00');
    assert.equal(result.days[0].activities.length, 4);
    assert.ok(result.days[0].activities.every((a) => /^\d{2}:\d{2}$/.test(a.time)));
});

test('keeps an activity whose description key was misspelt, with an empty description', () => {
    // Seen in a real rejected generation: "Mal description" instead of "description".
    const raw = output();
    const { description, ...rest } = raw.days[0].activities[2];
    raw.days[0].activities[2] = { ...rest, 'Mal description': description };
    const result = validateItinerary(raw, request);
    assert.equal(result.days[0].activities.length, 5);
    assert.equal(result.days[0].activities[2].description, '');
    assert.equal('Mal description' in result.days[0].activities[2], false);
});

test('drops activities without a title and rejects a day left with fewer than three', () => {
    const raw = output();
    raw.days[0].activities[1].title = '   ';
    assert.equal(validateItinerary(raw, request).days[0].activities.length, 4);
    raw.days[0].activities[2].title = '';
    raw.days[0].activities[3] = 'not an object';
    rejects(raw, 'activity_count');
});

test('sorts activities by time and keeps at most eight', () => {
    const raw = output();
    raw.days[0].activities = [
        activity('19:00', 'Dinner'), activity('08:00', 'Breakfast'), activity('13:00', 'Lunch'),
        activity('09:00', 'A'), activity('10:00', 'B'), activity('11:00', 'C'),
        activity('14:00', 'D'), activity('15:00', 'E'), activity('16:00', 'F'), activity('21:00', 'G'),
    ];
    const times = validateItinerary(raw, request).days[0].activities.map((a) => a.time);
    assert.deepEqual(times, ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']);
});

test('truncates long text and removes control and invisible characters', () => {
    const raw = output({ title: 'T'.repeat(500), notes: 'N\u0000o‮tes' });
    raw.days[0].activities[0].description = 'd'.repeat(5000);
    raw.days[0].location = 5;
    const result = validateItinerary(raw, request);
    assert.equal(result.title.length, 120);
    assert.equal(result.notes, 'N otes');
    assert.equal(result.days[0].activities[0].description.length, 600);
    assert.equal(result.days[0].location, '');
});

test('falls back to a generated title when the model gives none', () => {
    assert.equal(validateItinerary(output({ title: '' }), request).title, '2-day trip to Fort Kochi, India');
});

test('keeps only a positive budget in a real currency', () => {
    const budgetOf = (budget) => validateItinerary(output({ budget }), request).budget;
    assert.deepEqual(budgetOf({ currency: 'inr', estimated: 8999.6 }), { currency: 'INR', estimated: 9000 });
    assert.equal(budgetOf({ currency: 'INR', estimated: 0 }), null);
    assert.equal(budgetOf({ currency: 'INR', estimated: 'lots' }), null);
    assert.equal(budgetOf({ currency: 'RUPEES', estimated: 100 }), null);
    assert.equal(budgetOf({ currency: 'ZZZZ', estimated: 100 }), null);
    assert.equal(budgetOf('cheap'), null);
});

test('text that looks like markup stays plain text', () => {
    const raw = output();
    raw.days[0].activities[0].title = '<img src=x onerror=alert(1)>';
    assert.equal(validateItinerary(raw, request).days[0].activities[0].title, '<img src=x onerror=alert(1)>');
});
