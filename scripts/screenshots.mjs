// Captures every screen of the app at desktop and phone width, for design review.
// /api/trips is mocked at the network layer: this never calls the real API or spends AI quota.
//
//   npm run build && npx next start -p 3300
//   node scripts/screenshots.mjs --base http://localhost:3300 --out docs/design/screenshots
//   node scripts/screenshots.mjs --base ... --out ... --only landing,result --widths 375
//
// Form fields are found by id (#name, #startDate, #endDate, #area, #city, #state).

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
const BASE = args.base ?? 'http://localhost:3300';
const OUT = args.out ?? 'docs/design/screenshots';
const WIDTHS = (args.widths ?? '1440,375').split(',').map(Number);
const ONLY = args.only ? new Set(args.only.split(',')) : null;

const iso = (offsetDays) => {
    const d = new Date(Date.now() + offsetDays * 86_400_000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const DAY_PLAN = [
    ['08:30', 'Breakfast at Manteigaria', 'Custard tarts fresh from the oven, eaten standing at the counter like the locals.', 'Rua do Loreto 2, Chiado', 'Arrive before 9:00 to skip the queue.'],
    ['10:00', 'Castelo de São Jorge', 'Moorish castle walls with the widest views over the river and the red roofs of Alfama.', 'Rua de Santa Cruz do Castelo, Alfama', 'Buy tickets online; the ticket line is long by 11:00.'],
    ['13:00', 'Lunch at Taberna da Rua das Flores', 'Small-plates tavern with a handwritten daily menu and natural wines.', 'Rua das Flores 103, Chiado', 'No reservations; put your name down and walk around the block.'],
    ['15:30', 'Tram 28 to Estrela', 'The classic yellow tram through the steepest streets of the old city.', 'Praça Martim Moniz stop', 'Board at Martim Moniz to get a seat.'],
    ['19:30', 'Dinner at Zé da Mouraria', 'Generous portions of grilled fish and codfish in a family-run room.', 'Rua João do Outeiro 24, Mouraria', 'Portions are large; one main serves two.'],
];

function tripFor(body, days = 3) {
    const start = new Date(`${body.startDate}T00:00:00Z`);
    return {
        title: `${days}-Day Lisbon Highlights`,
        destination: body.destination,
        startDate: body.startDate,
        endDate: body.endDate,
        createdBy: body.createdBy,
        notes: 'Mild and sunny in spring, with cool evenings by the river. Lisbon is built on seven hills: wear shoes with grip, carry a light layer, and use the trams and funiculars for the steepest climbs.',
        budget: { currency: 'EUR', estimated: 540 },
        days: Array.from({ length: days }, (_, i) => ({
            day: i + 1,
            date: new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10),
            location: ['Alfama and Baixa', 'Belém', 'Sintra'][i % 3],
            activities: DAY_PLAN.map(([time, title, description, location, notes]) => ({ time, title, description, location, notes })),
        })),
        generatedAt: new Date().toISOString(),
    };
}

async function fill(page, { start = iso(10), end = iso(12) } = {}) {
    await page.locator('#name').fill('Asha Raman');
    await page.locator('#startDate').fill(start);
    await page.locator('#endDate').fill(end);
    await page.locator('#area').fill('Alfama');
    await page.locator('#city').fill('Lisbon');
    await page.locator('#state').fill('Portugal');
}

const mock = (page, respond) => page.route('**/api/trips', async (route) => {
    const { status = 200, json, headers = {}, delayMs = 0 } = respond(route.request().postDataJSON());
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(json) }).catch(() => {});
});

const submit = (page) => page.locator('button[type="submit"]').click();
const settle = (page) => page.waitForTimeout(600);

const SCREENS = {
    landing: async (page) => { await page.goto(BASE); await settle(page); },
    'form-filled': async (page) => { await page.goto(BASE); await fill(page); await settle(page); },
    'error-validation': async (page) => {
        await page.goto(BASE); await fill(page, { end: iso(40) }); await submit(page);
        await page.locator('main [role="alert"]').waitFor(); await settle(page);
    },
    loading: async (page) => {
        await mock(page, (body) => ({ delayMs: 60_000, json: { success: true, trip: tripFor(body) } }));
        await page.goto(BASE); await fill(page); await submit(page); await page.waitForTimeout(1200);
    },
    'error-busy': async (page) => {
        await mock(page, () => ({ status: 503, headers: { 'Retry-After': '20' }, json: { error: 'The itinerary service is busy right now. Please try again in 20 seconds.', code: 'AI_BUSY', retryable: true, retryAfter: 20 } }));
        await page.goto(BASE); await fill(page); await submit(page);
        await page.locator('main [role="alert"]').waitFor(); await settle(page);
    },
    'error-quota': async (page) => {
        await mock(page, () => ({ status: 503, json: { error: "We've reached today's limit for new itineraries. Please come back later.", code: 'AI_QUOTA_EXHAUSTED', retryable: false } }));
        await page.goto(BASE); await fill(page); await submit(page);
        await page.locator('main [role="alert"]').waitFor(); await settle(page);
    },
    result: async (page) => {
        await mock(page, (body) => ({ json: { success: true, trip: tripFor(body), requestId: 'r1', cache: 'miss' } }));
        await page.goto(BASE); await fill(page); await submit(page);
        await page.getByText('3-Day Lisbon Highlights').first().waitFor(); await page.waitForTimeout(1200);
    },
    'not-found': async (page) => { await page.goto(`${BASE}/this-page-does-not-exist`); await settle(page); },
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const written = [];
for (const width of WIDTHS) {
    const phone = width < 600;
    for (const [name, run] of Object.entries(SCREENS)) {
        if (ONLY && !ONLY.has(name)) continue;
        const context = await browser.newContext({ viewport: { width, height: phone ? 812 : 900 }, deviceScaleFactor: phone ? 2 : 1, reducedMotion: 'reduce' });
        const page = await context.newPage();
        try {
            await run(page);
            const file = path.join(OUT, `${name}-${width}.jpg`);
            await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 78 });
            written.push(file);
        } catch (error) {
            console.error(`FAILED ${name} @ ${width}: ${error.message.split('\n')[0]}`);
        }
        await context.close();
    }
}
await browser.close();
console.log(written.join('\n'));
