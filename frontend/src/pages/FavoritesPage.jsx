// frontend/src/pages/FavoritesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
// import axios from 'axios'; // Removed direct axios import
import apiClient from '../services/api'; // <--- IMPORT apiClient
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';

function FavoritesPage() {
    const [favoriteListings, setFavoriteListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token, user, favorites, toggleFavorite } = useAuth(); // Use favorites from context

    const fetchFavorites = useCallback(async () => {
        if (!token) { // Although apiClient handles token, a direct check here is good for early exit/error.
            setError("Authentication required to view favorites.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // This endpoint needs to return an array of listing objects that are favorited by the user
            // Replaced axios.get with apiClient.get. The Authorization header is now handled by the interceptor.
            const response = await apiClient.get('/users/me/favorites');
            setFavoriteListings(response.data); // Expects an array of full listing objects
            console.log("Fetched favorite listings for page:", response.data); // Added/Updated line
        } catch (err) {
            console.error("Error fetching favorites:", err);
            setError(err.response?.data?.message || "Failed to load favorites.");
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchFavorites();
    }, [fetchFavorites]);

    const handleRemoveFavorite = async (listingId) => {
        await toggleFavorite(listingId); // This updates context and (ideally) backend using apiClient internally
        setFavoriteListings(prev => prev.filter(l => l.id !== listingId)); // Optimistic UI update
    };

    if (loading) return <div className="container mx-auto px-4 py-8 text-center">Loading your favorites...</div>;
    if (error) return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error: {error}</div>;

    return (
        <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">My Favorites</h1>

            {favoriteListings.length === 0 ? (
                <p className="text-center text-gray-600">You haven't favorited any listings yet. Start by browsing listings and clicking the heart icon!</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {favoriteListings.map((listing) => (
                        <div key={listing.id} className="bg-white rounded-sm shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200 relative">
                            <button 
                                onClick={() => handleRemoveFavorite(listing.id)}
                                className="absolute top-2 right-2 z-10 p-1.5 bg-black bg-opacity-30 rounded-full text-white hover:bg-opacity-50"
                                title="Remove from favorites"
                            >
                                <HeartSolid className="w-5 h-5 text-red-400"/>
                            </button>
                            <Link to={`/listings/${listing.id}`} className="block">
                                {listing.photos && listing.photos.length > 0 ? (
                                    <img src={`http://localhost:5000/uploads/${listing.photos[0]}`} alt={listing.title} className="w-full h-48 object-cover" />
                                ) : (
                                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500">No Image</div>
                                )}
                                <div className="p-4">
                                    <h3 className="text-lg font-semibold text-gray-800 truncate">{listing.title}</h3>
                                    <p className="text-sm text-gray-600 truncate">{listing.location}</p>
                                    <p className="text-md font-bold text-gray-700 mt-1">
                                        {listing.type === 'monthly-rental' ? `$${parseFloat(listing.price).toFixed(0)}/mo` :
                                         (listing.type === 'daily-rental' ? `$${parseFloat(listing.price).toFixed(0)}/day` : `$${parseFloat(listing.price).toFixed(0)}`)}
                                    </p>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default FavoritesPage;