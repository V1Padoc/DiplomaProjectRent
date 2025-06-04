// frontend/src/pages/MapListingsPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Slider from 'react-slick'; // Added for photo slider
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

// For Favorites
import { HeartIcon as HeartOutline } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { useAuth } from '../context/AuthContext';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'; // For slider arrows

// Leaflet icon fix & custom icons
delete L.Icon.Default.prototype._getIconUrl;
const defaultIcon = L.icon({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

const highlightedIcon = L.icon({
    iconUrl: 'https://github.com/pointhi/leaflet-color-markers/blob/master/img/marker-icon-green.png?raw=true',
    iconRetinaUrl: 'https://github.com/pointhi/leaflet-color-markers/blob/master/img/marker-icon-green.png?raw=true',
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
    iconSize: [35, 51], 
    iconAnchor: [17, 51],
    popupAnchor: [1, -44], 
    tooltipAnchor: [21, -38], 
    shadowSize: [51, 51]
});

// Custom arrow components for react-slick (copied from ListingsPage)
function SlickArrowLeftSlick({ currentSlide, slideCount, ...props }) {
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

function SlickArrowRightSlick({ currentSlide, slideCount, ...props }) {
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


// Helper component to adjust map bounds when listings change
function MapBoundsAdjuster({ mapListings }) {
    const map = useMap();
    useEffect(() => {
        if (mapListings && mapListings.length > 0) {
            const validCoords = mapListings.filter(l => l.latitude != null && l.longitude != null)
                                       .map(l => [parseFloat(l.latitude), parseFloat(l.longitude)]);
            if (validCoords.length > 0) {
                const bounds = L.latLngBounds(validCoords);
                if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50] });
                }
            }
        }

        return () => {
            if (map) {
                try {
                    map.stop(); // Stops any ongoing pan/zoom animations
                     console.log('MapBoundsAdjuster: map.stop() called on cleanup.');
                } catch (e) {
                     console.warn('MapBoundsAdjuster: Error calling map.stop() during cleanup:', e);
                    // Map might already be in a removed state, especially if page is rapidly navigating away.
                }
            }
        };
    }, [mapListings, map]); // 'map' from useMap() is stable, 'mapListings' triggers effect

    return null;
}


function MapListingsPage() {
    const [listData, setListData] = useState([]);
    const [mapData, setMapData] = useState([]);
    
    const [loadingList, setLoadingList] = useState(true);
    const [loadingMap, setLoadingMap] = useState(true);
    const [error, setError] = useState(null);

    const [searchParams, setSearchParams] = useSearchParams();
    const { isAuthenticated, favorites, toggleFavorite } = useAuth();

    const [filters, setFilters] = useState({
        search: searchParams.get('search') || '',
        type: searchParams.get('type') || '',
        priceMin: searchParams.get('priceMin') || '',
        priceMax: searchParams.get('priceMax') || '',
        roomsMin: searchParams.get('roomsMin') || '',
        location: searchParams.get('location') || '',
    });

    const [sort, setSort] = useState({
        sortBy: searchParams.get('sortBy') || 'created_at',
        sortOrder: searchParams.get('sortOrder') || 'DESC',
    });

    const [pagination, setPagination] = useState({
        currentPage: parseInt(searchParams.get('page') || '1', 10),
        totalPages: 1,
        totalItems: 0,
    });
    const itemsPerPage = 6; // Adjusted for 1 or 2 items per "row" in list panel

    const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]); // Default: NYC
    const [mapZoom, setMapZoom] = useState(5); // Default zoom
    const mapRef = useRef(null);

    const [hoveredListingId, setHoveredListingId] = useState(null);

    const buildCommonParams = useCallback(() => {
        const params = new URLSearchParams();
        if (filters.search) params.append('search', filters.search);
        if (filters.type) params.append('type', filters.type);
        if (filters.priceMin) params.append('priceMin', filters.priceMin);
        if (filters.priceMax) params.append('priceMax', filters.priceMax);
        if (filters.roomsMin) params.append('roomsMin', filters.roomsMin);
        if (filters.location) params.append('location', filters.location);
        return params;
    }, [filters]);
    

    const fetchListData = useCallback(async (pageToFetch = pagination.currentPage) => {
        setLoadingList(true);
        const commonParams = buildCommonParams();
        commonParams.append('page', String(pageToFetch));
        commonParams.append('limit', String(itemsPerPage));
        commonParams.append('sortBy', sort.sortBy);
        commonParams.append('sortOrder', sort.sortOrder);
        
        const newSearchParams = new URLSearchParams(commonParams);
        // Only update URL if it's different to avoid re-triggering effects unnecessarily
        if (searchParams.toString() !== newSearchParams.toString()) {
            setSearchParams(newSearchParams, { replace: true });
        }

        try {
            const response = await axios.get(`http://localhost:5000/api/listings?${commonParams.toString()}`);
            setListData(response.data.listings);
            setPagination({
                totalPages: response.data.totalPages,
                totalItems: response.data.totalItems,
                currentPage: response.data.currentPage,
            });
        } catch (err) {
            console.error('Error fetching list data:', err);
            setError(prev => prev || 'Failed to fetch listings. Please try again.');
        } finally {
            setLoadingList(false);
        }
    }, [sort, itemsPerPage, buildCommonParams, setSearchParams, searchParams, pagination.currentPage]);


    const fetchMapData = useCallback(async () => {
        setLoadingMap(true);
        const commonParams = buildCommonParams();
        try {
            const response = await axios.get(`http://localhost:5000/api/listings/map-data?${commonParams.toString()}`);
            setMapData(response.data);
            
            if (response.data.length > 0) {
                if (filters.location && response.data[0]?.latitude && response.data[0]?.longitude) {
                    setMapCenter([parseFloat(response.data[0].latitude), parseFloat(response.data[0].longitude)]);
                    setMapZoom(12); 
                }
            }
        } catch (err) {
            console.error('Error fetching map data:', err);
            setError(prev => prev || 'Failed to load map data.');
        } finally {
            setLoadingMap(false);
        }
    }, [filters.location, buildCommonParams]);
    
    // Effect for filter/sort changes
    useEffect(() => {
        setError(null); 
        fetchListData(1); 
        fetchMapData();
    }, [filters, sort.sortBy, sort.sortOrder, fetchMapData]); // Removed fetchListData from here as it's complex with page

    // Effect for page changes from URL (e.g., back/forward button or direct URL manipulation)
    useEffect(() => {
        const pageFromUrl = parseInt(searchParams.get('page') || '1', 10);
        if (pageFromUrl !== pagination.currentPage || listData.length === 0 && !loadingList && pagination.totalItems > 0) {
             fetchListData(pageFromUrl);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]); // Only depends on searchParams to react to URL changes for page


    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleApplyFilters = () => {
        const currentParams = buildCommonParams();
        currentParams.set('page', '1'); 
        currentParams.set('sortBy', sort.sortBy);
        currentParams.set('sortOrder', sort.sortOrder);
        setSearchParams(currentParams, { replace: true });
        // The main useEffect for filters/sort will handle fetching
    };
    
    const handleResetFilters = () => {
        const defaultFilters = { search: '', type: '', priceMin: '', priceMax: '', roomsMin: '', location: '' };
        const defaultSort = { sortBy: 'created_at', sortOrder: 'DESC' };
        setFilters(defaultFilters);
        setSort(defaultSort);
        
        const params = new URLSearchParams(); 
        params.set('page', '1');
        params.set('sortBy', defaultSort.sortBy);
        params.set('sortOrder', defaultSort.sortOrder);
        setSearchParams(params, { replace: true });
        // The main useEffect for filters/sort will handle fetching
    };

    const handleSortChange = (e) => {
        const { name, value } = e.target;
        setSort(prev => ({ ...prev, [name]: value }));
        // The main useEffect for filters/sort will handle fetching and page reset
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== pagination.currentPage) {
            // Update URL parameter for page, which will trigger the useEffect listening to searchParams
            const currentParams = new URLSearchParams(searchParams);
            currentParams.set('page', String(newPage));
            setSearchParams(currentParams, { replace: true });
        }
    };

    const handleListItemHover = (listingId) => {
        setHoveredListingId(listingId);
    };

    const listCardSliderSettings = {
        dots: false,
        infinite: true,
        speed: 500,
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: false,
        arrows: true,
        prevArrow: <SlickArrowLeftSlick />,
        nextArrow: <SlickArrowRightSlick />,
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
            {/* Top Filter Bar */}
            <div className="bg-white p-3 shadow-sm sticky top-0 z-20">
                <div className="max-w-none mx-auto px-2 sm:px-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-3 items-end">
                        <div>
                            <label htmlFor="location" className="block text-xs text-[#4574a1] mb-0.5">Location</label>
                            <input
                                type="text" name="location" id="location" value={filters.location} onChange={handleFilterChange}
                                placeholder="City, Neighborhood, ZIP"
                                className="form-input w-full rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-10 p-3 text-sm placeholder:text-[#7b98b4]"
                            />
                        </div>
                        <div>
                            <label htmlFor="type" className="block text-xs text-[#4574a1] mb-0.5">Type</label>
                            <select name="type" id="type" value={filters.type} onChange={handleFilterChange} className="form-select w-full rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-10 p-2 pr-8 text-sm text-[#0c151d]">
                                <option value="">All Types</option>
                                <option value="monthly-rental">Monthly Rental</option>
                                <option value="daily-rental">Daily Rental</option>
                            </select>
                        </div>
                        <div className="flex space-x-2">
                            <div className="flex-1">
                                <label htmlFor="priceMin" className="block text-xs text-[#4574a1] mb-0.5">Min Price</label>
                                <input type="number" name="priceMin" id="priceMin" value={filters.priceMin} onChange={handleFilterChange} placeholder="Any" className="form-input w-full rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-10 p-3 text-sm placeholder:text-[#7b98b4]"/>
                            </div>
                            <div className="flex-1">
                                <label htmlFor="priceMax" className="block text-xs text-[#4574a1] mb-0.5">Max Price</label>
                                <input type="number" name="priceMax" id="priceMax" value={filters.priceMax} onChange={handleFilterChange} placeholder="Any" className="form-input w-full rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-10 p-3 text-sm placeholder:text-[#7b98b4]"/>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="roomsMin" className="block text-xs text-[#4574a1] mb-0.5">Min Rooms</label>
                            <input type="number" name="roomsMin" id="roomsMin" value={filters.roomsMin} onChange={handleFilterChange} min="0" placeholder="Any" className="form-input w-full rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-10 p-3 text-sm placeholder:text-[#7b98b4]"/>
                        </div>
                        <div>
                            <label htmlFor="search" className="block text-xs text-[#4574a1] mb-0.5">Keyword</label>
                            <input type="text" name="search" id="search" value={filters.search} onChange={handleFilterChange} placeholder="e.g. waterfront, cozy" className="form-input w-full rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-10 p-3 text-sm placeholder:text-[#7b98b4]"/>
                        </div>
                        <div className="flex space-x-2 items-end">
                             <button onClick={handleApplyFilters} className="w-full bg-[#359dff] hover:bg-blue-600 text-white text-sm font-bold rounded-lg h-10 transition-colors">Apply</button>
                             <button onClick={handleResetFilters} className="w-full bg-[#e6edf4] hover:bg-slate-300 text-[#0c151d] text-sm font-bold rounded-lg h-10 transition-colors">Reset</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-grow flex overflow-hidden">
                <div className="w-3/5 xl:w-2/3 h-full relative">
                    <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        scrollWheelZoom={true}
                        style={{ height: '100%', width: '100%' }}
                        ref={mapRef}
                        whenCreated={mapInstance => { mapRef.current = mapInstance; }}
                    >
                        <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapBoundsAdjuster mapListings={mapData} />
                        {mapData.filter(l => l.latitude != null && l.longitude != null).map(listing => (
                            <Marker
                                key={listing.id}
                                position={[parseFloat(listing.latitude), parseFloat(listing.longitude)]}
                                icon={String(listing.id) === String(hoveredListingId) ? highlightedIcon : defaultIcon}
                                eventHandlers={{
                                    mouseover: () => handleListItemHover(listing.id),
                                    mouseout: () => handleListItemHover(null),
                                }}
                            >
                                <Tooltip>
                                    <strong className="text-sm">{listing.title}</strong><br />
                                    <span className="text-xs">
                                    {listing.type === 'monthly-rental' ? `$${parseFloat(listing.price).toFixed(0)}/mo` : 
                                     (listing.type === 'daily-rental' ? `$${parseFloat(listing.price).toFixed(0)}/day` : `$${parseFloat(listing.price).toFixed(0)}`)}
                                    {listing.rooms ? ` · ${listing.rooms} bed${listing.rooms === 1 ? '' : 's'}` : ''}
                                    </span>
                                </Tooltip>
                                <Popup>
                                    <div className="w-48">
                                        {listing.photos && listing.photos.length > 0 && (
                                            <img src={`http://localhost:5000/uploads/${listing.photos[0]}`} alt={listing.title} className="w-full h-24 object-cover rounded-md mb-2"/>
                                        )}
                                        <h3 className="font-semibold text-base mb-1 text-[#0c151d] truncate">{listing.title}</h3>
                                        <p className="text-xs text-[#4574a1] mb-1 truncate">{listing.location}</p>
                                        <p className="text-sm font-bold text-[#0c151d] mb-2">
                                            {listing.type === 'monthly-rental' ? `$${parseFloat(listing.price).toFixed(0)}/mo` : 
                                             (listing.type === 'daily-rental' ? `$${parseFloat(listing.price).toFixed(0)}/day` : `$${parseFloat(listing.price).toFixed(0)}`)}
                                        </p>
                                        <Link to={`/listings/${listing.id}`} target="_blank" rel="noopener noreferrer" className="block text-center text-sm bg-[#359dff] hover:bg-blue-600 text-white font-bold py-1.5 px-2 rounded-md transition-colors">
                                            View Details
                                        </Link>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                    {(loadingMap || (loadingList && !mapData.length)) && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 p-6 rounded-lg shadow-xl z-[1000] text-[#0c151d] font-medium">Loading map & listings...</div>}
                </div>

                {/* Listings List Area - Adjusted width and grid */}
                <div className="w-2/5 lg:w-2/5 xl:w-1/3 h-full overflow-y-auto p-4 bg-slate-50">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-[#0c151d]">
                            {pagination.totalItems > 0 ? `${pagination.totalItems} Homes Found` : "Listings"}
                        </h2>
                        <div className="flex items-center space-x-2">
                            <label htmlFor="sortByList" className="text-sm text-[#4574a1]">Sort:</label>
                            <select name="sortBy" id="sortByList" value={sort.sortBy} onChange={handleSortChange} className="form-select rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:ring-opacity-50 text-sm h-9 py-1 pl-2 pr-7">
                                <option value="created_at">Date</option><option value="price">Price</option><option value="rooms">Rooms</option>
                            </select>
                            <select name="sortOrder" id="sortOrderList" value={sort.sortOrder} onChange={handleSortChange} className="form-select rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:ring-opacity-50 text-sm h-9 py-1 pl-2 pr-7">
                                <option value="DESC">Desc</option><option value="ASC">Asc</option>
                            </select>
                        </div>
                    </div>

                    {loadingList && <div className="text-center py-10 text-slate-700">Loading listings...</div>}
                    {error && !loadingList && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md text-center my-6">{error}</div>}
                    
                    {!loadingList && !error && listData.length === 0 && (
                        <div className="text-center py-10 text-slate-600">No listings match your current filters.</div>
                    )}

                    {!loadingList && !error && listData.length > 0 && (
                        <>
                            {/* Updated grid for 1 or 2 listings per line */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {listData.map((listing) => (
                                    <div
                                        key={listing.id}
                                        className="flex flex-col bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-shadow duration-300 group"
                                        onMouseEnter={() => handleListItemHover(listing.id)}
                                        onMouseLeave={() => handleListItemHover(null)}
                                    >
                                        <div className="relative">
                                            {isAuthenticated && (
                                                <button 
                                                    onClick={async (e) => { 
                                                        e.stopPropagation(); e.preventDefault(); await toggleFavorite(listing.id); 
                                                    }}
                                                    className="absolute top-3 right-3 z-10 p-2 bg-black bg-opacity-40 rounded-full text-white hover:bg-opacity-60 focus:outline-none transition-colors"
                                                    aria-label={favorites.includes(String(listing.id)) ? "Remove from favorites" : "Add to favorites"}
                                                >
                                                    {favorites.includes(String(listing.id)) ? 
                                                        <HeartSolid className="w-5 h-5 text-red-400"/> : 
                                                        <HeartOutline className="w-5 h-5 text-white"/>}
                                                </button>
                                            )}
                                             <Link to={`/listings/${listing.id}`} className="block">
                                                {listing.photos && listing.photos.length > 0 ? (
                                                    <div className="w-full h-48 sm:h-56 slick-listing-card">
                                                    <Slider {...listCardSliderSettings}>
                                                        {listing.photos.map((photo, index) => (
                                                        <div key={index}> <img src={`http://localhost:5000/uploads/${photo}`} alt={`${listing.title} ${index + 1}`} className="w-full h-48 sm:h-56 object-cover"/> </div>
                                                        ))}
                                                    </Slider>
                                                    </div>
                                                ) : ( <div className="w-full h-48 sm:h-56 bg-slate-200 flex items-center justify-center text-slate-500 text-sm">No Image</div> )}
                                            </Link>
                                        </div>
                                        <Link to={`/listings/${listing.id}`} className="block p-4 flex flex-col flex-grow">
                                            <h3 className="text-lg font-semibold mb-1 text-[#0c151d] group-hover:text-blue-600 transition-colors truncate" title={listing.title}>{listing.title}</h3>
                                            <p className="text-sm text-[#4574a1] mb-1.5 truncate" title={listing.location}>{listing.location}</p>
                                            <div className="mt-auto pt-2">
                                                <div className="flex items-baseline justify-between text-[#0c151d]">
                                                    <span className="text-base font-bold">
                                                    {listing.type === 'monthly-rental' ? `$${parseFloat(listing.price).toFixed(0)}/mo` :
                                                    (listing.type === 'daily-rental' ? `$${parseFloat(listing.price).toFixed(0)}/day` : `$${parseFloat(listing.price).toFixed(0)}`)}
                                                    </span>
                                                    {(listing.rooms !== null || listing.area !== null) && (
                                                        <div className="text-sm text-[#4574a1] flex items-center space-x-1.5"> {/* Changed space-x-2 to space-x-1.5 */}
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
                                <div className="mt-8 flex items-center justify-center p-4 space-x-1.5 sm:space-x-2">
                                    <button onClick={() => handlePageChange(pagination.currentPage - 1)} disabled={pagination.currentPage === 1 || loadingList}
                                    className="flex size-9 sm:size-10 items-center justify-center rounded-full text-[#0c151d] hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"> <ChevronLeftIcon className="w-5 h-5" /> </button>
                                    {Array.from({ length: Math.min(3, pagination.totalPages) }, (_, i) => {
                                        let pageNum;
                                        const maxPagesToShow = 3;
                                        let startPage = Math.max(1, pagination.currentPage - Math.floor(maxPagesToShow / 2));
                                        let endPage = Math.min(pagination.totalPages, startPage + maxPagesToShow - 1);
                                        if (endPage - startPage + 1 < maxPagesToShow) {
                                            startPage = Math.max(1, endPage - maxPagesToShow + 1);
                                        }
                                        pageNum = startPage + i;
                                        if (pageNum > endPage) return null;

                                        return (
                                        <button key={pageNum} onClick={() => handlePageChange(pageNum)} disabled={loadingList} 
                                                className={`text-sm font-medium leading-normal tracking-[0.015em] flex size-9 sm:size-10 items-center justify-center rounded-full transition-colors
                                                        ${pagination.currentPage === pageNum ? 'bg-[#e6edf4] text-[#0c151d] font-bold' : 'text-[#0c151d] hover:bg-slate-200'}`}> {pageNum} </button>
                                        );
                                    }).filter(Boolean)}
                                    <button onClick={() => handlePageChange(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages || loadingList}
                                    className="flex size-9 sm:size-10 items-center justify-center rounded-full text-[#0c151d] hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"> <ChevronRightIcon className="w-5 h-5" /> </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            <style jsx global>{`
                .form-input, .form-textarea, .form-select {
                    @apply shadow-sm appearance-none;
                }
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

export default MapListingsPage;