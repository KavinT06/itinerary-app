// GET /api/health — is the application running and correctly configured?
// It never calls the AI provider unless an administrator explicitly asks with ?probe=ai,
// and even then it spends no tokens.

import { getContainer } from '../../../lib/infrastructure/container.js';
import { hasAdminToken } from '../../../lib/http/request.js';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request) {
    const { config, store, storeKind, provider } = getContainer();
    const checks = {
        config: config.problems.length === 0 ? 'ok' : 'invalid',
        store: storeKind === 'memory' ? 'memory' : 'ok',
        ai: provider ? 'configured' : 'not_configured',
    };

    if (storeKind === 'shared') {
        try {
            await store.ping();
        } catch {
            checks.store = 'degraded';
        }
    }

    if (new URL(request.url).searchParams.get('probe') === 'ai') {
        if (!hasAdminToken(request, config.adminToken)) {
            return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE });
        }
        if (provider) {
            try {
                await provider.checkAvailability({ signal: request.signal });
                checks.ai = 'reachable';
            } catch (err) {
                checks.ai = `unreachable:${err.kind ?? 'unknown'}`;
            }
        }
    }

    const healthy = checks.config === 'ok' && checks.store !== 'degraded' && !checks.ai.startsWith('unreachable') && checks.ai !== 'not_configured';
    return Response.json(
        { status: healthy ? 'ok' : 'degraded', checks },
        // Only a broken configuration makes the service itself unhealthy.
        { status: checks.config === 'ok' ? 200 : 503, headers: NO_STORE },
    );
}
