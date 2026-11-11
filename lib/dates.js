// Calendar-date helpers. Trip dates are plain "YYYY-MM-DD" calendar days with no
// time zone, so all arithmetic happens in UTC to avoid local-time/DST drift.
// Shared by the browser form and the API route.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Returns the UTC timestamp for a valid "YYYY-MM-DD" string, otherwise null. */
export function parseIsoDate(value) {
    if (typeof value !== 'string' || !ISO_DATE.test(value)) return null;
    const ms = Date.parse(`${value}T00:00:00Z`);
    if (Number.isNaN(ms)) return null;
    // Reject roll-over dates such as 2026-02-30.
    return new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
}

/** Number of calendar days from start to end, counting both ends. */
export function inclusiveDayCount(startMs, endMs) {
    return Math.round((endMs - startMs) / DAY_MS) + 1;
}

/** ["2026-01-30", "2026-01-31", "2026-02-01", ...] starting at startIso. */
export function listDates(startIso, dayCount) {
    const startMs = parseIsoDate(startIso);
    if (startMs === null) throw new Error(`Invalid ISO date: ${startIso}`);
    return Array.from({ length: dayCount }, (_, i) =>
        new Date(startMs + i * DAY_MS).toISOString().slice(0, 10)
    );
}

/** Today's date in the user's local time zone as "YYYY-MM-DD". */
export function todayLocalIso(now = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
