// frontend/src/pages/PublicProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; // Added useNavigate
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; // To know if current viewer is this profile's user

function PublicProfilePage() {
    const { userId } = useParams();
    const { user: currentUser, isAuthenticated } = useAuth(); // Added isAuthenticated
    const navigate = useNavigate(); // For programmatic navigation

    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get(`http://localhost:5000/api/users/public-profile/${userId}`);
                setProfileData(response.data);
            } catch (err) {
                console.error("Error fetching public profile:", err);
                setError(err.response?.data?.message || "Could not load profile.");
            } finally {
                setLoading(false);
            }
        };
        if (userId) {
            fetchProfile();
        }
    }, [userId]);

    if (loading) return <div className="container mx-auto px-4 py-8 text-center">Loading profile...</div>;
    if (error) return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error: {error}</div>;
    if (!profileData || !profileData.user) return <div className="container mx-auto px-4 py-8 text-center">Profile not found.</div>;

    const handleContactAboutListing = (listingId) => {
        if (!isAuthenticated) {
            // Redirect to login if user is not authenticated, pass along where to redirect after login
            navigate(`/login?redirect=/listings/${listingId}/chat`); 
        } else {
            // If authenticated, navigate directly to the chat page
            // The ChatPage component is smart enough to figure out the recipient (owner)
            navigate(`/listings/${listingId}/chat`);
        }
    };

    const { user: profileUser, listings: userListings } = profileData;

    return (
        <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen">
            <div className="max-w-3xl mx-auto bg-white p-8 rounded-sm shadow-md">
                <div className="flex flex-col items-center md:flex-row md:items-start md:space-x-6">
                    <img
                        src={profileUser.profile_photo_url ? `http://localhost:5000/uploads/profiles/${profileUser.profile_photo_url}` : 'https://via.placeholder.com/150'}
                        alt={profileUser.name || 'User profile'}
                        className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-2 border-gray-300 mb-4 md:mb-0"
                    />
                    <div className="text-center md:text-left flex-grow">
                        <h1 className="text-3xl font-bold text-gray-800">{profileUser.name || 'User'}</h1>
                        <p className="text-sm text-gray-500 mb-2">Joined: {new Date(profileUser.created_at).toLocaleDateString()}</p>
                        {currentUser && currentUser.id === profileUser.id && (
                            <Link 
                                to="/profile" 
                                className="text-sm text-blue-600 hover:underline"
                            >
                                Edit Your Profile
                            </Link>
                        )}
                    </div>
                </div>

                {profileUser.bio && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-700 mb-2">About {profileUser.name || 'Me'}</h2>
                        <p className="text-gray-600 whitespace-pre-wrap">{profileUser.bio}</p>
                    </div>
                )}

                {profileUser.role === 'owner' && userListings && userListings.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4">Listings by {profileUser.name || 'this User'}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {userListings.map(listing => (
                                <div key={listing.id} className="bg-gray-50 p-4 rounded-sm shadow-sm hover:shadow-md transition-shadow h-full flex flex-col justify-between">
                                    <div> {/* Wrapper for content before button */}
                                        <Link to={`/listings/${listing.id}`}>
                                            {listing.photos && listing.photos.length > 0 ? (
                                                <img 
                                                    src={`http://localhost:5000/uploads/${listing.photos[0]}`} 
                                                    alt={listing.title} 
                                                    className="w-full h-32 object-cover rounded-sm mb-2"
                                                />
                                            ) : (
                                                <div className="w-full h-32 bg-gray-200 flex items-center justify-center text-gray-500 rounded-sm mb-2">No Image</div>
                                            )}
                                            <h3 className="font-semibold text-blue-700 truncate hover:underline">{listing.title}</h3>
                                        </Link>
                                        <p className="text-sm text-gray-600 truncate">{listing.location}</p>
                                        <p className="text-sm font-bold text-gray-800">
                                            {listing.type === 'rent' ? `$${parseFloat(listing.price).toFixed(2)}/month` : `$${parseFloat(listing.price).toFixed(2)}`}
                                        </p>
                                    </div>
                                    {/* *** NEW: Contact button for each listing *** */}
                                    {/* Show button if viewer is authenticated AND is NOT the profile owner */}
                                    {isAuthenticated && currentUser?.id !== profileUser.id && (
                                        <button
                                            onClick={() => handleContactAboutListing(listing.id)}
                                            className="mt-3 w-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2 px-3 rounded-sm transition duration-150"
                                        >
                                            Contact about this listing
                                        </button>
                                    )}
                                     {!isAuthenticated && ( // Prompt to login if not authenticated
                                        <button
                                            onClick={() => handleContactAboutListing(listing.id)}
                                            className="mt-3 w-full bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm font-semibold py-2 px-3 rounded-sm transition duration-150"
                                        >
                                            Login to Contact
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* Placeholder for user reviews if you implement that */}
            </div>
        </div>
    );
}

export default PublicProfilePage;