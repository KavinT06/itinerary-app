"use client";
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
        postCode: ''
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
            destination: `${formData.area}, ${formData.city}, ${formData.state} ${formData.postCode}`,
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
        <div>
            <div className="flex items-center justify-center p-12">
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
                                <div className="w-full px-3 sm:w-1/2">
                                    <div className="mb-5">
                                        <input
                                            type="text"
                                            name="postCode"
                                            id="post-code"
                                            placeholder="Post Code"
                                            value={formData.postCode}
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
                                className="hover:shadow-form w-full rounded-md bg-[#6A64F1] py-3 px-8 text-center text-base font-semibold text-white outline-none"
                            >
                                Make a Plan!
                            </button>
                        </div>
                    </form>

                    {/* Display the generated trip plan */}
                    {tripPlan && (
                        <div className="mt-8 p-4 border rounded-md bg-gray-50">
                            <h2 className="text-2xl font-bold">{tripPlan.title || 'Trip Details'}</h2>
                            <p><strong>ID:</strong> {tripPlan._id}</p>
                            <p><strong>Full Name:</strong> {tripPlan.createdBy || 'N/A'}</p>
                            <p><strong>Start Date:</strong> {tripPlan.startDate}</p>
                            <p><strong>End Date:</strong> {tripPlan.endDate}</p>
                            <p><strong>Destination:</strong> {tripPlan.destination}</p>
                        </div>
                    )}

                    {/* Fetch Trip Section */}
                    <div className="mt-8">
                        <h2 className="text-xl font-bold mb-4">Fetch Trip Details</h2>
                        <div className="mb-4">
                            <label htmlFor="fetchTripId" className="mb-2 block text-base font-medium text-[#07074D]">
                                Trip ID
                            </label>
                            <input
                                type="text"
                                id="fetchTripId"
                                placeholder="Enter Trip ID (e.g., trip01)"
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
                            className="hover:shadow-form w-full rounded-md bg-[#6A64F1] py-3 px-8 text-center text-base font-semibold text-white outline-none"
                        >
                            Fetch Trip Details
                        </button>
                    </div>

                    {/* Display the fetched trip */}
                    {fetchedTrip && (
                        <div className="mt-8 p-4 border rounded-md bg-gray-50">
                            <h2 className="text-2xl font-bold">{fetchedTrip.title}</h2>
                            <p><strong>ID:</strong> {fetchedTrip._id}</p>
                            <p><strong>Full Name:</strong> {fetchedTrip.createdBy}</p>
                            <p><strong>Start Date:</strong> {fetchedTrip.startDate}</p>
                            <p><strong>End Date:</strong> {fetchedTrip.endDate}</p>
                            <p><strong>Destination:</strong> {fetchedTrip.destination}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;