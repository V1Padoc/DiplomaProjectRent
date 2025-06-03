// frontend/src/pages/ListingsPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
// import axios from 'axios'; // Removed direct axios import
import apiClient from '../services/api'; // <--- IMPORT apiClient
import { Link, useSearchParams } from 'react-router-dom'; // useSearchParams for URL query management
import Slider from 'react-slick'; // For carousel
import "slick-carousel/slick/slick.css"; 
import "slick-carousel/slick/slick-theme.css";
import { HeartIcon as HeartOutline } from '@heroicons/react/24/outline'; // For favorites
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';     // For favorites
import { useAuth } from '../context/AuthContext'; // For favorites

function ListingsPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- State for filters, sorting, and pagination ---
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filter states from URL or defaults
   const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    type: searchParams.get('type') || '',
    priceMin: searchParams.get('priceMin') || '',
    priceMax: searchParams.get('priceMax') || '',
    roomsMin: searchParams.get('roomsMin') || '', // Ensure this is initialized
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
  const itemsPerPage = 9; // Adjusted for potentially larger cards
  // --- End of state ---

  const { isAuthenticated, favorites, toggleFavorite } = useAuth(); // For favorites


  // --- Function to fetch listings ---
  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Build query parameters string
    const params = new URLSearchParams();
    params.append('page', pagination.currentPage);
    params.append('limit', itemsPerPage);
    params.append('sortBy', sort.sortBy);
    params.append('sortOrder', sort.sortOrder);

    if (filters.search) params.append('search', filters.search);
    if (filters.type) params.append('type', filters.type);
    if (filters.priceMin) params.append('priceMin', filters.priceMin);
    if (filters.priceMax) params.append('priceMax', filters.priceMax);
    if (filters.roomsMin) params.append('roomsMin', filters.roomsMin);
    if (filters.location) params.append('location', filters.location);

    // Update URL search params
    setSearchParams(params);

    try {
      // OLD: const response = await axios.get(`http://localhost:5000/api/listings?${params.toString()}`);
      // NEW: Use apiClient.get, base URL is handled by apiClient.
      const response = await apiClient.get(`/listings?${params.toString()}`);
      setListings(response.data.listings);
      setPagination(prev => ({
        ...prev,
        totalPages: response.data.totalPages,
        totalItems: response.data.totalItems,
        currentPage: response.data.currentPage, // Ensure current page is updated from backend response
      }));
    } catch (err) {
      console.error('Error fetching listings:', err);
      setError('Failed to fetch listings. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, sort.sortBy, sort.sortOrder, filters, setSearchParams, itemsPerPage]); // Add itemsPerPage to dependencies if it can change

  useEffect(() => {
    fetchListings();
  }, [fetchListings]); // fetchListings is memoized by useCallback

  // --- Event Handlers ---
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to page 1 when filters change
    // fetchListings will be called by useEffect due to dependency change if not resetting page
    // If page is reset, useEffect will pick it up. Or call fetchListings() directly.
    // For simplicity with URL params, letting useEffect handle it is fine.
  };
  
  const handleResetFilters = () => {
    setFilters({
      search: '',
      type: '',
      priceMin: '',
      priceMax: '',
      roomsMin: '',
      location: '',
    });
    setSort({ sortBy: 'created_at', sortOrder: 'DESC' });
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setSearchParams({}); // Clear URL params
    // fetchListings(); // Or let useEffect trigger
  };


  const handleSortChange = (e) => {
    const { name, value } = e.target;
    setSort(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to page 1 on sort change
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: newPage }));
    }
  };
  // --- End of Event Handlers ---
  
  const sliderSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 4000, // Auto change every 4 seconds
  };

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Apartment Listings</h1>

      {/* --- Filter and Search Panel --- */}
      <div className="bg-gray-100 p-4 rounded-sm shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Search Keyword */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">Search Keyword</label>
            <input
              type="text"
              name="search"
              id="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="e.g. cozy, waterfront"
              className="mt-1 block w-full border-gray-300 rounded-sm shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          {/* Type */}
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700">Type</label>
            <select
              name="type"
              id="type"
              value={filters.type}
              onChange={handleFilterChange}
              className="mt-1 block w-full border-gray-300 rounded-sm shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">All Types</option>              
              <option value="monthly-rental">Monthly Rental</option>
              <option value="daily-rental">Daily Rental</option>
            </select>
          </div>
          {/* Location Search */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location</label>
            <input
              type="text"
              name="location"
              id="location"
              value={filters.location}
              onChange={handleFilterChange}
              placeholder="e.g. New York, Downtown"
              className="mt-1 block w-full border-gray-300 rounded-sm shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          {/* Min Rooms */}
          <div>
            <label htmlFor="roomsMin" className="block text-sm font-medium text-gray-700">Min. Rooms</label>
            <input
              type="number"
              name="roomsMin"
              id="roomsMin"
              value={filters.roomsMin}
              onChange={handleFilterChange}
              min="0"
              placeholder="e.g. 2"
              className="mt-1 block w-full border-gray-300 rounded-sm shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          {/* Price Range */}
          <div className="md:col-span-2 flex space-x-2">
            <div className="flex-1">
              <label htmlFor="priceMin" className="block text-sm font-medium text-gray-700">Min. Price</label>
              <input
                type="number"
                name="priceMin"
                id="priceMin"
                value={filters.priceMin}
                onChange={handleFilterChange}
                min="0"
                placeholder="e.g. 500"
                className="mt-1 block w-full border-gray-300 rounded-sm shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="priceMax" className="block text-sm font-medium text-gray-700">Max. Price</label>
              <input
                type="number"
                name="priceMax"
                id="priceMax"
                value={filters.priceMax}
                onChange={handleFilterChange}
                min="0"
                placeholder="e.g. 2000"
                className="mt-1 block w-full border-gray-300 rounded-sm shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex space-x-2">
            <button
              onClick={handleApplyFilters}
              className="bg-blue-500 text-white px-4 py-2 rounded-sm text-sm hover:bg-blue-600"
            >
              Apply Filters
            </button>
            <button
              onClick={handleResetFilters}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-sm text-sm hover:bg-gray-400"
            >
              Reset Filters
            </button>
          </div>
          {/* Sorting */}
          <div className="flex space-x-2 items-center">
            <label htmlFor="sortBy" className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              name="sortBy"
              id="sortBy"
              value={sort.sortBy}
              onChange={handleSortChange}
              className="border-gray-300 rounded-sm shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="created_at">Date Added</option>
              <option value="price">Price</option>
              <option value="rooms">Rooms</option>
              <option value="area">Area</option>
            </select>
            <select
              name="sortOrder"
              id="sortOrder"
              value={sort.sortOrder}
              onChange={handleSortChange}
              className="border-gray-300 rounded-sm shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="DESC">Descending</option>
              <option value="ASC">Ascending</option>
            </select>
          </div>
        </div>
      </div>
      {/* --- End of Filter Panel --- */}

      {loading && <div className="text-center text-gray-700">Loading listings...</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 text-center">{error}</div>}
      
      {!loading && !error && listings.length === 0 && (
        <div className="text-center text-gray-700">No listings found matching your criteria.</div>
      )}

      {!loading && !error && listings.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5"> {/* Reduced gap, potentially smaller cards */}
            {listings.map((listing) => (
              <div key={listing.id} className="bg-white rounded-sm shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200 h-full flex flex-col relative">
                {isAuthenticated && (
                    <button 
                        onClick={async (e) => { 
                            e.stopPropagation(); // Prevent link navigation
                            e.preventDefault(); // Prevent default button action (e.g., form submission if button type is submit)
                            await toggleFavorite(listing.id); 
                        }}
                        className="absolute top-2 right-2 z-10 p-1.5 bg-black bg-opacity-30 rounded-full text-white hover:bg-opacity-50 focus:outline-none"
                        aria-label={favorites.includes(String(listing.id)) ? "Remove from favorites" : "Add to favorites"} // Added aria-label
                    >
                        {/* MODIFIED LINE HERE: Convert listing.id to string for comparison */}
                        {favorites.includes(String(listing.id)) ? (
                            <HeartSolid className="w-5 h-5 text-red-400"/> 
                        ) : (
                            <HeartOutline className="w-5 h-5 text-white"/> // Explicitly set to white for unfavorited
                        )}
                    </button>
                )}
                <Link to={`/listings/${listing.id}`} className="block flex flex-col flex-grow"> {/* Ensure Link takes up space if div is flex container */}
                  {listing.photos && listing.photos.length > 0 ? (
                    <div className="w-full h-40 slick-carousel-container"> {/* Reduced height */}
                       <Slider {...sliderSettings}>
                            {listing.photos.map((photo, index) => (
                                <div key={index}>
                                    <img
                                      src={`http://localhost:5000/uploads/${photo}`}
                                      alt={`${listing.title} Photo ${index + 1}`}
                                      className="w-full h-40 object-cover" // Consistent height for slider images
                                    />
                                </div>
                            ))}
                        </Slider>
                    </div>
                  ) : (
                    <div className="w-full h-40 bg-gray-200 flex items-center justify-center text-gray-600 text-xs"> {/* Reduced height */}
                      No Image
                    </div>
                  )}
                  <div className="p-3 flex flex-col flex-grow"> {/* Reduced padding */}
                    <h3 className="text-md font-semibold mb-0.5 text-gray-800 truncate">{listing.title}</h3> {/* Truncate, smaller margin */}
                    <p className="text-gray-500 mb-1 text-xs truncate">{listing.location}</p> {/* Truncate, smaller size */}
                    <div className="mt-auto"> {/* Pushes price and rooms to the bottom */}
                      <div className="flex items-center justify-between text-gray-700">
                        <span className="text-sm font-bold"> {/* Smaller price */}
                          {listing.type === 'monthly-rental' ? `$${parseFloat(listing.price).toFixed(0)}/mo` :
                           (listing.type === 'daily-rental' ? `$${parseFloat(listing.price).toFixed(0)}/day` : `$${parseFloat(listing.price).toFixed(0)}`)}
                        </span>
                        {listing.rooms !== null && (
                          <span className="text-xs font-normal text-gray-500">{listing.rooms} {listing.rooms === 1 ? 'room' : 'rooms'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          {/* --- Pagination Controls --- */}
          {pagination.totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center space-x-2">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className="bg-gray-200 text-gray-800 px-3 py-1 rounded-sm hover:bg-gray-300 disabled:opacity-50"
              >
                Previous
              </button>
              {/* Display page numbers (simplified example) */}
              {[...Array(pagination.totalPages).keys()].map(num => (
                <button
                  key={num + 1}
                  onClick={() => handlePageChange(num + 1)}
                  className={`px-3 py-1 rounded-sm ${pagination.currentPage === num + 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                >
                  {num + 1}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="bg-gray-200 text-gray-800 px-3 py-1 rounded-sm hover:bg-gray-300 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
          {/* --- End of Pagination Controls --- */}
        </>
      )}
    </div>
  );
}

const slickArrowStyles = `
.slick-prev:before, .slick-next:before {
    color: black; /* Or your preferred color */
    opacity: 0.5;
}
.slick-dots li button:before {
    font-size: 8px; /* Smaller dots */
}`;

export default ListingsPage;