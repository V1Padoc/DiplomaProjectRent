// frontend/src/pages/MapListingsPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x-red.png', // Using a red marker for highlight
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x-red.png',
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
    iconSize: [35, 51], // Slightly larger
    iconAnchor: [17, 51],
    popupAnchor: [1, -44],
    tooltipAnchor: [16, -38],
    shadowSize: [51, 51]
});


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
    const [listData, setListData] = useState([]); // For paginated list
    const [mapData, setMapData] = useState([]);   // For map markers (all filtered)
    
    const [loadingList, setLoadingList] = useState(true);
    const [loadingMap, setLoadingMap] = useState(true);
    const [error, setError] = useState(null);

    const [searchParams, setSearchParams] = useSearchParams();

    const [filters, setFilters] = useState({
        search: searchParams.get('search') || '',
        type: searchParams.get('type') || '',
        priceMin: searchParams.get('priceMin') || '',
        priceMax: searchParams.get('priceMax') || '',
        roomsMin: searchParams.get('roomsMin') || '',
        location: searchParams.get('location') || '', // Main location search
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
    const itemsPerPage = 6; // Adjust as needed for side-by-side layout

    const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]); // Default center
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
        setError(null);

        const commonParams = buildCommonParams();
        commonParams.append('page', pageToFetch);
        commonParams.append('limit', itemsPerPage);
        commonParams.append('sortBy', sort.sortBy);
        commonParams.append('sortOrder', sort.sortOrder);
        
        // Update URL search params for pagination, sort, and filters
        const newSearchParams = new URLSearchParams(commonParams); // commonParams already has filters
        setSearchParams(newSearchParams);


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
            setError('Failed to fetch listings. Please try again.');
        } finally {
            setLoadingList(false);
        }
    }, [pagination.currentPage, sort, filters, setSearchParams, itemsPerPage, buildCommonParams]); // Added buildCommonParams


    const fetchMapData = useCallback(async () => {
        setLoadingMap(true);
        // setError(null); // Error state is shared, clear it if re-fetching both

        const commonParams = buildCommonParams();
        // No pagination or sorting for map data, we want all relevant markers

        try {
            const response = await axios.get(`http://localhost:5000/api/listings/map-data?${commonParams.toString()}`);
            setMapData(response.data);
            // Optional: Adjust map center/zoom based on new mapData
            if (response.data.length > 0 && mapRef.current) {
                const validCoords = response.data.filter(l => l.latitude != null && l.longitude != null)
                                         .map(l => [parseFloat(l.latitude), parseFloat(l.longitude)]);
                if (validCoords.length > 0) {
                    const bounds = L.latLngBounds(validCoords);
                    if (bounds.isValid()) {
                        // mapRef.current.fitBounds(bounds, { padding: [50, 50] });
                        // Center on first result if location filter is active
                        if (filters.location && response.data[0]?.latitude && response.data[0]?.longitude) {
                            setMapCenter([parseFloat(response.data[0].latitude), parseFloat(response.data[0].longitude)]);
                            setMapZoom(12); // Zoom in a bit for city search
                        }
                    }
                } else if (filters.location) { // No results but location searched
                  // Potentially try to geocode filters.location and center map there
                  // For now, keep current map view or reset to default
                }
            } else if (!filters.location) { // No results and no specific location search
                // setMapCenter([40.7128, -74.0060]); // Reset to default if no results and no location
                // setMapZoom(5);
            }

        } catch (err) {
            console.error('Error fetching map data:', err);
            setError(prev => prev || 'Failed to load map data.'); // Don't overwrite list error
        } finally {
            setLoadingMap(false);
        }
    }, [filters, buildCommonParams]); // Added buildCommonParams

    // Initial fetch and re-fetch when filters or sort change
    useEffect(() => {
        fetchListData(1); // Reset to page 1 when filters/sort change
        fetchMapData();
    }, [filters, sort.sortBy, sort.sortOrder]); // Removed fetchListData, fetchMapData from deps as they cause loops with setSearchParams

    // Re-fetch list data when page changes
    useEffect(() => {
        fetchListData();
    }, [pagination.currentPage]); // Only trigger for actual page changes from pagination controls


    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleApplyFilters = () => { // This button now effectively triggers the useEffect above
        // setPagination(prev => ({ ...prev, currentPage: 1 })); // Done by fetchListData call in useEffect
        // fetchListData(1);
        // fetchMapData();
        // The useEffect for [filters, sort] will handle re-fetching.
        // To ensure URL updates immediately before fetch, you can manually set them
        const commonParams = buildCommonParams(); // Get current filters
        commonParams.set('page', '1'); // Reset page
        commonParams.set('sortBy', sort.sortBy);
        commonParams.set('sortOrder', sort.sortOrder);
        setSearchParams(commonParams); // This will trigger the useEffect
    };
    
    const handleResetFilters = () => {
        setFilters({ search: '', type: '', priceMin: '', priceMax: '', roomsMin: '', location: '' });
        setSort({ sortBy: 'created_at', sortOrder: 'DESC' });
        // setPagination(prev => ({ ...prev, currentPage: 1 })); // Done by fetchListData call in useEffect
        setSearchParams({ page: '1', sortBy: 'created_at', sortOrder: 'DESC' }); // This triggers useEffect
    };

    const handleSortChange = (e) => {
        const { name, value } = e.target;
        setSort(prev => ({ ...prev, [name]: value }));
        // setPagination(prev => ({ ...prev, currentPage: 1 })); // Done by fetchListData call in useEffect
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== pagination.currentPage) {
            setPagination(prev => ({ ...prev, currentPage: newPage }));
            // The useEffect for [pagination.currentPage] will handle fetching list data
        }
    };

    const handleListItemHover = (listingId) => {
        setHoveredListingId(listingId);
    };

    const isLoading = loadingList || loadingMap;

    return (
        <div className="flex flex-col h-screen">
            {/* Top Filter Bar */}
            <div className="bg-gray-100 p-3 shadow sticky top-0 z-10"> {/* Adjust top based on your header height if fixed */}
                <div className="container mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
                        {/* Location Search (Primary) */}
                        <div className="lg:col-span-1">
                            <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location</label>
                            <input
                                type="text" name="location" id="location" value={filters.location} onChange={handleFilterChange}
                                placeholder="e.g. Edmonton, New York"
                                className="mt-1 block w-full border-gray-300 rounded-sm shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                        </div>
                         {/* Type */}
                        <div>
                            <label htmlFor="type" className="block text-sm font-medium text-gray-700">Type</label>
                            <select name="type" id="type" value={filters.type} onChange={handleFilterChange} className="mt-1 block w-full p-2 border-gray-300 rounded-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                                <option value="">All Types</option><option value="rent">Rent</option><option value="sale">Sale</option>
                            </select>
                        </div>
                        {/* Price Range (Simplified to one column for this example) */}
                        <div className="flex space-x-2">
                            <div className="flex-1">
                                <label htmlFor="priceMin" className="block text-sm font-medium text-gray-700">Min Price</label>
                                <input type="number" name="priceMin" id="priceMin" value={filters.priceMin} onChange={handleFilterChange} placeholder="Any" className="mt-1 w-full p-2"/>
                            </div>
                            <div className="flex-1">
                                <label htmlFor="priceMax" className="block text-sm font-medium text-gray-700">Max Price</label>
                                <input type="number" name="priceMax" id="priceMax" value={filters.priceMax} onChange={handleFilterChange} placeholder="Any" className="mt-1 w-full p-2"/>
                            </div>
                        </div>
                         {/* Min Rooms */}
                        <div>
                            <label htmlFor="roomsMin" className="block text-sm font-medium text-gray-700">Min Rooms</label>
                            <input type="number" name="roomsMin" id="roomsMin" value={filters.roomsMin} onChange={handleFilterChange} min="0" placeholder="Any" className="mt-1 block w-full p-2"/>
                        </div>
                        {/* Search Keyword */}
                        <div>
                            <label htmlFor="search" className="block text-sm font-medium text-gray-700">Keyword</label>
                            <input type="text" name="search" id="search" value={filters.search} onChange={handleFilterChange} placeholder="e.g. cozy" className="mt-1 block w-full p-2"/>
                        </div>
                        {/* Action Buttons */}
                        <div className="flex space-x-2 items-end justify-self-start md:justify-self-auto pt-3 md:pt-0">
                             <button onClick={handleApplyFilters} className="bg-blue-500 text-white px-4 py-2 rounded-sm text-sm hover:bg-blue-600 h-full">Apply</button>
                             <button onClick={handleResetFilters} className="bg-gray-300 text-gray-700 px-4 py-2 rounded-sm text-sm hover:bg-gray-400 h-full">Reset</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content: Map and List */}
            <div className="flex-grow flex overflow-hidden"> {/* This flex container will hold map and list */}
                {/* Map Area */}
                <div className="w-3/5 xl:w-2/3 h-full relative"> {/* Adjust width as needed */}
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
                            >
                                <Tooltip>
                                    <strong>{listing.title}</strong><br />
                                    {listing.type === 'rent' ? `$${parseFloat(listing.price).toFixed(0)}/mo` : `$${parseFloat(listing.price).toFixed(0)}`}{listing.rooms ? ` - ${listing.rooms} rooms` : ''}
                                </Tooltip>
                                <Popup>
                                    <div className="w-48">
                                        {listing.photos && listing.photos.length > 0 && (
                                            <img src={`http://localhost:5000/uploads/${listing.photos[0]}`} alt={listing.title} className="w-full h-24 object-cover rounded-sm mb-2"/>
                                        )}
                                        <h3 className="font-semibold text-md mb-1 truncate">{listing.title}</h3>
                                        <p className="text-xs text-gray-600 mb-1 truncate">{listing.location}</p>
                                        <p className="text-sm font-bold text-gray-800 mb-2">
                                            {listing.type === 'rent' ? `$${parseFloat(listing.price).toFixed(0)}/month` : `$${parseFloat(listing.price).toFixed(0)}`}
                                        </p>
                                        <Link to={`/listings/${listing.id}`} target="_blank" rel="noopener noreferrer" className="block text-center text-sm bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-2 rounded-sm">
                                            View Details
                                        </Link>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                    {loadingMap && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded shadow-lg z-[1000]">Loading map data...</div>}
                </div>

                {/* Listings List Area */}
                <div className="w-2/5 xl:w-1/3 h-full overflow-y-auto p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-xl font-semibold text-gray-800">
                            {pagination.totalItems > 0 ? `${pagination.totalItems} Homes Found` : "Listings"}
                        </h2>
                        <div className="flex items-center space-x-2">
                            <label htmlFor="sortBy" className="text-sm">Sort:</label>
                            <select name="sortBy" value={sort.sortBy} onChange={handleSortChange} className="p-1 border rounded-sm text-sm">
                                <option value="created_at">Date</option><option value="price">Price</option><option value="rooms">Rooms</option>
                            </select>
                            <select name="sortOrder" value={sort.sortOrder} onChange={handleSortChange} className="p-1 border rounded-sm text-sm">
                                <option value="DESC">Desc</option><option value="ASC">Asc</option>
                            </select>
                        </div>
                    </div>

                    {loadingList && <div className="text-center py-10">Loading listings...</div>}
                    {error && <div className="text-center py-10 text-red-500">{error}</div>}
                    
                    {!loadingList && !error && listData.length === 0 && (
                        <div className="text-center py-10 text-gray-600">No listings match your current filters.</div>
                    )}

                    {!loadingList && !error && listData.length > 0 && (
                        <>
                            <div className="space-y-4">
                                {listData.map((listing) => (
                                    <div
                                        key={listing.id}
                                        className="bg-white rounded-sm shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer border-2 border-transparent hover:border-blue-500"
                                        onMouseEnter={() => handleListItemHover(listing.id)}
                                        onMouseLeave={() => handleListItemHover(null)}
                                    >
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
                                                        {listing.type === 'rent' ? `$${parseFloat(listing.price).toFixed(0)}/month` : `$${parseFloat(listing.price).toFixed(0)}`}
                                                    </p>
                                                    {listing.rooms !== null && (
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
                                    {/* Simplified pagination numbers */}
                                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (pagination.totalPages <= 5 || pagination.currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (pagination.currentPage >= pagination.totalPages - 2) {
                                            pageNum = pagination.totalPages - 4 + i;
                                        } else {
                                            pageNum = pagination.currentPage - 2 + i;
                                        }
                                        if (pageNum < 1 || pageNum > pagination.totalPages) return null;
                                        return (
                                        <button key={pageNum} onClick={() => handlePageChange(pageNum)} disabled={loadingList} className={`px-3 py-1 text-sm rounded-sm ${pagination.currentPage === pageNum ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                            {pageNum}
                                        </button>
                                        );
                                    })}
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