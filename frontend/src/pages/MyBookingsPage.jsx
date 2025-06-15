// frontend/src/pages/MyBookingsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api from '../api/api.js';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Base calendar styles
import Slider from 'react-slick'; // For card image slider
// import "slick-carousel/slick/slick.css"; // Ensure these are imported globally or here
// import "slick-carousel/slick/slick-theme.css";
import {
    ChevronLeftIcon as ChevronLeft, ChevronRightIcon as ChevronRight,
    CalendarDaysIcon, MapPinIcon,
    UserCircleIcon, ChatBubbleLeftEllipsisIcon, ClockIcon, CheckCircleIcon, ArchiveBoxIcon,
    TrashIcon
} from '@heroicons/react/24/outline';
const SERVER_URL = process.env.REACT_APP_SERVER_BASE_URL || 'http://localhost:5000';
// Custom arrow components for react-slick in cards
function SlickCardArrowLeft({ currentSlide, slideCount, ...props }) {
    return (
        <button
            {...props}
            className="absolute top-1/2 left-2 z-10 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors focus:outline-none"
            aria-hidden="true"
            type="button"
        >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
    );
}

function SlickCardArrowRight({ currentSlide, slideCount, ...props }) {
    return (
        <button
            {...props}
            className="absolute top-1/2 right-2 z-10 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors focus:outline-none"
            aria-hidden="true"
            type="button"
        >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
    );
}

const getListingImageUrl = (photoFilename) => {
    if (photoFilename) {
        return `${SERVER_URL}/uploads/${photoFilename}`;
    }
    return 'https://via.placeholder.com/400x300.png?text=Зображення+відсутнє';
};
const fallbackImage = 'https://via.placeholder.com/400x300.png?text=Немає+зображень+для+оголошення';

const formatDateRange = (startDateStr, endDateStr) => {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const startDate = new Date(startDateStr).toLocaleDateString('uk-UA', options); // Changed to Ukrainian locale
    const endDate = new Date(endDateStr).toLocaleDateString('uk-UA', options);     // Changed to Ukrainian locale
    if (startDate === endDate) return startDate;
    return `${startDate} - ${endDate}`;
};

// Map English statuses to Ukrainian for display
const statusDisplayMap = {
    'confirmed': 'Підтверджено',
    'pending': 'На розгляді',
    'rejected': 'Відхилено',
    'cancelled': 'Скасовано',
    // Add other statuses if needed, though only these are typically shown in this context.
};

function MyBookingsPage() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token, user, acknowledgeBookingUpdates } = useAuth();

    const [calendarDate, setCalendarDate] = useState(new Date());
    const [selectedBookingId, setSelectedBookingId] = useState(null);
    const [actionError, setActionError] = useState(null);

    const fetchMyBookings = useCallback(async () => {
        if (!token) {
            setLoading(false);
            setError("Потрібна автентифікація.");
            return;
        }
        setError(null);
        setActionError(null);
        try {
            const response = await api.get('/bookings/my-bookings', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const sortedBookings = response.data.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
            setBookings(sortedBookings);
        } catch (err) {
            console.error("Error fetching my bookings:", err);
            setError(err.response?.data?.message || "Не вдалося завантажити ваші бронювання.");
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        setLoading(true);
        fetchMyBookings();
        if (user?.role === 'tenant') {
            acknowledgeBookingUpdates();
        }
    }, [fetchMyBookings, user?.role, acknowledgeBookingUpdates]);

    const handleCalendarDateChange = (newDate) => {
        setCalendarDate(newDate);
        setSelectedBookingId(null);
    };

    const handleDateClick = (date) => {
        const clickedDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const bookingOnDate = bookings.find(b => {
            const startDate = new Date(new Date(b.start_date).getFullYear(), new Date(b.start_date).getMonth(), new Date(b.start_date).getDate());
            const endDate = new Date(new Date(b.end_date).getFullYear(), new Date(b.end_date).getMonth(), new Date(b.end_date).getDate());
            return clickedDateOnly >= startDate && clickedDateOnly <= endDate;
        });

        if (bookingOnDate) {
            setSelectedBookingId(bookingOnDate.id);
            const element = document.getElementById(`booking-card-${bookingOnDate.id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            setSelectedBookingId(null);
        }
    };

    const handleCancelBooking = async (bookingId) => {
        setActionError(null);
        const confirmCancel = window.confirm("Ви впевнені, що хочете скасувати це бронювання?");
        if (confirmCancel) {
            const doubleConfirmCancel = window.confirm("Цю дію неможливо скасувати. Будь ласка, підтвердіть скасування.");
            if (doubleConfirmCancel) {
                try {
                    setLoading(true);
                    await api.post(`/bookings/${bookingId}/cancel`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    await fetchMyBookings();
                } catch (err) {
                    console.error("Error cancelling booking:", err);
                    setActionError(err.response?.data?.message || "Не вдалося скасувати бронювання. Будь ласка, спробуйте ще раз.");
                } finally {
                    setLoading(false);
                }
            }
        }
    };
    
    const tileClassName = ({ date, view }) => {
        if (view === 'month') {
            const classes = [];
            const currentDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            bookings.forEach(booking => {
                const startDate = new Date(new Date(booking.start_date).getFullYear(), new Date(booking.start_date).getMonth(), new Date(booking.start_date).getDate());
                const endDate = new Date(new Date(booking.end_date).getFullYear(), new Date(booking.end_date).getMonth(), new Date(booking.end_date).getDate());
                const todayCal = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

                if (currentDateOnly >= startDate && currentDateOnly <= endDate) {
                    classes.push('booked-day');
                    if (booking.status === 'confirmed') {
                        if (endDate < todayCal) classes.push('past-confirmed-booking-day');
                        else classes.push('confirmed-booking-day');
                    } else if (booking.status === 'pending') {
                        if (endDate < todayCal) classes.push('past-pending-booking-day');
                        else classes.push('pending-booking-day');
                    } else if (booking.status === 'cancelled') {
                        classes.push('cancelled-booking-day');
                    } else { 
                        // Assuming 'rejected' status falls here, or any other status not explicitly handled
                        classes.push('other-booking-day'); // Using 'other-booking-day' for rejected bookings.
                    }

                    if (currentDateOnly.getTime() === startDate.getTime()) classes.push('booking-start-date');
                    if (currentDateOnly.getTime() === endDate.getTime()) classes.push('booking-end-date');
                    if (startDate.getTime() !== endDate.getTime() && currentDateOnly > startDate && currentDateOnly < endDate) classes.push('booking-mid-range');
                }
            });

            let finalClasses = '';
            // Prioritize status classes that are most relevant/visible
            if (classes.includes('confirmed-booking-day')) finalClasses = 'booked-day confirmed-booking-day';
            else if (classes.includes('pending-booking-day')) finalClasses = 'booked-day pending-booking-day';
            else if (classes.includes('cancelled-booking-day')) finalClasses = 'booked-day cancelled-booking-day';
            else if (classes.includes('past-confirmed-booking-day')) finalClasses = 'booked-day past-confirmed-booking-day';
            else if (classes.includes('other-booking-day')) finalClasses = 'booked-day other-booking-day'; // Catches 'rejected'
            else if (classes.includes('past-pending-booking-day')) finalClasses = 'booked-day past-pending-booking-day';

            if (finalClasses) {
                if (classes.includes('booking-start-date')) finalClasses += ' booking-start-date';
                if (classes.includes('booking-end-date')) finalClasses += ' booking-end-date';
                if (classes.includes('booking-mid-range')) finalClasses += ' booking-mid-range';
            }
            return finalClasses || null;
        }
        return null;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingAndActiveBookings = bookings.filter(b => b.status === 'confirmed' && new Date(b.end_date) >= today);
    const pendingBookings = bookings.filter(b => b.status === 'pending' && new Date(b.end_date) >= today);
    const historyBookings = bookings.filter(b =>
        new Date(b.end_date) < today ||
        ['rejected', 'cancelled'].includes(b.status) ||
        (b.status === 'pending' && new Date(b.end_date) < today)
    ).sort((a, b) => new Date(b.start_date) - new Date(b.start_date)); // Ensure consistent sorting for history, perhaps by start_date DESC

    if (loading && bookings.length === 0) {
        return <div className="flex justify-center items-center min-h-screen bg-slate-100 text-xl text-slate-700" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Завантаження ваших бронювань...</div>;
    }
    if (error) {
        return <div className="flex justify-center items-center min-h-screen bg-slate-100 text-xl text-red-600 p-10 text-center" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Помилка: {error}</div>;
    }

    const BookingCard = ({ booking, isSelected, onCancel }) => {
        const canCancel = (booking.status === 'pending' || booking.status === 'confirmed') && new Date(booking.start_date) >= today;

        const sliderSettings = {
            dots: (booking.Listing?.photos?.length || 0) > 1, 
            infinite: (booking.Listing?.photos?.length || 0) > 1,
            speed: 500,
            slidesToShow: 1,
            slidesToScroll: 1,
            arrows: (booking.Listing?.photos?.length || 0) > 1,
            prevArrow: <SlickCardArrowLeft />,
            nextArrow: <SlickCardArrowRight />,
            className: "booking-card-slider"
        };

        return (
            <div
                id={`booking-card-${booking.id}`}
                className={`bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 ease-in-out ${isSelected ? 'ring-2 ring-blue-500 scale-[1.02]' : 'hover:shadow-xl'}`}
            >
                <div className="relative">
                    {booking.Listing?.photos && booking.Listing.photos.length > 0 ? (
                        <Slider {...sliderSettings}>
                            {booking.Listing.photos.map((photoFile, index) => (
                                <div key={index}>
                                    <Link to={`/listings/${booking.Listing?.id}`} className="block">
                                        <img
                                            src={getListingImageUrl(photoFile)}
                                            alt={`${booking.Listing?.title || 'Оголошення'} - Фото ${index + 1}`}
                                            className="w-full h-56 sm:h-60 object-cover"
                                        />
                                    </Link>
                                </div>
                            ))}
                        </Slider>
                    ) : (
                        <Link to={`/listings/${booking.Listing?.id}`} className="block">
                            <img
                                src={fallbackImage}
                                alt={booking.Listing?.title || 'Зображення оголошення'}
                                className="w-full h-56 sm:h-60 object-cover bg-slate-200"
                            />
                        </Link>
                    )}
                </div>

                <div className="p-4 sm:p-5">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg sm:text-xl font-semibold text-slate-800 hover:text-blue-600 transition-colors">
                            <Link to={`/listings/${booking.Listing?.id}`}>{booking.Listing?.title || 'Н/Д'}</Link>
                        </h3>
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full whitespace-nowrap ${booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            booking.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                booking.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                    booking.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                                        'bg-slate-100 text-slate-800'
                            }`}>
                            {statusDisplayMap[booking.status] || booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </span>
                    </div>

                    <p className="text-sm text-slate-600 mb-1 flex items-center">
                        <MapPinIcon className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                        <span className="truncate">{booking.Listing?.location || 'Н/Д'}</span>
                    </p>
                    <p className="text-sm text-slate-600 mb-3 flex items-center">
                        <CalendarDaysIcon className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                        {formatDateRange(booking.start_date, booking.end_date)}
                    </p>

                    {booking.Listing?.Owner && (
                        <p className="text-sm text-slate-600 mb-3 flex items-center">
                            <UserCircleIcon className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                            Власник: <span className="truncate ml-1">{booking.Listing.Owner.name || booking.Listing.Owner.email || 'Н/Д'}</span>
                        </p>
                    )}

                    <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap gap-x-4 gap-y-2 justify-between items-center">
                        {(booking.status === 'confirmed' || booking.status === 'pending') && booking.Listing?.Owner && (
                            <Link
                                to={`/listings/${booking.Listing.id}/chat?with=${booking.Listing.Owner.id}`}
                                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
                            >
                                <ChatBubbleLeftEllipsisIcon className="w-4 h-4 mr-1.5" />
                                Зв'язатися з власником
                            </Link>
                        )}
                        {canCancel && (
                            <button
                                onClick={() => onCancel(booking.id)}
                                className="inline-flex items-center text-sm text-red-600 hover:text-red-700 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading}
                            >
                                <TrashIcon className="w-4 h-4 mr-1.5" />
                                Скасувати бронювання
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderBookingSection = (title, bookingsList, IconComponent, colorClass, borderColorClass) => (
        // Section itself does not have a background. Header is distinct. List wrapper gets the background.
        <section className={`mb-10 rounded-lg shadow-sm overflow-hidden ${borderColorClass ? `border-l-4 ${borderColorClass}` : ''}`}>
            {/* Header part - no background here, or a standard one like bg-white if desired */}
            <div className={`flex items-center px-4 py-3 sm:px-5 sm:py-4 bg-white`}>
                {IconComponent && <IconComponent className={`w-7 h-7 mr-3 ${colorClass.icon || 'text-slate-700'}`} />}
                <h2 className={`text-2xl font-bold ${colorClass.text || 'text-slate-700'}`}>{title}</h2>
            </div>

            {/* List wrapper - THIS GETS THE BACKGROUND COLOR */}
        <div className="max-w-2xl mx-auto w-full">
           <div className={`py-4 sm:py-5 ${colorClass.bgSection || 'bg-slate-50'}`}>
                {bookingsList.length === 0 ? (
                    <div className="bg-white/70 p-6 text-center text-slate-500 rounded-md max-w-md sm:max-w-lg mx-auto w-full"> {/* Card-like for empty state */}
                        Немає бронювань у цій категорії.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {bookingsList.map((booking) => (
                            <div key={booking.id} className="max-w-md sm:max-w-lg mx-auto w-full">
                                <BookingCard booking={booking} isSelected={booking.id === selectedBookingId} onCancel={handleCancelBooking} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
        </section>
    );

    return (
        <div className="min-h-screen bg-slate-100 py-8" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <header className="mb-6 text-center">
                    <h1 className="text-4xl font-bold text-slate-800 tracking-tight">Мої бронювання</h1>
                    <p className="mt-2 text-lg text-slate-600">Переглядайте та керуйте своїми бронюваннями оренди в календарі та в списку нижче.</p>
                </header>

                {actionError && (
                    <div className="mb-6 max-w-3xl mx-auto bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                        <p className="font-bold">Помилка</p>
                        <p>{actionError}</p>
                    </div>
                )}

                {bookings.length === 0 && !loading && (
                    <div className="bg-white p-10 rounded-lg shadow-xl text-center max-w-lg mx-auto">
                        <CalendarDaysIcon className="w-16 h-16 mx-auto text-slate-400 mb-4" />
                        <h2 className="text-2xl font-semibold text-slate-700 mb-2">Ще немає бронювань</h2>
                        <p className="text-slate-500 mb-6">Ви ще не зробили жодного бронювання. Почніть досліджувати, щоб знайти своє наступне житло!</p>
                        <Link to="/listings" className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                            Дослідити оголошення
                        </Link>
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
                                    next2Label={null} prev2Label={null}
                                    nextLabel={<ChevronRight className="w-6 h-6" />}
                                    prevLabel={<ChevronLeft className="w-6 h-6" />}
                                    className="react-calendar-custom-bookings"
                                />
                                <div className="mt-4 p-3 space-y-2 text-xs text-slate-600 border-t border-slate-200">
                                    <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-2 shrink-0"></span>Підтверджено</div>
                                    <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-amber-500 mr-2 shrink-0"></span>На розгляді</div>
                                    <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-slate-400 mr-2 shrink-0"></span>Минулі</div>
                                    <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-rose-500 mr-2 shrink-0"></span>Скасовано</div>
                                    <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-2 shrink-0"></span>Відхилено/Інші</div>
                                </div>
                            </div>
                        </aside>

                        <main className="max-w-2xl w-full mx-auto">
                            {loading && bookings.length > 0 && (
                                <div className="text-center py-4">
                                    <p className="text-slate-600">Оновлення бронювань...</p>
                                </div>
                            )}
                            {upcomingAndActiveBookings.length > 0 && renderBookingSection(
                                "Майбутні та активні", upcomingAndActiveBookings, CheckCircleIcon,
                                { text: 'text-green-700', icon: 'text-green-600', bgSection: 'bg-green-50' }, // bgSection applied to list wrapper
                                'border-green-500'
                            )}
                            {pendingBookings.length > 0 && renderBookingSection(
                                "Запити на розгляді", pendingBookings, ClockIcon,
                                { text: 'text-amber-700', icon: 'text-amber-600', bgSection: 'bg-amber-50' }, // bgSection applied to list wrapper
                                'border-amber-500'
                            )}
                            {historyBookings.length > 0 && renderBookingSection(
                                "Історія бронювань", historyBookings, ArchiveBoxIcon,
                                { text: 'text-slate-700', icon: 'text-slate-600', bgSection: 'bg-slate-200' }, // bgSection applied to list wrapper
                                'border-slate-500'
                            )}
                        </main>
                    </div>
                )}
            </div>

            <style jsx global>{`
                /* ... (Calendar styles - no changes from previous version) ... */
                 .react-calendar-custom-bookings {
                    width: 100%; border: none; font-family: inherit; background-color: white;
                }
                .react-calendar-custom-bookings .react-calendar__navigation button {
                    color: #0d151c; min-width: 44px; background: none; font-size: 1rem; font-weight: 500; margin-top: 8px; border-radius: 0.375rem;
                }
                .react-calendar-custom-bookings .react-calendar__navigation button:hover,
                .react-calendar-custom-bookings .react-calendar__navigation button:focus { background-color: #f1f5f9; }
                .react-calendar-custom-bookings .react-calendar__navigation button[disabled] { background-color: #f8fafc; color: #94a3b8; }
                .react-calendar-custom-bookings .react-calendar__month-view__weekdays__weekday {
                    text-align: center; text-transform: uppercase; font-weight: 600; font-size: 0.7em; color: #64748b; padding-bottom: 0.5em;
                }
                .react-calendar-custom-bookings .react-calendar__month-view__days__day {
                    color: #0d151c; background: none; border: 0; padding: 0; margin: 1px 0; display: flex; align-items: center; justify-content: center; height: 38px;
                }
                .react-calendar-custom-bookings .react-calendar__month-view__days__day abbr {
                    display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
                }
                .react-calendar-custom-bookings .react-calendar__month-view__days__day--neighboringMonth abbr { color: #cbd5e1; }
                .react-calendar-custom-bookings .react-calendar__tile:disabled abbr {
                    background-color: #f1f5f9 !important; color: #cbd5e1 !important; cursor: not-allowed;
                }
                .react-calendar-custom-bookings .react-calendar__tile:enabled:not(.booked-day):hover abbr,
                .react-calendar-custom-bookings .react-calendar__tile:enabled:not(.booked-day):focus abbr { background-color: #e2e8f0; }
                .react-calendar-custom-bookings .react-calendar__tile--now abbr { background: #e0f2fe; font-weight: bold; color: #0ea5e9; }
                
                .react-calendar-custom-bookings .confirmed-booking-day abbr { background-color: #3b82f6; color: white; } 
                .react-calendar-custom-bookings .pending-booking-day abbr { background-color: #f59e0b; color: white; } 
                .react-calendar-custom-bookings .cancelled-booking-day abbr { background-color: #f43f5e; color: white; } /* rose-500 */
                .react-calendar-custom-bookings .past-confirmed-booking-day abbr { background-color: #9ca3af; color: white; } 
                .react-calendar-custom-bookings .past-pending-booking-day abbr { background-color: #d1d5db; color: #4b5563; }
                .react-calendar-custom-bookings .other-booking-day abbr { background-color: #ef4444; color: white; } /* red-500 (for rejected) */
                
                .react-calendar-custom-bookings .booked-day.booking-start-date:not(.booking-end-date) { background: linear-gradient(to right, transparent 50%, var(--range-bg, #eff6ff) 50%); }
                .react-calendar-custom-bookings .booked-day.booking-end-date:not(.booking-start-date) { background: linear-gradient(to left, transparent 50%, var(--range-bg, #eff6ff) 50%); }
                .react-calendar-custom-bookings .booked-day.booking-mid-range { background-color: var(--range-bg, #eff6ff); }
                
                .react-calendar-custom-bookings .confirmed-booking-day { --range-bg: #dbeafe; } 
                .react-calendar-custom-bookings .pending-booking-day { --range-bg: #fef3c7; } 
                .react-calendar-custom-bookings .cancelled-booking-day { --range-bg: #ffe4e6; } /* rose-100 */
                .react-calendar-custom-bookings .past-confirmed-booking-day { --range-bg: #e5e7eb; } 
                .react-calendar-custom-bookings .past-pending-booking-day { --range-bg: #f3f4f6; } 
                .react-calendar-custom-bookings .other-booking-day { --range-bg: #fee2e2; } 

                /* Slick slider styles for booking card */
                .booking-card-slider .slick-dots {
                    bottom: 8px;
                }
                .booking-card-slider .slick-dots li button:before {
                    font-size: 8px; 
                    color: white;
                    opacity: 0.6; /* More visible inactive dots */
                    transition: opacity 0.2s ease-in-out;
                }
                .booking-card-slider .slick-dots li.slick-active button:before {
                    opacity: 1;
                    color: white; /* Ensure active dot is bright white */
                }
                 .booking-card-slider .slick-arrow.slick-prev,
                 .booking-card-slider .slick-arrow.slick-next {
                    width: 28px; /* Slightly smaller arrows for card context */
                    height: 28px;
                 }
                 .booking-card-slider .slick-arrow.slick-prev {
                    left: 8px; /* Adjust position */
                 }
                 .booking-card-slider .slick-arrow.slick-next {
                    right: 8px; /* Adjust position */
                 }

            `}</style>
        </div>
    );
}

export default MyBookingsPage;