// frontend/src/pages/ListingDetail.jsx

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom'; // Hook to get URL parameters
import axios from 'axios'; // For fetching data
import Slider from 'react-slick'; 

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

        {/* Reviews Section (Placeholder) */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Reviews</h2>
          {/* Implement reviews display and form here later */}
          <div className="text-gray-700">Reviews section coming soon.</div>
        </div>

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