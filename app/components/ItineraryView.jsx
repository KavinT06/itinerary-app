// The generated plan (DESIGN_SYSTEM 7.6, 7.8, 7.10, 7.11; UX_RESEARCH 7.5).
// Presentational: the trip comes in, "Plan Another Trip" goes out. Model output is rendered as
// text only (React escapes it); nothing here builds an href or src from it.
//
// Strict-mode contract with test/e2e/trip.spec.js: the destination, the traveller's name, the
// budget figure and the AI notice each appear in exactly one element; "Day N" exists as a
// heading only once per day (the navigator items are links, not headings).

import DayNav from './DayNav.jsx';
import { ArrowLeftIcon, CalendarIcon, CompassIcon, InfoIcon, LightbulbIcon, MapPinIcon, UserIcon } from './icons.jsx';
import {
    RESULT_GRID, RESULT_MAIN, RESULT_SIDE, STOP_GRID, STOP_LIST, STOP_CARD, STOP_TIME, STOP_DOT, STOP_RAIL, NOTES_PANEL,
    SHORT_DATE, LONG_DATE, formatDate,
} from './result-layout.js';

const YEAR = new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: 'UTC' });

/** "Fri 27 Nov – Sun 29 Nov 2026", with both years when the trip crosses New Year. */
function dateRange(startIso, endIso) {
    const startYear = formatDate(YEAR, startIso);
    const endYear = formatDate(YEAR, endIso);
    const start = formatDate(SHORT_DATE, startIso);
    const end = `${formatDate(SHORT_DATE, endIso)} ${endYear}`;
    if (startIso === endIso) return end;
    return startYear === endYear ? `${start} – ${end}` : `${start} ${startYear} – ${end}`;
}

function formatBudget({ currency, estimated }) {
    try {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(estimated);
    } catch {
        return `${currency} ${estimated.toLocaleString('en-GB')}`;
    }
}

/**
 * One item of the summary: a muted 16 px icon and small ink text, no border and no fill. On the
 * result a pill always means a day-nav link (DESIGN_SYSTEM 7.6), so nothing here looks tappable.
 */
function Fact({ icon: Icon, label, className = '', children }) {
    return (
        <div className={`flex min-w-0 ${className}`}>
            <dt className="sr-only">{label}</dt>
            <dd className="flex min-w-0 items-start gap-2 text-small text-ink">
                <Icon size={16} className="mt-0.5 text-muted" />
                <span className="min-w-0 wrap-anywhere tabular-nums">{children}</span>
            </dd>
        </div>
    );
}

/**
 * One stop on a card, four distinct levels: the title (600 ink), the venue right under it as its
 * subtitle (small muted, pin icon), the description (regular-weight ink) and the tip on a sunken
 * inset with a lightbulb. The time and the dot sit beside the card's first line.
 */
function Stop({ stop, last }) {
    return (
        <li className={`relative ${STOP_GRID}`}>
            {/* The rail: from this stop's dot to the next one. */}
            {!last && <span aria-hidden="true" className={STOP_RAIL} />}
            <p className={`${STOP_TIME} text-right text-small font-semibold text-ink tabular-nums`}>
                {stop.time || (
                    <>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">Time not set</span>
                    </>
                )}
            </p>
            <span aria-hidden="true" className={`${STOP_DOT} border border-night bg-saffron`} />
            <div className={STOP_CARD}>
                <h4 className="text-title text-ink wrap-anywhere">{stop.title}</h4>
                {stop.location && (
                    <p className="mt-1 flex items-start gap-1.5 text-small text-muted">
                        <MapPinIcon size={16} className="mt-0.5" />
                        <span className="min-w-0 wrap-anywhere">{stop.location}</span>
                    </p>
                )}
                {stop.description && <p className="mt-3 font-normal text-ink wrap-anywhere">{stop.description}</p>}
                {stop.notes && (
                    <div className="mt-4 flex items-start gap-2.5 rounded-card bg-sunken px-3 py-2.5">
                        <LightbulbIcon size={16} className="mt-0.5 text-muted" />
                        <p className="min-w-0 text-small text-ink wrap-anywhere">
                            <span className="font-semibold">Tip </span>
                            <span className="font-normal">{stop.notes}</span>
                        </p>
                    </div>
                )}
            </div>
        </li>
    );
}

// A focused reading position (the title, a day heading) gets a ring that hugs the text with the
// control radius, not a full-width box that reads like an input.
const FOCUS_TARGET = 'w-fit max-w-full rounded-control';

function Day({ day, id }) {
    return (
        // scroll-margin: the html scroll-padding (68) plus the mobile chip row (60) and 8.
        <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-17 lg:scroll-mt-4">
            {/* The date as an eyebrow, then "Day N" with the day's area beside it, the stop count right. */}
            <div className="flex items-end justify-between gap-4 border-b border-hairline pb-4">
                <div className="min-w-0">
                    <p className="text-caption tracking-wider text-muted uppercase tabular-nums">{formatDate(LONG_DATE, day.date)}</p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <h3 id={`${id}-title`} tabIndex={-1} className={`text-h3-m text-ink lg:text-h3 ${FOCUS_TARGET}`}>
                            Day {day.day}
                        </h3>
                        {day.location && <p className="min-w-0 text-lead-m text-muted wrap-anywhere lg:text-lead">{day.location}</p>}
                    </div>
                </div>
                <p className="shrink-0 pb-0.5 text-small text-muted tabular-nums">
                    {day.activities.length} {day.activities.length === 1 ? 'stop' : 'stops'}
                </p>
            </div>
            <ol className={`mt-6 ${STOP_LIST}`}>
                {day.activities.map((stop, i) => (
                    <Stop key={i} stop={stop} last={i === day.activities.length - 1} />
                ))}
            </ol>
        </section>
    );
}

export default function ItineraryView({ trip, onReset }) {
    const dayCount = trip.days.length;
    const days = trip.days.map((day) => ({ day, id: `day-${day.day}` }));
    const navItems = days.map(({ day, id }) => ({ id, day: day.day, label: formatDate(SHORT_DATE, day.date), area: day.location }));
    // One-day trips have nothing to navigate: no navigator and no side column.
    const hasNav = dayCount > 1;
    const hasNotes = Boolean(trip.notes);

    // Spacing above the days: after the chip row (24) at 375; after the notes (48) or at the top
    // of the column (0) from `lg`; after the notes (32 / 48) when there is no navigator.
    let daysGap = '';
    if (hasNav) daysGap = hasNotes ? 'mt-6 lg:mt-12' : 'mt-6 lg:mt-0';
    else if (hasNotes) daysGap = 'mt-8 lg:mt-12';

    return (
        <article aria-labelledby="trip-title">
            <header className="min-w-0">
                {/* The focus target on success (Planner focuses it and scrolls it under the bar). */}
                <h2 id="trip-title" tabIndex={-1} className={`scroll-mt-4 text-h2-m text-ink wrap-anywhere lg:text-h2 ${FOCUS_TARGET}`}>
                    {trip.title}
                </h2>

                {/* The one AI notice: directly under the title, before anything the model wrote. */}
                <p className="mt-3 flex w-fit max-w-reading items-start gap-2 rounded-card bg-sunken px-3 py-2.5 text-small text-ink sm:mt-4 sm:px-4 sm:py-3">
                    <InfoIcon size={16} className="mt-0.5 text-muted" />
                    <span>AI-generated suggestions. Check opening hours, prices and bookings before you travel.</span>
                </p>

                {/* The summary as a meta list: the destination on its own line, the rest wrapping after it. */}
                <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 lg:mt-6">
                    <Fact icon={MapPinIcon} label="Destination" className="basis-full">{trip.destination}</Fact>
                    <Fact icon={CalendarIcon} label="Dates">
                        {dateRange(trip.startDate, trip.endDate)} · {dayCount} {dayCount === 1 ? 'day' : 'days'}
                    </Fact>
                    <Fact icon={UserIcon} label="Traveller">{trip.createdBy}</Fact>
                    {trip.budget && (
                        <div className="flex min-w-0">
                            <dt className="sr-only">Estimated budget</dt>
                            <dd className="flex min-w-0 items-start gap-2 text-small text-ink">
                                {/* The accent as an 8 px marker centred in a 16 px icon box; the figure stays ink. */}
                                <span aria-hidden="true" className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                                    <span className="size-2 bg-saffron ring-1 ring-night" />
                                </span>
                                <span className="min-w-0">
                                    <span className="text-muted">Estimated budget </span>
                                    <span className="font-semibold tabular-nums">{formatBudget(trip.budget)}</span>
                                    <span className="text-muted"> for one traveller, excluding flights</span>
                                </span>
                            </dd>
                        </div>
                    )}
                </dl>
            </header>

            {/* Source order: notes, navigator, days. At 375 the notes come before the sticky chip
                row; from `lg` the navigator takes columns 1-3 beside both. The navigator is a
                direct child of this box, so it stays sticky for the whole plan. */}
            <div className={`mt-8 lg:mt-12 ${hasNav ? RESULT_GRID : ''}`}>
                {hasNotes && (
                    <section aria-labelledby="notes-title" className={`min-w-0 max-w-reading ${NOTES_PANEL} ${hasNav ? `${RESULT_MAIN} lg:row-start-1` : ''}`}>
                        <h3 id="notes-title" className="flex items-center gap-2 text-small font-semibold text-ink">
                            <CompassIcon size={16} className="text-muted" />
                            Good to know
                        </h3>
                        <p className="mt-2 text-lead-m font-normal text-ink wrap-anywhere lg:text-lead">{trip.notes}</p>
                    </section>
                )}

                {hasNav && (
                    <DayNav
                        days={navItems}
                        className={`${RESULT_SIDE} ${hasNotes ? 'mt-6 lg:row-span-2' : ''} lg:row-start-1 lg:mt-0`}
                    />
                )}

                <div className={`min-w-0 max-w-reading ${hasNav ? `${RESULT_MAIN} ${hasNotes ? 'lg:row-start-2' : 'lg:row-start-1'}` : ''}`}>
                    <div className={`space-y-12 ${daysGap}`}>
                        {days.map(({ day, id }) => (
                            <Day key={id} day={day} id={id} />
                        ))}
                    </div>

                    <div className="mt-12 border-t border-hairline pt-8">
                        <button
                            type="button"
                            onClick={onReset}
                            className="inline-flex h-11 items-center gap-2 rounded-control border border-control bg-surface px-5 text-body font-semibold text-ink transition-colors duration-150 ease-standard hover:bg-sunken"
                        >
                            <ArrowLeftIcon size={20} />
                            Plan Another Trip
                        </button>
                    </div>
                </div>
            </div>
        </article>
    );
}
