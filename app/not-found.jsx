// The designed 404 (DESIGN_SYSTEM 7.14). A server component: the nav is the only client island,
// in its solid (condensed) state because there is no hero under it.

import Link from 'next/link';
import SiteNav from './components/SiteNav.jsx';
import SiteFooter from './components/SiteFooter.jsx';
import { ArrowRightIcon } from './components/icons.jsx';

export const metadata = {
    title: 'Page not found · AI Travel Planner',
};

export default function NotFound() {
    return (
        <div className="flex min-h-dvh flex-col">
            <SiteNav solid />
            <main id="content" className="flex-1">
                <div className="mx-auto max-w-content px-4 pt-32 pb-16 sm:px-6 lg:px-8 lg:pt-44 lg:pb-24">
                    <p className="text-small font-semibold text-muted tabular-nums">404</p>
                    <h1 className="mt-3 text-h1-m text-ink lg:text-h1">Page not found</h1>
                    <p className="mt-3 max-w-copy text-lead-m text-muted lg:text-lead">This page doesn&rsquo;t exist.</p>
                    <Link
                        href="/"
                        className="mt-10 inline-flex h-13 w-full items-center justify-center gap-2 rounded-control bg-saffron px-6 text-body font-semibold text-night transition-colors duration-150 ease-standard hover:bg-saffron-hover sm:w-auto"
                    >
                        Plan a trip
                        <ArrowRightIcon size={20} />
                    </Link>
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
