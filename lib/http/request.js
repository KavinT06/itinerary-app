// HTTP request helpers for route handlers: request context, origin and content-type
// guards, and a size-capped JSON body reader.

import 'server-only';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { AppError } from '../application/errors.js';

// A valid trip request is under 400 bytes. Anything far beyond that is not a trip request.
export const MAX_BODY_BYTES = 4096;

/**
 * On Vercel, x-real-ip is set by the platform and cannot be overridden by the client. Off Vercel,
 * put a proxy in front that sets it. x-forwarded-for is not used: outside Vercel the client controls it.
 */
function clientIp(headers) {
    return normalizeClientIp(headers.get('x-real-ip')?.trim() || 'unknown');
}

/**
 * One IPv6 subscriber usually controls a whole /64, so addresses are grouped by their first four
 * hextets; otherwise rotating addresses inside it would give unlimited per-client buckets.
 */
export function normalizeClientIp(ip) {
    const address = ip.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
    if (!address.includes(':')) return address;
    if (/^::ffff:\d+\.\d+\.\d+\.\d+$/.test(address)) return address.slice(7); // IPv4-mapped
    const [head, tail = ''] = address.split('::');
    const headParts = head ? head.split(':') : [];
    const tailParts = tail ? tail.split(':') : [];
    const missing = Math.max(0, 8 - headParts.length - tailParts.length);
    const full = address.includes('::') ? [...headParts, ...Array(missing).fill('0'), ...tailParts] : headParts;
    return `${full.slice(0, 4).map((part) => (part || '0').replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

/** @returns {{requestId: string, clientId: string, signal: AbortSignal, startedAt: number, route: string}} */
export function createRequestContext(request, route, now = Date.now) {
    return {
        requestId: randomUUID(),
        // A hash, so raw addresses never reach the store or the logs.
        clientId: createHash('sha256').update(clientIp(request.headers)).digest('hex').slice(0, 24),
        signal: request.signal,
        startedAt: now(),
        route,
    };
}

/**
 * Browser-side protection for the AI quota: other sites' pages cannot call this API from a
 * visitor's browser. It does not stop non-browser clients; rate limits and budgets do that.
 */
export function assertSameOriginJson(request) {
    if (request.headers.get('sec-fetch-site') === 'cross-site') throw new AppError('FORBIDDEN_ORIGIN');
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        throw new AppError('UNSUPPORTED_MEDIA_TYPE');
    }
}

/** Reads at most maxBytes of the body and parses it as JSON. Throws PAYLOAD_TOO_LARGE or INVALID_JSON. */
export async function readJsonBody(request, maxBytes = MAX_BODY_BYTES) {
    const declared = Number(request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) throw new AppError('PAYLOAD_TOO_LARGE');

    let text = '';
    if (request.body) {
        const reader = request.body.getReader();
        const decoder = new TextDecoder();
        let received = 0;
        for (;;) {
            let chunk;
            try {
                chunk = await reader.read();
            } catch (err) {
                // The client went away mid-upload, or the stream broke: neither is a server bug.
                throw new AppError(request.signal?.aborted ? 'CLIENT_CLOSED' : 'INVALID_JSON', { cause: err });
            }
            const { done, value } = chunk;
            if (done) break;
            received += value.byteLength;
            if (received > maxBytes) {
                await reader.cancel().catch(() => {});
                throw new AppError('PAYLOAD_TOO_LARGE');
            }
            text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
    }
    try {
        return JSON.parse(text);
    } catch {
        throw new AppError('INVALID_JSON');
    }
}

/** Constant-time check of "Authorization: Bearer <token>". False when no admin token is configured. */
export function hasAdminToken(request, adminToken) {
    if (!adminToken) return false;
    const given = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1] ?? '';
    const a = createHash('sha256').update(given).digest();
    const b = createHash('sha256').update(adminToken).digest();
    return timingSafeEqual(a, b);
}
