"use client";
import { useEffect, useRef, useState } from 'react';
import TripForm from './components/TripForm.jsx';
import ItineraryView from './components/ItineraryView.jsx';
import GenerationStatus from './components/GenerationStatus.jsx';
import { useTripGeneration } from './hooks/useTripGeneration.js';
import { MAX_TRIP_DAYS, MAX_NAME_LENGTH } from '../lib/domain/trip-request.js';
import { todayLocalIso } from '../lib/domain/dates.js';

const EMPTY_FORM = { name: '', startDate: '', endDate: '', area: '', city: '', state: '' };
const LIMITS = { name: MAX_NAME_LENGTH, days: MAX_TRIP_DAYS };
// Which form input to mark when the server or the validator names a request field.
const FIELD_TO_INPUT = { createdBy: 'name', destination: 'area', startDate: 'startDate', endDate: 'endDate' };

export default function Home() {
    const [form, setForm] = useState(EMPTY_FORM);
    // Computed after mount: the page is prerendered at build time, so using the
    // current date during render would cause a hydration mismatch.
    const [today, setToday] = useState('');
    const { status, trip, error, cooldown, submit, cancel, reset } = useTripGeneration();
    const resultRef = useRef(null);

    useEffect(() => {
        setToday(todayLocalIso());
    }, []);

    useEffect(() => {
        if (trip) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [trip]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        submit({
            destination: [form.area, form.city, form.state].map((s) => s.trim()).filter(Boolean).join(', '),
            startDate: form.startDate,
            endDate: form.endDate,
            createdBy: form.name,
        });
    };

    const handleReset = () => {
        reset();
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
                        loading={status === 'submitting'}
                        cooldown={cooldown}
                        today={today}
                        limits={LIMITS}
                        invalidInput={error?.code === 'VALIDATION_FAILED' ? FIELD_TO_INPUT[error.field] : undefined}
                    />
                    <GenerationStatus status={status} error={error} cooldown={cooldown} onCancel={cancel} />
                </div>

                <div ref={resultRef} className="scroll-mt-6">
                    {trip && <ItineraryView trip={trip} onReset={handleReset} />}
                </div>
            </div>
        </main>
    );
}
