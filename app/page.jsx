"use client";
import { useEffect, useRef, useState } from 'react';
import TripForm from './components/TripForm.jsx';
import ItineraryView from './components/ItineraryView.jsx';
import { requestTripItinerary } from '../lib/api-client.js';
import { parseTripRequest, MAX_TRIP_DAYS, MAX_NAME_LENGTH } from '../lib/itinerary.js';
import { todayLocalIso } from '../lib/dates.js';

// Client-side pacing to protect the shared AI quota; the server enforces its own limit.
const COOLDOWN_SECONDS = 15;
const EMPTY_FORM = { name: '', startDate: '', endDate: '', area: '', city: '', state: '' };
const LIMITS = { name: MAX_NAME_LENGTH, days: MAX_TRIP_DAYS };

export default function Home() {
    const [form, setForm] = useState(EMPTY_FORM);
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [cooldown, setCooldown] = useState(0);
    // Computed after mount: the page is prerendered at build time, so using the
    // current date during render would cause a hydration mismatch.
    const [today, setToday] = useState('');
    const abortRef = useRef(null);
    const resultRef = useRef(null);

    useEffect(() => {
        setToday(todayLocalIso());
        return () => abortRef.current?.abort();
    }, []);

    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    useEffect(() => {
        if (trip) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [trip]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading || cooldown > 0) return;

        const payload = {
            destination: [form.area, form.city, form.state].map((s) => s.trim()).filter(Boolean).join(', '),
            startDate: form.startDate,
            endDate: form.endDate,
            createdBy: form.name,
        };

        const parsed = parseTripRequest(payload, { minStartDate: todayLocalIso() });
        if (!parsed.ok) {
            setError(parsed.error);
            return;
        }

        const controller = new AbortController();
        abortRef.current = controller;
        setTrip(null);
        setError(null);
        setLoading(true);

        // The cooldown starts once the request finishes; generation itself takes 10-40s.
        let nextCooldown = COOLDOWN_SECONDS;
        try {
            setTrip(await requestTripItinerary(payload, { signal: controller.signal }));
        } catch (err) {
            if (err.name === 'AbortError') return;
            setError(err.message || 'An unexpected error occurred. Please try again.');
            nextCooldown = Math.max(nextCooldown, err.retryAfterSeconds || 0);
        } finally {
            if (abortRef.current === controller) {
                abortRef.current = null;
                setLoading(false);
                if (!controller.signal.aborted) setCooldown(nextCooldown);
            }
        }
    };

    const handleReset = () => {
        setTrip(null);
        setError(null);
        setForm(EMPTY_FORM);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <main className="min-h-screen bg-linear-to-br from-indigo-50 via-purple-50 to-pink-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto">
                <header className="text-center mb-12">
                    <div aria-hidden="true" className="flex items-center justify-center space-x-2 text-5xl sm:text-6xl mb-4">
                        <span>✈️</span>
                        <span>🗺️</span>
                        <span>🌍</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black bg-linear-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-4">
                        AI Travel Planner
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Let AI craft your perfect journey with personalised itineraries
                    </p>
                </header>

                <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 md:p-12 mb-8">
                    <TripForm
                        form={form}
                        onChange={handleChange}
                        onSubmit={handleSubmit}
                        loading={loading}
                        cooldown={cooldown}
                        today={today}
                        limits={LIMITS}
                    />

                    <div aria-live="polite">
                        {loading && (
                            <div className="mt-6 p-5 bg-purple-50 border-l-4 border-purple-400 rounded-xl">
                                <p className="font-bold text-purple-900">Crafting your itinerary…</p>
                                <p className="text-purple-800 text-sm mt-1">
                                    This usually takes 10–40 seconds, longer for long trips.
                                </p>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div role="alert" className="mt-6 p-5 bg-red-50 border-l-4 border-red-500 rounded-xl">
                            <div className="flex items-start">
                                <span aria-hidden="true" className="text-2xl mr-3">❌</span>
                                <div>
                                    <h3 className="text-red-800 font-bold mb-1">Couldn&apos;t create your itinerary</h3>
                                    <p className="text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div ref={resultRef} className="scroll-mt-6">
                    {trip && <ItineraryView trip={trip} onReset={handleReset} />}
                </div>
            </div>
        </main>
    );
}
