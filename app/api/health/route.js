import { getModelName, isAIConfigured } from '../../../lib/gemini.js';

export const dynamic = 'force-dynamic';

// Liveness + configuration check. Reports only whether a key is present, never
// any part of it. A present key can still be invalid; check server logs for
// "[trips] AI failure" entries with kind "auth".
export function GET() {
    return Response.json(
        { status: 'ok', aiConfigured: isAIConfigured(), model: getModelName() },
        { headers: { 'Cache-Control': 'no-store' } }
    );
}
