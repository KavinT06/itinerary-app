"use client";
// The one client island of the page (DESIGN_SYSTEM 9.3): the form, the status and the result.
// Owns the form state and composes the presentational components; the request logic stays in
// useTripGeneration. Everything static around it (hero, "How it works", footer) is server-rendered.

import { useEffect, useRef, useState } from 'react';
import TripForm from './TripForm.jsx';
import ItineraryView from './ItineraryView.jsx';
import { ErrorBanner, LoadingPanel } from './GenerationStatus.jsx';
import { useTripGeneration } from '../hooks/useTripGeneration.js';
import { MAX_TRIP_DAYS, MAX_NAME_LENGTH } from '../../lib/domain/trip-request.js';
import { inclusiveDayCount, listDates, parseIsoDate, todayLocalIso } from '../../lib/domain/dates.js';
import { SHORT_DATE, LONG_DATE, formatDate } from './result-layout.js';

const EMPTY_FORM = { name: '', startDate: '', endDate: '', area: '', city: '', state: '' };
const LIMITS = { name: MAX_NAME_LENGTH, days: MAX_TRIP_DAYS };
// Which form input to mark when the server or the validator names a request field.
const FIELD_TO_INPUT = { createdBy: 'name', destination: 'area', startDate: 'startDate', endDate: 'endDate' };
/**
 * Every day of the request as `{ day, short: "Fri 27 Nov", long: "Friday 27 Nov" }`, for the loading
 * skeleton. Only called while a request is in flight, never during prerender.
 */
function skeletonDays(startDate, endDate) {
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);
    if (start === null || end === null || end < start) return [];
    const count = Math.min(inclusiveDayCount(start, end), MAX_TRIP_DAYS);
    return listDates(startDate, count).map((iso, i) => ({
        day: i + 1, short: formatDate(SHORT_DATE, iso), long: formatDate(LONG_DATE, iso),
    }));
}

/** JS scrolling honours prefers-reduced-motion (CSS scroll-behavior does not cover it). */
function scrollBehavior() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

export default function Planner() {
    const [form, setForm] = useState(EMPTY_FORM);
    // Computed after mount: the page is prerendered at build time, so using the
    // current date during render would cause a hydration mismatch.
    const [today, setToday] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const { status, trip, error, cooldown, submit, cancel, reset } = useTripGeneration();
    const resultRef = useRef(null);
    const bannerRef = useRef(null);
    const cancelRef = useRef(null);
    const cancelledRef = useRef(false);
    const submitting = status === 'submitting';

    useEffect(() => {
        setToday(todayLocalIso());
    }, []);

    // Elapsed seconds while a request is in flight. Measured from the start, so a throttled
    // background tab still shows the right number when it wakes.
    useEffect(() => {
        if (!submitting) return undefined;
        const startedAt = Date.now();
        setElapsed(0);
        const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
        return () => clearInterval(timer);
    }, [submitting]);

    // On submit the focused submit button becomes disabled, so focus would fall to <body>:
    // move it to Cancel, the one action available while waiting (UX_RESEARCH 5.2).
    // After Cancel, focus returns to the submit button once it is enabled again (it is still
    // disabled at the moment Cancel is pressed).
    useEffect(() => {
        if (submitting) {
            cancelRef.current?.focus({ preventScroll: true });
        } else if (cancelledRef.current) {
            cancelledRef.current = false;
            document.querySelector('#planner button[type="submit"]')?.focus({ preventScroll: true });
        }
    }, [submitting]);

    // On success: focus the trip title (announced with the plan) and bring the plan into view.
    useEffect(() => {
        if (!trip) return;
        document.getElementById('trip-title')?.focus({ preventScroll: true });
        resultRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    }, [trip]);

    // On an error, focus goes to the field the error names, otherwise to the banner.
    useEffect(() => {
        if (!error) return;
        const inputId = error.code === 'VALIDATION_FAILED' ? FIELD_TO_INPUT[error.field] : undefined;
        const target = (inputId && document.getElementById(inputId)) || bannerRef.current;
        target?.focus();
    }, [error]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        submit({
            destination: [form.area, form.city, form.state].map((s) => s.trim()).filter(Boolean).join(', '),
            startDate: form.startDate,
            endDate: form.endDate,
            createdBy: form.name,
        });
    };

    // Cancel unmounts with the loading panel; the effect above returns focus to the submit button.
    const handleCancel = () => {
        cancelledRef.current = true;
        cancel();
    };

    // Back to an empty planner. The button that triggered this disappears with the plan, so focus
    // goes to the first field, and the planner (not the top of the page) is scrolled into view so
    // the focused field is on screen.
    const handleReset = () => {
        reset();
        setForm(EMPTY_FORM);
        document.getElementById('area')?.focus({ preventScroll: true });
        document.getElementById('planner')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    };

    const isValidationError = error?.code === 'VALIDATION_FAILED';

    return (
        <section
            id="planner"
            aria-labelledby="planner-title"
            className="relative z-10 mx-auto -mt-6 max-w-content scroll-mt-20 px-4 sm:px-6 lg:-mt-16 lg:px-8"
        >
            <div className="rounded-panel border border-hairline bg-surface p-5 shadow-raised sm:p-6 lg:p-8">
                <h2 id="planner-title" className="mb-6 text-h3-m text-ink lg:text-h3">
                    Your trip
                </h2>
                <TripForm
                    form={form}
                    onChange={handleChange}
                    onSubmit={handleSubmit}
                    loading={submitting}
                    cooldown={cooldown}
                    today={today}
                    limits={LIMITS}
                    invalidInput={isValidationError ? FIELD_TO_INPUT[error.field] : undefined}
                    fieldError={isValidationError ? error.message : undefined}
                    banner={error ? <ErrorBanner ref={bannerRef} error={error} cooldown={cooldown} /> : null}
                />
            </div>

            <div aria-live="polite" className={submitting ? 'mt-6' : ''}>
                {submitting && (
                    <LoadingPanel onCancel={handleCancel} cancelRef={cancelRef} elapsed={elapsed} days={skeletonDays(form.startDate, form.endDate)} />
                )}
                {/* Success is announced once, without the destination or the name (each must
                    appear on the page exactly once). */}
                {status === 'success' && trip && (
                    <p className="sr-only">
                        Your {trip.days.length}-day plan is ready.
                    </p>
                )}
            </div>

            {/* The plan takes the skeleton's place, directly below the planner and above
                "How it works". The html scroll-padding clears the nav; 16 px more for air. */}
            <div ref={resultRef} className={trip ? 'mt-16 scroll-mt-4 lg:mt-24' : ''}>
                {trip && <ItineraryView trip={trip} onReset={handleReset} />}
            </div>
        </section>
    );
}
