// frontend/src/pages/MapListingsPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
// import axios from 'axios'; // Removed direct axios import
import apiClient from '../services/api'; // <--- IMPORT apiClient
import { Link, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// For Favorites
import { HeartIcon as HeartOutline } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { useAuth } from '../context/AuthContext';

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

// Corrected highlightedIcon definition
// The CDN URL 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x-red.png'
// actually serves a 25x41 red marker. Despite the '2x' in its name, it's a standard resolution icon.
const highlightedIcon = L.icon({
    iconUrl: 'https://github.com/pointhi/leaflet-color-markers/blob/master/img/marker-icon-green.png?raw=true',
    iconRetinaUrl: 'https://github.com/pointhi/leaflet-color-markers/blob/master/img/marker-icon-green.png?raw=true', // Using same for retina
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'), // Standard shadow
    iconSize: [35, 51], // Slightly larger for highlight, as per original code
    iconAnchor: [17, 51], // Half of width (35/2 rounded), full height
    popupAnchor: [1, -44], // Adjusted for new size
    tooltipAnchor: [21, -38], // Corrected relative to iconAnchor for consistency
    shadowSize: [51, 51] // Slightly larger shadow
});
// If "pic with no image" persists for the highlighted marker, it's highly likely the CDN URL 
// 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x-red.png' 
// is inaccessible in your development or runtime environment.
// In such a case, download the red marker icon and its shadow, place them in your public assets folder,
// and reference them using local paths (e.g., iconUrl: '/images/marker-icon-red.png').

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
    }, [mapListings, map]);
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
        type: searchParams.get('type') || '', // Options: monthly-rental, daily-rental
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
    const itemsPerPage = 6;

    const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]);
    const [mapZoom, setMapZoom] = useState(5);
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
        setError(null);

        const commonParams = buildCommonParams();
        commonParams.append('page', String(pageToFetch));
        commonParams.append('limit', String(itemsPerPage));
        commonParams.append('sortBy', sort.sortBy);
        commonParams.append('sortOrder', sort.sortOrder);
        
        const newSearchParams = new URLSearchParams(commonParams);
        setSearchParams(newSearchParams, { replace: true });

        try {
            // Replaced axios.get with apiClient.get.
            const response = await apiClient.get(`/listings?${commonParams.toString()}`);
            setListData(response.data.listings);
            setPagination({
                totalPages: response.data.totalPages,
                totalItems: response.data.totalItems,
                currentPage: response.data.currentPage,
            });
        } catch (err) {
            console.error('Error fetching list data:', err);
            setError('Failed to fetch listings. Please try again.');
        } finally {
            setLoadingList(false);
        }
    }, [pagination.currentPage, sort, itemsPerPage, buildCommonParams, setSearchParams]);


    const fetchMapData = useCallback(async () => {
        setLoadingMap(true);

        const commonParams = buildCommonParams();

        try {
            // Replaced axios.get with apiClient.get.
            const response = await apiClient.get(`/listings/map-data?${commonParams.toString()}`);
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

    // Initial fetch and re-fetch when filters or sort change
    useEffect(() => {
        fetchListData(1); 
        fetchMapData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, sort.sortBy, sort.sortOrder]); // buildCommonParams is stable if filters don't change

    // Re-fetch list data when page changes via pagination controls
    useEffect(() => {
         // Only fetch if the call is not due to initial load or filter/sort changes handled by the above useEffect
        // This check ensures we don't double-fetch when filters change (which also resets page to 1 and calls fetchListData(1))
        // However, fetchListData is already debounced by useCallback and its dependencies.
        // A simpler approach is to just call it; React will handle memoization.
        // The current page is part of fetchListData's useCallback dependencies via pagination.currentPage.
        if (!loadingList) { // Avoid fetching if a fetch is already in progress or on initial mount if covered by other effect
            fetchListData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pagination.currentPage]); // fetchListData is stable if its deps don't change


    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleApplyFilters = () => {
        // The useEffect listening to `filters` and `sort` state will trigger data fetching.
        // This function explicitly sets searchParams to ensure URL consistency if desired,
        // and resets page to 1, which is handled by fetchListData(1) in the effect.
        const currentParams = buildCommonParams(); // Reflects current filters state
        currentParams.set('page', '1');
        currentParams.set('sortBy', sort.sortBy);
        currentParams.set('sortOrder', sort.sortOrder);
        setSearchParams(currentParams, { replace: true });
        // The main useEffect will run due to `filters` state having changed (if it did),
        // or if not, this setSearchParams might re-trigger things if not careful,
        // but it's generally okay as `filters` state is the primary driver.
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
    };

    const handleSortChange = (e) => {
        const { name, value } = e.target;
        setSort(prev => ({ ...prev, [name]: value }));
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== pagination.currentPage) {
            setPagination(prev => ({ ...prev, currentPage: newPage }));
        }
    };

    const handleListItemHover = (listingId) => {
        setHoveredListingId(listingId);
    };

    return (
        <div className="flex flex-col h-screen">
            {/* Top Filter Bar */}
            <div className="bg-gray-100 p-3 shadow sticky top-0 z-10">
                <div className="container mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 items-end"> {/* Adjusted to 6 columns for buttons */}
                        {/* Location Search */}
                        <div>
                            <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location</label>
                            <input
                                type="text" name="location" id="location" value={filters.location} onChange={handleFilterChange}
                                placeholder="e.g. Edmonton"
                                className="mt-1 block w-full border-gray-300 rounded-sm shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                        </div>
                         {/* Type */}
                        <div>
                            <label htmlFor="type" className="block text-sm font-medium text-gray-700">Type</label>
                            <select name="type" id="type" value={filters.type} onChange={handleFilterChange} className="mt-1 block w-full p-2 border-gray-300 rounded-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-[42px]"> {/* Match height of inputs */}
                                <option value="">All Types</option>
                                <option value="monthly-rental">Monthly Rental</option>
                                <option value="daily-rental">Daily Rental</option>
                            </select>
                        </div>
                        {/* Price Range */}
                        <div className="flex space-x-2">
                            <div className="flex-1">
                                <label htmlFor="priceMin" className="block text-sm font-medium text-gray-700">Min Price</label>
                                <input type="number" name="priceMin" id="priceMin" value={filters.priceMin} onChange={handleFilterChange} placeholder="Any" className="mt-1 w-full p-2 border-gray-300 rounded-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"/>
                            </div>
                            <div className="flex-1">
                                <label htmlFor="priceMax" className="block text-sm font-medium text-gray-700">Max Price</label>
                                <input type="number" name="priceMax" id="priceMax" value={filters.priceMax} onChange={handleFilterChange} placeholder="Any" className="mt-1 w-full p-2 border-gray-300 rounded-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"/>
                            </div>
                        </div>
                         {/* Min Rooms */}
                        <div>
                            <label htmlFor="roomsMin" className="block text-sm font-medium text-gray-700">Min Rooms</label>
                            <input type="number" name="roomsMin" id="roomsMin" value={filters.roomsMin} onChange={handleFilterChange} min="0" placeholder="Any" className="mt-1 block w-full p-2 border-gray-300 rounded-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"/>
                        </div>
                        {/* Search Keyword */}
                        <div>
                            <label htmlFor="search" className="block text-sm font-medium text-gray-700">Keyword</label>
                            <input type="text" name="search" id="search" value={filters.search} onChange={handleFilterChange} placeholder="e.g. cozy" className="mt-1 block w-full p-2 border-gray-300 rounded-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"/>
                        </div>
                        {/* Action Buttons */}
                        <div className="flex space-x-2 items-end">
                             <button onClick={handleApplyFilters} className="bg-blue-500 text-white px-4 py-2 rounded-sm text-sm hover:bg-blue-600 h-10">Apply</button>
                             <button onClick={handleResetFilters} className="bg-gray-300 text-gray-700 px-4 py-2 rounded-sm text-sm hover:bg-gray-400 h-10">Reset</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content: Map and List */}
            <div className="flex-grow flex overflow-hidden">
                {/* Map Area */}
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
                                icon={listing.id === hoveredListingId ? highlightedIcon : defaultIcon}
                                eventHandlers={{ // Added event handlers to sync hover state with map markers
                                    mouseover: () => handleListItemHover(listing.id),
                                    mouseout: () => handleListItemHover(null),
                                }}
                            >
                                <Tooltip>
                                    <strong>{listing.title}</strong><br />
                                    {listing.type === 'monthly-rental' ? `$${parseFloat(listing.price).toFixed(0)}/mo` : 
                                     (listing.type === 'daily-rental' ? `$${parseFloat(listing.price).toFixed(0)}/day` : `$${parseFloat(listing.price).toFixed(0)}`)}
                                    {listing.rooms ? ` - ${listing.rooms} rooms` : ''}
                                </Tooltip>
                                <Popup>
                                    <div className="w-48">
                                        {listing.photos && listing.photos.length > 0 && (
                                            <img src={`http://localhost:5000/uploads/${listing.photos[0]}`} alt={listing.title} className="w-full h-24 object-cover rounded-sm mb-2"/>
                                        )}
                                        <h3 className="font-semibold text-md mb-1 truncate">{listing.title}</h3>
                                        <p className="text-xs text-gray-600 mb-1 truncate">{listing.location}</p>
                                        <p className="text-sm font-bold text-gray-800 mb-2">
                                            {listing.type === 'monthly-rental' ? `$${parseFloat(listing.price).toFixed(0)}/month` : 
                                             (listing.type === 'daily-rental' ? `$${parseFloat(listing.price).toFixed(0)}/day` : `$${parseFloat(listing.price).toFixed(0)}`)}
                                        </p>
                                        <Link to={`/listings/${listing.id}`} target="_blank" rel="noopener noreferrer" className="block text-center text-sm bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-2 rounded-sm">
                                            View Details
                                        </Link>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                    {(loadingMap || loadingList && !mapData.length) && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded shadow-lg z-[1000]">Loading map & listings...</div>}
                </div>

                {/* Listings List Area */}
                <div className="w-2/5 xl:w-1/3 h-full overflow-y-auto p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-xl font-semibold text-gray-800">
                            {pagination.totalItems > 0 ? `${pagination.totalItems} Homes Found` : "Listings"}
                        </h2>
                        <div className="flex items-center space-x-2">
                            <label htmlFor="sortByList" className="text-sm">Sort:</label>
                            <select name="sortBy" id="sortByList" value={sort.sortBy} onChange={handleSortChange} className="p-1 border rounded-sm text-sm">
                                <option value="created_at">Date</option><option value="price">Price</option><option value="rooms">Rooms</option>
                            </select>
                            <select name="sortOrder" id="sortOrderList" value={sort.sortOrder} onChange={handleSortChange} className="p-1 border rounded-sm text-sm">
                                <option value="DESC">Desc</option><option value="ASC">Asc</option>
                            </select>
                        </div>
                    </div>

                    {loadingList && <div className="text-center py-10">Loading listings...</div>}
                    {error && !loadingList && <div className="text-center py-10 text-red-500">{error}</div>}
                    
                    {!loadingList && !error && listData.length === 0 && (
                        <div className="text-center py-10 text-gray-600">No listings match your current filters.</div>
                    )}

                    {!loadingList && !error && listData.length > 0 && (
                        <>
                            <div className="space-y-4">
                                {listData.map((listing) => (
                                    <div
                                        key={listing.id}
                                        className="relative bg-white rounded-sm shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer border-2 border-transparent hover:border-blue-500"
                                        onMouseEnter={() => handleListItemHover(listing.id)}
                                        onMouseLeave={() => handleListItemHover(null)}
                                    >
                                        {isAuthenticated && (
                                            <button 
                                                onClick={async (e) => { 
                                                    e.stopPropagation(); 
                                                    e.preventDefault(); 
                                                    await toggleFavorite(listing.id); 
                                                }}
                                                className="absolute top-2 right-2 z-20 p-1.5 bg-black bg-opacity-30 rounded-full text-white hover:bg-opacity-50 focus:outline-none"
                                                aria-label={favorites.includes(String(listing.id)) ? "Remove from favorites" : "Add to favorites"}
                                            >
                                                {favorites.includes(String(listing.id)) ? (
                                                    <HeartSolid className="w-5 h-5 text-red-400"/> 
                                                ) : (
                                                    <HeartOutline className="w-5 h-5 text-white"/>
                                                )}
                                            </button>
                                        )}
                                        <Link to={`/listings/${listing.id}`} className="block">
                                            <div className="flex">
                                                {listing.photos && listing.photos.length > 0 ? (
                                                    <img src={`http://localhost:5000/uploads/${listing.photos[0]}`} alt={listing.title} className="w-1/3 h-32 object-cover"/>
                                                ) : (
                                                    <div className="w-1/3 h-32 bg-gray-200 flex items-center justify-center text-gray-500 text-xs">No Image</div>
                                                )}
                                                <div className="p-3 flex-grow w-2/3">
                                                    <h3 className="text-md font-semibold mb-1 text-gray-800 truncate">{listing.title}</h3>
                                                    <p className="text-xs text-gray-500 mb-1 truncate">{listing.location}</p>
                                                    <p className="text-sm font-bold text-gray-700">
                                                        {listing.type === 'monthly-rental' ? `$${parseFloat(listing.price).toFixed(0)}/month` : 
                                                         (listing.type === 'daily-rental' ? `$${parseFloat(listing.price).toFixed(0)}/day` : `$${parseFloat(listing.price).toFixed(0)}`)}
                                                    </p>
                                                    {listing.rooms !== null && listing.rooms !== undefined && (
                                                        <p className="text-xs text-gray-500">{listing.rooms} {listing.rooms === 1 ? 'room' : 'rooms'}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                ))}
                            </div>

                            {pagination.totalPages > 1 && (
                                <div className="mt-6 flex justify-center items-center space-x-1">
                                    <button onClick={() => handlePageChange(pagination.currentPage - 1)} disabled={pagination.currentPage === 1 || loadingList} className="px-3 py-1 text-sm rounded-sm bg-gray-200 hover:bg-gray-300 disabled:opacity-50">Prev</button>
                                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (pagination.totalPages <= 5 || pagination.currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (pagination.currentPage >= pagination.totalPages - 2) {
                                            pageNum = pagination.totalPages - 4 + i;
                                        } else {
                                            pageNum = pagination.currentPage - 2 + i;
                                        }
                                        if (pageNum < 1 || pageNum > pagination.totalPages) return null; // Should not happen with this logic
                                        return (
                                        <button key={pageNum} onClick={() => handlePageChange(pageNum)} disabled={loadingList} className={`px-3 py-1 text-sm rounded-sm ${pagination.currentPage === pageNum ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                            {pageNum}
                                        </button>
                                        );
                                    }).filter(Boolean)} {/* Filter out nulls if any pageNum is out of bounds */}
                                    <button onClick={() => handlePageChange(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages || loadingList} className="px-3 py-1 text-sm rounded-sm bg-gray-200 hover:bg-gray-300 disabled:opacity-50">Next</button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MapListingsPage;