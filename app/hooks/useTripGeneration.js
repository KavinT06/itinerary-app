"use client";
// The submit state machine: idle -> submitting -> success | error. Owns cancellation
// and the cooldown, so the page only composes components.

import { useCallback, useEffect, useRef, useState } from 'react';
import { requestTripItinerary } from '../../lib/client/api-client.js';
import { parseTripRequest, MAX_START_DAYS_AHEAD } from '../../lib/domain/trip-request.js';
import { todayLocalIso, addDays } from '../../lib/domain/dates.js';
import { ERROR_CODES } from '../../lib/domain/error-codes.js';

// Courtesy pacing between requests. The server enforces the real limits.
const COOLDOWN_SECONDS = 15;
// Never show a countdown longer than this; longer waits are presented as "come back later".
const MAX_COUNTDOWN_SECONDS = 120;

export function useTripGeneration() {
    const [status, setStatus] = useState('idle'); // idle | submitting | success | error
    const [trip, setTrip] = useState(null);
    const [error, setError] = useState(null); // { code, message, retryable, field } | null
    const [cooldown, setCooldown] = useState(0);
    const abortRef = useRef(null);

    useEffect(() => () => abortRef.current?.abort(), []);

    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const submit = useCallback(async (payload) => {
        // The ref, not the state, guards against a second submit in the same tick.
        if (abortRef.current || cooldown > 0) return;

        const today = todayLocalIso();
        const parsed = parseTripRequest(payload, { minStartDate: today, maxStartDate: addDays(today, MAX_START_DAYS_AHEAD) });
        if (!parsed.ok) {
            setStatus('error');
            setError({ code: 'VALIDATION_FAILED', message: parsed.error, retryable: false, field: parsed.field, retryAfterSeconds: undefined });
            return;
        }

        const controller = new AbortController();
        abortRef.current = controller;
        setTrip(null);
        setError(null);
        setStatus('submitting');

        let nextCooldown = COOLDOWN_SECONDS;
        try {
            setTrip(await requestTripItinerary(payload, { signal: controller.signal }));
            setStatus('success');
        } catch (err) {
            if (err?.name === 'AbortError') return;
            setStatus('error');
            setError({
                code: err.code ?? 'INTERNAL',
                message: err.message || ERROR_CODES.INTERNAL.message,
                retryable: Boolean(err.retryable),
                field: err.field,
                retryAfterSeconds: err.retryAfterSeconds,
            });
            // No countdown where waiting will not help: fix the input, or come back later (LLD section 8).
            if (err.code === 'VALIDATION_FAILED' || err.code === 'AI_QUOTA_EXHAUSTED') nextCooldown = 0;
            else if (err.retryAfterSeconds) nextCooldown = Math.min(MAX_COUNTDOWN_SECONDS, Math.max(nextCooldown, err.retryAfterSeconds));
        } finally {
            if (abortRef.current === controller) {
                abortRef.current = null;
                if (!controller.signal.aborted) setCooldown(nextCooldown);
            }
        }
    }, [cooldown]);

    const cancel = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setStatus('idle');
    }, []);

    const reset = useCallback(() => {
        setTrip(null);
        setError(null);
        setStatus('idle');
    }, []);

    return { status, trip, error, cooldown, submit, cancel, reset };
}
