// The loading panel and the error banner. The banner's heading and advice depend on the
// error code, so "try again in 20 seconds" and "come back later" no longer look the same.
// Titles are a contract with test/e2e/trip.spec.js; keep them exact.
// Presentational: the elapsed seconds and the day labels come in as props (Planner owns the timer).

import { AlertCircleIcon, AlertTriangleIcon } from './icons.jsx';
import { RESULT_GRID, RESULT_MAIN, RESULT_SIDE, STOP_GRID, RAIL_LEFT } from './result-layout.js';

// Every code in lib/domain/error-codes.js, plus the browser-only NETWORK, renders through this one
// banner. Codes not listed (AI_INVALID_RESPONSE, AI_UNAVAILABLE, INTERNAL and the request-shape
// codes) take the default. `kept`: no retry is invited, so say that nothing typed was lost.
const PRESENTATION = {
    VALIDATION_FAILED: { title: 'Please check your details', tone: 'danger' },
    RATE_LIMITED: { title: 'Please slow down', tone: 'warning' },
    AI_BUSY: { title: 'The service is busy', tone: 'warning' },
    AI_QUOTA_EXHAUSTED: { title: "Today's limit has been reached", tone: 'danger', kept: true },
    AI_TIMEOUT: { title: 'That took too long', tone: 'warning' },
    AI_REFUSED: { title: "We couldn't plan that destination", tone: 'danger' },
    SERVICE_UNAVAILABLE: { title: 'The service is unavailable', tone: 'warning', kept: true },
    NETWORK: { title: "Can't reach the server", tone: 'warning' },
};
const DEFAULT_PRESENTATION = { title: "Couldn't create your itinerary", tone: 'warning' };

// Warning: retryable. Danger: the visitor must change something, or come back later.
// A 1 px border in the variant ink at low alpha, plus the icon and heading, set the banner apart
// from the disabled button's similar fill. No left rule: on a rounded box it bends into a bracket.
const TONES = {
    warning: { box: 'border-warning-ink/25 bg-warning-bg', icon: 'text-warning-ink', Icon: AlertTriangleIcon },
    danger: { box: 'border-danger-ink/25 bg-danger-bg', icon: 'text-danger-ink', Icon: AlertCircleIcon },
};

function hint(error, cooldown) {
    if (error.code === 'VALIDATION_FAILED' || error.code === 'AI_REFUSED') return null;
    if (!error.retryable) return null;
    return cooldown > 0 ? `You can try again in ${cooldown} seconds.` : 'You can try again now.';
}

/**
 * The error banner. Sits directly above the submit button, inside the planner panel.
 * Focusable (tabIndex -1) so the planner can move focus to it when a request fails: the submit
 * button was disabled while loading, so focus would otherwise be lost.
 */
export function ErrorBanner({ error, cooldown, ref }) {
    if (!error) return null;
    const presentation = PRESENTATION[error.code] ?? DEFAULT_PRESENTATION;
    const tone = TONES[presentation.tone];
    const retryHint = hint(error, cooldown);

    return (
        <div ref={ref} role="alert" tabIndex={-1} className={`flex items-start gap-3 rounded-card border p-4 motion-safe:animate-fade ${tone.box}`}>
            <tone.Icon size={20} className={`mt-0.5 ${tone.icon}`} />
            <div className="min-w-0">
                <h3 className="text-title text-ink">{presentation.title}</h3>
                <p className="mt-1 text-small text-ink">{error.message}</p>
                {retryHint && (
                    <p className="mt-2 text-small text-muted tabular-nums">
                        {/* Not re-announced every second: the alert is read once when it appears. */}
                        <span aria-live="off">{retryHint}</span>
                    </p>
                )}
                {presentation.kept && <p className="mt-2 text-small text-muted">Your details are still in the form.</p>}
            </div>
        </div>
    );
}

// Widths (%) of the title, second text line and venue bars per stop, so the rows do not look
// stamped from one template.
const SKELETON_ROWS = [
    [62, 88, 46],
    [48, 76, 58],
    [70, 64, 40],
    [54, 82, 52],
    [66, 58, 44],
];
// The skeleton shows at most this many days at full height (UX_RESEARCH P4).
const SKELETON_DAYS = 3;

/** A placeholder bar, vertically centred in a line box of the text it stands for. */
function Bar({ line = 'h-6', bar = 'h-3', width, className = '' }) {
    return (
        <span className={`flex items-center ${line} ${className}`}>
            <span className={`rounded-full bg-hairline ${bar}`} style={{ width }} />
        </span>
    );
}

/** The day navigator's shape: chips at 375, the side list from `lg`. Real day labels, no links. */
function SkeletonNav({ days, hasNotes }) {
    return (
        <div className={`-mx-4 border-b border-hairline sm:-mx-6 lg:row-start-1 lg:mx-0 lg:mt-0 lg:self-start lg:border-0 ${hasNotes ? 'mt-6 lg:row-span-2' : ''} ${RESULT_SIDE}`}>
            <ul className="flex gap-2 overflow-hidden px-4 py-2 sm:px-6 lg:flex-col lg:gap-0 lg:p-0">
                {days.map((d) => (
                    <li key={d.day} className="shrink-0 lg:shrink">
                        <span className="flex h-11 items-center gap-2 rounded-full border border-hairline bg-surface px-4 text-small whitespace-nowrap lg:h-auto lg:min-h-9 lg:flex-col lg:items-stretch lg:justify-center lg:gap-0 lg:rounded-none lg:border-y-0 lg:border-r-0 lg:border-l-2 lg:bg-transparent lg:px-3 lg:py-1.5">
                            <span className="flex items-center gap-2 lg:justify-between lg:gap-3">
                                <span className="font-semibold text-ink lg:font-medium">Day {d.day}</span>
                                <span className="text-muted lg:hidden">·</span>
                                <span className="text-muted tabular-nums">{d.short}</span>
                            </span>
                            {/* Where the day's area will be: unknown until the plan arrives. */}
                            <Bar line="h-5" bar="h-2.5" width="6rem" className="hidden lg:flex" />
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** One day's shape: its real label and date from the request, then five timed stops (the number the plan asks for). */
function SkeletonDay({ day }) {
    return (
        <div>
            <div className="border-b border-hairline pb-4">
                <p className="text-h3-m text-ink lg:text-h3">Day {day.day}</p>
                <p className="mt-1 flex items-center gap-2 text-small text-muted">
                    <span className="tabular-nums">{day.long}</span>
                    <span className="h-2.5 w-20 rounded-full bg-hairline" />
                </p>
            </div>
            <ol className="mt-6 space-y-6">
                {SKELETON_ROWS.map(([title, text, venue], i) => (
                    <li key={i} className={`relative ${STOP_GRID}`}>
                        {i < SKELETON_ROWS.length - 1 && <span className={`absolute top-3 -bottom-9 w-px bg-hairline ${RAIL_LEFT}`} />}
                        <Bar line="h-6" bar="h-3" width="2.5rem" className="justify-end" />
                        <span className="relative z-10 mx-auto mt-1.75 size-2.5 rounded-full border border-control bg-paper" />
                        <span className="min-w-0 pl-2">
                            <Bar bar="h-4" width={`${title}%`} />
                            <Bar width="100%" className="mt-1" />
                            <Bar width={`${text}%`} />
                            <Bar line="h-5" width={`${venue}%`} className="mt-2" />
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

/** Time-based copy (UX_RESEARCH P5): honest about the wait, no fake progress. */
function waitCopy(elapsed) {
    if (elapsed >= 30) return 'The service may be busy. You can keep waiting or cancel.';
    if (elapsed >= 15) return 'Longer trips take more time.';
    return 'This usually takes 5–30 seconds.';
}

/**
 * Shown while a request is in flight, in the place the plan will take. The status panel is the
 * one card; under it, on the page background, the skeleton in the result's own grid (notes,
 * navigator, days), so the plan replaces it without the area changing width, columns or fill.
 * Rendered inside the page's polite live region, so the wait copy is announced when it changes
 * (twice at most); the seconds counter and the skeleton are aria-hidden.
 * `days`: every day of the validated request, `{ day, short: "Fri 27 Nov", long: "Friday 27 Nov" }`.
 * `cancelRef`: the Planner moves focus here on submit, because the focused submit button has just
 * become disabled (UX_RESEARCH 5.2).
 */
export function LoadingPanel({ onCancel, elapsed = 0, days = [], cancelRef }) {
    const shown = days.length ? days : [{ day: 1, short: '', long: '' }];
    const hasNav = shown.length > 1;

    return (
        <div className="motion-safe:animate-fade">
            <div className="rounded-panel border border-hairline bg-surface p-5 lg:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <h3 className="text-h3-m text-ink lg:text-h3">Crafting your itinerary…</h3>
                        <p className="mt-1 text-small text-muted">
                            {waitCopy(elapsed)}{' '}
                            <span aria-hidden="true" className="font-semibold text-ink tabular-nums">
                                {elapsed}s
                            </span>
                        </p>
                    </div>
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={onCancel}
                        className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-control border border-control bg-surface px-5 text-body font-semibold text-ink transition-colors duration-150 ease-standard hover:bg-sunken sm:w-auto"
                    >
                        Cancel
                    </button>
                </div>
            </div>

            <div aria-hidden="true" className={`mt-8 motion-safe:animate-pulse-soft lg:mt-12 ${hasNav ? RESULT_GRID : ''}`}>
                {/* The notes' shape: a small label and three lines of lead text. */}
                <div className={`max-w-reading ${hasNav ? `${RESULT_MAIN} lg:row-start-1` : ''}`}>
                    <Bar line="h-5" bar="h-2.5" width="6rem" />
                    <Bar line="h-6.5 lg:h-7.5" bar="h-3.5" width="100%" className="mt-1" />
                    <Bar line="h-6.5 lg:h-7.5" bar="h-3.5" width="92%" />
                    <Bar line="h-6.5 lg:h-7.5" bar="h-3.5" width="60%" />
                </div>

                {hasNav && <SkeletonNav days={shown} hasNotes />}

                <div className={`min-w-0 max-w-reading space-y-12 ${hasNav ? `mt-6 lg:mt-12 ${RESULT_MAIN} lg:row-start-2` : 'mt-8 lg:mt-12'}`}>
                    {shown.slice(0, SKELETON_DAYS).map((day) => (
                        <SkeletonDay key={day.day} day={day} />
                    ))}
                </div>
            </div>
        </div>
    );
}
