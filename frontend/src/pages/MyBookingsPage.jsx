// frontend/src/pages/MyBookingsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

function MyBookingsPage() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token, user } = useAuth(); // Assuming user role 'tenant' is checked by ProtectedRoute

    const fetchMyBookings = useCallback(async () => {
        if (!token) {
            setLoading(false);
            setError("Authentication required.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get('http://localhost:5000/api/bookings/my-bookings', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setBookings(response.data);
        } catch (err) {
            console.error("Error fetching my bookings:", err);
            setError(err.response?.data?.message || "Failed to load your bookings.");
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchMyBookings();
    }, [fetchMyBookings]);

    if (loading) return <div className="container mx-auto px-4 py-8 text-center">Loading your bookings...</div>;
    if (error) return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error: {error}</div>;
    
    const activeBookings = bookings.filter(b => b.status === 'confirmed' && new Date(b.end_date) >= new Date());
    const pastBookings = bookings.filter(b => b.status !== 'confirmed' || new Date(b.end_date) < new Date());


    return (
        <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">My Bookings</h1>

            {/* Active/Upcoming Confirmed Bookings */}
            <h2 className="text-2xl font-semibold mb-4 text-gray-700">Active & Upcoming Bookings</h2>
            {activeBookings.length === 0 ? (
                <p className="text-center text-gray-600 mb-8 bg-white p-4 rounded-sm shadow-sm">You have no active or upcoming confirmed bookings.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    {activeBookings.map((booking) => (
                        <div key={booking.id} className="bg-white p-6 rounded-sm shadow-md">
                            <h3 className="text-xl font-semibold text-blue-600 mb-2">
                                <Link to={`/listings/${booking.Listing?.id}`} className="hover:underline">
                                    {booking.Listing?.title || 'N/A'}
                                </Link>
                            </h3>
                            <p className="text-sm text-gray-600 mb-1">Location: {booking.Listing?.location}</p>
                            <p className="text-sm text-gray-600 mb-1">Owner: {booking.Listing?.Owner?.name || 'N/A'}</p>
                            <p className="text-sm text-gray-700 font-medium">
                                Dates: {new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}
                            </p>
                            <p className="text-sm mt-2">
                                Status: <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                            'bg-gray-100 text-gray-800' // Should always be confirmed here
                                        }`}>
                                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                </span>
                            </p>
                             {booking.status === 'confirmed' && (
                                <Link 
                                    to={`/listings/${booking.Listing?.id}/chat?with=${booking.Listing?.Owner?.id}`}
                                    className="mt-3 inline-block text-sm text-blue-500 hover:text-blue-700 hover:underline"
                                >
                                    Contact Owner
                                </Link>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Past and Other Status Bookings */}
            <h2 className="text-2xl font-semibold mb-4 text-gray-700">Booking History</h2>
            {pastBookings.length === 0 && activeBookings.length === 0 && bookings.length > 0 && ( 
                 <p className="text-center text-gray-600 bg-white p-4 rounded-sm shadow-sm">No other booking history.</p>
            )}
             {pastBookings.length === 0 && bookings.length === 0 && ( // If no bookings at all
                <p className="text-center text-gray-600 bg-white p-4 rounded-sm shadow-sm">You haven't made any bookings yet.</p>
            )}
            {pastBookings.length > 0 && (
                 <div className="overflow-x-auto bg-white shadow-md rounded-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Listing</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {pastBookings.map((booking) => (
                                <tr key={booking.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Link to={`/listings/${booking.Listing?.id}`} className="text-sm text-blue-600 hover:underline">
                                            {booking.Listing?.title || 'N/A'}
                                        </Link>
                                        <div className="text-xs text-gray-500">{booking.Listing?.location}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                        {new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                            booking.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default MyBookingsPage;