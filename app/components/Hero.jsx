// The dark brand band at the top of the page. A server component: static markup, no hooks.
// The visual on the right is decorative (aria-hidden) and schematic: no places, prices or counts.

import { CalendarIcon, CheckIcon, ClockIcon, ListIcon } from './icons.jsx';

// Each fact appears once on the page: here (14 days, 5 stops, 5-30 s) and in the badge (no account).
const FACTS = [
    { icon: CalendarIcon, text: 'Up to 14 days' },
    { icon: ListIcon, text: '5 timed stops a day' },
    { icon: ClockIcon, text: 'Usually ready in 5–30 seconds' },
];

const TIMES = ['09:00', '11:30', '13:00', '15:30', '19:00'];
// Widths of the skeleton bars, so the three cards do not look stamped from one template.
const BARS = [
    [78, 56, 88, 64, 72],
    [64, 84, 58, 76, 60],
    [86, 62, 74, 54, 80],
];

// Hero entrance: once, under motion-safe only; the delay comes from inline style.
const rise = 'motion-safe:animate-rise';
const delay = (ms) => ({ animationDelay: `${ms}ms` });

// Card geometry, in the plane before projection. 184 px wide, 28 px apart, each card 70 px
// further back than the one before. Projected, the stack is about 550 x 480 px.
const CARD_W = 184;
const STEP_X = CARD_W + 28;
const STEP_Y = 70;
const FRONT_H = 241; // the front card with its budget row

function DayCard({ day, bars, front, style }) {
    return (
        <div className="glass-card absolute p-4" style={{ width: `${CARD_W}px`, ...style }}>
            <div className="flex items-center justify-between">
                <span className="text-small font-semibold text-on-night">Day {day}</span>
                <span className="h-1.5 w-10 rounded-full bg-on-night/12" />
            </div>
            <div className="relative mt-3">
                <span className="absolute top-2.5 bottom-2.5 left-[59.5px] w-px bg-on-night/16" />
                <ul className="space-y-2">
                    {TIMES.map((time, i) => (
                        <li key={time} className="flex h-5 items-center gap-3">
                            <span className="w-11 text-small text-on-night-muted tabular-nums">{time}</span>
                            {/* Saffron only on the front card; the others recede. */}
                            <span className={`relative size-2 rounded-full ring-1 ring-night ${front ? 'bg-saffron' : 'bg-on-night-muted/60'}`} />
                            <span className="h-2 rounded-full bg-on-night/12" style={{ width: `${bars[i]}%`, maxWidth: '64px' }} />
                        </li>
                    ))}
                </ul>
            </div>
            {front && (
                <div className="mt-3 flex items-center justify-between border-t border-on-night/12 pt-3">
                    <span className="text-small whitespace-nowrap text-on-night-muted">Estimated budget</span>
                    <span className="h-2 w-6 rounded-full bg-on-night/30" />
                </div>
            )}
        </div>
    );
}

const CARDS = [
    { day: 3, bars: BARS[2], left: 2 * STEP_X, top: 0, delay: 320 },
    { day: 2, bars: BARS[1], left: STEP_X, top: STEP_Y, delay: 240 },
    { day: 1, bars: BARS[0], left: 0, top: 2 * STEP_Y, delay: 160, front: true },
];

/**
 * Fills the hero's visible box (below the nav, above the planner's overlap) in the right half and
 * centres the projected stack in it, 12 px high. The hero's min-height (576 px) keeps every card
 * at least 24 px below the nav and 48 px above the planner panel (measured at 1024-1920).
 */
function HeroVisual() {
    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 left-1/2 hidden select-none lg:block">
            <div className="absolute top-[calc(50%-12px)] left-1/2 -translate-1/2 scale-[.85] xl:scale-100">
                <div className="iso-plane relative" style={{ width: `${2 * STEP_X + CARD_W}px`, height: `${2 * STEP_Y + FRONT_H}px` }}>
                    {CARDS.map((card) => (
                        <div key={card.day} className={rise} style={delay(card.delay)}>
                            <DayCard day={card.day} bars={card.bars} front={card.front} style={{ left: `${card.left}px`, top: `${card.top}px` }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function Hero() {
    return (
        <section id="top" aria-labelledby="hero-title" className="hero-band relative isolate overflow-hidden lg:pt-18 lg:pb-16">
            <div aria-hidden="true" className="hero-grid" />

            <div className="relative mx-auto max-w-content px-4 pt-24 pb-16 sm:px-6 lg:flex lg:min-h-[36rem] lg:items-center lg:px-8 lg:py-0">
                <div className="lg:w-1/2 lg:pr-6">
                    <p
                        className={`inline-flex items-center gap-1.5 rounded-control border border-on-night/20 px-2.5 py-1.5 text-caption text-on-night ${rise}`}
                        style={delay(0)}
                    >
                        <CheckIcon size={14} className="text-on-night-muted" />
                        No account needed
                    </p>

                    <h1 id="hero-title" className={`mt-3 text-display-m text-on-night lg:text-display ${rise}`} style={delay(60)}>
                        <span className="block text-saffron">Plan a trip,</span> <span className="block">day by day.</span>
                    </h1>

                    <p className={`mt-3 max-w-copy text-lead-m text-on-night-muted lg:text-lead ${rise}`} style={delay(120)}>
                        Tell us where and when. Get a plan for each day with five timed stops and an estimated budget.
                    </p>

                    <ul className={`mt-8 flex flex-wrap gap-x-6 gap-y-3 text-small text-on-night-muted lg:mt-10 ${rise}`} style={delay(180)}>
                        {FACTS.map(({ icon: Icon, text }) => (
                            <li key={text} className="flex items-center gap-2">
                                <Icon size={16} />
                                {text}
                            </li>
                        ))}
                    </ul>
                </div>

                <HeroVisual />
            </div>

            {/* The nav condenses when this line, where the planner panel starts, passes under it. */}
            <div id="hero-end" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-6 h-px lg:bottom-16" />
        </section>
    );
}
