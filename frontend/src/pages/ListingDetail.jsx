// frontend/src/pages/ListingDetail.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Base calendar styles
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { Captions, Download, Fullscreen, Thumbnails, Zoom } from "yet-another-react-lightbox/plugins";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import { HeartIcon as HeartOutline } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { StarIcon as StarSolidIcon } from '@heroicons/react/20/solid'; // For review stars
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline'; // For review stars
import { PhotoIcon } from '@heroicons/react/24/solid'; // For "Show all photos" button

// Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const formatPrice = (price, type) => {
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice)) return 'Ціна недоступна';
    if (type === 'monthly-rental') return `₴${numericPrice.toFixed(2)}/місяць`;
    if (type === 'daily-rental') return `₴${numericPrice.toFixed(2)}/день`;
    return `₴${numericPrice.toFixed(2)}`;
};

function ListingDetail() {
    const { id: listingId } = useParams();
    const navigate = useNavigate();

    const [listing, setListing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [reviews, setReviews] = useState([]);
    const [reviewLoading, setReviewLoading] = useState(true);
    const [reviewError, setReviewError] = useState(null);
    const [newReviewRating, setNewReviewRating] = useState(0);
    const [newReviewComment, setNewReviewComment] = useState('');

    const [photoIndex, setPhotoIndex] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [showAllPhotos, setShowAllPhotos] = useState(false); // State for toggling all photos view

    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewSubmitError, setReviewSubmitError] = useState(null);
    const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState(null);

    const [bookingDates, setBookingDates] = useState([null, null]);
    const [bookingSubmitting, setBookingSubmitting] = useState(false);
    const [bookingError, setBookingError] = useState(null);
    const [bookingSuccess, setBookingSuccess] = useState(null);

    const [isFavorited, setIsFavorited] = useState(false);

    const { isAuthenticated, user, token, favorites, toggleFavorite, isSocketEligible, fetchSocketEligibility } = useAuth();

    const [bookedRanges, setBookedRanges] = useState([]);
    const [loadingBookedDates, setLoadingBookedDates] = useState(true);

    useEffect(() => {
        const fetchListing = async () => {
            if (!listingId) return;
            try {
                setLoading(true);
                setError(null);
                const config = {};
                if (token) {
                    config.headers = { Authorization: `Bearer ${token}` };
                }
                const response = await axios.get(`http://localhost:5000/api/listings/${listingId}`, config);
                setListing(response.data);
            } catch (err) {
                console.error('Error fetching listing details:', err);
                setError(err.response?.data?.message || 'Не вдалося завантажити деталі оголошення.');
            } finally {
                setLoading(false);
            }
        };
        fetchListing();
    }, [listingId, token]);

    useEffect(() => {
        if (listingId && favorites) {
            setIsFavorited(favorites.includes(listingId));
        }
    }, [listingId, favorites]);

    useEffect(() => {
        const fetchReviews = async () => {
            if (!listingId) return;
            try {
                setReviewLoading(true);
                setReviewError(null);
                const response = await axios.get(`http://localhost:5000/api/listings/${listingId}/reviews`);
                setReviews(response.data);
            } catch (err) {
                console.error('Error fetching reviews:', err);
                setReviewError('Не вдалося завантажити відгуки.');
            } finally {
                setReviewLoading(false);
            }
        };
        fetchReviews();
    }, [listingId]);

    useEffect(() => {
        const fetchBookedDates = async () => {
            if (!listingId) return;
            setLoadingBookedDates(true);
            try {
                const response = await axios.get(`http://localhost:5000/api/listings/${listingId}/booked-dates`);
                setBookedRanges(response.data.map(range => ({
                    start: new Date(range.start),
                    end: new Date(range.end)
                })));
            } catch (err) {
                console.error("Error fetching booked dates:", err);
            } finally {
                setLoadingBookedDates(false);
            }
        };
        fetchBookedDates();
    }, [listingId]);

    const tileDisabled = ({ date, view }) => {
        if (view === 'month') {
            const today = new Date(); today.setHours(0,0,0,0);
            if (date < today) return true;
            for (const range of bookedRanges) {
                const normDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const normStart = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
                const normEnd = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate());
                if (normDate >= normStart && normDate <= normEnd) return true;
            }
        }
        return false;
    };

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (newReviewRating < 1) {
            setReviewSubmitError('Будь ласка, оберіть рейтинг.'); return;
        }
        setReviewSubmitting(true); setReviewError(null); setReviewSubmitSuccess(null);
        try {
            const response = await axios.post(`http://localhost:5000/api/listings/${listingId}/reviews`,
                { rating: newReviewRating, comment: newReviewComment },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            setReviewSubmitSuccess(response.data.message || "Відгук надіслано!");
            setReviews([response.data.review, ...reviews]);
            setNewReviewRating(0); setNewReviewComment('');
            // Fetch updated listing to get new average_rating
            const listingResponse = await axios.get(`http://localhost:5000/api/listings/${listingId}`);
            setListing(listingResponse.data);
            setTimeout(() => setReviewSubmitSuccess(null), 3000);
        } catch (err) {
            setReviewSubmitError(err.response?.data?.message || 'Не вдалося надіслати відгук.');
            setTimeout(() => setReviewSubmitError(null), 3000);
        } finally {
            setReviewSubmitting(false);
        }
    };

    const handleDateChange = (dates) => {
        setBookingDates(dates); setBookingError(null); setBookingSuccess(null);
    };

    const handleBookingRequest = async () => {
        if (!bookingDates || !bookingDates[0] || !bookingDates[1]) {
            setBookingError("Будь ласка, оберіть дату початку та дату закінчення."); return;
        }
        setBookingSubmitting(true); setBookingError(null); setBookingSuccess(null);
        try {
            const response = await axios.post('http://localhost:5000/api/bookings', {
                listing_id: listingId,
                start_date: bookingDates[0].toISOString().split('T')[0],
                end_date: bookingDates[1].toISOString().split('T')[0],
            }, { headers: { Authorization: `Bearer ${token}` } });
            setBookingSuccess(response.data.message || "Запит на бронювання надіслано!");
            setBookingDates([null, null]);
            // Re-fetch booked dates
            const bookedResponse = await axios.get(`http://localhost:5000/api/listings/${listingId}/booked-dates`);
            setBookedRanges(bookedResponse.data.map(range => ({ start: new Date(range.start), end: new Date(range.end) })));
            if (token && isAuthenticated && !isSocketEligible) fetchSocketEligibility(token);
            setTimeout(() => setBookingSuccess(null), 3000);
        } catch (err) {
            setBookingError(err.response?.data?.message || "Не вдалося надіслати запит на бронювання.");
            setTimeout(() => setBookingError(null), 3000);
        } finally {
            setBookingSubmitting(false);
        }
    };

    const handleFavoriteToggle = async () => {
        if (!isAuthenticated || !listingId) return;
        try {
            const newStatus = await toggleFavorite(listingId);
            setIsFavorited(newStatus);
        } catch (error) {
            console.error("Не вдалося змінити статус обраного:", error);
        }
    };

    const handleContactOwner = () => {
        if (!isAuthenticated) navigate(`/login?redirect=/listings/${listingId}/chat`);
        else navigate(`/listings/${listingId}/chat`);
    };

    if (loading) return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-slate-700" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Завантаження...</div>;
    if (error) return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-red-600" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Помилка: {error}</div>;
    if (!listing) return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-slate-700" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Оголошення не знайдено.</div>;

    const slides = listing.photos?.map((photoFilename, index) => ({
        src: `http://localhost:5000/uploads/${photoFilename}`,
        title: `${listing.title} - Фото ${index + 1}`
    })) || [];

    const mapPosition = (listing.latitude && listing.longitude) ? [parseFloat(listing.latitude), parseFloat(listing.longitude)] : [51.505, -0.09];
    const isOwner = user && listing.owner_id === user.id;
    const canBook = listing.type === 'daily-rental';

    const featuredPhotosCount = 5; // Total featured photos (1 main + 4 small)
    const mainPhoto = slides.length > 0 ? slides[0] : null;
    const smallFeaturedPhotos = slides.length > 1 ? slides.slice(1, featuredPhotosCount) : [];
    const extraPhotos = slides.length > featuredPhotosCount ? slides.slice(featuredPhotosCount) : [];

    const getAvatarUrl = (profileImageUrl, nameOrEmail) => {
        if (profileImageUrl) {
            // Assuming profile_image_url contains a path like /uploads/profiles/filename.ext
            // We need to ensure it's pointing to the correct uploads directory for profiles
            const filename = profileImageUrl.split('/').pop();
            return `http://localhost:5000/uploads/profiles/${filename}`;
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(nameOrEmail || 'U')}&background=random&size=56&color=fff&font-size=0.5`;
    };

    return (
        <div className="bg-slate-50 min-h-screen py-5 md:py-10" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
            <div className="px-4 sm:px-6 md:px-8">
                <div className="layout-content-container flex flex-col max-w-5xl mx-auto bg-white shadow-xl rounded-lg overflow-hidden">
                    
                    <div className="p-4 sm:p-6 md:p-8">
                        <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                            <h1 className="text-[#0d141c] tracking-light text-3xl lg:text-4xl font-bold leading-tight">
                                {listing.title}
                            </h1>
                            {isAuthenticated && !isOwner && (
                                <button onClick={handleFavoriteToggle} className="p-2 rounded-full hover:bg-red-100 transition-colors" aria-label="Додати/видалити з обраних">
                                    {isFavorited ? <HeartSolid className="w-7 h-7 text-red-500" /> : <HeartOutline className="w-7 h-7 text-red-500" />}
                                </button>
                            )}
                        </div>
                        <div className="mb-6 text-sm text-slate-600">
                            {listing.location}
                            {listing.average_rating && parseFloat(listing.average_rating) > 0 && (
                                <>
                                    <span className="mx-2">·</span>
                                    <span className="flex items-center">
                                        <StarSolidIcon className="w-4 h-4 text-yellow-500 mr-1" />
                                        {parseFloat(listing.average_rating).toFixed(1)} ({listing.review_count} відгуків)
                                    </span>
                                </>
                            )}
                        </div>
                    
                        {/* Main Featured Photo Grid */}
                        <div className="w-full @container mb-2 relative"> {/* Added relative for button positioning */}
                            {slides.length > 0 ? (
                                <div className="w-full gap-1 @[480px]:gap-2 aspect-video rounded-lg grid grid-cols-[2fr_1fr_1fr] grid-rows-2 overflow-hidden">
                                    {mainPhoto && (
                                        <div
                                            className="w-full h-full bg-center bg-no-repeat bg-cover row-span-2 col-span-1 cursor-pointer"
                                            style={{ backgroundImage: `url(${mainPhoto.src})` }}
                                            onClick={() => { setPhotoIndex(0); setIsLightboxOpen(true); }}
                                        ></div>
                                    )}
                                    {smallFeaturedPhotos.map((photo, index) => (
                                        <div
                                            key={`featured-${index}`}
                                            className={`w-full h-full bg-center bg-no-repeat bg-cover cursor-pointer ${index < 2 ? 'col-start-' + (index + 2) + ' row-start-1' : 'col-start-' + (index - 2 + 2) + ' row-start-2'}`}
                                            style={{ backgroundImage: `url(${photo.src})` }}
                                            onClick={() => { setPhotoIndex(index + 1); setIsLightboxOpen(true); }}
                                        ></div>
                                    ))}
                                    {/* Fillers for featured grid if less than 5 photos */}
                                    {slides.length > 0 && slides.length < featuredPhotosCount && 
                                     Array.from({ length: Math.max(0, (featuredPhotosCount - 1) - smallFeaturedPhotos.length) }).map((_, i) => {
                                        const overallIndexInSmallGrid = smallFeaturedPhotos.length + i;
                                        let colStart, rowStart;
                                        if (overallIndexInSmallGrid < 2) { colStart = overallIndexInSmallGrid + 2; rowStart = 1; } 
                                        else { colStart = (overallIndexInSmallGrid - 2) + 2; rowStart = 2; }
                                        return <div key={`filler-featured-${i}`} className={`w-full h-full bg-slate-200 col-start-${colStart} row-start-${rowStart}`}></div>;
                                    })}
                                </div>
                            ) : (
                                <div className="w-full aspect-video bg-slate-200 flex items-center justify-center text-slate-500 rounded-lg">Фотографії відсутні</div>
                            )}
                             {/* "Show all photos" Button - positioned over the grid */}
                            {extraPhotos.length > 0 && ( // Only show if there are extra photos beyond the featured 5
                                <div className="absolute bottom-4 right-4">
                                    <button
                                        onClick={() => setShowAllPhotos(!showAllPhotos)}
                                        className="flex items-center gap-2 bg-black bg-opacity-70 hover:bg-opacity-80 text-white font-semibold py-2 px-4 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-75"
                                    >
                                        <PhotoIcon className="w-5 h-5"/>
                                        {showAllPhotos ? 'Приховати додаткові фото' : `Показати ще ${extraPhotos.length}`}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Expanded Photos Grid (conditionally rendered) */}
                        {showAllPhotos && extraPhotos.length > 0 && (
                            <div className="mt-4 mb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {extraPhotos.map((slide, index) => (
                                    <div 
                                        key={`extra-photo-${index}`} 
                                        className="aspect-square cursor-pointer overflow-hidden rounded-md hover:opacity-90 transition-opacity"
                                        onClick={() => { setPhotoIndex(featuredPhotosCount + index); setIsLightboxOpen(true); }} // Correct index for lightbox
                                    >
                                        <img
                                            src={slide.src}
                                            alt={slide.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <Lightbox
                            open={isLightboxOpen}
                            close={() => setIsLightboxOpen(false)}
                            slides={slides}
                            index={photoIndex}
                            plugins={[Captions, Download, Fullscreen, Thumbnails, Zoom]}
                        />

                        <h2 className="text-[#0d141c] text-xl sm:text-2xl font-bold leading-tight tracking-[-0.015em] mb-3 pt-2">Про це оголошення</h2>
                        <p className="text-slate-700 text-base leading-relaxed pb-3 pt-1 whitespace-pre-wrap">
                            {listing.description || 'Опис відсутній.'}
                        </p>

                        <h2 className="text-[#0d141c] text-xl sm:text-2xl font-bold leading-tight tracking-[-0.015em] mb-3 pt-5">Деталі оголошення</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                            {[
                                { label: "Ціна", value: formatPrice(listing.price, listing.type) },
                                { label: "Тип оренди", value: listing.type === 'monthly-rental' ? 'Щомісячна' : (listing.type === 'daily-rental' ? 'Щоденна' : listing.type) },
                                listing.rooms ? { label: "Кімнати", value: `${listing.rooms} спальня(і)` } : null,
                                listing.area ? { label: "Площа", value: `${listing.area} м²` } : null,
                                { label: "Адреса", value: listing.location },
                                { label: "Зручності", value: listing.amenities || 'Н/Д' },
                            ].filter(Boolean).map((item) => (
                                <div key={item.label} className="flex flex-col py-3 border-t border-solid border-slate-200">
                                    <p className="text-slate-500 text-sm font-normal leading-normal">{item.label}</p>
                                    <p className="text-[#0d141c] text-sm font-medium leading-normal">{item.value}</p>
                                </div>
                            ))}
                        </div>
                        
                        {listing.Owner && (
                            <>
                                <h2 className="text-[#0d141c] text-xl sm:text-2xl font-bold leading-tight tracking-[-0.015em] mb-3 pt-5">Інформація про власника</h2>
                                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-lg">
                                    <img
                                        className="aspect-square bg-cover rounded-full h-14 w-14 object-cover border border-slate-300"
                                        src={getAvatarUrl(listing.Owner.profile_image_url, listing.Owner.name || listing.Owner.email)}
                                        alt={listing.Owner.name || 'Власник'}
                                    />
                                    <div>
                                        <Link to={`/profiles/${listing.Owner.id}`} className="text-[#0d141c] text-base font-semibold leading-normal hover:underline">
                                            {listing.Owner.name || listing.Owner.email}
                                        </Link>
                                        <Link to={`/profiles/${listing.Owner.id}`} className="block text-sm text-[#0c7ff2] hover:underline">
                                            Переглянути профіль
                                        </Link>
                                    </div>
                                </div>
                            </>
                        )}

                        {isAuthenticated && !isOwner && (
                            <>
                                <h2 className="text-[#0d141c] text-xl sm:text-2xl font-bold leading-tight tracking-[-0.015em] mb-2 pt-5">Зв'язатися з власником</h2>
                                <div className="py-2">
                                    <button
                                        onClick={handleContactOwner}
                                        className="w-full sm:w-auto flex items-center justify-center bg-[#0c7ff2] hover:bg-[#0a69c3] text-white font-bold py-2.5 px-6 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0c7ff2] focus:ring-opacity-50"
                                    >
                                        Надіслати повідомлення
                                    </button>
                                </div>
                            </>
                        )}
                        {isOwner && <div className="mt-5 p-3 text-sm text-slate-600 bg-slate-100 rounded-lg">Ви є власником цього оголошення. Ви можете керувати ним зі своєї панелі інструментів.</div>}
                        {!isAuthenticated && !isOwner && <div className="mt-5 text-sm text-slate-600"><button onClick={handleContactOwner} className="text-[#0c7ff2] hover:underline font-medium">Увійдіть, щоб зв'язатися з власником.</button></div>}

                        <h2 className="text-[#0d141c] text-xl sm:text-2xl font-bold leading-tight tracking-[-0.015em] mb-3 pt-8">Розташування</h2>
                        <div className="py-3">
                            {(listing.latitude && listing.longitude) ? (
                                <MapContainer center={mapPosition} zoom={15} scrollWheelZoom={false} className="w-full h-80 sm:h-96 rounded-lg border border-slate-300">
                                    <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                    <Marker position={mapPosition}><Popup>{listing.title}<br/>{listing.location}</Popup></Marker>
                                </MapContainer>
                            ) : (
                                <div className="w-full h-80 sm:h-96 bg-slate-200 flex items-center justify-center text-slate-500 rounded-lg">Дані карти недоступні.</div>
                            )}
                        </div>

                        {canBook && isAuthenticated && !isOwner && (
                            <>
                                <h2 className="text-[#0d141c] text-xl sm:text-2xl font-bold leading-tight tracking-[-0.015em] mb-3 pt-8">Бронювання</h2>
                                <div className="flex flex-col md:flex-row items-start gap-6 py-3">
                                    <div className="flex-1 w-full max-w-md mx-auto md:mx-0">
                                        {loadingBookedDates && <p className="text-sm text-center text-slate-500 mb-2">Завантаження доступності...</p>}
                                        <Calendar onChange={handleDateChange} value={bookingDates} selectRange minDate={new Date()} tileDisabled={tileDisabled} className="react-calendar-custom mx-auto" />
                                    </div>
                                    <div className="flex-1 w-full max-w-md mx-auto md:mx-0 mt-4 md:mt-0 md:pl-4">
                                        {bookingDates && bookingDates[0] && bookingDates[1] && (
                                            <div className="mb-4 p-3 bg-[#e7f2fe] rounded-lg text-[#0c7ff2]">
                                                <p><strong>Початок:</strong> {bookingDates[0].toLocaleDateString('uk-UA')}</p>
                                                <p><strong>Кінець:</strong> {bookingDates[1].toLocaleDateString('uk-UA')}</p>
                                            </div>
                                        )}
                                        <button onClick={handleBookingRequest} disabled={bookingSubmitting || !bookingDates?.[0] || !bookingDates?.[1] || loadingBookedDates}
                                            className="w-full bg-[#0c7ff2] hover:bg-[#0a69c3] text-white font-bold py-2.5 px-4 rounded-md text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#0c7ff2] focus:ring-opacity-50">
                                            {bookingSubmitting ? 'Відправлення...' : (loadingBookedDates ? 'Завантаження дат...' : 'Запит на бронювання')}
                                        </button>
                                        {bookingError && <p className="mt-2 text-sm text-red-600">{bookingError}</p>}
                                        {bookingSuccess && <p className="mt-2 text-sm text-green-600">{bookingSuccess}</p>}
                                    </div>
                                </div>
                            </>
                        )}
                        {!isAuthenticated && canBook && <div className="my-6 p-4 bg-[#e7f2fe] rounded-lg text-center text-[#0c7ff2]"><Link to={`/login?redirect=/listings/${listingId}`} className="font-bold hover:underline">Увійдіть</Link> або <Link to={`/register?redirect=/listings/${listingId}`} className="font-bold hover:underline">зареєструйтеся</Link>, щоб забронювати цю оренду.</div>}
                        {listing.type === 'monthly-rental' && <div className="my-6 p-4 bg-[#e7f2fe] rounded-lg text-center text-[#0c7ff2]">Для місячної оренди, будь ласка, скористайтеся кнопкою "Зв'язатися з власником", щоб домовитися про умови та бронювання.</div>}

                        <h2 className="text-[#0d141c] text-xl sm:text-2xl font-bold leading-tight tracking-[-0.015em] mb-3 pt-8">Відгуки</h2>
                        {isAuthenticated && !isOwner && (
                            <div className="py-3">
                                {reviewSubmitSuccess && <div className="mb-3 p-3 bg-green-100 text-green-700 rounded-md text-sm">{reviewSubmitSuccess}</div>}
                                {reviewSubmitError && <div className="mb-3 p-3 bg-red-100 text-red-700 rounded-md text-sm">{reviewSubmitError}</div>}
                                <form onSubmit={handleReviewSubmit} className="flex flex-col max-w-xl gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[#0d141c] mb-1">Ваш рейтинг</label>
                                        <div className="flex">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button key={star} type="button" onClick={() => setNewReviewRating(star)} aria-label={`Оцінити на ${star} зірок`}
                                                    className={`text-3xl p-1 focus:outline-none ${star <= newReviewRating ? 'text-[#0c7ff2]' : 'text-slate-300 hover:text-slate-400'}`}>
                                                    {star <= newReviewRating ? <StarSolidIcon className="w-6 h-6" /> : <StarOutlineIcon className="w-6 h-6" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <label className="flex flex-col">
                                        <span className="block text-sm font-medium text-[#0d141c] mb-1">Ваш відгук</span>
                                        <textarea id="comment" placeholder="Поділіться своїм досвідом..." value={newReviewComment} onChange={(e) => setNewReviewComment(e.target.value)} rows="4"
                                            className="form-textarea w-full resize-none rounded-lg text-[#0d141c] focus:outline-none focus:ring-2 focus:ring-[#0c7ff2] border border-slate-300 bg-white min-h-32 p-3 text-base placeholder:text-slate-400"></textarea>
                                    </label>
                                    <button type="submit" disabled={reviewSubmitting || newReviewRating === 0}
                                        className="self-start bg-[#0c7ff2] hover:bg-[#0a69c3] text-white font-bold py-2 px-5 rounded-md text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#0c7ff2] focus:ring-opacity-50">
                                        {reviewSubmitting ? 'Відправлення...' : 'Надіслати відгук'}
                                    </button>
                                </form>
                            </div>
                        )}
                        {!isAuthenticated && <div className="py-3 text-sm text-slate-600"><Link to={`/login?redirect=/listings/${listingId}`} className="text-[#0c7ff2] hover:underline font-medium">Увійдіть</Link>, щоб залишити відгук.</div>}
                        {isAuthenticated && isOwner && <div className="py-3 text-sm text-slate-600 bg-slate-100 rounded-lg p-3">Власники не можуть залишати відгуки до власних оголошень.</div>}
                        
                        <div className="mt-6 space-y-6">
                            {reviewLoading && <p className="text-slate-500">Завантаження відгуків...</p>}
                            {reviewError && <p className="text-red-500">{reviewError}</p>}
                            {!reviewLoading && !reviewError && reviews.length === 0 && <p className="text-slate-500">До цього оголошення ще немає відгуків.</p>}
                            {reviews.map(review => (
                                <div key={review.id} className="pb-4 border-b border-slate-200 last:border-b-0">
                                    <div className="flex items-start gap-3">
                                        <img
                                            className="aspect-square bg-cover rounded-full size-10 object-cover border border-slate-300 mt-1"
                                            src={getAvatarUrl(review.User?.profile_image_url, review.User?.name || review.User?.email)}
                                            alt={review.User?.name || 'Рецензент'}
                                        />
                                        <div className="flex-1">
                                            <p className="text-[#0d141c] text-base font-semibold leading-normal">{review.User?.name || review.User?.email || 'Анонімний користувач'}</p>
                                            <p className="text-slate-500 text-xs font-normal leading-normal mb-1">{new Date(review.createdAt).toLocaleDateString('uk-UA')}</p>
                                            <div className="flex gap-0.5 items-center mb-1.5">
                                                {[...Array(5)].map((_, i) => <StarSolidIcon key={i} className={`w-5 h-5 ${i < review.rating ? "text-[#0c7ff2]" : "text-slate-300"}`} />)}
                                                <span className="ml-2 text-sm text-[#0d141c] font-medium">{review.rating}/5</span>
                                            </div>
                                            <p className="text-slate-700 text-base leading-relaxed whitespace-pre-wrap">{review.comment || 'Коментар відсутній.'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .react-calendar-custom {
                    width: 100%;
                    border: 1px solid #e2e8f0; /* slate-200 */
                    border-radius: 0.5rem; /* rounded-lg */
                    font-family: inherit;
                    background-color: white;
                    box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
                }
                .react-calendar-custom .react-calendar__navigation button {
                    color: #0c7ff2; /* primary blue */
                    min-width: 44px;
                    background: none;
                    font-size: 1rem;
                    font-weight: 500;
                    margin-top: 8px;
                    border-radius: 0.25rem;
                }
                .react-calendar-custom .react-calendar__navigation button:hover,
                .react-calendar-custom .react-calendar__navigation button:focus {
                    background-color: #e7f2fe; /* light blue bg */
                }
                .react-calendar-custom .react-calendar__navigation button[disabled] {
                    background-color: #f8fafc; /* slate-50 */
                    color: #94a3b8; /* slate-400 */
                }
                .react-calendar-custom .react-calendar__month-view__weekdays__weekday {
                    text-align: center;
                    text-transform: uppercase;
                    font-weight: 600; /* semibold */
                    font-size: 0.75em;
                    color: #49739c; /* muted blue-gray */
                    padding: 0.5em;
                }
                .react-calendar-custom .react-calendar__month-view__days__day {
                    color: #0d141c; /* dark text */
                    background: none;
                    border: 0;
                    padding: 0.65em 0.5em; 
                    margin: 1px; 
                    border-radius: 0.25rem; 
                    transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
                }
                .react-calendar-custom .react-calendar__month-view__days__day--neighboringMonth {
                    color: #94a3b8; /* slate-400 */
                }
                .react-calendar-custom .react-calendar__tile:disabled {
                    background-color: #f1f5f9; /* slate-100 */
                    color: #cbd5e1; /* slate-300 */
                    text-decoration: line-through;
                    cursor: not-allowed;
                }
                .react-calendar-custom .react-calendar__tile:enabled:hover,
                .react-calendar-custom .react-calendar__tile:enabled:focus {
                    background-color: #e7f2fe; /* light blue bg */
                    color: #0c7ff2;
                }
                .react-calendar-custom .react-calendar__tile--now {
                    background: #dbeafe; /* blue-200ish */
                    font-weight: bold;
                    color: #1e40af; /* darker blue text */
                }
                .react-calendar-custom .react-calendar__tile--active,
                .react-calendar-custom .react-calendar__tile--rangeStart,
                .react-calendar-custom .react-calendar__tile--rangeEnd {
                    background: #0c7ff2 !important; /* primary blue */
                    color: white !important;
                    font-weight: bold;
                }
                .react-calendar-custom .react-calendar__tile--active:enabled:hover,
                .react-calendar-custom .react-calendar__tile--active:enabled:focus {
                    background: #0a69c3 !important; /* darker primary blue */
                }
                .react-calendar-custom .react-calendar__tile.react-calendar__tile--range.react-calendar__month-view__days__day {
                    background: #e7f2fe; /* design's range color: light blue bg */
                    color: #0d141c; /* dark text for in-range dates */
                    border-radius: 0; /* square for continuous range */
                }
                .react-calendar-custom .react-calendar__tile--rangeStart { border-top-left-radius: 0.25rem; border-bottom-left-radius: 0.25rem; }
                .react-calendar-custom .react-calendar__tile--rangeEnd { border-top-right-radius: 0.25rem; border-bottom-right-radius: 0.25rem; }

                /* Photo grid specific styles */
                .grid .bg-cover { background-size: cover; background-position: center; background-repeat: no-repeat; }
                /* For @container query for photo grid, ensure your Tailwind setup supports container queries */
                 /* .@container { container-type: inline-size; } */

            `}</style>
        </div>
    );
}

export default ListingDetail;