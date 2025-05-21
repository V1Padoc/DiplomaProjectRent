// frontend/src/pages/BookingRequestsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom'; // For linking to listing details

function BookingRequestsPage() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token, user } = useAuth(); // Assuming user role is 'owner' is checked by ProtectedRoute

    const fetchBookingRequests = useCallback(async () => {
        if (!token) {
            setLoading(false);
            setError("Authentication required.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get('http://localhost:5000/api/bookings/owner', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setBookings(response.data);
        } catch (err) {
            console.error("Error fetching booking requests:", err);
            setError(err.response?.data?.message || "Failed to load booking requests.");
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchBookingRequests();
    }, [fetchBookingRequests]);

    const handleUpdateStatus = async (bookingId, newStatus) => {
        const originalBookings = [...bookings]; // Store original state for potential rollback
        // Optimistically update UI
        setBookings(prevBookings =>
            prevBookings.map(b =>
                b.id === bookingId ? { ...b, status: newStatus, processing: true } : b
            )
        );
        setError(null); // Clear previous general errors

        try {
            await axios.put(
                `http://localhost:5000/api/bookings/${bookingId}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Success: UI is already updated, just remove processing flag
            setBookings(prevBookings =>
                prevBookings.map(b =>
                    b.id === bookingId ? { ...b, processing: false } : b
                )
            );
            // Optionally, re-fetch or just rely on optimistic update if backend is source of truth
            // fetchBookingRequests(); // Could re-fetch to ensure data consistency
        } catch (err) {
            console.error(`Error updating booking ${bookingId} to ${newStatus}:`, err);
            alert(err.response?.data?.message || `Failed to update booking status. ${err.message}`);
            setBookings(originalBookings); // Rollback UI on error
        }
    };


    if (loading) return <div className="container mx-auto px-4 py-8 text-center">Loading booking requests...</div>;
    if (error) return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error: {error}</div>;

    return (
        <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">Booking Requests</h1>

            {bookings.length === 0 ? (
                <p className="text-center text-gray-600">No booking requests found for your listings.</p>
            ) : (
                <div className="overflow-x-auto bg-white shadow-md rounded-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Listing</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {bookings.map((booking) => (
                                <tr key={booking.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Link to={`/listings/${booking.Listing?.id}`} className="text-sm text-blue-600 hover:underline">
                                            {booking.Listing?.title || 'N/A'}
                                        </Link>
                                        <div className="text-xs text-gray-500">{booking.Listing?.location}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{booking.User?.name || 'N/A'}</div>
                                        <div className="text-xs text-gray-500">{booking.User?.email}</div>
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
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        {booking.status === 'pending' && !booking.processing && (
                                            <>
                                                <button
                                                    onClick={() => handleUpdateStatus(booking.id, 'confirmed')}
                                                    className="text-green-600 hover:text-green-900 mr-3 transition duration-150 ease-in-out"
                                                    disabled={booking.processing}
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateStatus(booking.id, 'rejected')}
                                                    className="text-red-600 hover:text-red-900 transition duration-150 ease-in-out"
                                                    disabled={booking.processing}
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        )}
                                        {booking.processing && <span className="text-xs text-gray-500">Processing...</span>}
                                        {booking.status !== 'pending' && !booking.processing && <span className="text-xs text-gray-500">-</span>}
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

export default BookingRequestsPage;