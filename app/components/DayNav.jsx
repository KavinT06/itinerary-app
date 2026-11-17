"use client";
// The day navigator (DESIGN_SYSTEM 7.11). One list of in-page links, styled per breakpoint:
// a sticky chip row under the nav below `lg`, a sticky list in the side column from `lg`.
// Items are links, never headings (the e2e tests find days by their h3). The current day comes
// from an IntersectionObserver in an effect; nothing here runs during render.

import { useEffect, useRef, useState } from 'react';

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A section counts as "current" while it crosses the band from just under the sticky bars
// (nav 56 + chip row 60 + 24) to 40% up from the bottom of the viewport.
const BAND = '-140px 0px -40% 0px';

// Room kept around a focused chip when it is scrolled into view: the 2 px ring, its 2 px offset and air.
const FOCUS_PAD = 16;

/**
 * @param {{ days: { id: string, day: number, label: string, area?: string }[], className?: string }} props
 * `className` places the navigator in the result's grid. It must be a direct child of the box it
 * stays sticky in, so it is never wrapped.
 */
export default function DayNav({ days, className = '' }) {
    const [active, setActive] = useState(days[0]?.id);
    const listRef = useRef(null);
    const ids = days.map((d) => d.id).join(' ');

    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return undefined;
        const order = ids.split(' ');
        const visible = new Set();
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) visible.add(entry.target.id);
                else visible.delete(entry.target.id);
            }
            // The top-most day in the band; after a jump past the band (to the end of the plan),
            // the last day that has scrolled above it.
            const inBand = order.find((id) => visible.has(id));
            const above = order.filter((id) => document.getElementById(id)?.getBoundingClientRect().top < 140).at(-1);
            if (inBand || above) setActive(inBand ?? above);
        }, { rootMargin: BAND });
        order.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [ids]);

    // Keep the current chip in view inside the row (mobile only: the desktop list scrolls vertically).
    useEffect(() => {
        const list = listRef.current;
        const link = list?.querySelector('[aria-current="true"]');
        if (!list || !link || list.scrollWidth <= list.clientWidth) return;
        const left = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
        list.scrollTo({ left, behavior: reduceMotion() ? 'auto' : 'smooth' });
    }, [active]);

    // Tabbing through the chip row does not change the current day, and Chrome scrolls a nested
    // scroller only when the focused element is fully hidden. Bring a part-hidden chip, with its
    // focus ring, fully into the row. A no-op from `lg`, where the list does not scroll sideways.
    const keepInView = (event) => {
        const list = listRef.current;
        const link = event.currentTarget;
        if (!list || list.scrollWidth <= list.clientWidth) return;
        const start = link.offsetLeft - FOCUS_PAD;
        const end = link.offsetLeft + link.offsetWidth + FOCUS_PAD;
        if (start >= list.scrollLeft && end <= list.scrollLeft + list.clientWidth) return;
        const left = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
        list.scrollTo({ left, behavior: reduceMotion() ? 'auto' : 'smooth' });
    };

    const jump = (event, id) => {
        const section = document.getElementById(id);
        if (!section) return;
        event.preventDefault();
        section.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
        // Move the reading position too, so the next Tab continues from the chosen day.
        section.querySelector('h3')?.focus({ preventScroll: true });
        setActive(id);
    };

    return (
        <nav
            aria-label="Days"
            className={`sticky top-14 z-20 -mx-4 border-b border-hairline bg-paper sm:-mx-6 lg:top-21 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent ${className}`}
        >
            <ul
                ref={listRef}
                className="no-scrollbar relative flex snap-x snap-proximity scroll-px-4 gap-2 overflow-x-auto px-4 py-2 sm:scroll-px-6 sm:px-6 lg:-m-1 lg:max-h-[calc(100dvh-6.5rem)] lg:flex-col lg:gap-0 lg:overflow-x-hidden lg:overflow-y-auto lg:p-1"
            >
                {days.map((d) => {
                    const current = d.id === active;
                    return (
                        <li key={d.id} className="shrink-0 snap-start lg:shrink">
                            <a
                                href={`#${d.id}`}
                                onClick={(e) => jump(e, d.id)}
                                onFocus={keepInView}
                                aria-current={current ? 'true' : undefined}
                                className={`flex h-11 items-center gap-2 rounded-full border px-4 text-small whitespace-nowrap transition-colors duration-150 ease-standard lg:h-auto lg:min-h-9 lg:flex-col lg:items-stretch lg:justify-center lg:gap-0 lg:rounded-l-none lg:rounded-r-control lg:border-y-0 lg:border-r-0 lg:border-l-2 lg:px-3 lg:py-1.5 ${
                                    current
                                        ? 'border-night bg-night text-on-night lg:bg-sunken lg:text-ink'
                                        : 'border-hairline bg-surface text-ink hover:bg-sunken lg:bg-transparent lg:hover:bg-sunken'
                                }`}
                            >
                                {/* The current day's dot on dark (mobile); on desktop the left rail turns night. */}
                                {current && <span aria-hidden="true" className="size-1.5 rounded-full bg-saffron lg:hidden" />}
                                <span className="flex items-center gap-2 lg:justify-between lg:gap-3">
                                    {/* From `lg` only the current day is 600, so it reads at a glance. */}
                                    <span className={current ? 'font-semibold' : 'font-semibold lg:font-medium'}>Day {d.day}</span>
                                    <span aria-hidden="true" className={`lg:hidden ${current ? 'text-on-night-muted' : 'text-muted'}`}>·</span>
                                    <span className={`tabular-nums ${current ? 'text-on-night-muted lg:text-muted' : 'text-muted'}`}>{d.label}</span>
                                </span>
                                {/* The day's area answers "which day is Sintra?" in the side list (model text, as text). */}
                                {d.area && <span className="hidden truncate text-muted lg:block">{d.area}</span>}
                            </a>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
