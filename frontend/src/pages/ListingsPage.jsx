// frontend/src/pages/ListingsPage.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Import axios for fetching data
import { Link } from 'react-router-dom'; // Import Link for navigation (to individual listing pages later)

function ListingsPage() {
  // State to store the list of listings
  const [listings, setListings] = useState([]);
  // State to manage loading status
  const [loading, setLoading] = useState(true);
  // State to manage potential errors
  const [error, setError] = useState(null);

  // useEffect hook to fetch data when the component mounts
  useEffect(() => {
    const fetchListings = async () => {
      try {
        // Set loading to true before starting the fetch
        setLoading(true);
        setError(null); // Clear previous errors

        // Make a GET request to your backend listings endpoint
        const response = await axios.get('http://localhost:5000/api/listings');

        // Set the listings state with the data from the response
        setListings(response.data);
        console.log('Listings fetched:', response.data); // Log fetched data

      } catch (err) {
        // If there's an error during the fetch
        console.error('Error fetching listings:', err);
        setError('Failed to fetch listings. Please try again later.'); // Set error state

      } finally {
        // Set loading to false regardless of success or failure
        setLoading(false);
      }
    };

    // Call the fetchListings function when the component mounts
    fetchListings();
  }, []); // The empty dependency array ensures this effect runs only once on mount

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen"> {/* Added minimalistic background */}
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Apartment Listings</h1> {/* Styled heading */}

      {/* Display loading message while fetching */}
      {loading && <div className="text-center text-gray-700">Loading listings...</div>}

      {/* Display error message if fetching failed */}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 text-center">{error}</div>}

      {/* Display a message if no listings are found after loading */}
      {!loading && !error && listings.length === 0 && (
        <div className="text-center text-gray-700">No active listings found at the moment.</div>
      )}

      {/* Display the listings if loading is complete and no error */}
      {!loading && !error && listings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"> {/* Responsive grid layout */}
          {/* Map over the listings array and render each listing */}
          {listings.map((listing) => (
            // Use Link to make the listing card clickable to a detail page (route will be added later)
            // Use the listing.id for a unique key and part of the URL
            <Link to={`/listings/${listing.id}`} key={listing.id} className="block"> {/* Link makes the whole card clickable */}
              <div className="bg-white rounded-sm shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200"> {/* Minimalistic card styling */}
                {/* Placeholder for Listing Image */}
                {/* You would replace this with an actual image tag using the listing's photo path */}
                <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-600">
                    {/* If you have a 'photos' column and serve images, use an img tag here */}
                    {/* <img src={`http://localhost:5000/uploads/${listing.photos[0]}`} alt={listing.title} className="w-full h-full object-cover"/> */}
                    No Image Available
                </div>

                <div className="p-4">
                  <h3 className="text-xl font-semibold mb-1 text-gray-800">{listing.title}</h3>
                  <p className="text-gray-600 mb-2">{listing.location}</p>
                  <div className="flex items-center justify-between text-gray-700 text-lg font-bold">
                    <span>
                      {listing.type === 'rent' ? `$${listing.price}/month` : `$${listing.price}`}
                    </span>
                    {listing.rooms && (
                        <span className="text-sm font-normal text-gray-600">{listing.rooms} {listing.rooms === 1 ? 'room' : 'rooms'}</span>
                    )}
                  </div>
                  {/* Display other relevant listing details here (area, amenities etc.) */}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ListingsPage;