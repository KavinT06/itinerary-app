// Browser tests for the redesigned UI (DESIGN_SYSTEM 7.11, 7.14; UX_RESEARCH 5.2, 7.6, 8).
// Same rules as trip.spec.js: production build, /api/trips mocked at the network layer, dates
// relative to today. These tests add to trip.spec.js; they do not replace any of its assertions.

import { test, expect } from '@playwright/test';

const iso = (offsetDays) => {
    const d = new Date(Date.now() + offsetDays * 86_400_000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Adds whole days to a YYYY-MM-DD string, in UTC (calendar arithmetic only). */
const addDays = (isoDate, n) => {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};

const TITLE = '3-Day Lisbon Highlights';

const activity = (time, title) => ({ time, title, description: `About ${title}.`, location: `${title}, Alfama`, notes: 'Go early.' });

/** A trip shaped like the server's response, with one day per requested date. */
function tripFor(body) {
    const count = Math.round((Date.parse(`${body.endDate}T00:00:00Z`) - Date.parse(`${body.startDate}T00:00:00Z`)) / 86_400_000) + 1;
    return {
        title: TITLE,
        destination: body.destination,
        startDate: body.startDate,
        endDate: body.endDate,
        createdBy: body.createdBy,
        notes: 'Mild weather. Wear comfortable shoes for the hills.',
        budget: { currency: 'EUR', estimated: 340 },
        days: Array.from({ length: count }, (_, i) => ({
            day: i + 1,
            date: addDays(body.startDate, i),
            location: 'Alfama',
            activities: [activity('08:00', 'Breakfast'), activity('10:00', 'Castle'), activity('13:00', 'Lunch'), activity('15:30', 'Tram 28'), activity('19:00', 'Dinner')],
        })),
        generatedAt: new Date().toISOString(),
    };
}

/** Mocks POST /api/trips. `respond(body, attempt)` returns { status, json, headers?, delayMs? }. */
async function mockTrips(page, respond) {
    const calls = [];
    await page.route('**/api/trips', async (route) => {
        const body = route.request().postDataJSON();
        calls.push(body);
        const { status = 200, json, headers = {}, delayMs = 0 } = respond(body, calls.length);
        if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
        await route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(json) }).catch(() => {});
    });
    return calls;
}

const success = (body) => ({ json: { success: true, trip: tripFor(body), requestId: 'r1', cache: 'miss' } });

/** Waits until the planner island has hydrated: `min` on Departure is set in an effect after mount. */
async function gotoHydrated(page) {
    await page.goto('/');
    await expect(page.getByLabel('Departure *')).toHaveAttribute('min', /^\d{4}-\d{2}-\d{2}$/);
}

async function fillForm(page, { start = iso(10), end = iso(12) } = {}) {
    await gotoHydrated(page);
    await page.getByLabel('Full Name *').fill('Asha Traveller');
    await page.getByLabel('Departure *').fill(start);
    await page.getByLabel('Return *').fill(end);
    await page.getByLabel('Area *').fill('Alfama');
    await page.getByLabel('City *').fill('Lisbon');
    await page.getByLabel('State / Country *').fill('Portugal');
}

const submitButton = (page) => page.locator('button[type="submit"]');
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ---------------------------------------------------------------------------------------------
// 404 (UX_RESEARCH 7.6, DESIGN_SYSTEM 7.14)
// ---------------------------------------------------------------------------------------------

test.describe('404 page', () => {
    test('is a designed page with the site nav, a heading and a link back to the planner', async ({ page }) => {
        const response = await page.goto('/this-page-does-not-exist');
        expect(response.status()).toBe(404);

        await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
        await expect(page.getByText('This page doesn’t exist.')).toBeVisible();
        // Same nav as the planner page, linking back to it.
        const nav = page.getByRole('navigation', { name: 'Main' });
        await expect(nav).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Plan a trip' })).toHaveAttribute('href', '/#planner');
        // The skip link targets content that exists on this page.
        await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#content');
        await expect(page.locator('#content')).toHaveCount(1);
        expect(await overflow(page)).toBeLessThanOrEqual(0);

        const back = page.getByRole('main').getByRole('link', { name: 'Plan a trip' });
        await expect(back).toHaveAttribute('href', '/');
        await back.click();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole('heading', { name: 'Your trip' })).toBeVisible();
        await expect(page.getByLabel('Area *')).toBeVisible();
    });

    test('sends the security headers', async ({ page }) => {
        const response = await page.goto('/this-page-does-not-exist');
        expect(response.status()).toBe(404);
        const headers = response.headers();
        expect(headers['content-security-policy']).toContain("default-src 'self'");
        expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
        expect(headers['x-frame-options']).toBe('DENY');
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
        expect(headers['x-powered-by']).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------------------------
// Nav and form (DESIGN_SYSTEM 7.1, UX_RESEARCH 7)
// ---------------------------------------------------------------------------------------------

test('the nav "Plan a trip" link moves focus to the first planner field', async ({ page }) => {
    await gotoHydrated(page);
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Plan a trip' }).click();
    const firstField = page.locator('#planner form').locator('input, select, textarea').first();
    await expect(firstField).toBeFocused();
    await expect(page.getByLabel('Area *')).toBeFocused();
});

test('the date range hint shows the live trip length once both dates are filled', async ({ page }) => {
    await gotoHydrated(page);
    const departure = page.getByLabel('Departure *');
    const ret = page.getByLabel('Return *');

    // Before both dates parse, the hint states only the limit.
    await expect(departure).toHaveAccessibleDescription('Up to 14 days');
    await departure.fill(iso(10));
    await expect(departure).toHaveAccessibleDescription('Up to 14 days');

    await ret.fill(iso(12));
    await expect(departure).toHaveAccessibleDescription('3 days · up to 14');
    await expect(ret).toHaveAccessibleDescription('3 days · up to 14');

    await ret.fill(iso(10));
    await expect(ret).toHaveAccessibleDescription('1 day · up to 14');

    // Over the limit the hint still counts, which explains the duration error.
    await ret.fill(iso(40));
    await expect(ret).toHaveAccessibleDescription('31 days · up to 14');
});

// ---------------------------------------------------------------------------------------------
// Result (DESIGN_SYSTEM 7.11, UX_RESEARCH 5.2 and P6)
// ---------------------------------------------------------------------------------------------

test('on success focus moves to the trip title', async ({ page }) => {
    await mockTrips(page, success);
    await fillForm(page);
    await submitButton(page).click();
    const title = page.getByRole('heading', { level: 2, name: TITLE });
    await expect(title).toBeVisible();
    await expect(title).toBeFocused();
});

test('a 3-day result has a day navigator with one link per day pointing at the day headings', async ({ page }) => {
    await mockTrips(page, success);
    await fillForm(page);
    await submitButton(page).click();
    await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();

    const dayNav = page.getByRole('navigation', { name: 'Days' });
    await expect(dayNav).toBeVisible();
    const links = dayNav.getByRole('link');
    await expect(links).toHaveCount(3);
    // The navigator items are links, never headings.
    await expect(dayNav.getByRole('heading')).toHaveCount(0);

    for (let n = 1; n <= 3; n++) {
        const link = links.nth(n - 1);
        await expect(link).toHaveAccessibleName(new RegExp(`^Day ${n}\\b`));
        const href = await link.getAttribute('href');
        expect(href).toMatch(/^#[A-Za-z][\w-]*$/);
        const target = page.locator(href);
        await expect(target).toHaveCount(1);
        // The target is the day's section, and the day is a level-3 heading inside it.
        await expect(target.getByRole('heading', { level: 3, name: `Day ${n}`, exact: true })).toHaveCount(1);
        await expect(page.getByRole('heading', { name: `Day ${n}`, exact: true })).toHaveCount(1);
    }
    await expect(links.first()).toHaveAttribute('aria-current', 'true');

    // Choosing a day moves the reading position to its heading and marks it current.
    await links.nth(2).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Day 3', exact: true })).toBeFocused();
    await expect(links.nth(2)).toHaveAttribute('aria-current', 'true');
    await expect(dayNav.locator('[aria-current="true"]')).toHaveCount(1);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
});

// Keyboard focus is never dropped to <body> (UX_RESEARCH 5.2; review findings on the redesign).
test('a keyboard submit moves focus to Cancel, and Cancel returns it to the submit button', async ({ page }) => {
    await mockTrips(page, (body) => ({ delayMs: 5000, ...success(body) }));
    await fillForm(page);
    await submitButton(page).focus();
    await page.keyboard.press('Enter');
    const cancel = page.getByRole('button', { name: 'Cancel' });
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(cancel).toHaveCount(0);
    await expect(submitButton(page)).toBeFocused();
});

test('"Plan Another Trip" focuses the first field and keeps it on screen', async ({ page }) => {
    await mockTrips(page, success);
    await fillForm(page);
    await submitButton(page).click();
    await page.getByRole('button', { name: /Plan Another Trip/ }).click();
    const area = page.getByLabel('Area *');
    await expect(area).toBeFocused();
    await expect(area).toBeInViewport({ ratio: 1 });
});

test('tabbing through the day chips keeps the focused chip fully visible', async ({ page }) => {
    await mockTrips(page, success);
    await fillForm(page, { start: iso(10), end: iso(16) });
    await submitButton(page).click();
    await expect(page.getByRole('heading', { name: TITLE })).toBeFocused();
    const links = page.getByRole('navigation', { name: 'Days' }).getByRole('link');
    const width = page.viewportSize().width;
    for (let n = 0; n < 7; n++) {
        await page.keyboard.press('Tab');
        await expect(links.nth(n)).toBeFocused();
        await expect.poll(async () => {
            const box = await links.nth(n).boundingBox();
            return box.x >= 0 && box.x + box.width <= width;
        }).toBe(true);
    }
});

test('an exhausted daily quota does not start a countdown on the button', async ({ page }) => {
    await mockTrips(page, () => ({ status: 503, json: { error: "We've reached today's limit for new itineraries. Please come back later.", code: 'AI_QUOTA_EXHAUSTED', retryable: false } }));
    await fillForm(page);
    await submitButton(page).click();
    await expect(page.locator('main').getByRole('alert')).toContainText("Today's limit has been reached");
    await expect(submitButton(page)).toBeEnabled();
    await expect(submitButton(page)).not.toContainText(/Please wait/);
});

test('a 1-day result has no day navigator', async ({ page }) => {
    await mockTrips(page, success);
    await fillForm(page, { start: iso(10), end: iso(10) });
    await submitButton(page).click();
    await expect(page.getByRole('heading', { name: 'Day 1', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Days' })).toHaveCount(0);
});

test('the AI notice comes before the model-written notes, the day navigator and the first day', async ({ page }) => {
    await mockTrips(page, success);
    await fillForm(page);
    await submitButton(page).click();
    await expect(page.getByRole('heading', { name: 'Day 1', exact: true })).toBeVisible();

    const notice = await page.getByText(/AI-generated suggestions/).elementHandle();
    const later = {
        'Good to know': await page.getByRole('heading', { name: 'Good to know' }).elementHandle(),
        'Days navigation': await page.getByRole('navigation', { name: 'Days' }).elementHandle(),
        'Day 1 heading': await page.getByRole('heading', { name: 'Day 1', exact: true }).elementHandle(),
    };
    for (const [name, el] of Object.entries(later)) {
        // DOCUMENT_POSITION_FOLLOWING (4): `el` comes after the notice in document order.
        const following = await page.evaluate(([a, b]) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING), [notice, el]);
        expect(following, `AI notice precedes ${name}`).toBe(true);
    }
});

// ---------------------------------------------------------------------------------------------
// Reduced motion (UX_RESEARCH 8: "prefers-reduced-motion stops CSS animation")
// ---------------------------------------------------------------------------------------------

/** Every animation and transition in the document right now. */
const runningAnimations = (page) => page.evaluate(() => document.getAnimations().map((a) => a.animationName ?? a.transitionProperty ?? a.constructor.name));
/** Keyframe animations only (CSSAnimation): none may exist at any moment under reduced motion. */
const keyframeAnimations = (page) => page.evaluate(() => document.getAnimations().filter((a) => a instanceof CSSAnimation).map((a) => a.animationName));
/**
 * Transitions that last longer than 1 ms. Under reduced motion every transition is cut to 0.01ms
 * (UX_RESEARCH 8), so one may exist in the frame of a state change, but none may have a real length.
 */
const longTransitions = (page) => page.evaluate(() => document.getAnimations()
    .filter((a) => a instanceof CSSTransition && a.effect.getComputedTiming().duration > 1)
    .map((a) => `${a.transitionProperty} ${a.effect.getComputedTiming().duration}ms on ${a.effect.target.tagName}`));

test.describe('with prefers-reduced-motion: reduce', () => {
    test.use({ reducedMotion: 'reduce' });

    test('no element is animated after load', async ({ page }) => {
        await gotoHydrated(page);
        await page.evaluate(() => document.fonts.ready);
        expect(await runningAnimations(page)).toEqual([]);
    });

    test('no keyframe animation and no transition with a real length while generating or on the result', async ({ page }) => {
        await mockTrips(page, (body) => ({ ...success(body), delayMs: 1500 }));
        await fillForm(page);
        await submitButton(page).click();
        await expect(page.getByText('Crafting your itinerary…')).toBeVisible();
        expect(await keyframeAnimations(page)).toEqual([]);
        expect(await longTransitions(page)).toEqual([]);

        await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();
        expect(await keyframeAnimations(page)).toEqual([]);
        expect(await longTransitions(page)).toEqual([]);
    });
});

test.describe('without a motion preference', () => {
    test.use({ reducedMotion: 'no-preference' });

    // Control for the reduced-motion tests: the probe does see the hero's entrance animation.
    test('the hero entrance animation is present', async ({ page }) => {
        await gotoHydrated(page);
        expect((await runningAnimations(page)).length).toBeGreaterThan(0);
    });
});
