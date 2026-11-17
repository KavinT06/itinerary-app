// Layout shared by the result and its loading skeleton, so the skeleton has the result's shape and
// nothing changes width or column when the plan arrives (DESIGN_SYSTEM 7.9, 7.10, 7.11).

import { parseIsoDate } from '../../lib/domain/dates.js';

// The result sits on the page's 12-column grid ("How it works" uses the same one): the day
// navigator in columns 1-3 and the reading column from column 5, so the left edges line up.
export const RESULT_GRID = 'lg:grid lg:grid-cols-12 lg:gap-x-6';
export const RESULT_SIDE = 'lg:col-span-3 lg:col-start-1';
export const RESULT_MAIN = 'lg:col-span-8 lg:col-start-5';

// Timeline geometry (DESIGN_SYSTEM 7.10): time 52 | rail 20 | content at 375, and 64 | 24 |
// content from `sm`. The rail line sits on the centre of the rail column.
export const STOP_GRID = 'grid grid-cols-[52px_20px_minmax(0,1fr)] sm:grid-cols-[64px_24px_minmax(0,1fr)]';
export const RAIL_LEFT = 'left-[61.5px] sm:left-[75.5px]';

// Trip dates are calendar days: always formatted in UTC so the weekday never shifts.
export const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
export const LONG_DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Formats a YYYY-MM-DD calendar day; returns the input unchanged if it does not parse. */
export function formatDate(formatter, iso) {
    const ms = parseIsoDate(iso);
    return ms === null ? iso : formatter.format(ms);
}
