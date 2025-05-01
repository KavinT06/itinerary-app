"use client";
import Link from 'next/link';
import React, { useState } from 'react';

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
    const [fetchTripId, setFetchTripId] = useState('');
    const [fetchDestination, setFetchDestination] = useState('');
    const [fetchedTrip, setFetchedTrip] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // const handleSubmit = async (e) => {
    //     e.preventDefault();
    //     setTripPlan(null);

    //     const payload = {
    //         destination: `${formData.area}, ${formData.city}, ${formData.state} ${formData.postCode}`,
    //         startDate: formData.startDate,
    //         endDate: formData.endDate,
    //         createdBy: formData.name
    //     };

    //     try {
    //         const response = await fetch('/api/trips', {
    //             method: 'POST',
    //             headers: { 'Content-Type': 'application/json' },
    //             body: JSON.stringify(payload),
    //         });

    //         if (!response.ok) throw new Error('Failed to generate trip plan');
    //         const data = await response.json();
    //         alert('Trip saved successfully!');
    //         setTripPlan(data); // Display the trip details
    //     } catch (err) {
    //         alert('Error: ' + err.message); // Show error as an alert
    //     }
    // };


    const handleSubmit = async (e) => {
        e.preventDefault();
        setTripPlan(null);

        const payload = {
            destination: `${formData.area}, ${formData.city}, ${formData.state}`,
            startDate: formData.startDate,
            endDate: formData.endDate,
            createdBy: formData.name
        };

        try {
            const response = await fetch('/api/trips', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate trip plan');
            }

            const responseData = await response.json();
            console.log('Response Data:', responseData);

            // Check if the response contains the inserted document or just the operation result
            if (responseData.acknowledged && responseData.insertedId) {
                // If it's just the MongoDB operation result, fetch the complete document
                const tripId = responseData.insertedId;
                const tripResponse = await fetch(`/api/trips/${tripId}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });

                if (!tripResponse.ok) throw new Error('Failed to fetch created trip');
                const tripData = await tripResponse.json();
                alert('Trip saved successfully!');
                setTripPlan(tripData);
            } else {
                // If the complete document is already included in the response
                alert('Trip saved successfully!');
                setTripPlan(responseData);
            }
        } catch (err) {
            console.error('Error:', err.message);
            alert('Error: ' + err.message);
        }
    };

    const handleFetchTrip = async () => {
        setFetchedTrip(null);

        if (fetchTripId) {
            // Fetch by tripId
            try {
                const response = await fetch(`/api/trips/${fetchTripId}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                if (!response.ok) throw new Error('Trip not found');
                const data = await response.json();
                setFetchedTrip(data);
                alert('Trip details fetched successfully!');
            } catch (err) {
                alert('Error: ' + err.message);
            }
        } else if (fetchDestination) {
            // Fetch by destination
            try {
                const response = await fetch(`/api/trips?destination=${encodeURIComponent(fetchDestination)}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                if (!response.ok) throw new Error('Failed to fetch trips');
                const trips = await response.json();
                if (trips.length > 0) {
                    setFetchedTrip(trips[0]); // Display the first matching trip
                    alert('Trip details fetched successfully!');
                } else {
                    alert('No trip found for this destination');
                }
            } catch (err) {
                alert('Error: ' + err.message);
            }
        } else {
            alert('Please enter a Trip ID or Destination');
        }
    };

    return (
            <div className="flex items-center justify-center p-6">
                <div className="mx-auto w-full max-w-[530px] bg-white">
                    <h1 className="text-3xl font-extrabold mb-5">Itinerary App</h1>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-5">
                            <label htmlFor="name" className="mb-3 block text-base font-medium text-[#07074D]">
                                Full Name
                            </label>
                            <input
                                type="text"
                                name="name"
                                id="name"
                                placeholder="Full Name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full rounded-md border border-[#e0e0e0] bg-white py-3 px-6 text-base font-medium text-[#6B7280] outline-none focus:border-[#6A64F1] focus:shadow-md"
                                required
                            />
                        </div>
                        <div className="mb-5">
                            <label htmlFor="phone" className="mb-3 block text-base font-medium text-[#07074D]">
                                Phone Number
                            </label>
                            <input
                                type="text"
                                name="phone"
                                id="phone"
                                placeholder="Enter your phone number"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full rounded-md border border-[#e0e0e0] bg-white py-3 px-6 text-base font-medium text-[#6B7280] outline-none focus:border-[#6A64F1] focus:shadow-md"
                            />
                        </div>
                        <div className="mb-5">
                            <label htmlFor="email" className="mb-3 block text-base font-medium text-[#07074D]">
                                Email Address
                            </label>
                            <input
                                type="email"
                                name="email"
                                id="email"
                                placeholder="Enter your email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full rounded-md border border-[#e0e0e0] bg-white py-3 px-6 text-base font-medium text-[#6B7280] outline-none focus:border-[#6A64F1] focus:shadow-md"
                                required
                            />
                        </div>
                        <div className="-mx-3 flex flex-wrap">
                            <div className="w-full px-3 sm:w-1/2">
                                <div className="mb-5">
                                    <label htmlFor="startDate" className="mb-3 block text-base font-medium text-[#07074D]">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        name="startDate"
                                        id="startDate"
                                        value={formData.startDate}
                                        onChange={handleChange}
                                        className="w-full rounded-md border border-[#e0e0e0] bg-white py-3 px-6 text-base font-medium text-[#6B7280] outline-none focus:border-[#6A64F1] focus:shadow-md"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="w-full px-3 sm:w-1/2">
                                <div className="mb-5">
                                    <label htmlFor="endDate" className="mb-3 block text-base font-medium text-[#07074D]">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        name="endDate"
                                        id="endDate"
                                        value={formData.endDate}
                                        onChange={handleChange}
                                        className="w-full rounded-md border border-[#e0e0e0] bg-white py-3 px-6 text-base font-medium text-[#6B7280] outline-none focus:border-[#6A64F1] focus:shadow-md"
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="mb-5 pt-3">
                            <label className="mb-5 block text-base font-semibold text-[#07074D] sm:text-xl">
                                Address Details
                            </label>
                            <div className="-mx-3 flex flex-wrap">
                                <div className="w-full px-3 sm:w-1/2">
                                    <div className="mb-5">
                                        <input
                                            type="text"
                                            name="area"
                                            id="area"
                                            placeholder="Enter area"
                                            value={formData.area}
                                            onChange={handleChange}
                                            className="w-full rounded-md border border-[#e0e0e0] bg-white py-3 px-6 text-base font-medium text-[#6B7280] outline-none focus:border-[#6A64F1] focus:shadow-md"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="w-full px-3 sm:w-1/2">
                                    <div className="mb-5">
                                        <input
                                            type="text"
                                            name="city"
                                            id="city"
                                            placeholder="Enter city"
                                            value={formData.city}
                                            onChange={handleChange}
                                            className="w-full rounded-md border border-[#e0e0e0] bg-white py-3 px-6 text-base font-medium text-[#6B7280] outline-none focus:border-[#6A64F1] focus:shadow-md"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="w-full px-3 sm:w-1/2">
                                    <div className="mb-5">
                                        <input
                                            type="text"
                                            name="state"
                                            id="state"
                                            placeholder="Enter state"
                                            value={formData.state}
                                            onChange={handleChange}
                                            className="w-full rounded-md border border-[#e0e0e0] bg-white py-3 px-6 text-base font-medium text-[#6B7280] outline-none focus:border-[#6A64F1] focus:shadow-md"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <button
                                type="submit"
                                className="hover:shadow-form w-full rounded-md bg-[#6A64F1] py-3 px-8 text-center text-base font-semibold text-white outline-none hover:bg-purple-600"
                            >
                                Make a Plan!
                            </button>
                        </div>
                    </form>

                    {/* Display the generated trip plan with improved destination description */}
                    {tripPlan && (
                        <div className="mt-8 p-4 border rounded-md bg-gray-50">
                            <h2 className="text-2xl font-bold">{tripPlan.title || 'Trip Details'}</h2>
                            <p><strong>ID:</strong> {tripPlan._id}</p>
                            <p><strong>Full Name:</strong> {tripPlan.createdBy || 'N/A'}</p>
                            <p><strong>Start Date:</strong> {tripPlan.startDate}</p>
                            <p><strong>End Date:</strong> {tripPlan.endDate}</p>

                            {/* Enhanced destination display with AI description */}
                            <div className="mt-3 pb-3 border-b">
                                <p className="text-lg font-semibold">Destination: {tripPlan.destination ||
                                    (tripPlan.days && tripPlan.days.length > 0 && tripPlan.days[0].location) ||
                                    (tripPlan.title && tripPlan.title.includes('in') ?
                                        tripPlan.title.split('in')[1].trim() : 'Not specified')}
                                </p>

                                {/* Extract destination description from notes or first day description */}
                                <div className="mt-2 text-gray-700">
                                    {tripPlan.notes ? (
                                        <p>{tripPlan.notes}</p>
                                    ) : tripPlan.days && tripPlan.days.length > 0 && tripPlan.days[0].activities &&
                                        tripPlan.days[0].activities.length > 0 ? (
                                        <p>{tripPlan.days[0].activities[0].description ||
                                            tripPlan.days[0].activities[0].notes ||
                                            "No destination description available"}</p>
                                    ) : (
                                        <p>No destination description available</p>
                                    )}
                                </div>
                            </div>

                            {/* Display the itinerary highlights */}
                            {tripPlan.days && tripPlan.days.length > 0 && (
                                <div className="mt-4">
                                    <h3 className="text-xl font-semibold">Itinerary Highlights:</h3>
                                    <ul className="list-disc pl-5 mt-2">
                                        {tripPlan.days.map((day, index) => (
                                            <li key={index} className="mb-2">
                                                <div>
                                                    <strong>Day {day.day}:</strong> {day.location}
                                                    {day.activities && day.activities.length > 0 && (
                                                        <ul className="list-circle pl-5 mt-1 text-sm text-gray-600">
                                                            {day.activities.slice(0, 2).map((activity, i) => (
                                                                <li key={i}>{activity.title} at {activity.location}</li>
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
                        </div>
                    )}

                    <Link href="/getTrips">
                        <button className='hover:shadow-form w-full rounded-md bg-red-400 py-3 px-8 text-center text-base font-semibold text-white outline-none hover:bg-amber-500 my-8'>Get Trip Details</button>
                    </Link>

                    
            </div>
        </div>
    );
}

export default App;