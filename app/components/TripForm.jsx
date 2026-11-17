// The planner form: where, when, who. Presentational: props in, events out.
// Labels and button texts are a contract with test/e2e/trip.spec.js; keep them exact.
//
// One grid for the whole form (three columns from `sm`, 16 px gutter, 24 px between rows):
// Area | City | State on the first row, the date range across two columns and Full Name in the
// third on the second, so every edge lines up with the row above.

import { AlertCircleIcon, ArrowRightIcon } from './icons.jsx';
import { inclusiveDayCount, parseIsoDate } from '../../lib/domain/dates.js';

const CONTROL =
    'h-12 w-full min-w-0 border border-control px-3 text-body text-ink placeholder:text-muted ' +
    'transition-colors duration-150 ease-standard read-only:bg-sunken ' +
    'aria-invalid:border-danger-ink aria-invalid:inset-ring aria-invalid:inset-ring-danger-ink';

const INPUT = `block rounded-control bg-surface ${CONTROL}`;

const LABEL = 'block text-small font-semibold text-ink';

/** "Full Name *": the asterisk is styled, but stays in the label text (the accessible name). */
function LabelText({ children }) {
    return (
        <>
            {children} <span className="text-muted">*</span>
        </>
    );
}

function FieldError({ id, children }) {
    return (
        <p id={id} className="mt-2 flex items-start gap-1.5 text-small text-danger-ink">
            <AlertCircleIcon size={16} className="mt-0.5" />
            <span className="min-w-0">{children}</span>
        </p>
    );
}

function Field({ id, label, hint, invalid, error, ...inputProps }) {
    const errorId = invalid && error ? `${id}-error` : null;
    const hintId = hint ? `${id}-hint` : null;
    return (
        <div className="min-w-0">
            <label htmlFor={id} className={LABEL}>
                <LabelText>{label}</LabelText>
            </label>
            <input
                id={id}
                name={id}
                aria-invalid={invalid || undefined}
                aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
                className={`${INPUT} mt-2`}
                {...inputProps}
            />
            {errorId && <FieldError id={errorId}>{error}</FieldError>}
            {hint && (
                <p id={hintId} className="mt-2 text-small text-muted">
                    {hint}
                </p>
            )}
        </div>
    );
}

/** The legend names the group for assistive technology; the labels carry the visible hierarchy. */
function Group({ legend, className = '', children }) {
    return (
        <fieldset className={`min-w-0 ${className}`}>
            <legend className="sr-only">{legend}</legend>
            {children}
        </fieldset>
    );
}

/** "3 days · up to 14" once both dates parse; the plain limit before that. */
function dayCountHint(startDate, endDate, maxDays) {
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);
    if (start === null || end === null || end < start) return `Up to ${maxDays} days`;
    const days = inclusiveDayCount(start, end);
    return `${days} ${days === 1 ? 'day' : 'days'} · up to ${maxDays}`;
}

export default function TripForm({ form, onChange, onSubmit, loading, cooldown, today, limits, invalidInput, fieldError, banner }) {
    const disabled = loading || cooldown > 0;
    const startInvalid = invalidInput === 'startDate';
    const endInvalid = invalidInput === 'endDate';
    const dateErrorId = (startInvalid || endInvalid) && fieldError ? 'dates-error' : null;
    const dateDescribedBy = [dateErrorId, 'dates-hint'].filter(Boolean).join(' ');
    // While a request is in flight the fields are read-only, so the form cannot drift from the plan
    // being generated. Not disabled: values stay readable and focusable.
    const shared = { onChange, readOnly: loading, required: true };

    return (
        <form onSubmit={onSubmit} className="grid gap-x-4 gap-y-6 sm:grid-cols-3">
            <Group legend="Where" className="grid gap-x-4 gap-y-4 sm:col-span-3 sm:grid-cols-3">
                <Field
                    id="area" invalid={invalidInput === 'area'} error={fieldError}
                    label="Area" type="text" placeholder="e.g. Alfama"
                    maxLength={50} value={form.area} {...shared}
                />
                <Field
                    id="city" label="City" type="text" placeholder="e.g. Lisbon"
                    maxLength={50} value={form.city} {...shared}
                />
                <Field
                    id="state" label="State / Country" type="text" placeholder="e.g. Portugal"
                    maxLength={45} value={form.state} {...shared}
                />
            </Group>

            <Group legend="When" className="min-w-0 sm:col-span-2">
                <div className="date-range grid">
                    <label htmlFor="startDate" className={LABEL}>
                        <LabelText>Departure</LabelText>
                    </label>
                    <label htmlFor="endDate" className={LABEL}>
                        <LabelText>Return</LabelText>
                    </label>
                    {/* One joined control: each half has its own border and the right half overlaps the
                        shared edge by 1 px, so only the invalid half turns red (it is raised above its
                        neighbour) while the outline of the pair stays one piece. */}
                    <input
                        id="startDate"
                        name="startDate"
                        type="date"
                        min={today || undefined}
                        value={form.startDate}
                        aria-invalid={startInvalid || undefined}
                        aria-describedby={dateDescribedBy}
                        className={`date-half relative mt-2 rounded-l-control bg-surface aria-invalid:z-10 ${CONTROL} px-2.5 sm:px-3`}
                        {...shared}
                    />
                    <input
                        id="endDate"
                        name="endDate"
                        type="date"
                        min={form.startDate || today || undefined}
                        value={form.endDate}
                        aria-invalid={endInvalid || undefined}
                        aria-describedby={dateDescribedBy}
                        className={`date-half relative mt-2 -ml-px rounded-r-control bg-surface aria-invalid:z-10 ${CONTROL} px-2.5 sm:px-3`}
                        {...shared}
                    />
                </div>
                {dateErrorId && <FieldError id={dateErrorId}>{fieldError}</FieldError>}
                {/* Live length of the trip: explains a duration error instead of repeating it. */}
                <p id="dates-hint" className="mt-2 text-small text-muted">
                    {dayCountHint(form.startDate, form.endDate, limits.days)}
                </p>
            </Group>

            <Group legend="Who" className="min-w-0">
                <Field
                    id="name" invalid={invalidInput === 'name'} error={fieldError}
                    label="Full Name" type="text" autoComplete="name"
                    hint="Shown on your plan only."
                    maxLength={limits.name} value={form.name} {...shared}
                />
            </Group>

            <div className="sm:col-span-3">
                {banner}
                <div className={`flex border-t border-hairline pt-6 sm:justify-end ${banner ? 'mt-6' : ''}`}>
                    <button
                        type="submit"
                        disabled={disabled}
                        className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-control bg-saffron px-6 text-body font-semibold text-night tabular-nums transition-colors duration-150 ease-standard enabled:hover:bg-saffron-hover disabled:cursor-not-allowed disabled:bg-saffron-disabled disabled:text-ink sm:w-auto sm:min-w-64"
                    >
                        {loading ? (
                            <span>Generating Itinerary…</span>
                        ) : cooldown > 0 ? (
                            <span>Please wait {cooldown}s</span>
                        ) : (
                            <>
                                <span>Generate Itinerary</span>
                                <ArrowRightIcon size={20} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}
