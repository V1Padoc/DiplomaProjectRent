// frontend/src/pages/ListingDetail.jsx

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom'; // Hook to get URL parameters
import axios from 'axios'; // For fetching data
import Slider from 'react-slick'; 
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // Import Leaflet CSS
// Fix for default marker icon issue with Webpack/Create-React-App
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});


function ListingDetail() {
  // Get the 'id' parameter from the URL
  const { id } = useParams();

  // State to store the listing details
  const [listing, setListing] = useState(null);
  // State to manage loading status
  const [loading, setLoading] = useState(true);
  // State to manage potential errors
  const [error, setError] = useState(null);

  const [reviews, setReviews] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewError, setReviewError] = useState(null);
  const [newReviewRating, setNewReviewRating] = useState(5); // State for new review rating input
  const [newReviewComment, setNewReviewComment] = useState(''); // State for new review comment input
  const [reviewSubmitting, setReviewSubmitting] = useState(false); // State for review submission loading
  const [reviewSubmitError, setReviewSubmitError] = useState(null); // State for review submission error
  const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState(null); // State for review submission success
  // --- End of State for Reviews ---

    const { isAuthenticated, user, token } = useAuth();

  // useEffect hook to fetch data when the component mounts or the ID changes
  useEffect(() => {
    const fetchListing = async () => {
      try {
        setLoading(true);
        setError(null);

        // Make a GET request to your backend endpoint for a single listing
        const response = await axios.get(`http://localhost:5000/api/listings/${id}`);

        // Set the listing state with the data from the response
        setListing(response.data);
        console.log('Listing details fetched:', response.data); // Log fetched data

      } catch (err) {
        console.error('Error fetching listing details:', err);
        // Check if the error response status is 404
        if (err.response && err.response.status === 404) {
            setError('Listing not found or is not active.');
        } else {
            setError('Failed to fetch listing details. Please try again later.');
        }
      } finally {
        setLoading(false); // Set loading to false after fetch completes
      }
    };

    // Call the fetchListing function
    if (id) { // Only fetch if ID exists (should always exist for this route, but safe check)
       fetchListing();
    }
  }, [id]); // Dependency array: re-run effect if 'id' changes
// --- useEffect to fetch Reviews ---
  useEffect(() => {
      const fetchReviews = async () => {
          try {
              setReviewLoading(true);
              setReviewError(null);
               // Use the listing ID from useParams to fetch reviews
              const response = await axios.get(`http://localhost:5000/api/listings/${id}/reviews`);
              setReviews(response.data);
               console.log('Reviews fetched:', response.data); // Log fetched reviews
          } catch (err) {
              console.error('Error fetching reviews:', err);
              setReviewError('Failed to load reviews.');
          } finally {
              setReviewLoading(false);
          }
      };

      if (id) { // Fetch reviews only if listing ID is available
          fetchReviews();
      }
  }, [id]); // Re-fetch reviews if the listing ID changes
  // --- End of useEffect to fetch Reviews ---

   // --- Function to handle new review submission ---
  const handleReviewSubmit = async (e) => {
    e.preventDefault();

    setReviewSubmitError(null);
    setReviewSubmitSuccess(null);
    setReviewSubmitting(true);

    // Basic frontend validation (can add more)
    if (newReviewRating === null || newReviewRating < 1 || newReviewRating > 5) {
        setReviewSubmitError('Please select a rating between 1 and 5.');
        setReviewSubmitting(false);
        return;
    }

    try {
        // Send the POST request to the backend review endpoint
        const response = await axios.post(`http://localhost:5000/api/listings/${id}/reviews`,
            { // Request body
                rating: newReviewRating,
                comment: newReviewComment
            },
            { // Configuration object for headers
                headers: {
                    'Authorization': `Bearer ${token}` // Include the JWT from AuthContext
                }
            }
        );

        // If review is created successfully
        setReviewSubmitSuccess(response.data.message);
        console.log('Review submitted:', response.data.review);

        // Add the newly created review to the existing reviews state so it appears immediately
        // response.data.review contains the review with user details included by backend
        setReviews([response.data.review, ...reviews]); // Add new review to the top of the list

        // Clear the review form fields
        setNewReviewRating(5); // Reset rating to default
        setNewReviewComment(''); // Clear comment

    } catch (err) {
        console.error('Error submitting review:', err);
        setReviewSubmitError(err.response?.data?.message || 'Failed to submit review. Please try again.');
    } finally {
        setReviewSubmitting(false); // Always set submitting to false
    }
  };
  // --- End of Function to handle new review submission ---

  // Render loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-gray-700 min-h-screen">
        Loading listing details...
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-red-600 min-h-screen">
        Error: {error}
      </div>
    );
  }

  // Render not found state (should be covered by error, but an extra check)
  if (!listing) {
       // If not loading and no error, but listing is null, it wasn't found
       return (
           <div className="container mx-auto px-4 py-8 text-center text-gray-700 min-h-screen">
               Listing not found.
           </div>
       );
  }

const sliderSettings = {
    dots: true, // Show navigation dots
    infinite: true, // Loop the carousel
    speed: 500, // Transition speed
    slidesToShow: 1, // Show one slide at a time
    slidesToScroll: 1, // Scroll one slide at a time
    autoplay: true, // Auto-play the carousel
    autoplaySpeed: 3000, // Auto-play speed (in milliseconds)
    arrows: true, // Show navigation arrows
    // Add more settings as needed (e.g., responsive settings)
  };
  // --- End of slick settings --- 


  // Ensure listing and coordinates exist before trying to use them for the map
  const mapPosition = (listing && listing.latitude && listing.longitude)
    ? [parseFloat(listing.latitude), parseFloat(listing.longitude)] // Use listing coords
    : [51.505, -0.09]; // Default fallback position (e.g., London coordinates)


  // Render the listing details once data is loaded
  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen"> {/* Consistent background */}
      <div className="bg-white rounded-sm shadow-md overflow-hidden p-6 md:p-8"> {/* Card styling */}

        {/* Title and Price */}
        <div className="mb-6 pb-4 border-b border-gray-200">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{listing.title}</h1>
          <p className="text-2xl font-semibold text-blue-600">
            {listing.type === 'rent' ? `$${listing.price}/month` : `$${listing.price}`}
          </p>
        </div>

        {/* Photos Section (Placeholder for Carousel) */}
       <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Photos</h2>
          {/* Only render the slider if there are photos */}
          {listing.photos && listing.photos.length > 0 ? (
            <div className="w-full max-w-xl mx-auto"> {/* Optional: Limit carousel width and center */}
                 <Slider {...sliderSettings}> {/* Spread the settings object */}
                    {/* Map over the array of photo filenames */}
                    {listing.photos.map((photoFilename, index) => (
                        <div key={index}> {/* Use index as key if filenames aren't guaranteed unique */}
                            {/* Construct the full URL to the image on your backend */}
                            {/* This assumes your backend serves /uploads statically */}
                            <img
                                src={`http://localhost:5000/uploads/${photoFilename}`}
                                alt={`${listing.title} Photo ${index + 1}`}
                                className="w-full h-96 object-cover rounded-sm" // Styling for the image
                            />
                        </div>
                    ))}
                </Slider>
            </div>
          ) : (
            // Display "No Photos Available" if the photos array is empty or null
            <div className="w-full h-64 bg-gray-200 flex items-center justify-center text-gray-600 rounded-sm">
                No Photos Available
            </div>
          )}
        </div>
        {/* --- End of Photos Section --- */}

        {/* Description */}
        <div className="mb-6 pb-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Description</h2>
          <p className="text-gray-700 leading-relaxed">{listing.description || 'No description provided.'}</p>
        </div>

        {/* Key Details */}
        <div className="mb-6 pb-4 border-b border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Details</h3>
                <p className="text-gray-700"><strong>Type:</strong> {listing.type === 'rent' ? 'For Rent' : 'For Sale'}</p>
                {listing.rooms && <p className="text-gray-700"><strong>Rooms:</strong> {listing.rooms}</p>}
                {listing.area && <p className="text-gray-700"><strong>Area:</strong> {listing.area} sq ft/m²</p>}
                <p className="text-gray-700"><strong>Location:</strong> {listing.location}</p>
             </div>
             <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Amenities</h3>
                <p className="text-gray-700">{listing.amenities || 'No amenities listed.'}</p>
             </div>
        </div>

        {/* Owner Information */}
        {listing.Owner && (
             <div className="mb-6 pb-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800 mb-3">Contact Information</h2>
                <p className="text-gray-700"><strong>Owner:</strong> {listing.Owner.name || listing.Owner.email}</p>
                 {/* You will add a "Contact Owner" button here later linking to chat */}
             </div>
        )}


       {/* --- Map Section (Integrate Leaflet Map) --- */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Location on Map</h2>
           {/* Only render the map if coordinates are available */}
          {(listing && listing.latitude && listing.longitude) ? (
              // MapContainer needs a fixed height to display
              <MapContainer
                center={mapPosition} // Center the map on the listing's coordinates
                zoom={15} // Set the initial zoom level
                scrollWheelZoom={false} // Disable scroll wheel zoom
                className="w-full h-96 rounded-sm border border-gray-300" // Styling for the map container
              >
                {/* OpenStreetMap tiles */}
                <TileLayer
                  attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* Marker at the listing's location */}
                <Marker position={mapPosition}>
                  {/* Optional: Popup when clicking the marker */}
                  <Popup>
                    {listing.title} <br /> {listing.location}
                  </Popup>
                </Marker>
              </MapContainer>
           ) : (
              // Display a message if coordinates are not available
              <div className="w-full h-64 bg-gray-200 flex items-center justify-center text-gray-600 rounded-sm">
                 Location coordinates not available for map display.
              </div>
           )}
        </div>
        {/* --- End of Map Section --- */}

       {/* --- Reviews Section (Integrate Reviews Display and Form) --- */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Reviews</h2>

          {/* Review Submission Form (Visible only if authenticated) */}
          {isAuthenticated ? (
            <div className="bg-gray-50 p-4 rounded-sm mb-6"> {/* Form container styling */}
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Leave a Review</h3>

                {/* Display submission messages */}
                 {reviewSubmitting && <div className="text-center text-blue-600 mb-2">Submitting review...</div>}
                {reviewSubmitSuccess && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded relative mb-2 text-sm">{reviewSubmitSuccess}</div>}
                {reviewSubmitError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative mb-2 text-sm">{reviewSubmitError}</div>}


                <form onSubmit={handleReviewSubmit}>
                    {/* Rating Input */}
                    <div className="mb-3">
                         <label className="block text-gray-700 text-sm font-bold mb-1" htmlFor="rating">Rating (1-5)</label>
                         <input
                             className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                             id="rating"
                             type="number"
                             min="1"
                             max="5"
                             value={newReviewRating}
                             onChange={(e) => setNewReviewRating(parseInt(e.target.value, 10))} // Parse to integer
                             required
                         />
                    </div>

                    {/* Comment Input */}
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-1" htmlFor="comment">Comment (Optional)</label>
                        <textarea
                            className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            id="comment"
                            placeholder="Share your experience..."
                            value={newReviewComment}
                            onChange={(e) => setNewReviewComment(e.target.value)}
                            rows="3"
                        ></textarea>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end">
                         <button
                             className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-sm focus:outline-none focus:shadow-outline transition duration-150 ease-in-out text-sm"
                             type="submit"
                             disabled={reviewSubmitting} // Disable button while submitting
                         >
                             {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                         </button>
                    </div>
                </form>
            </div>
          ) : (
            // Message for unauthenticated users
            <div className="bg-gray-100 p-4 rounded-sm text-center text-gray-700 mb-6">
                Please log in to leave a review.
            </div>
          )}


          {/* Display Existing Reviews */}
           {reviewLoading && <div className="text-center text-gray-700">Loading reviews...</div>}
           {reviewError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 text-center">{reviewError}</div>}
           {!reviewLoading && !reviewError && reviews.length === 0 && (
               <div className="text-gray-700">No reviews yet. Be the first to leave one!</div>
           )}
           {!reviewLoading && !reviewError && reviews.length > 0 && (
               <div className="space-y-4"> {/* Add vertical space between reviews */}
                   {reviews.map(review => (
                       <div key={review.id} className="bg-gray-50 p-4 rounded-sm shadow-sm border border-gray-200"> {/* Individual review card styling */}
                           <div className="flex justify-between items-center mb-2">
                                <span className="font-semibold text-gray-800">{review.User?.name || review.User?.email || 'Anonymous'}</span> {/* Display reviewer name or email */}
                                <span className="text-sm text-gray-600">Rating: {review.rating}/5</span> {/* Display rating */}
                           </div>
                           <p className="text-gray-700 leading-snug">{review.comment || 'No comment provided.'}</p>
                           {/* Optional: Display review creation date */}
                           <div className="text-xs text-gray-500 mt-2">
                                Reviewed on: {new Date(review.createdAt).toLocaleDateString()}
                           </div>
                       </div>
                   ))}
               </div>
           )}
        </div>
        {/* --- End of Reviews Section --- */}

        {/* Contact Button (Placeholder) */}
         <div className="text-center">
             {/* You will add a button/link to the chat feature here */}
             <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-sm focus:outline-none focus:shadow-outline transition duration-150 ease-in-out">
                 Contact Owner (Coming Soon)
             </button>
         </div>


      </div>
    </div>
  );
}

export default ListingDetail;