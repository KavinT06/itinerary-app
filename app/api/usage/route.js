// GET /api/usage?date=YYYY-MM-DD — daily usage counters, for the owner.
// Requires "Authorization: Bearer <ADMIN_TOKEN>". Without ADMIN_TOKEN configured the
// endpoint does not exist (404).

import { getContainer } from '../../../lib/infrastructure/container.js';
import { hasAdminToken } from '../../../lib/http/request.js';
import { parseIsoDate, isoDateFromMs } from '../../../lib/domain/dates.js';
import { ERROR_CODES } from '../../../lib/domain/error-codes.js';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request) {
    const { config, usage } = getContainer();
    if (!config.adminToken) return Response.json({ error: 'Not found.' }, { status: 404, headers: NO_STORE });
    if (!hasAdminToken(request, config.adminToken)) {
        return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE });
    }

    const date = new URL(request.url).searchParams.get('date') ?? isoDateFromMs(Date.now());
    if (parseIsoDate(date) === null) {
        return Response.json({ error: 'date must be YYYY-MM-DD.' }, { status: 400, headers: NO_STORE });
    }

    const counters = await usage.read(date, Object.keys(ERROR_CODES).map((code) => `error:${code}`));
    const errors = {};
    for (const [field, value] of Object.entries(counters)) {
        if (!field.startsWith('error:')) continue;
        if (value > 0) errors[field.slice('error:'.length)] = value;
        delete counters[field];
    }
    return Response.json(
        { date, ...counters, errors, budget: { dailyRequests: config.budget.dailyRequests, dailyTokens: config.budget.dailyTokens } },
        { headers: NO_STORE },
    );
}
