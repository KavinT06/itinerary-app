// Browser tests against the production build. /api/trips is mocked at the network
// layer, so these are deterministic and never spend AI quota.

import { test, expect } from '@playwright/test';

const iso = (offsetDays) => {
    const d = new Date(Date.now() + offsetDays * 86_400_000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const activity = (time, title) => ({
    time, title, description: `About ${title}.`, location: `${title}, Averyveryverylongunbrokenvenuenamethatmustwrapinsteadofoverflowing District`, notes: 'Go early.',
});

function tripFor(body) {
    return {
        title: '2-Day Lisbon Highlights',
        destination: body.destination,
        startDate: body.startDate,
        endDate: body.endDate,
        createdBy: body.createdBy,
        notes: 'Mild weather. Wear comfortable shoes for the hills.',
        budget: { currency: 'EUR', estimated: 340 },
        days: [body.startDate, body.endDate].map((date, i) => ({
            day: i + 1, date, location: 'Alfama',
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

async function fillForm(page, { start = iso(10), end = iso(11) } = {}) {
    await page.goto('/');
    await page.getByLabel('Full Name *').fill('Asha Traveller');
    await page.getByLabel('Departure *').fill(start);
    await page.getByLabel('Return *').fill(end);
    await page.getByLabel('Area *').fill('Alfama');
    await page.getByLabel('City *').fill('Lisbon');
    await page.getByLabel('State / Country *').fill('Portugal');
}

const submitButton = (page) => page.locator('button[type="submit"]');
// Next.js adds its own hidden role="alert" route announcer, so the banner is found inside <main>.
const errorBanner = (page) => page.locator('main').getByRole('alert');

test('generates and shows an itinerary', async ({ page }) => {
    const calls = await mockTrips(page, (body) => ({ json: { success: true, trip: tripFor(body), requestId: 'r1', cache: 'miss' } }));
    await fillForm(page);
    await submitButton(page).click();

    await expect(page.getByRole('heading', { name: '2-Day Lisbon Highlights' })).toBeVisible();
    await expect(page.getByText('Alfama, Lisbon, Portugal')).toBeVisible();
    await expect(page.getByText('Asha Traveller')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Day 1' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Day 2' })).toBeVisible();
    await expect(page.getByText('€340')).toBeVisible();
    await expect(page.getByText(/AI-generated suggestions/)).toBeVisible();
    expect(calls).toEqual([{ destination: 'Alfama, Lisbon, Portugal', startDate: iso(10), endDate: iso(11), createdBy: 'Asha Traveller' }]);

    // After a request the button is paced by a cooldown.
    await expect(submitButton(page)).toBeDisabled();
    await expect(submitButton(page)).toContainText(/Please wait \d+s/);

    await page.getByRole('button', { name: /Plan Another Trip/ }).click();
    await expect(page.getByRole('heading', { name: '2-Day Lisbon Highlights' })).toHaveCount(0);
    await expect(page.getByLabel('Full Name *')).toHaveValue('');
});

test('invalid input is caught in the browser, marks the field, and sends nothing', async ({ page }) => {
    const calls = await mockTrips(page, () => ({ json: {} }));
    await fillForm(page, { end: iso(30) });
    await submitButton(page).click();

    const alert = errorBanner(page);
    await expect(alert).toContainText('Please check your details');
    await expect(alert).toContainText('Trip duration cannot exceed 14 days.');
    await expect(page.getByLabel('Return *')).toHaveAttribute('aria-invalid', 'true');
    expect(calls).toHaveLength(0);
    // A validation error does not start a cooldown: the user can correct and resubmit at once.
    await expect(submitButton(page)).toBeEnabled();
});

test('shows a loading state, ignores duplicate submissions, and can be cancelled', async ({ page }) => {
    const calls = await mockTrips(page, (body) => ({ delayMs: 3000, json: { success: true, trip: tripFor(body) } }));
    await fillForm(page);
    await submitButton(page).click();

    await expect(page.getByText('Crafting your itinerary…')).toBeVisible();
    await expect(submitButton(page)).toBeDisabled();
    await expect(submitButton(page)).toContainText('Generating Itinerary…');
    // Pressing Enter in a field would submit the form again; it must not send a second request.
    await page.getByLabel('City *').press('Enter');
    await page.waitForTimeout(300);
    expect(calls).toHaveLength(1);

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Crafting your itinerary…')).toHaveCount(0);
    await expect(errorBanner(page)).toHaveCount(0);
    await expect(submitButton(page)).toBeEnabled();
    await expect(submitButton(page)).toContainText('Generate Itinerary');
});

const errorCases = [
    {
        name: 'the visitor\'s own rate limit shows a countdown',
        response: { status: 429, headers: { 'Retry-After': '42' }, json: { error: 'Too many requests. Please wait 42 seconds and try again.', code: 'RATE_LIMITED', retryable: true, retryAfter: 42 } },
        title: 'Please slow down', text: /wait 42 seconds/, hint: /try again in \d+ seconds/, countdown: true,
    },
    {
        name: 'a busy provider shows a countdown',
        response: { status: 503, headers: { 'Retry-After': '20' }, json: { error: 'The itinerary service is busy right now. Please try again in 20 seconds.', code: 'AI_BUSY', retryable: true, retryAfter: 20 } },
        title: 'The service is busy', text: /busy right now/, hint: /try again in \d+ seconds/, countdown: true,
    },
    {
        name: 'an exhausted daily quota says to come back later and does not invite a retry',
        response: { status: 503, json: { error: "We've reached today's limit for new itineraries. Please come back later.", code: 'AI_QUOTA_EXHAUSTED', retryable: false } },
        title: "Today's limit has been reached", text: /come back later/, hint: null,
    },
    {
        name: 'a timeout suggests a shorter trip',
        response: { status: 504, json: { error: 'Generating your itinerary took too long. Please try again, or plan a shorter trip.', code: 'AI_TIMEOUT', retryable: true } },
        title: 'That took too long', text: /shorter trip/, hint: /try again/,
    },
    {
        name: 'an invalid AI response invites a retry',
        response: { status: 502, json: { error: 'The AI returned an incomplete itinerary. Please try again.', code: 'AI_INVALID_RESPONSE', retryable: true } },
        title: "Couldn't create your itinerary", text: /incomplete itinerary/, hint: /try again/,
    },
    {
        name: 'a refused destination asks the visitor to check it',
        response: { status: 422, json: { error: "We couldn't create an itinerary for that destination. Please check it and try again.", code: 'AI_REFUSED', retryable: false } },
        title: "We couldn't plan that destination", text: /check it/, hint: null,
    },
    {
        name: 'an unexpected server error is generic',
        response: { status: 500, json: { error: 'An unexpected error occurred. Please try again.', code: 'INTERNAL', retryable: true } },
        title: "Couldn't create your itinerary", text: /unexpected error/, hint: /try again/,
    },
];

for (const c of errorCases) {
    test(`error: ${c.name}`, async ({ page }) => {
        await mockTrips(page, () => c.response);
        await fillForm(page);
        await submitButton(page).click();

        const alert = errorBanner(page);
        await expect(alert.getByRole('heading')).toHaveText(c.title);
        await expect(alert).toContainText(c.text);
        if (c.hint) await expect(alert).toContainText(c.hint);
        else await expect(alert).not.toContainText(/try again (now|in \d+)/i);
        if (c.countdown) await expect(submitButton(page)).toContainText(/Please wait \d+s/);
        // Nothing internal is ever shown.
        await expect(page.locator('body')).not.toContainText(/stack|groq|gsk_|at \w+ \(/i);
        // The form keeps what the visitor typed.
        await expect(page.getByLabel('City *')).toHaveValue('Lisbon');
    });
}

test('a platform error page that is not JSON still produces a clear message', async ({ page }) => {
    await page.route('**/api/trips', (route) => route.fulfill({ status: 504, contentType: 'text/html', body: '<html>Gateway Timeout</html>' }));
    await fillForm(page);
    await submitButton(page).click();
    await expect(errorBanner(page)).toContainText('took too long');
});

test('a network failure is reported as a connection problem', async ({ page }) => {
    await page.route('**/api/trips', (route) => route.abort('failed'));
    await fillForm(page);
    await submitButton(page).click();
    await expect(errorBanner(page).getByRole('heading')).toHaveText("Can't reach the server");
});

test('model text is rendered as text, never as markup', async ({ page }) => {
    await mockTrips(page, (body) => {
        const trip = tripFor(body);
        trip.title = '<img src=x onerror="window.__xss=1">Trip';
        trip.days[0].activities[0].description = '<script>window.__xss=1</script>';
        return { json: { success: true, trip } };
    });
    await fillForm(page);
    await submitButton(page).click();
    await expect(page.getByText('<img src=x onerror="window.__xss=1">Trip')).toBeVisible();
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await expect(page.locator('article img')).toHaveCount(0);
});

test('nothing overflows horizontally, with the form and with a long itinerary', async ({ page }) => {
    await mockTrips(page, (body) => ({ json: { success: true, trip: tripFor(body) } }));
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await fillForm(page);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await submitButton(page).click();
    await expect(page.getByRole('heading', { name: 'Day 2' })).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
});

test('the page sends the security headers', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response.headers();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-powered-by']).toBeUndefined();
});
