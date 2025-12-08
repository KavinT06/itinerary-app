"use client";
import React, { useState, useEffect } from 'react';

function App() {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        startDate: '',
        endDate: '',
        area: '',
        city: '',
        state: '',
    });

    const [tripPlan, setTripPlan] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const [lastRequestTime, setLastRequestTime] = useState(0);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        const minimumDelay = 5000;
        
        if (timeSinceLastRequest < minimumDelay) {
            const waitTime = Math.ceil((minimumDelay - timeSinceLastRequest) / 1000);
            setError(`Please wait ${waitTime} seconds between requests to respect API limits`);
            return;
        }

        setTripPlan(null);
        setError(null);
        setLoading(true);
        setRetryCount(0);
        setLastRequestTime(now);

        const payload = {
            destination: `${formData.area}, ${formData.city}, ${formData.state}`,
            startDate: formData.startDate,
            endDate: formData.endDate,
            createdBy: formData.name
        };

        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                const response = await fetch('/api/trips', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                const responseData = await response.json();

                if (response.status === 429) {
                    attempt++;
                    setRetryCount(attempt);
                    
                    if (attempt < maxRetries) {
                        const waitTime = Math.pow(2, attempt) * 3000;
                        setError(`API rate limit reached. Retrying in ${waitTime/1000} seconds (Attempt ${attempt}/${maxRetries})`);
                        await sleep(waitTime);
                        continue;
                    } else {
                        throw new Error('API rate limit exceeded. Please wait 60 seconds before submitting a new request.');
                    }
                }

                if (!response.ok) {
                    const errorMsg = responseData.error || responseData.details || 'Failed to generate trip plan';
                    throw new Error(errorMsg);
                }

                setTripPlan(responseData.trip);
                setError(null);
                break;

            } catch (err) {
                if (attempt === maxRetries - 1) {
                    setError(err.message || 'An unexpected error occurred');
                    break;
                }
            }
        }

        setLoading(false);
        setRetryCount(0);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-block mb-4">
                        <div className="flex items-center justify-center space-x-2 text-6xl">
                            <span>✈️</span>
                            <span>🗺️</span>
                            <span>🌍</span>
                        </div>
                    </div>
                    <h1 className="text-5xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-4">
                        AI Travel Planner
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Let AI craft your perfect journey with personalized itineraries
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 mb-8">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Personal Info */}
                        <div className="space-y-6">
                            <div className="flex items-center space-x-3 pb-4 border-b-2 border-purple-200">
                                <span className="text-3xl">👤</span>
                                <h2 className="text-2xl font-bold text-gray-800">Personal Information</h2>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">👨‍💼</span>
                                        <input
                                            type="text"
                                            name="name"
                                            id="name"
                                            placeholder="John Doe"
                                            value={formData.name}
                                            onChange={handleChange}
                                            className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-800 outline-none focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-100 transition-all"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">📧</span>
                                        <input
                                            type="email"
                                            name="email"
                                            id="email"
                                            placeholder="john@example.com"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-800 outline-none focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-100 transition-all"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">📱</span>
                                        <input
                                            type="tel"
                                            name="phone"
                                            id="phone"
                                            placeholder="+1 (555) 000-0000"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-800 outline-none focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-100 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="space-y-6">
                            <div className="flex items-center space-x-3 pb-4 border-b-2 border-pink-200">
                                <span className="text-3xl">📅</span>
                                <h2 className="text-2xl font-bold text-gray-800">Travel Dates</h2>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="startDate" className="block text-sm font-semibold text-gray-700 mb-2">Departure *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🛫</span>
                                        <input
                                            type="date"
                                            name="startDate"
                                            id="startDate"
                                            value={formData.startDate}
                                            onChange={handleChange}
                                            className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-800 outline-none focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-100 transition-all"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="endDate" className="block text-sm font-semibold text-gray-700 mb-2">Return *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🛬</span>
                                        <input
                                            type="date"
                                            name="endDate"
                                            id="endDate"
                                            value={formData.endDate}
                                            onChange={handleChange}
                                            className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-800 outline-none focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-100 transition-all"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Destination */}
                        <div className="space-y-6">
                            <div className="flex items-center space-x-3 pb-4 border-b-2 border-blue-200">
                                <span className="text-3xl">📍</span>
                                <h2 className="text-2xl font-bold text-gray-800">Dream Destination</h2>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label htmlFor="area" className="block text-sm font-semibold text-gray-700 mb-2">Area *</label>
                                    <input
                                        type="text"
                                        name="area"
                                        id="area"
                                        placeholder="e.g., Manhattan"
                                        value={formData.area}
                                        onChange={handleChange}
                                        className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="city" className="block text-sm font-semibold text-gray-700 mb-2">City *</label>
                                    <input
                                        type="text"
                                        name="city"
                                        id="city"
                                        placeholder="e.g., New York"
                                        value={formData.city}
                                        onChange={handleChange}
                                        className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="state" className="block text-sm font-semibold text-gray-700 mb-2">State/Country *</label>
                                    <input
                                        type="text"
                                        name="state"
                                        id="state"
                                        placeholder="e.g., USA"
                                        value={formData.state}
                                        onChange={handleChange}
                                        className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-6">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 py-5 px-8 text-lg font-bold text-white shadow-2xl transform transition-all duration-300 hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <span className="flex items-center justify-center space-x-3">
                                    {loading ? (
                                        <>
                                            <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            <span>
                                                {retryCount > 0 
                                                    ? `Retrying (${retryCount}/3)` 
                                                    : 'Generating Itinerary...'}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span>✨</span>
                                            <span>Generate Itinerary</span>
                                            <span>🚀</span>
                                        </>
                                    )}
                                </span>
                            </button>
                        </div>
                    </form>

                    {/* Error Message */}
                    {error && (
                        <div className="mt-6 p-5 bg-red-50 border-l-4 border-red-500 rounded-xl">
                            <div className="flex items-start">
                                <span className="text-2xl mr-3">❌</span>
                                <div>
                                    <h3 className="text-red-800 font-bold mb-1">Request Failed</h3>
                                    <p className="text-red-700">{error}</p>
                                    {(error.includes('rate limit') || error.includes('Rate limit')) && (
                                        <div className="mt-3 p-3 bg-amber-50 border-l-4 border-amber-400 rounded">
                                            <p className="text-amber-800 text-sm font-semibold">ℹ️ API Rate Limit Information</p>
                                            <p className="text-amber-700 text-sm mt-1">
                                                Please wait at least 5 seconds between requests. The system will automatically retry with increasing delays.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Trip Display */}
                {tripPlan && (
                    <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 mb-8">
                        <div className="text-center mb-10 pb-8 border-b-2 border-purple-100">
                            <span className="text-6xl mb-4 inline-block">🎉</span>
                            <h2 className="text-4xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
                                {tripPlan.title || 'Your Dream Itinerary'}
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 transform hover:scale-105 transition-transform">
                                <div className="text-3xl mb-3">📍</div>
                                <p className="text-sm font-semibold text-purple-700 mb-1">Destination</p>
                                <p className="text-lg font-bold text-purple-900">{tripPlan.destination}</p>
                            </div>

                            <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-2xl p-6 transform hover:scale-105 transition-transform">
                                <div className="text-3xl mb-3">📅</div>
                                <p className="text-sm font-semibold text-pink-700 mb-1">Duration</p>
                                <p className="text-lg font-bold text-pink-900">{tripPlan.startDate} → {tripPlan.endDate}</p>
                            </div>

                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 transform hover:scale-105 transition-transform">
                                <div className="text-3xl mb-3">👤</div>
                                <p className="text-sm font-semibold text-blue-700 mb-1">Traveler</p>
                                <p className="text-lg font-bold text-blue-900">{tripPlan.createdBy}</p>
                            </div>

                            {tripPlan.budget && (
                                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 transform hover:scale-105 transition-transform">
                                    <div className="text-3xl mb-3">💰</div>
                                    <p className="text-sm font-semibold text-green-700 mb-1">Budget</p>
                                    <p className="text-lg font-bold text-green-900">{tripPlan.budget.currency} {tripPlan.budget.estimated?.toLocaleString()}</p>
                                </div>
                            )}
                        </div>

                        {tripPlan.notes && (
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 mb-10 border-2 border-amber-200">
                                <div className="flex items-start space-x-4">
                                    <span className="text-4xl">ℹ️</span>
                                    <div className="flex-1">
                                        <h3 className="text-2xl font-bold text-gray-800 mb-3">About Your Destination!</h3>
                                        <p className="text-gray-700 leading-relaxed text-lg">{tripPlan.notes}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {tripPlan.days && tripPlan.days.length > 0 && (
                            <div className="space-y-6">
                                <h3 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                                    <span className="mr-3">📋</span>
                                    Your Daily Adventure
                                </h3>
                                
                                {tripPlan.days.map((day, dayIndex) => (
                                    <div key={dayIndex}>
                                        <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl shadow-xl overflow-hidden transform hover:scale-[1.02] transition-all">
                                            <div className="bg-white/10 backdrop-blur-sm text-white p-6">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-3xl font-black mb-1">Day {day.day}</h4>
                                                        <p className="text-lg opacity-90">{day.date} • {day.location}</p>
                                                    </div>
                                                    <div className="text-5xl opacity-80">{dayIndex === 0 ? '🌅' : dayIndex === tripPlan.days.length - 1 ? '🌃' : '☀️'}</div>
                                                </div>
                                            </div>

                                            <div className="bg-white p-6 space-y-4">
                                                {day.activities && day.activities.slice(0, 3).map((activity, actIndex) => (
                                                    <div key={actIndex} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-purple-50 transition-colors">
                                                        <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                                            {activity.time?.split(':')[0] || '⏰'}
                                                        </div>
                                                        <div className="flex-1">
                                                            <h5 className="font-bold text-lg text-gray-800 mb-1">{activity.title}</h5>
                                                            <p className="text-gray-600 text-sm mb-2">{activity.description}</p>
                                                            <div className="flex items-center text-sm text-purple-600">
                                                                <span className="mr-1">📍</span>
                                                                <span className="font-medium">{activity.location}</span>
                                                            </div>
                                                            {activity.notes && (
                                                                <div className="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
                                                                    <p className="text-sm text-gray-700">
                                                                        <span className="font-bold">💡 Pro Tip:</span> {activity.notes}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                
                                                {day.activities && day.activities.length > 3 && (
                                                    <div className="text-center py-3">
                                                        <span className="inline-block px-6 py-2 bg-purple-100 text-purple-700 rounded-full font-semibold text-sm">
                                                            + {day.activities.length - 3} more activities
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {tripPlan.id && (
                            <div className="mt-10 p-6 bg-gray-50 rounded-2xl border-2 border-gray-200">
                                <p className="text-sm text-gray-600 mb-2">Trip Reference ID</p>
                                <p className="text-lg font-mono font-bold text-gray-800 break-all">{tripPlan.id}</p>
                            </div>
                        )}

                        <div className="mt-10 text-center">
                            <button
                                onClick={() => {
                                    setTripPlan(null);
                                    setFormData({
                                        name: '',
                                        phone: '',
                                        email: '',
                                        startDate: '',
                                        endDate: '',
                                        area: '',
                                        city: '',
                                        state: '',
                                    });
                                }}
                                className="px-8 py-4 bg-gradient-to-r from-gray-600 to-gray-800 text-white rounded-xl font-bold hover:scale-105 transition-transform"
                            >
                                ← Create Another Trip
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;