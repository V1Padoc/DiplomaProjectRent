// frontend/src/pages/BookingRequestsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

// Helper function to truncate text
const truncateText = (text, maxLength) => {
    if (!text) return '';
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
};

function BookingRequestsPage() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token, user, refreshBookingRequestsCountForOwner, fetchUnreadBookingRequestsCountForOwner } = useAuth();

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
            if (user?.role === 'owner') {
                refreshBookingRequestsCountForOwner();
            }
        } catch (err) {
            console.error("Error fetching booking requests:", err);
            setError(err.response?.data?.message || "Failed to load booking requests.");
        } finally {
            setLoading(false);
        }
    }, [token, user?.role, refreshBookingRequestsCountForOwner]);

    useEffect(() => {
        fetchBookingRequests();
    }, [fetchBookingRequests]);

    const handleUpdateStatus = async (bookingId, newStatus) => {
        const originalBookings = bookings.map(b => ({ ...b })); // Deep copy for proper rollback
        setBookings(prevBookings =>
            prevBookings.map(b =>
                b.id === bookingId ? { ...b, status: newStatus, processing: true } : b
            )
        );
        setError(null);

        try {
            await axios.put(
                `http://localhost:5000/api/bookings/${bookingId}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setBookings(prevBookings =>
                prevBookings.map(b =>
                    b.id === bookingId ? { ...b, processing: false } : b
                )
            );
            if (user?.role === 'owner') {
                fetchUnreadBookingRequestsCountForOwner(token);
            }
        } catch (err) {
            console.error(`Error updating booking ${bookingId} to ${newStatus}:`, err);
            // Display error message to user, perhaps using a toast notification system in a real app
            alert(err.response?.data?.message || `Failed to update status. ${err.message || ''}`);
            setBookings(originalBookings); // Rollback UI on error
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-slate-700" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Loading booking requests...</div>;
    }

    if (error) {
        return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-red-600 p-10 text-center" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Error: {error}</div>;
    }

    return (
        <div className="relative flex size-full min-h-screen flex-col bg-slate-50" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
            <div className="px-4 sm:px-10 md:px-20 lg:px-40 flex flex-1 justify-center py-5">
                <div className="layout-content-container flex flex-col max-w-5xl w-full flex-1">
                    <div className="p-6 md:p-8 bg-white shadow-xl rounded-lg">
                        <h1 className="text-[#0d151c] text-2xl sm:text-3xl font-bold leading-tight tracking-tight mb-8 text-center">
                            Booking Requests
                        </h1>

                        {bookings.length === 0 ? (
                            <p className="text-center text-slate-600 py-10">No booking requests found for your listings at the moment.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th scope="col" className="px-4 py-3 sm:px-6 sm:py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Listing</th>
                                            <th scope="col" className="px-4 py-3 sm:px-6 sm:py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Tenant</th>
                                            <th scope="col" className="px-4 py-3 sm:px-6 sm:py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Dates</th>
                                            <th scope="col" className="px-4 py-3 sm:px-6 sm:py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                                            <th scope="col" className="px-4 py-3 sm:px-6 sm:py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-200">
                                        {bookings.map((booking) => (
                                            <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-4 sm:px-6 whitespace-nowrap">
                                                    <Link to={`/listings/${booking.Listing?.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline block truncate max-w-[200px]" title={booking.Listing?.title}>
                                                        {booking.Listing?.title || 'N/A'}
                                                    </Link>
                                                    <div className="text-xs text-slate-500 truncate max-w-[200px]" title={booking.Listing?.location}>
                                                        {truncateText(booking.Listing?.location, 75)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 sm:px-6 whitespace-nowrap">
                                                    {booking.User ? (
                                                        <Link to={`/profiles/${booking.User.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline block truncate max-w-[150px]" title={booking.User.name}>
                                                            {booking.User.name || 'N/A'}
                                                        </Link>
                                                    ) : (
                                                        <div className="text-sm text-slate-800">N/A</div>
                                                    )}
                                                    <div className="text-xs text-slate-500 truncate max-w-[150px]" title={booking.User?.email}>{booking.User?.email}</div>
                                                </td>
                                                <td className="px-4 py-4 sm:px-6 whitespace-nowrap text-sm text-slate-700">
                                                    {new Date(booking.start_date).toLocaleDateString()} - <br className="sm:hidden"/>{new Date(booking.end_date).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-4 sm:px-6 whitespace-nowrap">
                                                    <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-md ${
                                                        booking.status === 'confirmed' ? 'bg-green-100 text-green-700 border border-green-200' :
                                                        booking.status === 'rejected' ? 'bg-red-100 text-red-700 border border-red-200' :
                                                        booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                                        'bg-slate-100 text-slate-700 border border-slate-200'
                                                    }`}>
                                                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 sm:px-6 whitespace-nowrap text-sm font-medium">
                                                    {booking.status === 'pending' && !booking.processing && (
                                                        <div className="flex items-center space-x-3">
                                                            <button
                                                                onClick={() => handleUpdateStatus(booking.id, 'confirmed')}
                                                                className="text-green-600 hover:text-green-700 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                                                                disabled={booking.processing}
                                                                title="Approve request"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handleUpdateStatus(booking.id, 'rejected')}
                                                                className="text-red-600 hover:text-red-700 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                                                                disabled={booking.processing}
                                                                title="Reject request"
                                                            >
                                                                Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                    {booking.processing && <span className="text-xs text-slate-500 italic">Processing...</span>}
                                                    {booking.status !== 'pending' && !booking.processing && <span className="text-xs text-slate-400">-</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <style jsx global>{`
                .tracking-tight { letter-spacing: -0.025em; }
            `}</style>
        </div>
    );
}

export default BookingRequestsPage;