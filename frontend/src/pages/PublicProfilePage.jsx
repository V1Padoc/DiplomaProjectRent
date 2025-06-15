// frontend/src/pages/PublicProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../api/api.js';
import { useAuth } from '../context/AuthContext';
import Slider from 'react-slick'; // For listing photos
// import "slick-carousel/slick/slick.css"; // Ensure these are imported globally or here
// import "slick-carousel/slick/slick-theme.css";
import { ChevronLeftIcon as ChevronLeft, ChevronRightIcon as ChevronRight, UserCircleIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { MapPinIcon, CurrencyDollarIcon, TagIcon, ChatBubbleLeftEllipsisIcon } from '@heroicons/react/20/solid'; // For listing details
const SERVER_URL = process.env.REACT_APP_SERVER_BASE_URL || 'http://localhost:5000';
// Custom arrow components for react-slick in listing cards (similar to MyBookingsPage)
function SlickListingCardArrowLeft({ currentSlide, slideCount, ...props }) {
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

function SlickListingCardArrowRight({ currentSlide, slideCount, ...props }) {
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
    return 'https://via.placeholder.com/400x300.png?text=Зображення+відсутнє'; // Translated
};
const fallbackImage = 'https://via.placeholder.com/400x300.png?text=Немає+зображень+для+оголошення'; // Translated


function PublicProfilePage() {
    const { userId } = useParams();
    const { user: currentUser, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            setError(null);
            try {
                // Assuming this endpoint also returns listings with their 'photos' array
                const response = await api.get(`/users/public-profile/${userId}`);
                setProfileData(response.data);
            } catch (err) {
                console.error("Error fetching public profile:", err);
                setError(err.response?.data?.message || "Не вдалося завантажити профіль."); // Translated
            } finally {
                setLoading(false);
            }
        };
        if (userId) {
            fetchProfile();
        }
    }, [userId]);

    if (loading) return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-slate-700" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Завантаження профілю...</div>; // Translated
    if (error) return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-red-600 p-6 text-center" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Помилка: {error}</div>; // Translated
    if (!profileData || !profileData.user) return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-slate-700 p-6 text-center" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Профіль не знайдено.</div>; // Translated

    const handleContactAboutListing = (listingId) => {
        if (!isAuthenticated) {
            navigate(`/login?redirect=/listings/${listingId}/chat`);
        } else {
            navigate(`/listings/${listingId}/chat`);
        }
    };

    const { user: profileUser, listings: userListings } = profileData;

    const profileAvatar = profileUser.profile_photo_url
        ? `${SERVER_URL}/uploads/profiles/${profileUser.profile_photo_url.split('/').pop()}` // Ensure correct path for profiles
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(profileUser.name || profileUser.email || 'U')}&background=random&color=fff&size=160&font-size=0.4&bold=true`;

    const listingSliderSettings = {
        dots: true,
        infinite: true,
        speed: 500,
        slidesToShow: 1,
        slidesToScroll: 1,
        arrows: true,
        prevArrow: <SlickListingCardArrowLeft />,
        nextArrow: <SlickListingCardArrowRight />,
        className: "listing-card-slider-public-profile" // Custom class for specific styling if needed
    };
    
    const formatPrice = (price, type) => {
        const numericPrice = parseFloat(price);
        if (isNaN(numericPrice)) return 'Н/Д'; // Translated
        if (type === 'monthly-rental') return `₴${numericPrice.toFixed(0)}/міс`; // Translated
        if (type === 'daily-rental') return `₴${numericPrice.toFixed(0)}/день`; // Translated
        return `₴${numericPrice.toFixed(0)}`;
    };

    // Function to determine plural form for "rooms" (consistent with ListingsPage)
    const formatRooms = (count) => {
        if (count === null) return '';
        if (count === 1) return '1 ліжко';
        if (count >= 2 && count <= 4) return `${count} ліжка`;
        return `${count} ліжок`;
    };


    return (
        <div className="relative flex size-full min-h-screen flex-col bg-slate-50 py-5" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
            <div className="px-4 sm:px-6 md:px-8 flex flex-1 justify-center">
                <div className="layout-content-container flex flex-col max-w-4xl w-full flex-1"> {/* Max width increased a bit */}
                    <div className="p-6 md:p-8 bg-white shadow-xl rounded-lg">
                        {/* Profile Header */}
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 pb-6 md:pb-8 border-b border-slate-200">
                            <img
                                src={profileAvatar}
                                alt={profileUser.name || 'Профіль користувача'} // Translated
                                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-2 border-slate-300 shrink-0"
                            />
                            <div className="text-center sm:text-left flex-grow pt-1">
                                <h1 className="text-[#0d151c] text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
                                    {profileUser.name || 'Користувач'} {/* Translated */}
                                </h1>
                                <p className="text-sm text-slate-500 mt-1 mb-2">
                                    Приєднався: {new Date(profileUser.created_at).toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' })} {/* Translated & Localized Date */}
                                </p>
                                {currentUser && currentUser.id === profileUser.id && (
                                    <Link
                                        to="/profile"
                                        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                                    >
                                        <PencilSquareIcon className="w-4 h-4 mr-1.5" />
                                        Редагувати ваш профіль {/* Translated */}
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* Bio Section */}
                        {profileUser.bio && (
                            <div className="py-6 md:py-8 border-b border-slate-200">
                                <h2 className="text-xl font-semibold text-[#0d151c] mb-3">
                                    Про {profileUser.name ? profileUser.name.split(' ')[0] : 'Користувача'} {/* Translated */}
                                </h2>
                                <p className="text-slate-700 text-base leading-relaxed whitespace-pre-wrap">{profileUser.bio}</p>
                            </div>
                        )}

                        {/* Listings Section */}
                        {profileUser.role === 'owner' && userListings && userListings.length > 0 ? (
                            <div className="py-6 md:py-8">
                                <h2 className="text-xl font-semibold text-[#0d151c] mb-5 sm:mb-6">
                                    Оголошення від {profileUser.name || 'цього користувача'} ({userListings.length}) {/* Translated */}
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-8">
                                    {userListings.map(listing => (
                                        <div key={listing.id} className="flex flex-col bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-shadow duration-300 group">
                                            <div className="relative">
                                                {listing.photos && listing.photos.length > 0 ? (
                                                    <div className="w-full h-56 sm:h-60"> {/* Increased height */}
                                                        <Slider {...listingSliderSettings}>
                                                            {listing.photos.map((photo, index) => (
                                                                <div key={index}>
                                                                    <img src={getListingImageUrl(photo)} alt={`${listing.title} ${index + 1}`} className="w-full h-56 sm:h-60 object-cover" />
                                                                </div>
                                                            ))}
                                                        </Slider>
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-56 sm:h-60 bg-slate-200 flex items-center justify-center">
                                                        <img src={fallbackImage} alt="Зображення відсутнє" className="w-full h-56 sm:h-60 object-cover"/> {/* Translated */}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-4 sm:p-5 flex flex-col flex-grow">
                                                <Link to={`/listings/${listing.id}`} className="block">
                                                    <h3 className="text-lg sm:text-xl font-semibold mb-1 text-[#0d151c] group-hover:text-blue-600 transition-colors truncate" title={listing.title}>
                                                        {listing.title}
                                                    </h3>
                                                </Link>
                                                <p className="text-sm text-slate-500 mb-1 flex items-center" title={listing.location}>
                                                    <MapPinIcon className="w-4 h-4 mr-1.5 text-slate-400 shrink-0" />
                                                    <span className="truncate">{listing.location}</span>
                                                </p>
                                                <p className="text-sm text-slate-500 mb-2.5 flex items-center">
                                                    <TagIcon className="w-4 h-4 mr-1.5 text-slate-400 shrink-0" />
                                                    {listing.type === 'monthly-rental' ? 'Щомісячна оренда' : 'Щоденна оренда'} {/* Translated */}
                                                </p>
                                                <div className="mt-auto pt-2">
                                                    <div className="flex items-center justify-between text-[#0d151c]">
                                                        <span className="text-lg sm:text-xl font-bold flex items-center">
                                                            <CurrencyDollarIcon className="w-5 h-5 mr-1 text-slate-500"/>
                                                            {formatPrice(listing.price, listing.type)}
                                                        </span>
                                                        {listing.rooms !== null && (
                                                            <div className="text-sm text-[#4574a1] flex items-center space-x-1.5">
                                                                <span>{formatRooms(listing.rooms)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Contact Button */}
                                                {currentUser?.id !== profileUser.id && ( // Show only if viewer is not the profile owner
                                                    <div className="mt-4 pt-4 border-t border-slate-200">
                                                         <button
                                                            onClick={() => handleContactAboutListing(listing.id)}
                                                            className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-70"
                                                            disabled={!isAuthenticated && currentUser?.id === profileUser.id} // Disable if not logged in AND it's their own profile (though button shouldn't show then)
                                                        >
                                                            <ChatBubbleLeftEllipsisIcon className="w-5 h-5 mr-2"/>
                                                            {isAuthenticated ? "Зв'язатися щодо цього оголошення" : "Увійдіть, щоб зв'язатися"} {/* Translated */}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : profileUser.role === 'owner' && (!userListings || userListings.length === 0) ? (
                             <div className="py-6 md:py-8 text-center">
                                <UserCircleIcon className="w-12 h-12 mx-auto text-slate-400 mb-3"/>
                                <p className="text-slate-600">{profileUser.name || 'Цей користувач'} ще не розміщував жодних об'єктів.</p> {/* Translated */}
                            </div>
                        ) : null} {/* If not an owner, or no listings, do not show section */}
                    </div>
                </div>
            </div>
            <style jsx global>{`
                .tracking-tight { letter-spacing: -0.025em; }
                /* Styles for listing card slider on public profile page (if needed, can be more specific) */
                .listing-card-slider-public-profile .slick-dots {
                    bottom: 8px;
                }
                .listing-card-slider-public-profile .slick-dots li button:before {
                    font-size: 8px; 
                    color: white;
                    opacity: 0.6;
                }
                .listing-card-slider-public-profile .slick-dots li.slick-active button:before {
                    opacity: 1;
                    color: white;
                }
                 .listing-card-slider-public-profile .slick-arrow.slick-prev,
                 .listing-card-slider-public-profile .slick-arrow.slick-next {
                    width: 28px; 
                    height: 28px;
                 }
            `}</style>
        </div>
    );
}

export default PublicProfilePage;