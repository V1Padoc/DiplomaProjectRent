// frontend/src/pages/FavoritesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import Slider from 'react-slick'; // Added for photo slider
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'; // For slider arrows

// Custom arrow components for react-slick (copied from ListingsPage)
function SlickArrowLeft({ currentSlide, slideCount, ...props }) {
    return (
      <button
        {...props}
        className="slick-prev slick-arrow"
        aria-hidden="true"
        type="button"
      >
       <ChevronLeftIcon className="h-6 w-6 text-white drop-shadow-md" />
      </button>
    );
}

function SlickArrowRight({ currentSlide, slideCount, ...props }) {
    return (
      <button
        {...props}
        className="slick-next slick-arrow"
        aria-hidden="true"
        type="button"
      >
        <ChevronRightIcon className="h-6 w-6 text-white drop-shadow-md" />
      </button>
    );
}

function FavoritesPage() {
    const [favoriteListings, setFavoriteListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token, toggleFavorite } = useAuth();

    const fetchFavorites = useCallback(async () => {
        if (!token) {
            setError("Потрібна автентифікація для перегляду обраних.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get('http://localhost:5000/api/users/me/favorites', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setFavoriteListings(response.data);
        } catch (err) {
            console.error("Error fetching favorites:", err);
            setError(err.response?.data?.message || "Не вдалося завантажити обрані.");
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchFavorites();
    }, [fetchFavorites]);

    const handleRemoveFavorite = async (listingId) => {
        await toggleFavorite(listingId); 
        setFavoriteListings(prev => prev.filter(l => l.id !== listingId));
    };

    // Slider settings for the listing cards
    const cardSliderSettings = {
        dots: false,
        infinite: true,
        speed: 500,
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: false,
        arrows: true,
        prevArrow: <SlickArrowLeft />,
        nextArrow: <SlickArrowRight />,
        lazyLoad: 'ondemand', 
    };

    if (loading) return <div className="text-center text-slate-700 py-10">Завантаження ваших обраних...</div>;
    if (error) return <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md text-center my-6 mx-auto max-w-lg">Помилка: {error}</div>;

    return (
        <div className="relative flex size-full min-h-screen flex-col bg-slate-50" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
            <div className="flex-1 py-5 px-4 sm:px-6 lg:px-8">
                <div className="max-w-none mx-auto"> {/* Full width container */}
                    <h1 className="text-[#0c151d] tracking-tight text-xl sm:text-2xl md:text-[32px] font-bold leading-tight mb-8">
                        Мої обрані
                    </h1>

                    {favoriteListings.length === 0 ? (
                        <p className="text-center text-slate-600 py-10">Ви ще не додали жодного оголошення до обраних. Почніть переглядати оголошення та натисніть на іконку серця!</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-8">
                            {favoriteListings.map((listing) => (
                                <div key={listing.id} className="flex flex-col bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-shadow duration-300 group">
                                    <div className="relative">
                                        <button 
                                            onClick={() => handleRemoveFavorite(listing.id)}
                                            className="absolute top-3 right-3 z-10 p-2 bg-black bg-opacity-40 rounded-full text-white hover:bg-opacity-60 focus:outline-none transition-colors"
                                            aria-label="Видалити з обраних"
                                        >
                                            <HeartSolid className="w-5 h-5 text-red-400"/>
                                        </button>
                                        <Link to={`/listings/${listing.id}`} className="block">
                                          {listing.photos && listing.photos.length > 0 ? (
                                            <div className="w-full h-60 sm:h-64 slick-listing-card">
                                              <Slider {...cardSliderSettings}>
                                                {listing.photos.map((photo, index) => (
                                                  <div key={index}> <img src={`http://localhost:5000/uploads/thumb-${photo}`} alt={`${listing.title} ${index + 1}`} className="w-full h-60 sm:h-64 object-cover" loading="lazy" decoding="async"/> </div>
                                                ))}
                                              </Slider>
                                            </div>
                                          ) : ( <div className="w-full h-60 sm:h-64 bg-slate-200 flex items-center justify-center text-slate-500 text-sm">Без зображення</div> )}
                                        </Link>
                                    </div>
                                    <Link to={`/listings/${listing.id}`} className="block p-4 sm:p-5 flex flex-col flex-grow">
                                        <h3 className="text-lg sm:text-xl font-semibold mb-1 text-[#0c151d] group-hover:text-blue-600 transition-colors truncate" title={listing.title}>{listing.title}</h3>
                                        <p className="text-sm text-[#4574a1] mb-1.5 truncate" title={listing.location}>{listing.location}</p>
                                        <div className="mt-auto pt-2">
                                          <div className="flex items-baseline justify-between text-[#0c151d]">
                                            <span className="text-base sm:text-lg font-bold">
                                              {listing.type === 'monthly-rental' ? `$${parseFloat(listing.price).toFixed(0)}/міс` :
                                               (listing.type === 'daily-rental' ? `$${parseFloat(listing.price).toFixed(0)}/день` : `$${parseFloat(listing.price).toFixed(0)}`)}
                                            </span>
                                            {(listing.rooms !== null || listing.area !== null) && (
                                                <div className="text-sm text-[#4574a1] flex items-center space-x-2">
                                                    {listing.rooms !== null && ( <span>{listing.rooms} {listing.rooms === 1 ? 'ліжко' : 'ліжка'}</span> )}
                                                    {listing.rooms !== null && listing.area !== null && <span>·</span>}
                                                    {listing.area !== null && ( <span>{listing.area} м²</span> )} {/* Keeping sqft, but translated the word */}
                                                </div>
                                            )}
                                          </div>
                                        </div>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <style jsx global>{`
                .form-input, .form-textarea, .form-select { @apply shadow-sm; }
                .tracking-tight { letter-spacing: -0.025em; }

                /* Slick Carousel Customizations for listing cards */
                .slick-listing-card .slick-arrow {
                  z-index: 10;
                  width: 32px;
                  height: 32px;
                  background-color: rgba(0,0,0,0.3);
                  border-radius: 50%;
                  transition: background-color 0.2s ease;
                  position: absolute;
                  top: 50%;
                  transform: translateY(-50%);
                  display: flex !important;
                  align-items: center;
                  justify-content: center;
                }
                .slick-listing-card .slick-arrow:hover {
                    background-color: rgba(0,0,0,0.5);
                }
                .slick-listing-card .slick-prev {
                  left: 10px;
                }
                .slick-listing-card .slick-next {
                  right: 10px;
                }
                .slick-listing-card .slick-prev:before, .slick-listing-card .slick-next:before {
                  content: ''; 
                }
                .slick-listing-card .slick-disabled {
                    opacity: 0.3;
                    cursor: default;
                }
                .slick-listing-card .slick-dots {
                    display: none !important;
                }
            `}</style>
        </div>
    );
}

export default FavoritesPage;