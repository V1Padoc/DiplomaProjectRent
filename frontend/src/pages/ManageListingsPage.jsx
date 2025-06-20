// frontend/src/pages/ManageListingsPage.jsx

import React, { useState, useEffect, useCallback } from 'react';

import api from '../api/api.js';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Slider from 'react-slick';
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';

// Custom arrow components for react-slick
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


function ManageListingsPage() {
  const [ownerListings, setOwnerListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionState, setActionState] = useState({ id: null, type: null }); // For delete/archive
  const [actionError, setActionError] = useState(null);

  const { token } = useAuth();

  const fetchOwnerListings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setActionError(null);
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      const response = await api.get('/listings/owner', config);
      setOwnerListings(response.data);
    } catch (err) {
      console.error('Error fetching owner listings:', err);
      setError(err.response?.data?.message || 'Не вдалося завантажити ваші оголошення.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
       fetchOwnerListings();
    } else {
        setLoading(false);
        setError('Токен автентифікації не знайдено. Будь ласка, увійдіть.');
    }
  }, [token, fetchOwnerListings]);

  const handleDeleteListing = async (listingId) => {
    const isConfirmed = window.confirm('Ви впевнені, що хочете видалити це оголошення? Цю дію неможливо скасувати.');
    if (!isConfirmed) return;

    setActionState({ id: listingId, type: 'delete' });
    setActionError(null);
    try {
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      await api.delete(`/listings/${listingId}`, config);
      setOwnerListings(prev => prev.filter(listing => listing.id !== listingId));
    } catch (err) {
      console.error('Error deleting listing:', err);
      setActionError(err.response?.data?.message || 'Не вдалося видалити оголошення.');
    } finally {
      setActionState({ id: null, type: null });
    }
  };

  const handleArchiveToggle = async (listingId, currentStatus) => {
    const newStatus = currentStatus === 'archived' ? 'pending' : 'archived'; // Toggle to pending for re-activation
    const actionText = newStatus === 'archived' ? 'архівувати' : 'розархівувати';
    const isConfirmed = window.confirm(`Ви впевнені, що хочете ${actionText} це оголошення?`);
    if (!isConfirmed) return;

    setActionState({ id: listingId, type: 'archive' });
    setActionError(null);
    try {
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      await api.put(`/listings/${listingId}/archive`, { status: newStatus }, config);
      // Optimistic update, then refetch for consistency
      setOwnerListings(prev => prev.map(l => l.id === listingId ? { ...l, status: newStatus } : l));
      // fetchOwnerListings(); // Or just update locally if backend is reliable
    } catch (err) {
      console.error(`Error ${actionText}ing listing:`, err);
      setActionError(err.response?.data?.message || `Не вдалося ${actionText} оголошення.`);
    } finally {
      setActionState({ id: null, type: null });
    }
  };

  const cardSliderSettings = {
    dots: false, infinite: true, speed: 500, slidesToShow: 1, slidesToScroll: 1,
    autoplay: false, arrows: true, prevArrow: <SlickArrowLeft />, nextArrow: <SlickArrowRight />, lazyLoad: 'ondemand', 
  };

  if (loading) return <div className="text-center text-slate-700 py-10" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Завантаження ваших оголошень...</div>;
  
  return (
    <div className="relative flex size-full min-h-screen flex-col bg-slate-50" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
      <div className="flex-1 py-5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-none mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
            <h1 className="text-[#0c151d] tracking-tight text-xl sm:text-2xl md:text-[32px] font-bold leading-tight">
                Мої оголошення
            </h1>
            <Link 
                to="/create-listing" 
                className="w-full sm:w-auto bg-[#359dff] hover:bg-blue-700 text-white text-sm font-bold py-2.5 px-5 rounded-lg h-11 transition-colors flex items-center justify-center"
            >
                + Створити нове оголошення
            </Link>
          </div>

          {error && <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"><p className="font-bold">Помилка</p><p>{error}</p></div>}
          {actionError && <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"><p className="font-bold">Помилка дії</p><p>{actionError}</p></div>}

          {!loading && !error && ownerListings.length === 0 && (
            <p className="text-center text-slate-600 py-10">Ви ще не створили жодного оголошення. Натисніть "+ Створити нове оголошення", щоб розпочати!</p>
          )}

           {!loading && !error && ownerListings.length > 0 && (
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-8">
              {ownerListings.map((listing) => (
                // Головний контейнер картки з `flex flex-col`
                <div key={listing.id} className="flex flex-col bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-shadow duration-300 group">
                    
                    {/* --- БЛОК 1: Зображення. Він самодостатній. --- */}
                    <div className="relative">
                        <Link to={`/listings/${listing.id}`} className="block">
                          {listing.photos && listing.photos.length > 0 ? (
                            <div className="w-full h-60 sm:h-64 slick-listing-card">
                              <Slider {...cardSliderSettings}>
                               {listing.photos.map((photoUrl, index) => (
                                    <div key={index} className="h-60 sm:h-64">
                                        <img 
                                            src={photoUrl} 
                                            alt={`${listing.title} ${index + 1}`} 
                                            className="w-full h-full object-cover" 
                                            loading="lazy" 
                                            decoding="async" 
                                        />
                                    </div>
                                ))}
                              </Slider>
                            </div>
                          ) : ( <div className="w-full h-60 sm:h-64 bg-slate-200 flex items-center justify-center text-slate-500 text-sm">Немає зображення</div> )}
                        </Link>
                    </div> {/* <-- ✅ ОСЬ ТУТ ПРАВИЛЬНЕ МІСЦЕ ДЛЯ ЗАКРИВАЮЧОГО ТЕГУ */}

                    {/* --- БЛОК 2: Текст. Тепер це сусід, а не нащадок блоку зображення. --- */}
                    <div className="p-4 sm:p-5 flex flex-col flex-grow">
                        <h3 className="text-lg sm:text-xl font-semibold mb-1 text-[#0c151d] group-hover:text-blue-600 transition-colors truncate" title={listing.title}>{listing.title}</h3>
                        <p className="text-sm text-[#4574a1] mb-1 truncate" title={listing.location}>{listing.location}</p>
                        
                        <div className="flex justify-between items-center my-1.5">
                            <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full
                                ${ listing.status === 'active' ? 'bg-green-100 text-green-700 border border-green-200' :
                                   listing.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                   listing.status === 'rejected' ? 'bg-red-100 text-red-700 border border-red-200' :
                                   listing.status === 'archived' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                                   'bg-gray-100 text-gray-800 border border-gray-200'}`}>
                               {/* Translate status */}
                               {listing.status === 'active' ? 'Активне' :
                                listing.status === 'pending' ? 'На розгляді' :
                                listing.status === 'rejected' ? 'Відхилено' :
                                listing.status === 'archived' ? 'В архіві' :
                                listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                            </span>
                            <p className="text-xs text-slate-500">
                                Перегляди: {listing.Analytics && listing.Analytics.length > 0 ? listing.Analytics[0].views_count : 0}
                            </p>
                        </div>

                        <div className="text-base sm:text-lg font-bold text-[#0c151d] mb-3 mt-1">
                              {listing.type === 'monthly-rental' ? `₴${parseFloat(listing.price).toFixed(0)}/міс` :
                               (listing.type === 'daily-rental' ? `₴${parseFloat(listing.price).toFixed(0)}/день` : `₴${parseFloat(listing.price).toFixed(0)}`)}
                        </div>
                         
                        <div className="mt-auto pt-2 border-t border-slate-100">
                            <div className="flex flex-col sm:flex-row gap-2">
                               <Link
                                   to={`/manage-listings/edit/${listing.id}`}
                                   className="flex-1 text-center bg-[#e6edf4] hover:bg-slate-300 text-[#0c151d] text-sm font-bold py-2 px-3 rounded-lg h-10 transition-colors flex items-center justify-center"
                               >
                                   Редагувати
                               </Link>
                                {/* ... решта кнопок ... */}
                                {(listing.status === 'active' || listing.status === 'pending') && (
                                    <button
                                        onClick={() => handleArchiveToggle(listing.id, listing.status)}
                                        disabled={actionState.id === listing.id && actionState.type === 'archive'}
                                        className="flex-1 text-center bg-slate-400 hover:bg-slate-500 text-white text-sm font-bold py-2 px-3 rounded-lg h-10 transition-colors disabled:opacity-70 flex items-center justify-center"
                                    >
                                        {actionState.id === listing.id && actionState.type === 'archive' ? 'Архівування...' : 'Архівувати'}
                                    </button>
                                )}
                                {listing.status === 'archived' && (
                                    <button
                                        onClick={() => handleArchiveToggle(listing.id, listing.status)}
                                        disabled={actionState.id === listing.id && actionState.type === 'archive'}
                                        className="flex-1 text-center bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold py-2 px-3 rounded-lg h-10 transition-colors disabled:opacity-70 flex items-center justify-center"
                                    >
                                        {actionState.id === listing.id && actionState.type === 'archive' ? 'Розархівування...' : 'Розархівувати'}
                                    </button>
                                )}
                                <button
                                   onClick={() => handleDeleteListing(listing.id)}
                                   disabled={actionState.id === listing.id && actionState.type === 'delete'}
                                   className="flex-1 text-center bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-2 px-3 rounded-lg h-10 transition-colors disabled:opacity-70 flex items-center justify-center"
                                >
                                   {actionState.id === listing.id && actionState.type === 'delete' ? 'Видалення...' : 'Видалити'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style jsx global>{`
        .form-input, .form-textarea, .form-select { @apply shadow-sm; }
        .tracking-tight { letter-spacing: -0.025em; }
        .slick-listing-card .slick-arrow {
          z-index: 10; width: 32px; height: 32px; background-color: rgba(0,0,0,0.3);
          border-radius: 50%; transition: background-color 0.2s ease; position: absolute;
          top: 50%; transform: translateY(-50%); display: flex !important;
          align-items: center; justify-content: center;
        }
        .slick-listing-card .slick-arrow:hover { background-color: rgba(0,0,0,0.5); }
        .slick-listing-card .slick-prev { left: 10px; }
        .slick-listing-card .slick-next { right: 10px; }
        .slick-listing-card .slick-prev:before, .slick-listing-card .slick-next:before { content: ''; }
        .slick-listing-card .slick-disabled { opacity: 0.3; cursor: default; }
        .slick-listing-card .slick-dots { display: none !important; }
      `}</style>
    </div>
  );
}

export default ManageListingsPage;
