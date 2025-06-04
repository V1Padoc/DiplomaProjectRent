// frontend/src/pages/ListingsPage.jsx

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import Slider from 'react-slick';
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { HeartIcon as HeartOutline } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { useAuth } from '../context/AuthContext';
import { ChevronLeftIcon, ChevronRightIcon, ArrowUpIcon, ArrowDownIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/20/solid'; // Added ArrowUpIcon

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


function ListingsPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [showBackToTop, setShowBackToTop] = useState(false); // For Back to Top button

  const SLIDER_SCALE_MAX = 10000; 

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    type: searchParams.get('type') || '',
    priceMin: searchParams.get('priceMin') || '0',
    priceMax: searchParams.get('priceMax') || String(SLIDER_SCALE_MAX),
    roomsMin: searchParams.get('roomsMin') || '',
    location: searchParams.get('location') || '',
  });
  
  const [priceRangeVisual, setPriceRangeVisual] = useState({ min: 0, max: 100 });

  const [activeSortField, setActiveSortField] = useState(searchParams.get('sortBy') || 'created_at');
  const [sortDirection, setSortDirection] = useState(searchParams.get('sortOrder') || 'DESC');

  const [pagination, setPagination] = useState({
    currentPage: parseInt(searchParams.get('page') || '1', 10),
    totalPages: 1,
    totalItems: 0,
  });
  const itemsPerPage = 8; // Changed from 10 to 8 for wider cards

  const { isAuthenticated, favorites, toggleFavorite } = useAuth();

  const sliderTrackRef = useRef(null);
  const isDraggingMinRef = useRef(false);
  const isDraggingMaxRef = useRef(false);
  const filtersRef = useRef(filters); // Initialize ref with initial filters

  // Effect to keep filtersRef.current in sync with filters state
  useEffect(() => {
      filtersRef.current = filters;
  }, [filters]);

  const [applyFilterTrigger, setApplyFilterTrigger] = useState(0);

  // Effect for Back to Top button visibility
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) { // Show button after scrolling 300px down
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll); // Cleanup
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  useEffect(() => {
    const min = parseFloat(filters.priceMin) || 0;
    const max = parseFloat(filters.priceMax) || SLIDER_SCALE_MAX;
    const clampedMin = Math.max(0, Math.min(min, SLIDER_SCALE_MAX));
    const clampedMax = Math.max(0, Math.min(max, SLIDER_SCALE_MAX));

    setPriceRangeVisual({
      min: (clampedMin / SLIDER_SCALE_MAX) * 100,
      max: (clampedMax / SLIDER_SCALE_MAX) * 100,
    });
  }, [filters.priceMin, filters.priceMax, SLIDER_SCALE_MAX]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const currentFilters = filtersRef.current; // Use the up-to-date filters from the ref
    const params = new URLSearchParams();
    params.append('page', pagination.currentPage);
    params.append('limit', itemsPerPage);
    params.append('sortBy', activeSortField);
    params.append('sortOrder', sortDirection);

    if (currentFilters.search) params.append('search', currentFilters.search);
    if (currentFilters.type) params.append('type', currentFilters.type);
    if (currentFilters.priceMin && currentFilters.priceMin !== '0') params.append('priceMin', currentFilters.priceMin);
    if (currentFilters.priceMax && currentFilters.priceMax !== String(SLIDER_SCALE_MAX)) params.append('priceMax', currentFilters.priceMax);
    if (currentFilters.roomsMin) params.append('roomsMin', currentFilters.roomsMin); // Sends '0' if roomsMin is '0'
    if (currentFilters.location) params.append('location', currentFilters.location);
    
    setSearchParams(params, { replace: true });

    try {
      const response = await axios.get(`http://localhost:5000/api/listings?${params.toString()}`);
      setListings(response.data.listings);
      setPagination(prev => ({
        ...prev,
        totalPages: response.data.totalPages,
        totalItems: response.data.totalItems,
        currentPage: response.data.currentPage,
      }));
    } catch (err) {
      console.error('Error fetching listings:', err);
      setError('Failed to fetch listings. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, activeSortField, sortDirection, itemsPerPage, setSearchParams, SLIDER_SCALE_MAX]); // SLIDER_SCALE_MAX is const, but listed if it were prop/state

  useEffect(() => {
    fetchListings();
  }, [fetchListings, applyFilterTrigger]); // Runs when fetchListings identity changes or applyFilterTrigger changes

  useEffect(() => {
    if (isSidebarOpen && window.innerWidth < 1024) { 
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isSidebarOpen]);

  const handleFilterChange = useCallback((e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  }, []); // setFilters is stable
  
  const handleTypeFilterChange = useCallback((value) => {
    setFilters(prev => ({ ...prev, type: value }));
  }, []); // setFilters is stable

  const handleApplyFilters = useCallback(() => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setApplyFilterTrigger(prev => prev + 1); // This will trigger the fetchListings effect
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, [setIsSidebarOpen]); // State setters are stable, added setIsSidebarOpen for completeness if its identity could change (it won't here)
  
  const handleResetFilters = useCallback(() => {
    setFilters({ search: '', type: '', priceMin: '0', priceMax: String(SLIDER_SCALE_MAX), roomsMin: '', location: '' });
    setActiveSortField('created_at');
    setSortDirection('DESC');
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setSearchParams({}, { replace: true }); // Clear URL params first
    setApplyFilterTrigger(prev => prev + 1); // Then trigger fetch which will set params again
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, [setSearchParams, SLIDER_SCALE_MAX, setIsSidebarOpen]);

  const handleSortButtonClick = useCallback((field) => {
    if (field === activeSortField) {
      setSortDirection(prev => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setActiveSortField(field);
      setSortDirection(field === 'price' ? 'ASC' : 'DESC'); // Default sort for price ASC, others DESC
    }
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setApplyFilterTrigger(prev => prev + 1);
  }, [activeSortField]); // Dependencies: activeSortField, state setters are stable

  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: newPage }));
      setApplyFilterTrigger(prev => prev + 1); // Trigger fetch for new page
    }
  }, [pagination.totalPages]); // Dependency: pagination.totalPages, state setters are stable

  const handleSliderMouseMove = useCallback((e) => {
    if (!sliderTrackRef.current) return;
    const trackRect = sliderTrackRef.current.getBoundingClientRect();
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    let newPixelPos = clientX - trackRect.left; 
    newPixelPos = Math.max(0, Math.min(newPixelPos, trackRect.width));
    let newPercentage = (newPixelPos / trackRect.width) * 100;
    newPercentage = Math.max(0, Math.min(100, newPercentage)); 
    let newPrice = Math.round((newPercentage / 100) * SLIDER_SCALE_MAX);
    newPrice = Math.round(newPrice / 50) * 50; // Snap to nearest 50
    newPrice = Math.max(0, Math.min(newPrice, SLIDER_SCALE_MAX)); 

    setFilters(prevFilters => {
      let updatedMin = parseFloat(prevFilters.priceMin) || 0;
      let updatedMax = parseFloat(prevFilters.priceMax) || SLIDER_SCALE_MAX;
      if (isDraggingMinRef.current) {
        updatedMin = Math.min(newPrice, updatedMax); 
      } else if (isDraggingMaxRef.current) {
        updatedMax = Math.max(newPrice, updatedMin); 
      }
      // Ensure min is not greater than max
      if (updatedMin > updatedMax) {
          if (isDraggingMinRef.current) updatedMax = updatedMin; 
          else if (isDraggingMaxRef.current) updatedMin = updatedMax; 
      }
      return { ...prevFilters, priceMin: String(updatedMin), priceMax: String(updatedMax) };
    });
  }, [SLIDER_SCALE_MAX]); // isDraggingMinRef/MaxRef are refs, access .current inside. setFilters stable.

  const handleSliderMouseUp = useCallback(() => {
    isDraggingMinRef.current = false;
    isDraggingMaxRef.current = false;
    document.removeEventListener('mousemove', handleSliderMouseMove);
    document.removeEventListener('mouseup', handleSliderMouseUp);
    document.removeEventListener('touchmove', handleSliderMouseMove);
    document.removeEventListener('touchend', handleSliderMouseUp);
    document.body.classList.remove('select-none'); 
    handleApplyFilters(); // Apply filters once dragging stops
  }, [handleSliderMouseMove, handleApplyFilters]);

  const handleSliderMouseDown = useCallback((e, type) => {
    if (type === 'min') isDraggingMinRef.current = true;
    else isDraggingMaxRef.current = true;
    
    // Prevent text selection and default touch actions during drag
    e.preventDefault(); 
    document.body.classList.add('select-none');

    if (e.type === 'touchstart') {
        document.addEventListener('touchmove', handleSliderMouseMove, { passive: false });
        document.addEventListener('touchend', handleSliderMouseUp, { passive: false });
    } else {
        document.addEventListener('mousemove', handleSliderMouseMove);
        document.addEventListener('mouseup', handleSliderMouseUp);
    }
  }, [handleSliderMouseMove, handleSliderMouseUp]);

  const sliderSettings = {
    dots: false, infinite: true, speed: 500, slidesToShow: 1, slidesToScroll: 1,
    autoplay: false, arrows: true, prevArrow: <SlickArrowLeft />, nextArrow: <SlickArrowRight />,
  };

  const sortOptions = useMemo(() => [
    { label: 'Date Added', field: 'created_at' }, { label: 'Price', field: 'price' },
    { label: 'Rooms', field: 'rooms' }, { label: 'Area', field: 'area' },
  ], []);

  return (
    <div className="relative flex size-full min-h-screen flex-col bg-slate-50" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
      {/* Sidebar Toggle Button - Mobile, bottom-left */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 left-4 right-auto z-50 p-3 bg-slate-700 text-white rounded-full shadow-lg hover:bg-slate-600 transition-colors lg:hidden"
        aria-label={isSidebarOpen ? "Close filters" : "Open filters"}
      >
        {isSidebarOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
      </button>

      {/* Back to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-6 right-6 z-50 p-3 bg-slate-700 text-white rounded-full shadow-lg hover:bg-slate-600 transition-opacity duration-300
                    ${showBackToTop ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        aria-label="Back to top"
      >
        <ArrowUpIcon className="h-6 w-6" />
      </button>


      {/* Backdrop for mobile sidebar */}
      {isSidebarOpen && window.innerWidth < 1024 && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          aria-hidden="true"
        ></div>
      )}

      <div className="flex flex-1 py-5 px-4 sm:px-6 lg:px-8"> 
        <div className="flex flex-row w-full gap-6">
          
          {/* Filters Sidebar - Left position */}
          <aside
            className={`
              fixed top-0 left-0 h-full w-[90vw] max-w-xs sm:max-w-sm
              bg-white shadow-xl z-40
              transform transition-transform duration-300 ease-in-out
              ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              lg:relative lg:translate-x-0 lg:h-auto
              lg:w-72 xl:w-80 lg:shrink-0
              lg:shadow-none lg:bg-transparent
            `}
          >
            <div className="h-full lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] overflow-y-auto pt-5 lg:pt-0">
              <h2 className="text-[#0c151d] text-xl sm:text-[22px] font-bold leading-tight tracking-tight px-4 pb-3 pt-4 lg:pt-0">Filters</h2>
              
              <div className="px-4 py-2.5"> {/* Reduced py */}
                <label htmlFor="search-keyword" className="sr-only">Search by keyword</label>
                <input id="search-keyword" name="search" placeholder="Search by keyword"
                  className="form-input w-full rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 sm:h-14 p-3 sm:p-[15px] text-sm sm:text-base placeholder:text-[#4574a1]"
                  value={filters.search} onChange={handleFilterChange}/>
              </div>

              <h3 className="text-[#0c151d] text-base sm:text-lg font-bold leading-tight tracking-tight px-4 pb-1.5 pt-3">Listing Type</h3> {/* Reduced pb, pt */}
              <div className="flex flex-col gap-2 p-3"> {/* Reduced gap, p */}
                {[
                    { label: 'All Types', value: ''},
                    { label: 'Monthly Rental', value: 'monthly-rental' },
                    { label: 'Daily Rental', value: 'daily-rental' },
                ].map(typeOpt => (
                    <label key={typeOpt.value} className="flex items-center gap-3 sm:gap-4 rounded-lg border border-solid border-[#cddcea] p-3 sm:p-[15px] cursor-pointer hover:border-blue-400 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 transition-colors">
                        <input
                        type="radio"
                        className="form-radio h-4 w-4 sm:h-5 sm:w-5 border-2 border-[#cddcea] text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                        name="type"
                        value={typeOpt.value}
                        checked={filters.type === typeOpt.value}
                        onChange={() => handleTypeFilterChange(typeOpt.value)}
                        />
                        <span className="text-[#0c151d] text-sm font-medium leading-normal">{typeOpt.label}</span>
                    </label>
                ))}
              </div>

              <h3 className="text-[#0c151d] text-base sm:text-lg font-bold leading-tight tracking-tight px-4 pb-1.5 pt-3">Price Range</h3> {/* Reduced pb, pt */}
                <div className="px-4 pt-0 pb-3"> {/* Reduced pb */}
                    <p className="text-[#0c151d] text-sm font-medium leading-normal mb-2 text-center">
                        ${filters.priceMin} - {filters.priceMax === String(SLIDER_SCALE_MAX) ? `${SLIDER_SCALE_MAX}+` : `$${filters.priceMax}`}
                    </p>
                    <div className="relative h-[38px] w-full pt-1.5">
                        <div ref={sliderTrackRef} className="relative h-1 w-full rounded-sm bg-[#cddcea]">
                            <div className="absolute h-1 rounded-sm bg-[#359dff]" style={{ left: `${priceRangeVisual.min}%`, right: `${100 - priceRangeVisual.max}%` }}></div>
                            <div className="absolute -top-1.5 size-4 rounded-full bg-[#359dff] border-2 border-white shadow cursor-grab touch-none"
                               style={{ left: `calc(${priceRangeVisual.min}% - 8px)` }}
                               onMouseDown={(e) => handleSliderMouseDown(e, 'min')}
                               onTouchStart={(e) => handleSliderMouseDown(e, 'min')}
                            ></div>
                            <div className="absolute -top-1.5 size-4 rounded-full bg-[#359dff] border-2 border-white shadow cursor-grab touch-none"
                               style={{ left: `calc(${priceRangeVisual.max}% - 8px)` }}
                               onMouseDown={(e) => handleSliderMouseDown(e, 'max')}
                               onTouchStart={(e) => handleSliderMouseDown(e, 'max')}
                            ></div>
                        </div>
                    </div>
                </div>
              
              <h3 className="text-[#0c151d] text-base sm:text-lg font-bold leading-tight tracking-tight px-4 pb-1.5 pt-3">Rooms</h3> {/* Reduced pb, pt */}
               <div className="p-3"> {/* Reduced p */}
                    <label htmlFor="roomsMin" className="sr-only">Min. Rooms</label>
                    <input type="number" name="roomsMin" id="roomsMin" value={filters.roomsMin} onChange={handleFilterChange} min="0" placeholder="Min. Bedrooms"
                           className="form-input w-full rounded-lg border-[#cddcea] bg-slate-50 h-12 sm:h-14 p-3 sm:p-[15px] text-sm sm:text-base placeholder:text-[#4574a1]"/>
               </div>

              <h3 className="text-[#0c151d] text-base sm:text-lg font-bold leading-tight tracking-tight px-4 pb-1.5 pt-3">Location</h3> {/* Reduced pb, pt */}
              <div className="px-4 py-2.5"> {/* Reduced py */}
                <label htmlFor="location-filter" className="sr-only">Location</label>
                <input id="location-filter" name="location" placeholder="City, Neighborhood, ZIP"
                  className="form-input w-full rounded-lg border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 sm:h-14 p-3 sm:p-[15px] text-sm sm:text-base placeholder:text-[#4574a1]"
                  value={filters.location} onChange={handleFilterChange}/>
              </div>

              <div className="flex flex-col gap-2 px-4 py-4"> {/* Reduced gap, py */}
                <button onClick={handleApplyFilters}
                  className="w-full bg-[#359dff] hover:bg-blue-600 text-white text-sm font-bold rounded-lg h-10 sm:h-12 transition-colors">
                  Apply Filters
                </button>
                <button onClick={handleResetFilters}
                  className="w-full bg-[#e6edf4] hover:bg-slate-300 text-[#0c151d] text-sm font-bold rounded-lg h-10 sm:h-12 transition-colors">
                  Reset Filters
                </button>
              </div>
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <div className="px-0 sm:px-4">
                <p className="text-[#0c151d] tracking-tight text-xl sm:text-2xl md:text-[32px] font-bold leading-tight mb-4">
                    Apartments for rent
                </p>
                <p className="text-sm text-slate-600 mb-6">
                    {pagination.totalItems > 0 ? `Showing ${((pagination.currentPage - 1) * itemsPerPage) + 1}-${Math.min(pagination.currentPage * itemsPerPage, pagination.totalItems)} of ${pagination.totalItems} results` : 'No results'}
                </p>
            </div>

            <div className="pb-3 mb-4">
              <div className="flex border-b border-[#cddcea] px-0 sm:px-4 gap-1 sm:gap-2 overflow-x-auto">
                {sortOptions.map(opt => (
                    <button
                        key={opt.field}
                        onClick={() => handleSortButtonClick(opt.field)}
                        className={`flex items-center whitespace-nowrap px-2 sm:px-3 pb-[10px] sm:pb-[13px] pt-3 sm:pt-4 text-xs sm:text-sm font-bold leading-normal tracking-[0.015em] transition-colors duration-150
                                   ${activeSortField === opt.field ? 'border-b-[3px] border-b-[#359dff] text-[#0c151d]' : 'border-b-[3px] border-b-transparent text-[#4574a1] hover:text-[#0c151d]'}`}
                    >
                        {opt.label}
                        {activeSortField === opt.field && (
                            sortDirection === 'ASC' ? <ArrowUpIcon className="ml-1.5 h-3 w-3 sm:h-4 sm:w-4" /> : <ArrowDownIcon className="ml-1.5 h-3 w-3 sm:h-4 sm:w-4" />
                        )}
                    </button>
                ))}
              </div>
            </div>

            {loading && <div className="text-center text-slate-700 py-10">Loading listings...</div>}
            {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md text-center my-6">{error}</div>}
            
            {!loading && !error && listings.length === 0 && (
              <div className="text-center text-slate-600 py-10">No listings found matching your criteria. Try adjusting your filters.</div>
            )}

            {!loading && !error && listings.length > 0 && (
              <>
                {/* Updated grid for wider listings and more columns on very wide screens */}
                <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-x-5 gap-y-8 px-0 sm:px-4">
                  {listings.map((listing) => (
                    <div key={listing.id} className="flex flex-col bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-shadow duration-300 group">
                      <div className="relative">
                        {isAuthenticated && (
                            <button onClick={async (e) => { e.stopPropagation(); e.preventDefault(); await toggleFavorite(listing.id); }}
                                className="absolute top-3 right-3 z-10 p-2 bg-black bg-opacity-40 rounded-full text-white hover:bg-opacity-60 focus:outline-none transition-colors"
                                aria-label={favorites.includes(String(listing.id)) ? "Remove from favorites" : "Add to favorites"}>
                                {favorites.includes(String(listing.id)) ? 
                                    <HeartSolid className="w-5 h-5 text-red-400"/> : 
                                    <HeartOutline className="w-5 h-5 text-white"/>}
                            </button>
                        )}
                        <Link to={`/listings/${listing.id}`} className="block">
                          {listing.photos && listing.photos.length > 0 ? (
                            <div className="w-full h-60 sm:h-64 slick-listing-card">
                              <Slider {...sliderSettings}>
                                {listing.photos.map((photo, index) => (
                                  <div key={index}> <img src={`http://localhost:5000/uploads/${photo}`} alt={`${listing.title} ${index + 1}`} className="w-full h-60 sm:h-64 object-cover"/> </div>
                                ))}
                              </Slider>
                            </div>
                          ) : ( <div className="w-full h-60 sm:h-64 bg-slate-200 flex items-center justify-center text-slate-500 text-sm">No Image</div> )}
                        </Link>
                      </div>
                      <Link to={`/listings/${listing.id}`} className="block p-4 sm:p-5 flex flex-col flex-grow">
                        <h3 className="text-lg sm:text-xl font-semibold mb-1 text-[#0c151d] group-hover:text-blue-600 transition-colors truncate" title={listing.title}>{listing.title}</h3>
                        <p className="text-sm text-[#4574a1] mb-1.5 truncate" title={listing.location}>{listing.location}</p>
                        <div className="mt-auto pt-2">
                          <div className="flex items-baseline justify-between text-[#0c151d]">
                            <span className="text-base sm:text-lg font-bold">
                              {listing.type === 'monthly-rental' ? `$${parseFloat(listing.price).toFixed(0)}/mo` :
                               (listing.type === 'daily-rental' ? `$${parseFloat(listing.price).toFixed(0)}/day` : `$${parseFloat(listing.price).toFixed(0)}`)}
                            </span>
                            {(listing.rooms !== null || listing.area !== null) && (
                                <div className="text-sm text-[#4574a1] flex items-center space-x-2">
                                    {listing.rooms !== null && ( <span>{listing.rooms} bed{listing.rooms === 1 ? '' : 's'}</span> )}
                                    {listing.rooms !== null && listing.area !== null && <span>·</span>}
                                    {listing.area !== null && ( <span>{listing.area} sqft</span> )}
                                </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>

                {pagination.totalPages > 1 && (
                  <div className="mt-10 sm:mt-12 flex items-center justify-center p-4 space-x-1.5 sm:space-x-2">
                    <button onClick={() => handlePageChange(pagination.currentPage - 1)} disabled={pagination.currentPage === 1}
                      className="flex size-9 sm:size-10 items-center justify-center rounded-full text-[#0c151d] hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"> <ChevronLeftIcon className="w-5 h-5" /> </button>
                    {[...Array(pagination.totalPages).keys()].slice(
                        Math.max(0, pagination.currentPage - 3),
                        Math.min(pagination.totalPages, pagination.currentPage + 2)
                    ).map(num => (
                      <button key={num + 1} onClick={() => handlePageChange(num + 1)}
                        className={`text-sm font-medium leading-normal tracking-[0.015em] flex size-9 sm:size-10 items-center justify-center rounded-full transition-colors
                                   ${pagination.currentPage === num + 1 ? 'bg-[#e6edf4] text-[#0c151d] font-bold' : 'text-[#0c151d] hover:bg-slate-200'}`}> {num + 1} </button>
                    ))}
                    <button onClick={() => handlePageChange(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages}
                      className="flex size-9 sm:size-10 items-center justify-center rounded-full text-[#0c151d] hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"> <ChevronRightIcon className="w-5 h-5" /> </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
      <style jsx global>{`
        .form-input, .form-textarea, .form-select, .form-radio { @apply shadow-sm; }
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
        .select-none {
            -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;
        }
        .touch-none { touch-action: none; } 
      `}</style>
    </div>
  );
}

export default ListingsPage;