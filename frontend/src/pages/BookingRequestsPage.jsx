// frontend/src/pages/BookingRequestsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';

import api from '../api/api.js';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Base calendar styles
import {
    ChevronLeftIcon as ChevronLeft, ChevronRightIcon as ChevronRight,
    CalendarDaysIcon, UserCircleIcon, ChatBubbleLeftEllipsisIcon, CheckIcon, XMarkIcon,
    HomeModernIcon, InformationCircleIcon, EyeIcon, EyeSlashIcon // For filter toggles
} from '@heroicons/react/24/outline';


// Helper function to format date ranges nicely
const formatDateRange = (startDateStr, endDateStr) => {
    const options = { month: 'short', day: 'numeric' };
    const startDate = new Date(startDateStr).toLocaleDateString('uk-UA', options); // Changed to Ukrainian locale
    const endDate = new Date(endDateStr).toLocaleDateString('uk-UA', options);     // Changed to Ukrainian locale
    if (startDate === endDate) return startDate;
    return `${startDate} - ${endDate}`;
};

// Define statuses for filtering
const STATUS_TYPES = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled',
    PAST: 'past', // A general category for past confirmed/pending if not explicitly shown
};

// Map English statuses to Ukrainian for display
const statusDisplayMap = {
    'pending': 'На розгляді',
    'confirmed': 'Підтверджено',
    'rejected': 'Відхилено',
    'cancelled': 'Скасовано',
    'past': 'Минулі',
};

function BookingRequestsPage() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token, user, refreshBookingRequestsCountForOwner, fetchUnreadBookingRequestsCountForOwner } = useAuth();

    const [calendarDate, setCalendarDate] = useState(new Date());
    const [selectedBookingId, setSelectedBookingId] = useState(null);
    const [actionError, setActionError] = useState(null);

    // State for calendar filters: initially all true (visible)
    const [calendarFilters, setCalendarFilters] = useState({
        [STATUS_TYPES.PENDING]: true,
        [STATUS_TYPES.CONFIRMED]: true,
        [STATUS_TYPES.REJECTED]: true,
        [STATUS_TYPES.CANCELLED]: true,
        [STATUS_TYPES.PAST]: true, // For past confirmed/pending
    });

    const toggleCalendarFilter = (statusType) => {
        setCalendarFilters(prevFilters => ({
            ...prevFilters,
            [statusType]: !prevFilters[statusType],
        }));
    };

    const fetchBookingRequests = useCallback(async () => {
        if (!token || user?.role !== 'owner') {
            setLoading(false);
            setError(user?.role !== 'owner' ? "Доступ заборонено. Лише власники можуть переглядати запити на бронювання." : "Потрібна автентифікація.");
            return;
        }
        setError(null);
        setActionError(null);
        try {
            const response = await api.get('/bookings/owner', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const sortedBookings = response.data.sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                return new Date(a.start_date) - new Date(b.start_date);
            });
            setBookings(sortedBookings);
            refreshBookingRequestsCountForOwner(); 
        } catch (err) {
            console.error("Error fetching booking requests:", err);
            setError(err.response?.data?.message || "Не вдалося завантажити запити на бронювання.");
        } finally {
            setLoading(false);
        }
    }, [token, user?.role, refreshBookingRequestsCountForOwner]);

    useEffect(() => {
        setLoading(true);
        fetchBookingRequests();
    }, [fetchBookingRequests]);

    const handleUpdateStatus = async (bookingId, newStatus) => {
        const bookingToUpdate = bookings.find(b => b.id === bookingId);
        if (!bookingToUpdate) return;

        const confirmAction = window.confirm(
            `Ви впевнені, що хочете ${newStatus === 'confirmed' ? 'СХВАЛИТИ' : 'ВІДХИЛИТИ'} запит на бронювання для "${bookingToUpdate.Listing.title}" на дати ${formatDateRange(bookingToUpdate.start_date, bookingToUpdate.end_date)}?`
        );

        if (!confirmAction) return;

        setActionError(null);
        const originalBookings = bookings.map(b => ({ ...b })); // Deep copy for rollback
        setBookings(prevBookings =>
            prevBookings.map(b =>
                b.id === bookingId ? { ...b, status: newStatus, processing: true } : b
            )
        );

        try {
            await api.put(
                `/bookings/${bookingId}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await fetchBookingRequests(); // Re-fetch to get accurate, sorted data
            fetchUnreadBookingRequestsCountForOwner(token); // Refresh unread count
        } catch (err) {
            console.error(`Error updating booking ${bookingId} to ${newStatus}:`, err);
            setActionError(err.response?.data?.message || `Не вдалося оновити статус. ${err.message || ''}`);
            setBookings(originalBookings); // Rollback on error
        }
    };

    const handleCalendarDateChange = (newDate) => {
        setCalendarDate(newDate);
        setSelectedBookingId(null); // Clear selection when month/year changes
    };

    const handleDateClick = (date) => {
         // Normalize dates to start of day for comparison
         const clickedDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const bookingsOnDate = bookings.filter(b => {
            const startDate = new Date(new Date(b.start_date).getFullYear(), new Date(b.start_date).getMonth(), new Date(b.start_date).getDate());
            const endDate = new Date(new Date(b.end_date).getFullYear(), new Date(b.end_date).getMonth(), new Date(b.end_date).getDate());
            return clickedDateOnly >= startDate && clickedDateOnly <= endDate;
        });

        if (bookingsOnDate.length > 0) {
            // Select the first booking found for that date and scroll to it
            setSelectedBookingId(bookingsOnDate[0].id);
            const element = document.getElementById(`booking-request-card-${bookingsOnDate[0].id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            setSelectedBookingId(null); // No bookings on this date
        }
    };

    /**
     * Determines the conceptual status type of a booking for calendar filtering/coloring.
     * Takes into account if a pending/confirmed booking is in the past.
     * @param {object} booking The booking object.
     * @param {Date} todayCal A Date object representing the start of the current day.
     * @returns {string} One of STATUS_TYPES values (PENDING, CONFIRMED, REJECTED, CANCELLED, PAST).
     */
    const getBookingStatusType = (booking, todayCal) => {
        // Normalize end date to start of day for accurate comparison
        const endDate = new Date(new Date(booking.end_date).getFullYear(), new Date(booking.end_date).getMonth(), new Date(booking.end_date).getDate());
        
        if (booking.status === STATUS_TYPES.PENDING) {
            return endDate < todayCal ? STATUS_TYPES.PAST : STATUS_TYPES.PENDING;
        }
        if (booking.status === STATUS_TYPES.CONFIRMED) {
            return endDate < todayCal ? STATUS_TYPES.PAST : STATUS_TYPES.CONFIRMED;
        }
        return booking.status; // rejected, cancelled remain as they are
    };

    // Callback for `react-calendar`'s `tileContent` prop to add custom content to date tiles
    const tileContent = useCallback(({ date, view }) => {
        if (view === 'month') {
            const currentDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const todayCal = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

            const bookingsOnThisDay = bookings.filter(booking => {
                const statusType = getBookingStatusType(booking, todayCal);
                // Only include bookings if their status type filter is active
                if (!calendarFilters[statusType]) return false;

                const startDate = new Date(new Date(booking.start_date).getFullYear(), new Date(booking.start_date).getMonth(), new Date(booking.start_date).getDate());
                const endDate = new Date(new Date(booking.end_date).getFullYear(), new Date(booking.end_date).getMonth(), new Date(booking.end_date).getDate());
                return currentDateOnly >= startDate && currentDateOnly <= endDate;
            });

            if (bookingsOnThisDay.length > 1) {
                // Display count for days with multiple filtered bookings
                return (
                    <span className="absolute top-0 right-0 text-[0.6rem] bg-red-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                        {bookingsOnThisDay.length}
                    </span>
                );
            }
        }
        return null;
    }, [bookings, calendarFilters]); // Re-run if bookings or filters change

    // Callback for `react-calendar`'s `tileClassName` prop to add custom CSS classes
    const tileClassName = useCallback(({ date, view }) => {
        if (view === 'month') {
            const classes = [];
            const currentDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const todayCal = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
            
            bookings.forEach(booking => {
                const statusType = getBookingStatusType(booking, todayCal);

                // Apply class only if the filter for this status type is active
                if (!calendarFilters[statusType]) {
                    return; // Skip this booking if its status type is filtered out
                }

                const startDate = new Date(new Date(booking.start_date).getFullYear(), new Date(booking.start_date).getMonth(), new Date(booking.start_date).getDate());
                const endDate = new Date(new Date(booking.end_date).getFullYear(), new Date(booking.end_date).getMonth(), new Date(booking.end_date).getDate());

                if (currentDateOnly >= startDate && currentDateOnly <= endDate) {
                    classes.push('booked-day');
                    if (booking.status === STATUS_TYPES.CONFIRMED) {
                        if (endDate < todayCal) classes.push('past-confirmed-booking-day');
                        else classes.push('confirmed-booking-day');
                    } else if (booking.status === STATUS_TYPES.PENDING) {
                        if (endDate < todayCal) classes.push('past-pending-booking-day');
                        else classes.push('pending-booking-day');
                    } else if (booking.status === STATUS_TYPES.CANCELLED) {
                        classes.push('cancelled-booking-day');
                    } else if (booking.status === STATUS_TYPES.REJECTED) {
                        classes.push('rejected-booking-day');
                    }
                    // Add date range specific classes
                    if (currentDateOnly.getTime() === startDate.getTime()) classes.push('booking-start-date');
                    if (currentDateOnly.getTime() === endDate.getTime()) classes.push('booking-end-date');
                    if (startDate.getTime() !== endDate.getTime() && currentDateOnly > startDate && currentDateOnly < endDate) classes.push('booking-mid-range');
                }
            });
            
            // Prioritize status classes to ensure only one color is applied per day,
            // with pending/confirmed taking precedence over past if both are filtered ON.
            // Simplified logic: just join unique classes. CSS rules will handle priority.
            // However, to ensure *only* visible statuses contribute to the class:
            let finalClasses = '';
            // Order of precedence for calendar highlighting: Pending > Confirmed > Rejected > Cancelled > Past (Confirmed/Pending)
            if (classes.includes('pending-booking-day') && calendarFilters[STATUS_TYPES.PENDING]) finalClasses = 'booked-day pending-booking-day';
            else if (classes.includes('confirmed-booking-day') && calendarFilters[STATUS_TYPES.CONFIRMED]) finalClasses = 'booked-day confirmed-booking-day';
            else if (classes.includes('rejected-booking-day') && calendarFilters[STATUS_TYPES.REJECTED]) finalClasses = 'booked-day rejected-booking-day';
            else if (classes.includes('cancelled-booking-day') && calendarFilters[STATUS_TYPES.CANCELLED]) finalClasses = 'booked-day cancelled-booking-day';
            else if ((classes.includes('past-confirmed-booking-day') || classes.includes('past-pending-booking-day')) && calendarFilters[STATUS_TYPES.PAST]) {
                 // If both past-confirmed and past-pending are present, prefer past-confirmed or handle as needed
                 if(classes.includes('past-confirmed-booking-day')) finalClasses = 'booked-day past-confirmed-booking-day';
                 else finalClasses = 'booked-day past-pending-booking-day';
            }

            if (finalClasses) {
                // Append range classes if applicable
                if (classes.includes('booking-start-date')) finalClasses += ' booking-start-date';
                if (classes.includes('booking-end-date')) finalClasses += ' booking-end-date';
                if (classes.includes('booking-mid-range')) finalClasses += ' booking-mid-range';
            }
            
            return finalClasses || null;
        }
        return null;
    }, [bookings, calendarFilters]); // Re-run if bookings or filters change


    if (loading && bookings.length === 0) {
        return <div className="flex justify-center items-center min-h-screen bg-slate-100 text-xl text-slate-700" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Завантаження запитів на бронювання...</div>;
    }
    if (error && !loading ) {
        return <div className="flex justify-center items-center min-h-screen bg-slate-100 text-xl text-red-600 p-10 text-center" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Помилка: {error}</div>;
    }

    const pendingRequests = bookings.filter(b => b.status === 'pending');
    const otherBookings = bookings.filter(b => b.status !== 'pending');


    const RequestCard = ({ booking, isSelected, onApprove, onReject }) => (
        <div
            id={`booking-request-card-${booking.id}`}
            className={`bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 ${isSelected ? 'ring-2 ring-blue-500' : 'hover:shadow-lg'}`}
        >
            <div className="p-4 sm:p-5">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                        <Link to={`/listings/${booking.Listing?.id}`} className="text-md sm:text-lg font-semibold text-slate-700 hover:text-blue-600 truncate block" title={booking.Listing?.title}>
                           <HomeModernIcon className="w-5 h-5 inline-block mr-1.5 text-slate-400"/> {booking.Listing?.title || 'Н/Д'}
                        </Link>
                         <p className="text-xs text-slate-500 truncate mt-0.5" title={booking.Listing?.location}>
                            {booking.Listing?.location || 'Без місцезнаходження'}
                        </p>
                    </div>
                    <span className={`ml-2 px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md whitespace-nowrap ${
                        booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        booking.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        booking.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        booking.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                        'bg-slate-100 text-slate-700'
                    }`}>
                        {statusDisplayMap[booking.status] || booking.status}
                    </span>
                </div>

                <div className="space-y-1.5 text-sm mb-3">
                    <p className="text-slate-600 flex items-center">
                        <UserCircleIcon className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                        Орендар: 
                        {booking.User ? (
                            <Link to={`/profiles/${booking.User.id}`} className="ml-1 font-medium text-blue-600 hover:underline truncate" title={booking.User.name}>
                                {booking.User.name || 'Н/Д'}
                            </Link>
                        ) : <span className="ml-1 text-slate-500">Н/Д</span>}
                    </p>
                    <p className="text-slate-600 flex items-center">
                        <CalendarDaysIcon className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                        Дати: {formatDateRange(booking.start_date, booking.end_date)}
                    </p>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap gap-3 justify-end items-center">
                    {booking.User && (
                         <Link
                            to={`/listings/${booking.listing_id}/chat?with=${booking.User.id}`}
                            className="inline-flex items-center text-xs sm:text-sm text-slate-600 hover:text-blue-600 font-medium transition-colors"
                        >
                            <ChatBubbleLeftEllipsisIcon className="w-4 h-4 mr-1.5" />
                            Зв'язатися з орендарем
                        </Link>
                    )}
                    {booking.status === 'pending' && !booking.processing && (
                        <>
                            <button
                                onClick={() => onReject(booking.id)}
                                className="px-3 py-1.5 inline-flex items-center text-xs sm:text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors disabled:opacity-50"
                                disabled={booking.processing}
                            >
                                <XMarkIcon className="w-4 h-4 mr-1" /> Відхилити
                            </button>
                            <button
                                onClick={() => onApprove(booking.id)}
                                className="px-3 py-1.5 inline-flex items-center text-xs sm:text-sm font-semibold text-green-600 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md transition-colors disabled:opacity-50"
                                disabled={booking.processing}
                            >
                                <CheckIcon className="w-4 h-4 mr-1" /> Схвалити
                            </button>
                        </>
                    )}
                     {booking.processing && <span className="text-xs text-slate-500 italic">Обробка...</span>}
                </div>
            </div>
        </div>
    );

    // Legend items configuration
    const legendItems = [
        { label: statusDisplayMap[STATUS_TYPES.PENDING], status: STATUS_TYPES.PENDING, colorClass: 'bg-amber-500' },
        { label: statusDisplayMap[STATUS_TYPES.CONFIRMED], status: STATUS_TYPES.CONFIRMED, colorClass: 'bg-blue-500' },
        { label: statusDisplayMap[STATUS_TYPES.REJECTED], status: STATUS_TYPES.REJECTED, colorClass: 'bg-red-500' },
        { label: statusDisplayMap[STATUS_TYPES.CANCELLED], status: STATUS_TYPES.CANCELLED, colorClass: 'bg-rose-500' },
        { label: statusDisplayMap[STATUS_TYPES.PAST], status: STATUS_TYPES.PAST, colorClass: 'bg-slate-400' },
    ];


    return (
        <div className="min-h-screen bg-slate-100 py-8" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <header className="mb-10 text-center">
                    <h1 className="text-4xl font-bold text-slate-800 tracking-tight">Запити на бронювання</h1>
                    <p className="mt-2 text-lg text-slate-600">Керуйте вхідними запитами на бронювання для ваших оголошень.</p>
                </header>

                {actionError && (
                     <div className="mb-6 max-w-3xl mx-auto bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                        <p className="font-bold">Помилка обробки запиту</p>
                        <p>{actionError}</p>
                    </div>
                )}
                
                {bookings.length === 0 && !loading && (
                     <div className="bg-white p-10 rounded-lg shadow-xl text-center max-w-lg mx-auto">
                        <InformationCircleIcon className="w-16 h-16 mx-auto text-slate-400 mb-4" />
                        <h2 className="text-2xl font-semibold text-slate-700 mb-2">Немає запитів на бронювання</h2>
                        <p className="text-slate-500">Наразі немає запитів на бронювання для ваших оголошень.</p>
                    </div>
                )}

                {bookings.length > 0 && (
                     <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
                        <aside className="lg:w-2/5 xl:w-1/3 lg:sticky lg:top-8 self-start">
                            <div className="bg-white p-1 sm:p-3 rounded-xl shadow-xl">
                                <Calendar
                                    onChange={handleCalendarDateChange}
                                    value={calendarDate}
                                    onClickDay={handleDateClick}
                                    tileClassName={tileClassName}
                                    tileContent={tileContent}
                                    next2Label={null} prev2Label={null}
                                    nextLabel={<ChevronRight className="w-6 h-6" />}
                                    prevLabel={<ChevronLeft className="w-6 h-6" />}
                                    className="react-calendar-custom-bookings"
                                />
                                 <div className="mt-4 p-3 space-y-1.5 border-t border-slate-200">
                                    <p className="text-xs font-semibold text-slate-500 mb-1.5">Перемкнути вигляд календаря:</p>
                                    {legendItems.map(item => (
                                        <button
                                            key={item.status}
                                            onClick={() => toggleCalendarFilter(item.status)}
                                            className={`w-full text-left text-xs px-2 py-1.5 rounded-md flex items-center transition-colors duration-150 ${calendarFilters[item.status] ? 'bg-slate-100 hover:bg-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}
                                        >
                                            <span className={`w-3 h-3 rounded-full ${item.colorClass} mr-2 shrink-0`}></span>
                                            {item.label}
                                            {calendarFilters[item.status] ? <EyeIcon className="w-3.5 h-3.5 ml-auto text-slate-500" /> : <EyeSlashIcon className="w-3.5 h-3.5 ml-auto text-slate-400" />}
                                        </button>
                                    ))}
                                    <div className="flex items-center text-xs text-slate-600 pt-1.5 mt-1.5 border-t border-slate-200/60">
                                        <span className="text-[0.6rem] bg-red-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold mr-2 shrink-0">N</span>Кілька бронювань на дату
                                    </div>
                                </div>
                            </div>
                        </aside>

                        <main className="lg:w-3/5 xl:w-2/3 space-y-8">
                            {loading && bookings.length > 0 && (
                                <div className="text-center py-4">
                                    <p className="text-slate-600">Оновлення запитів...</p>
                                </div>
                            )}
                            {pendingRequests.length > 0 && (
                                <section>
                                    <h2 className="text-xl sm:text-2xl font-semibold text-amber-700 mb-4">На розгляді ({pendingRequests.length})</h2>
                                    <div className="space-y-4">
                                        {pendingRequests.map(booking => (
                                            <RequestCard key={booking.id} booking={booking} isSelected={selectedBookingId === booking.id} onApprove={() => handleUpdateStatus(booking.id, 'confirmed')} onReject={() => handleUpdateStatus(booking.id, 'rejected')} />
                                        ))}
                                    </div>
                                </section>
                            )}
                            {otherBookings.length > 0 && (
                                 <section>
                                    <h2 className="text-xl sm:text-2xl font-semibold text-slate-600 mb-4">Інші бронювання ({otherBookings.length})</h2>
                                    <div className="space-y-4">
                                        {otherBookings.map(booking => (
                                            <RequestCard key={booking.id} booking={booking} isSelected={selectedBookingId === booking.id} onApprove={() => {}} onReject={() => {}} />
                                        ))}
                                    </div>
                                </section>
                            )}
                        </main>
                    </div>
                )}
            </div>
            <style jsx global>{`
                 .react-calendar-custom-bookings { width: 100%; border: none; font-family: inherit; background-color: white; }
                .react-calendar-custom-bookings .react-calendar__navigation button { color: #0d151c; min-width: 44px; background: none; font-size: 1rem; font-weight: 500; margin-top: 8px; border-radius: 0.375rem; }
                .react-calendar-custom-bookings .react-calendar__navigation button:hover,
                .react-calendar-custom-bookings .react-calendar__navigation button:focus { background-color: #f1f5f9; }
                .react-calendar-custom-bookings .react-calendar__navigation button[disabled] { background-color: #f8fafc; color: #94a3b8; }
                .react-calendar-custom-bookings .react-calendar__month-view__weekdays__weekday { text-align: center; text-transform: uppercase; font-weight: 600; font-size: 0.7em; color: #64748b; padding-bottom: 0.5em; }
                .react-calendar-custom-bookings .react-calendar__month-view__days__day { position:relative; color: #0d151c; background: none; border: 0; padding: 0; margin: 1px 0; display: flex; align-items: center; justify-content: center; height: 38px; }
                .react-calendar-custom-bookings .react-calendar__month-view__days__day abbr { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out; }
                .react-calendar-custom-bookings .react-calendar__month-view__days__day--neighboringMonth abbr { color: #cbd5e1; }
                .react-calendar-custom-bookings .react-calendar__tile:disabled abbr { background-color: #f1f5f9 !important; color: #cbd5e1 !important; cursor: not-allowed; }
                .react-calendar-custom-bookings .react-calendar__tile:enabled:not(.booked-day):hover abbr,
                .react-calendar-custom-bookings .react-calendar__tile:enabled:not(.booked-day):focus abbr { background-color: #e2e8f0; }
                .react-calendar-custom-bookings .react-calendar__tile--now abbr { background: #e0f2fe; font-weight: bold; color: #0ea5e9; }
                
                .react-calendar-custom-bookings .pending-booking-day abbr { background-color: #f59e0b; color: white; } 
                .react-calendar-custom-bookings .confirmed-booking-day abbr { background-color: #3b82f6; color: white; } 
                .react-calendar-custom-bookings .rejected-booking-day abbr { background-color: #ef4444; color: white; } 
                .react-calendar-custom-bookings .cancelled-booking-day abbr { background-color: #f43f5e; color: white; } 
                .react-calendar-custom-bookings .past-confirmed-booking-day abbr,
                .react-calendar-custom-bookings .past-pending-booking-day abbr { background-color: #9ca3af; color: white; } /* General past style */
                .react-calendar-custom-bookings .other-booking-day abbr { background-color: #6b7280; color: white; }

                .react-calendar-custom-bookings .booked-day.booking-start-date:not(.booking-end-date) { background: linear-gradient(to right, transparent 50%, var(--range-bg, #eff6ff) 50%); }
                .react-calendar-custom-bookings .booked-day.booking-end-date:not(.booking-start-date) { background: linear-gradient(to left, transparent 50%, var(--range-bg, #eff6ff) 50%); }
                .react-calendar-custom-bookings .booked-day.booking-mid-range { background-color: var(--range-bg, #eff6ff); }
                
                .react-calendar-custom-bookings .pending-booking-day { --range-bg: #fef3c7; } 
                .react-calendar-custom-bookings .confirmed-booking-day { --range-bg: #dbeafe; } 
                .react-calendar-custom-bookings .rejected-booking-day { --range-bg: #fee2e2; } 
                .react-calendar-custom-bookings .cancelled-booking-day { --range-bg: #ffe4e6; } 
                .react-calendar-custom-bookings .past-confirmed-booking-day,
                .react-calendar-custom-bookings .past-pending-booking-day { --range-bg: #e5e7eb; } 
                .react-calendar-custom-bookings .other-booking-day { --range-bg: #f3f4f6; } 
            `}</style>
        </div>
    );
}

export default BookingRequestsPage;