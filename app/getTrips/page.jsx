"use client";
import React, { useState } from 'react';
import Link from 'next/link';

export default function GetTripsPage() {
    // State for form controls and fetched trip data
    const [fetchTripId, setFetchTripId] = useState('');
    const [fetchDestination, setFetchDestination] = useState('');
    const [fetchedTrip, setFetchedTrip] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleFetchTrip = async () => {
        setFetchedTrip(null);
        setError(null);
        setLoading(true);

        try {
            if (fetchTripId) {
                // Fetch by tripId
                const response = await fetch(`/api/trips/${fetchTripId}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Trip not found');
                }
                
                const data = await response.json();
                setFetchedTrip(data);
                
            } else if (fetchDestination) {
                // Fetch by destination
                const response = await fetch(`/api/trips?destination=${encodeURIComponent(fetchDestination)}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch trips');
                }
                
                const trips = await response.json();
                if (trips.length > 0) {
                    setFetchedTrip(trips[0]); // Display the first matching trip
                } else {
                    setError('No trip found for this destination');
                }
            } else {
                setError('Please enter a Trip ID or Destination');
            }
        } catch (err) {
            console.error('Error fetching trip:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center p-12">
            <div className="mx-auto w-full max-w-[530px] bg-white">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-extrabold">Trip Details</h1>
                    <Link href="/">
                        <button className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300">
                            Back to Home
                        </button>
                    </Link>
                </div>

                {/* Fetch Trip Section */}
                <div className="mb-8 p-6 border rounded-md bg-white shadow-sm">
                    <h2 className="text-xl font-bold mb-4">Fetch Trip Details</h2>
                    <div className="mb-4">
                        <label htmlFor="fetchTripId" className="mb-2 block text-base font-medium text-[#07074D]">
                            Trip ID
                        </label>
                        <input
                            type="text"
                            id="fetchTripId"
                            placeholder="Enter Trip ID (e.g., 64f8c2e5...)"
                            value={fetchTripId}
                            onChange={(e) => setFetchTripId(e.target.value)}
                            className="w-full rounded-md border border-[#e0e0e0] bg-white py-3 px-6 text-base font-medium text-[#6B7280] outline-none focus:border-[#6A64F1] focus:shadow-md"
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="fetchDestination" className="mb-2 block text-base font-medium text-[#07074D]">
                            Destination
                        </label>
                        <input
                            type="text"
                            id="fetchDestination"
                            placeholder="Enter destination (e.g., Chennai)"
                            value={fetchDestination}
                            onChange={(e) => setFetchDestination(e.target.value)}
                            className="w-full rounded-md border border-[#e0e0e0] bg-white py-3 px-6 text-base font-medium text-[#6B7280] outline-none focus:border-[#6A64F1] focus:shadow-md"
                        />
                    </div>
                    <button
                        onClick={handleFetchTrip}
                        disabled={loading}
                        className={`w-full rounded-md bg-[#6A64F1] py-3 px-8 text-center text-base font-semibold text-white outline-none hover:bg-purple-600 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Fetching...' : 'Fetch Trip Details'}
                    </button>
                    
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-100 rounded">
                            <p>{error}</p>
                        </div>
                    )}
                </div>

                {/* Display the fetched trip with destination description */}
                {fetchedTrip && (
                    <div className="mt-8 p-6 border rounded-md bg-gray-50 shadow-sm">
                        <h2 className="text-2xl font-bold">{fetchedTrip.title || 'Trip Details'}</h2>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <p><strong>ID:</strong> {fetchedTrip._id}</p>
                            <p><strong>Created By:</strong> {fetchedTrip.createdBy || 'N/A'}</p>
                            <p><strong>Start Date:</strong> {fetchedTrip.startDate}</p>
                            <p><strong>End Date:</strong> {fetchedTrip.endDate}</p>
                        </div>

                        {/* Enhanced destination display with AI description */}
                        <div className="mt-6 pb-4 border-b">
                            <p className="text-lg font-semibold">Destination: {fetchedTrip.destination ||
                                (fetchedTrip.days && fetchedTrip.days.length > 0 && fetchedTrip.days[0].location) ||
                                (fetchedTrip.title && fetchedTrip.title.includes('in') ?
                                    fetchedTrip.title.split('in')[1].trim() : 'Not specified')}
                            </p>

                            {/* Extract destination description from notes or first day description */}
                            <div className="mt-2 text-gray-700">
                                {fetchedTrip.notes ? (
                                    <p>{fetchedTrip.notes}</p>
                                ) : fetchedTrip.days && fetchedTrip.days.length > 0 && fetchedTrip.days[0].activities &&
                                    fetchedTrip.days[0].activities.length > 0 ? (
                                    <p>{fetchedTrip.days[0].activities[0].description ||
                                        fetchedTrip.days[0].activities[0].notes ||
                                        "No destination description available"}</p>
                                ) : (
                                    <p>No destination description available</p>
                                )}
                            </div>
                        </div>

                        {/* Display the itinerary highlights */}
                        {fetchedTrip.days && fetchedTrip.days.length > 0 && (
                            <div className="mt-4">
                                <h3 className="text-xl font-semibold mb-2">Itinerary Highlights:</h3>
                                <ul className="list-disc pl-5 space-y-2">
                                    {fetchedTrip.days.map((day, index) => (
                                        <li key={index} className="mb-2">
                                            <div>
                                                <strong>Day {day.day}:</strong> {day.location}
                                                {day.activities && day.activities.length > 0 && (
                                                    <ul className="list-circle pl-5 mt-1 text-sm text-gray-600">
                                                        {day.activities.slice(0, 2).map((activity, i) => (
                                                            <li key={i} className="mb-1">
                                                                <strong>{activity.time}:</strong> {activity.title} at {activity.location}
                                                                {activity.description && (
                                                                    <p className="text-xs mt-1 text-gray-500">{activity.description}</p>
                                                                )}
                                                            </li>
                                                        ))}
                                                        {day.activities.length > 2 && (
                                                            <li>...and {day.activities.length - 2} more activities</li>
                                                        )}
                                                    </ul>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="mt-6 flex justify-between">
                            <Link href="/">
                                <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                                    Back to Home
                                </button>
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}