// frontend/src/pages/ManageListingsPage.jsx

import React, { useState, useEffect } from 'react';
// import axios from 'axios'; // Removed direct axios import
import apiClient from '../services/api'; // <--- IMPORT apiClient
import { Link } from 'react-router-dom'; // Import Link for navigation (e.g., to edit page)
import { useAuth } from '../context/AuthContext'; // Import useAuth to get the token

function ManageListingsPage() {
  // State to store the list of owner's listings
  const [ownerListings, setOwnerListings] = useState([]);
  // State to manage loading status
  const [loading, setLoading] = useState(true);
  // State to manage potential errors
  const [error, setError] = useState(null);

  const [deletingId, setDeletingId] = useState(null); // Track which listing is being deleted
  const [deleteError, setDeleteError] = useState(null); // Error message for deletion
  // --- End of state for delete actions ---

  const { token, user } = useAuth(); // Get the token and user from AuthContext



  // useEffect hook to fetch data when the component mounts (and token is available)
  useEffect(() => {
    const fetchOwnerListings = async () => {
      try {
        setLoading(true);
        setError(null);

        // Make a GET request to the backend endpoint for owner's listings
        // Replaced axios.get with apiClient.get. The Authorization header is now handled by the interceptor.
        const response = await apiClient.get('/listings/owner');

        // Set the ownerListings state with the data from the response
        setOwnerListings(response.data);
        console.log('Owner listings fetched:', response.data); // Log fetched data

      } catch (err) {
        console.error('Error fetching owner listings:', err);
        // Check for 401 Unauthorized specifically
        if (err.response && err.response.status === 401) {
             setError('Unauthorized: Please log in as an owner to view your listings.');
        } else {
             setError('Failed to fetch your listings. Please try again later.');
        }
      } finally {
        setLoading(false); // Set loading to false after fetch completes
      }
    };

    // Only fetch if the token is available (meaning the user is likely authenticated)
    // The ProtectedRoute ensures they are, but this is a good defensive check
    if (token) {
       fetchOwnerListings();
    } else {
        // This case should ideally not be reached due to ProtectedRoute
        setLoading(false);
        setError('Authentication token not found.');
    }
  }, [token]); // Dependency array: re-run effect if 'token' changes

  const handleDeleteListing = async (listingId) => {
    const isConfirmed = window.confirm('Are you sure you want to delete this listing? This action cannot be undone.');
    if (!isConfirmed) {
      return;
    }

    setDeletingId(listingId);
    setDeleteError(null);

    try {
      // Replaced axios.delete with apiClient.delete. The Authorization header is now handled by the interceptor.
      const response = await apiClient.delete(`/listings/${listingId}`);

      console.log('Delete successful:', response.data);

      setOwnerListings(ownerListings.filter(listing => listing.id !== listingId));

    } catch (err) {
      console.error('Error deleting listing:', err);
      setDeleteError(err.response?.data?.message || 'Failed to delete listing.');
    } finally {
      setDeletingId(null);
    }
  };
  // --- End of Function to handle listing deletion ---
  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen"> {/* Consistent layout styling */}
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">My Listings</h1> {/* Styled heading */}

       {/* Link to Create Listing Page (Optional but helpful) */}
        <div className="mb-6 text-center">
            <Link to="/create-listing" className="inline-block bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-sm focus:outline-none focus:shadow-outline transition duration-150 ease-in-out">
                + Create New Listing
            </Link>
        </div>


      {/* Display messages */}
      {loading && <div className="text-center text-gray-700">Loading your listings...</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 text-center">{error}</div>}


 {/* --- Display delete error message --- */}
      {deleteError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 text-center">{deleteError}</div>}
      {/* --- End of delete error message --- */}

      {/* Display a message if no listings are found */}
      {!loading && !error && ownerListings.length === 0 && (
        <div className="text-center text-gray-700">You haven't created any listings yet.</div>
      )}

      {/* Display the listings if loading is complete and no error */}
      {!loading && !error && ownerListings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"> {/* Responsive grid layout */}
          {ownerListings.map((listing) => (
            // Each listing card
            <div key={listing.id} className="bg-white rounded-sm shadow-md overflow-hidden border border-gray-200"> {/* Minimalistic card styling */}
               {/* Optional: Link to the listing detail page for viewing */}
               <Link to={`/listings/${listing.id}`} className="block hover:opacity-90 transition-opacity duration-200">
                    {/* Placeholder for Listing Image Thumbnail */}
                    {listing.photos && listing.photos.length > 0 ? (
                        // Display the first photo as a thumbnail
                        <img
                            src={`http://localhost:5000/uploads/${listing.photos[0]}`}
                            alt={`${listing.title} Thumbnail`}
                            className="w-full h-48 object-cover" // Styling for thumbnail image
                        />
                    ) : (
                        <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-600 text-sm">
                            No Image
                        </div>
                    )}
               </Link>


              <div className="p-4">
                <h3 className="text-xl font-semibold mb-1 text-gray-800">{listing.title}</h3>
                <p className="text-gray-600 mb-2 text-sm">{listing.location}</p>

                {/* Listing Status Badge */}
                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full mb-2 ${
                   listing.status === 'active' ? 'bg-green-100 text-green-800' :
                   listing.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                   listing.status === 'rejected' ? 'bg-red-100 text-red-800' :
                   'bg-gray-100 text-gray-800' // Default for other statuses
                }`}>
                   Status: {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)} {/* Capitalize first letter */}
                </span>

                {/* Price and Rooms (Optional Display) */}
                <div className="text-gray-700 text-lg font-bold mb-3">
                    <span>
                      {listing.type === 'monthly-rental' ? `$${parseFloat(listing.price).toFixed(2)}/month` : 
                       (listing.type === 'daily-rental' ? `$${parseFloat(listing.price).toFixed(2)}/day` : `$${parseFloat(listing.price).toFixed(2)}`)
                      }
                    </span>
                    <p className="text-xs text-gray-500 mt-1">Views: {listing.Analytics && listing.Analytics.length > 0 ? listing.Analytics[0].views_count : 0}</p>
                     {listing.rooms && (
                        <span className="text-sm font-normal text-gray-600 ml-2">{listing.rooms} {listing.rooms === 1 ? 'room' : 'rooms'}</span>
                    )}
                </div>

               {/* Actions: Edit and Delete Buttons */}
                <div className="flex space-x-4">
                   {/* --- Link to Edit Listing Page (Corrected) --- */}
                   <Link
                       // Change the 'to' prop to the new edit route format
                       to={`/manage-listings/edit/${listing.id}`} // Corrected URL
                       className="flex-1 text-center bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-sm transition duration-150 ease-in-out text-sm"
                   >
                       Edit
                   </Link>
                   {/* --- Delete Button (Make Functional) --- */}
                    <button
                       onClick={() => handleDeleteListing(listing.id)} // Call the delete handler
                       className={`flex-1 text-center bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-sm transition duration-150 ease-in-out text-sm ${deletingId === listing.id ? 'opacity-50 cursor-not-allowed' : ''}`} // Optional: Disable/style while deleting
                        disabled={deletingId === listing.id} // Disable button while deleting
                    >
                       {deletingId === listing.id ? 'Deleting...' : 'Delete'} {/* Change button text while deleting */}
                    </button>
                   {/* --- End of Delete Button --- */}
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ManageListingsPage;