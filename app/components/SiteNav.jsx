"use client";
// The fixed top bar. Transparent over the hero; condensed (paper, blur, hairline) once the planner
// panel reaches it, so the bar never turns grey over the dark band. The state is set by an
// IntersectionObserver on the hero's end line (#hero-end) in an effect, never during render.

import { useEffect, useState } from 'react';
import { ArrowDownIcon, ArrowRightIcon } from './icons.jsx';

import { PRODUCT_NAME } from './brand.js';

/** Scrolls to the planner and focuses its first field. Falls back to the plain anchor jump. */
function goToPlanner(event) {
    const panel = document.getElementById('planner');
    const field = document.getElementById('area');
    if (!panel || !field) return;
    event.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panel.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    field.focus({ preventScroll: true });
}

// The bar's height over the hero (72 px desktop, 64 px at 375). The observer's root starts below it.
const NAV_OFFSET = 72;

/**
 * `solid`: pages without the hero (the 404). The bar is condensed from the start, the links go
 * back to the planner page, and the skip link targets the page's own content.
 */
export default function SiteNav({ solid = false }) {
    const [scrolledPast, setScrolledPast] = useState(false);
    const condensed = solid || scrolledPast;
    const home = solid ? '/' : '';

    useEffect(() => {
        if (solid) return undefined;
        const el = document.getElementById('hero-end');
        if (!el || typeof IntersectionObserver === 'undefined') return undefined;
        const observer = new IntersectionObserver(
            // Condensed only once the line has passed above the bar, not while it is still below the fold.
            ([entry]) => setScrolledPast(!entry.isIntersecting && entry.boundingClientRect.top < NAV_OFFSET),
            { rootMargin: `-${NAV_OFFSET}px 0px 0px 0px` },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [solid]);

    return (
        <>
            <a
                href={solid ? '#content' : '#planner'}
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-3 focus:text-small focus:font-semibold focus:text-ink"
            >
                {solid ? 'Skip to content' : 'Skip to planner'}
            </a>

            <header
                data-condensed={condensed || undefined}
                className={`fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-250 ease-standard ${
                    condensed ? 'nav-condensed border-hairline text-ink shadow-float' : 'border-transparent text-on-night'
                }`}
            >
                <nav
                    aria-label="Main"
                    className={`mx-auto flex max-w-content items-center justify-between gap-4 px-4 transition-[height] duration-250 ease-standard sm:px-6 lg:px-8 ${
                        condensed ? 'h-14 lg:h-15' : 'h-16 lg:h-18'
                    }`}
                >
                    {/* Wordmark only (DESIGN_SYSTEM 7.1): no logo graphic until the owner supplies one. */}
                    <a href={solid ? '/' : '#top'} className="flex h-11 min-w-0 items-center rounded-control text-title">
                        <span className="truncate">{PRODUCT_NAME}</span>
                    </a>

                    <div className="flex items-center gap-2 lg:gap-6">
                        <a
                            href={`${home}#how-it-works`}
                            className={`hidden rounded-control text-small font-semibold underline-offset-4 transition-colors duration-150 ease-standard hover:underline md:inline ${
                                condensed ? 'text-muted hover:text-ink' : 'text-on-night-muted hover:text-on-night'
                            }`}
                        >
                            How it works
                        </a>
                        {/* Never saffron: the submit button is the page's one primary action. */}
                        <a
                            href={`${home}#planner`}
                            onClick={solid ? undefined : goToPlanner}
                            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-control border px-4 text-small font-semibold transition-colors duration-150 ease-standard lg:h-10 ${
                                condensed
                                    ? 'border-control bg-surface text-ink hover:bg-sunken'
                                    : 'border-on-night/30 text-on-night hover:bg-on-night/10'
                            }`}
                        >
                            Plan a trip
                            {/* Down to the planner on this page; across to it from other pages. */}
                            {solid ? <ArrowRightIcon size={16} /> : <ArrowDownIcon size={16} />}
                        </a>
                    </div>
                </nav>
            </header>
        </>
    );
}
