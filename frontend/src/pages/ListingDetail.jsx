// frontend/src/pages/ListingDetail.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import Slider from 'react-slick';
import { useAuth } from '../context/AuthContext';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});


function ListingDetail() {
    const { id: listingId } = useParams();

    const [listing, setListing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [reviews, setReviews] = useState([]);
    const [reviewLoading, setReviewLoading] = useState(true);
    const [reviewError, setReviewError] = useState(null);
    const [newReviewRating, setNewReviewRating] = useState(5);
    const [newReviewComment, setNewReviewComment] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewSubmitError, setReviewSubmitError] = useState(null);
    const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState(null);

    const [bookingDates, setBookingDates] = useState([null, null]);
    const [bookingSubmitting, setBookingSubmitting] = useState(false);
    const [bookingError, setBookingError] = useState(null);
    const [bookingSuccess, setBookingSuccess] = useState(null);

    const { isAuthenticated, user, token } = useAuth();

    const [listingIdFromParams, setListingIdFromParams] = useState(useParams().id);

    const [bookedRanges, setBookedRanges] = useState([]);
    const [loadingBookedDates, setLoadingBookedDates] = useState(true);

    useEffect(() => {
        const fetchListing = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await axios.get(`http://localhost:5000/api/listings/${listingId}`);

                setListing(response.data);
                console.log('Listing details fetched:', response.data);

            } catch (err) {
                console.error('Error fetching listing details:', err);
                if (err.response && err.response.status === 404) {
                    setError('Listing not found or is not active.');
                } else {
                    setError('Failed to fetch listing details. Please try again later.');
                }
            } finally {
                setLoading(false);
            }
        };

        if (listingId) {
            fetchListing();
        }
    }, [listingId]);

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                setReviewLoading(true);
                setReviewError(null);
                const response = await axios.get(`http://localhost:5000/api/listings/${listingId}/reviews`);
                setReviews(response.data);
                console.log('Reviews fetched:', response.data);
            } catch (err) {
                console.error('Error fetching reviews:', err);
                setReviewError('Failed to load reviews.');
            } finally {
                setReviewLoading(false);
            }
        };

        if (listingId) {
            fetchReviews();
        }
    }, [listingId]);

    useEffect(() => {
        const fetchBookedDatesForListing = async () => {
            if (!listingIdFromParams) return;
            setLoadingBookedDates(true);
            try {
                const response = await axios.get(`http://localhost:5000/api/listings/${listingIdFromParams}/booked-dates`);
                console.log("Raw booked dates from backend:", response.data); // Log raw
                const ranges = response.data.map(range => ({
                    start: new Date(range.start),
                    end: new Date(range.end)
                }));
                console.log("Processed bookedRanges for calendar:", ranges); // Log processed
                setBookedRanges(ranges);
            } catch (err) {
                console.error("Error fetching booked dates:", err);
            } finally {
                setLoadingBookedDates(false);
            }
        };
        fetchBookedDatesForListing();
    }, [listingIdFromParams]);


    const tileDisabled = ({ date, view }) => {
        if (view === 'month') {
            for (const range of bookedRanges) {
                const startDate = new Date(range.start); // Assuming range.start is a valid date string or Date object
                const endDate = new Date(range.end);   // Assuming range.end is a valid date string or Date object

                // Ensure we are comparing date parts only, ignoring time
                const normalizedCurrentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const normalizedRangeStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                const normalizedRangeEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

                if (normalizedCurrentDate >= normalizedRangeStart && normalizedCurrentDate <= normalizedRangeEnd) {
                    return true; // This date is within a booked range, so disable it
                }
            }
        }
        return false; // Otherwise, the date is enabled
    };


    const handleReviewSubmit = async (e) => {
        e.preventDefault();

        setReviewSubmitError(null);
        setReviewSubmitSuccess(null);
        setReviewSubmitting(true);

        if (newReviewRating === null || newReviewRating < 1 || newReviewRating > 5) {
            setReviewSubmitError('Please select a rating between 1 and 5.');
            setReviewSubmitting(false);
            return;
        }

        try {
            const response = await axios.post(`http://localhost:5000/api/listings/${listingId}/reviews`,
                {
                    rating: newReviewRating,
                    comment: newReviewComment
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            setReviewSubmitSuccess(response.data.message);
            console.log('Review submitted:', response.data.review);

            setReviews([response.data.review, ...reviews]);

            setNewReviewRating(5);
            setNewReviewComment('');

        } catch (err) {
            console.error('Error submitting review:', err);
            setReviewSubmitError(err.response?.data?.message || 'Failed to submit review. Please try again.');
        } finally {
            setReviewSubmitting(false);
        }
    };

    const handleDateChange = (dates) => {
        setBookingDates(dates);
        setBookingError(null);
        setBookingSuccess(null);
    };

    const handleBookingRequest = async () => {
        if (!bookingDates || !bookingDates[0] || !bookingDates[1]) {
            setBookingError("Please select a start and end date.");
            return;
        }
        setBookingSubmitting(true);
        setBookingError(null);
        setBookingSuccess(null);

        try {
            const response = await axios.post('http://localhost:5000/api/bookings', {
                listing_id: listingId,
                start_date: bookingDates[0].toISOString().split('T')[0],
                end_date: bookingDates[1].toISOString().split('T')[0],
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBookingSuccess(response.data.message);
            setBookingDates([null, null]);
        } catch (err) {
            console.error("Error requesting booking:", err);
            setBookingError(err.response?.data?.message || "Failed to submit booking request.");
        } finally {
            setBookingSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8 text-center text-gray-700 min-h-screen">
                Loading listing details...
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8 text-center text-red-600 min-h-screen">
                Error: {error}
            </div>
        );
    }

    if (!listing) {
        return (
            <div className="container mx-auto px-4 py-8 text-center text-gray-700 min-h-screen">
                Listing not found.
            </div>
        );
    }

    const sliderSettings = {
        dots: true,
        infinite: true,
        speed: 500,
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 3000,
        arrows: true,
    };

    const mapPosition = (listing && listing.latitude && listing.longitude)
        ? [parseFloat(listing.latitude), parseFloat(listing.longitude)]
        : [51.505, -0.09];

    const isOwner = user && listing && user.id === listing.owner_id;

    return (
        <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen">
            <div className="bg-white rounded-sm shadow-md overflow-hidden p-6 md:p-8">

                <div className="mb-6 pb-4 border-b border-gray-200">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">{listing.title}</h1>
                    <p className="text-2xl font-semibold text-blue-600">
                        {listing.type === 'rent' ? `$${listing.price}/month` : `$${listing.price}`}
                    </p>
                </div>

                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-3">Photos</h2>
                    {listing.photos && listing.photos.length > 0 ? (
                        <div className="w-full max-w-xl mx-auto">
                            <Slider {...sliderSettings}>
                                {listing.photos.map((photoFilename, index) => (
                                    <div key={index}>
                                        <img
                                            src={`http://localhost:5000/uploads/${photoFilename}`}
                                            alt={`${listing.title} Photo ${index + 1}`}
                                            className="w-full h-96 object-cover rounded-sm"
                                        />
                                    </div>
                                ))}
                            </Slider>
                        </div>
                    ) : (
                        <div className="w-full h-64 bg-gray-200 flex items-center justify-center text-gray-600 rounded-sm">
                            No Photos Available
                        </div>
                    )}
                </div>

                <div className="mb-6 pb-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-800 mb-3">Description</h2>
                    <p className="text-gray-700 leading-relaxed">{listing.description || 'No description provided.'}</p>
                </div>

                <div className="mb-6 pb-4 border-b border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Details</h3>
                        <p className="text-gray-700"><strong>Type:</strong> {listing.type === 'rent' ? 'For Rent' : 'For Sale'}</p>
                        {listing.rooms && <p className="text-gray-700"><strong>Rooms:</strong> {listing.rooms}</p>}
                        {listing.area && <p className="text-gray-700"><strong>Area:</strong> {listing.area} sq ft/m²</p>}
                        <p className="text-gray-700"><strong>Location:</strong> {listing.location}</p>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Amenities</h3>
                        <p className="text-gray-700">{listing.amenities || 'No amenities listed.'}</p>
                    </div>
                </div>

                {listing.Owner && (
                    <div className="mb-6 pb-4 border-b border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">Contact Information</h2>
                        <p className="text-gray-700"><strong>Owner:</strong> {listing.Owner.name || listing.Owner.email}</p>
                    </div>
                )}


                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-3">Location on Map</h2>
                    {(listing && listing.latitude && listing.longitude) ? (
                        <MapContainer
                            center={mapPosition}
                            zoom={15}
                            scrollWheelZoom={false}
                            className="w-full h-96 rounded-sm border border-gray-300"
                        >
                            <TileLayer
                                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <Marker position={mapPosition}>
                                <Popup>
                                    {listing.title} <br /> {listing.location}
                                </Popup>
                            </Marker>
                        </MapContainer>
                    ) : (
                        <div className="w-full h-64 bg-gray-200 flex items-center justify-center text-gray-600 rounded-sm">
                            Location coordinates not available for map display.
                        </div>
                    )}
                </div>

                {listing.type === 'rent' && isAuthenticated && !isOwner && (
                    <div className="my-8 p-6 bg-gray-50 rounded-sm shadow">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Request to Book</h2>
                         {loadingBookedDates && <p className="text-sm text-gray-600 mb-2">Loading availability...</p>}
                        <div className="flex flex-col md:flex-row md:space-x-6 items-start">
                            <div className="mb-4 md:mb-0 md:flex-1">
                                <Calendar
                                    onChange={handleDateChange}
                                    value={bookingDates}
                                    selectRange={true}
                                    minDate={new Date()}
                                    tileDisabled={tileDisabled}
                                    className="border-gray-300 rounded-sm shadow-sm react-calendar-override"
                                    tileClassName={({ date, view }) => {
                                        return null;
                                    }}
                                />
                            </div>
                            <div className="md:flex-1">
                                {bookingDates && bookingDates[0] && bookingDates[1] && (
                                    <div className="mb-4 p-3 bg-blue-50 rounded-sm text-blue-700">
                                        <p><strong>Selected Start:</strong> {bookingDates[0].toLocaleDateString()}</p>
                                        <p><strong>Selected End:</strong> {bookingDates[1].toLocaleDateString()}</p>
                                    </div>
                                )}
                                <button
                                    onClick={handleBookingRequest}
                                    disabled={bookingSubmitting || !bookingDates || !bookingDates[0] || !bookingDates[1] || loadingBookedDates}
                                    className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-sm focus:outline-none focus:shadow-outline transition duration-150 ease-in-out disabled:opacity-50"
                                >
                                    {bookingSubmitting ? 'Submitting Request...' : 'Request to Book'}
                                </button>
                                {bookingError && <p className="mt-2 text-sm text-red-600">{bookingError}</p>}
                                {bookingSuccess && <p className="mt-2 text-sm text-green-600">{bookingSuccess}</p>}
                            </div>
                        </div>
                    </div>
                )}
                {!isAuthenticated && listing.type === 'rent' && (
                    <div className="my-8 p-4 bg-gray-100 rounded-sm text-center text-gray-700">
                        Please <Link to="/login" className="text-blue-600 hover:underline">log in</Link> or <Link to="/register" className="text-blue-600 hover:underline">register</Link> to book this rental.
                    </div>
                )}

                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-3">Reviews</h2>

                    {isAuthenticated ? (
                        <div className="bg-gray-50 p-4 rounded-sm mb-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">Leave a Review</h3>

                            {reviewSubmitting && <div className="text-center text-blue-600 mb-2">Submitting review...</div>}
                            {reviewSubmitSuccess && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded relative mb-2 text-sm">{reviewSubmitSuccess}</div>}
                            {reviewSubmitError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative mb-2 text-sm">{reviewSubmitError}</div>}


                            <form onSubmit={handleReviewSubmit}>
                                <div className="mb-3">
                                    <label className="block text-gray-700 text-sm font-bold mb-1" htmlFor="rating">Rating (1-5)</label>
                                    <input
                                        className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                        id="rating"
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={newReviewRating}
                                        onChange={(e) => setNewReviewRating(parseInt(e.target.value, 10))}
                                        required
                                    />
                                </div>

                                <div className="mb-4">
                                    <label className="block text-gray-700 text-sm font-bold mb-1" htmlFor="comment">Comment (Optional)</label>
                                    <textarea
                                        className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                        id="comment"
                                        placeholder="Share your experience..."
                                        value={newReviewComment}
                                        onChange={(e) => setNewReviewComment(e.target.value)}
                                        rows="3"
                                    ></textarea>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-sm focus:outline-none focus:shadow-outline transition duration-150 ease-in-out text-sm"
                                        type="submit"
                                        disabled={reviewSubmitting}
                                    >
                                        {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="bg-gray-100 p-4 rounded-sm text-center text-gray-700 mb-6">
                            Please log in to leave a review.
                        </div>
                    )}


                    {reviewLoading && <div className="text-center text-gray-700">Loading reviews...</div>}
                    {reviewError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 text-center">{reviewError}</div>}
                    {!reviewLoading && !reviewError && reviews.length === 0 && (
                        <div className="text-gray-700">No reviews yet. Be the first to leave one!</div>
                    )}
                    {!reviewLoading && !reviewError && reviews.length > 0 && (
                        <div className="space-y-4">
                            {reviews.map(review => (
                                <div key={review.id} className="bg-gray-50 p-4 rounded-sm shadow-sm border border-gray-200">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-semibold text-gray-800">{review.User?.name || review.User?.email || 'Anonymous'}</span>
                                        <span className="text-sm text-gray-600">Rating: {review.rating}/5</span>
                                    </div>
                                    <p className="text-gray-700 leading-snug">{review.comment || 'No comment provided.'}</p>
                                    <div className="text-xs text-gray-500 mt-2">
                                        Reviewed on: {new Date(review.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="text-center">
                    {isAuthenticated && !isOwner && (
                        <Link
                            to={`/listings/${listingId}/chat`}
                            className="inline-block bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-sm focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
                        >
                            Contact Owner
                        </Link>
                    )}
                    {isOwner && (
                        <div className="text-gray-600 text-sm">
                            You are the owner of this listing.
                        </div>
                    )}
                    {!isAuthenticated && (
                        <div className="text-gray-600 text-sm">
                            Log in to contact the owner.
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

export default ListingDetail;