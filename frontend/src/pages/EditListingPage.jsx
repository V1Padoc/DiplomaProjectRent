// frontend/src/pages/EditListingPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Import useParams and useNavigate
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; // To get the token and user info


function EditListingPage() {
  // Get the 'id' parameter from the URL (the listing ID)
  const { id } = useParams();

  // State for the original listing data fetched from the backend
  const [originalListing, setOriginalListing] = useState(null);

  // State for the form fields (initialized with original data after fetch)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    rooms: '',
    area: '',
    location: '',
    latitude: '', // Added latitude/longitude
    longitude: '', // Added latitude/longitude
    amenities: '',
    type: 'rent', // Default type
    existingPhotos: [], // Array of filenames of photos to keep
    newPhotos: [] // Array of File objects for new uploads
  });

  // State for messages (loading, error, submission feedback)
  const [loading, setLoading] = useState(true); // For initial data fetch loading
  const [error, setError] = useState(null); // For initial data fetch errors
  const [submitting, setSubmitting] = useState(false); // For form submission loading
  const [submitError, setSubmitError] = useState(null); // For form submission errors
  const [submitSuccess, setSubmitSuccess] = useState(null); // For form submission success

  const navigate = useNavigate(); // For redirection after saving
  const { token, user } = useAuth(); // Get token and user info for auth/authz


  // --- Effect to fetch the listing data for editing ---
  useEffect(() => {
    const fetchListingForEdit = async () => {
      try {
        setLoading(true);
        setError(null);
         setOriginalListing(null); // Clear previous listing data

        // Make a GET request to the backend endpoint for editing a listing
        // This route is protected, so include the Authorization header
        const config = {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        };
        const response = await axios.get(`http://localhost:5000/api/listings/${id}/edit`, config);

        const fetchedListing = response.data;
        setOriginalListing(fetchedListing); // Store original fetched data

        // --- Initialize form state with fetched data ---
        setFormData({
          title: fetchedListing.title || '',
          description: fetchedListing.description || '',
          price: fetchedListing.price !== null ? fetchedListing.price.toString() : '', // Convert Decimal to String for input
          rooms: fetchedListing.rooms !== null ? fetchedListing.rooms.toString() : '', // Convert Integer to String
          area: fetchedListing.area !== null ? fetchedListing.area.toString() : '', // Convert Decimal to String
          location: fetchedListing.location || '',
          latitude: fetchedListing.latitude !== null ? fetchedListing.latitude.toString() : '', // Convert Decimal to String
          longitude: fetchedListing.longitude !== null ? fetchedListing.longitude.toString() : '', // Convert Decimal to String
          amenities: fetchedListing.amenities || '',
          type: fetchedListing.type || 'rent',
          existingPhotos: Array.isArray(fetchedListing.photos) ? fetchedListing.photos : [], // Initialize with existing photo filenames
          newPhotos: [] // Start with no new photos
        });
        // --- End of initializing form state ---

        console.log('Listing data for editing fetched:', fetchedListing); // Log fetched data

      } catch (err) {
        console.error('Error fetching listing for edit:', err);
        // Check for 404 or 403 errors specifically
        if (err.response) {
            if (err.response.status === 404) {
                 setError('Listing not found.');
            } else if (err.response.status === 403) {
                 setError('You do not have permission to edit this listing.');
            } else if (err.response.status === 401) {
                 setError('Authentication required to edit listing.'); // Should be handled by ProtectedRoute, but safe fallback
            } else {
                 setError('Failed to fetch listing data for editing. Please try again.');
            }
        } else {
             setError('Network error while fetching listing data.');
        }
      } finally {
        setLoading(false); // Set loading to false after fetch completes
      }
    };

    // Fetch data only if ID and token are available
    if (id && token) {
       fetchListingForEdit();
    } else if (!token) {
        // This case should be handled by ProtectedRoute, but good practice
        setLoading(false);
        setError('Authentication token missing.');
    }
  }, [id, token, navigate]); // Dependency array: re-run effect if id, token, or navigate changes

  // --- Handle form input changes ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value // Update the corresponding field in formData state
    });
  };
  // --- End of handle input changes ---

  // --- Handle new file input change ---
  const handleNewPhotosChange = (e) => {
    // Add newly selected files to the newPhotos array state
    setFormData({
      ...formData,
      newPhotos: [...formData.newPhotos, ...Array.from(e.target.files)]
    });
     // Optional: Clear the file input value after selection if you want
     // e.target.value = null;
  };
  // --- End of handle new file input change ---

  // --- Handle removing an existing photo ---
  const handleRemoveExistingPhoto = (filenameToRemove) => {
     // Filter out the filename to remove from the existingPhotos array
     setFormData({
       ...formData,
       existingPhotos: formData.existingPhotos.filter(filename => filename !== filenameToRemove)
     });
  };
  // --- End of handle removing an existing photo ---

   // --- Handle removing a newly selected photo before submission ---
   const handleRemoveNewPhoto = (indexToRemove) => {
       // Filter out the photo by index from the newPhotos array
       setFormData({
           ...formData,
           newPhotos: formData.newPhotos.filter((_, index) => index !== indexToRemove)
       });
   };
  // --- End of handle removing a newly selected photo ---


  // --- Handle form submission (Update Listing) ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(true);

    // --- Prepare FormData for submission ---
    const updateFormData = new FormData();
    // Append text/number fields from formData state
    Object.keys(formData).forEach(key => {
        // Don't append the photo arrays directly here
        if (key !== 'existingPhotos' && key !== 'newPhotos') {
            updateFormData.append(key, formData[key]);
        }
    });

    // Append existing photos to keep (filenames array)
    formData.existingPhotos.forEach(filename => {
        updateFormData.append('existingPhotos', filename); // Backend expects this key
    });

    // Append new photo files
    formData.newPhotos.forEach(file => {
        updateFormData.append('photos', file); // Backend expects this key ('photos') for new uploads
    });
     // --- End of preparing FormData ---


    try {
      // Send the PUT request to the backend update endpoint
      const response = await axios.put(`http://localhost:5000/api/listings/${id}`, updateFormData, {
        headers: {
           // Axios usually sets Content-Type for FormData, but Authorization is needed
          'Authorization': `Bearer ${token}` // Include the JWT
        }
      });

      setSubmitSuccess(response.data.message);
      console.log('Listing updated:', response.data.listing);

      // Optional: Navigate to the listing detail page or management page after update
      setTimeout(() => {
        // Navigate to the updated listing's detail page
        navigate(`/listings/${id}`);
        // Or navigate to the owner's management page: navigate('/manage-listings');
      }, 2000); // Redirect after 2 seconds

    } catch (err) {
      console.error('Error updating listing:', err);
      setSubmitError(err.response?.data?.message || 'Failed to update listing. Please try again.');
    } finally {
      setSubmitting(false); // Always set submitting to false
    }
  };
  // --- End of Handle form submission ---


  // --- Conditional Rendering for initial fetch states ---
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-gray-700 min-h-screen">
        Loading listing data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-red-600 min-h-screen">
        Error: {error}
      </div>
    );
  }

  // If not loading and no error, but originalListing is null (shouldn't happen if 404 handled by error)
  if (!originalListing) {
      return (
          <div className="container mx-auto px-4 py-8 text-center text-gray-700 min-h-screen">
              Listing data not available.
          </div>
      );
  }
  // --- End of Conditional Rendering for initial fetch states ---


  // Render the edit form once data is loaded and user is authorized (handled by ProtectedRoute)
  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen"> {/* Consistent layout styling */}
      <div className="w-full max-w-2xl mx-auto bg-white p-8 rounded-sm shadow-sm"> {/* Form container with card styling */}
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Edit Listing</h1> {/* Styled heading */}

        {/* Display messages */}
        {submitting && <div className="text-center text-blue-600 mb-4">Saving changes...</div>}
        {submitSuccess && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{submitSuccess}</div>}
        {submitError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{submitError}</div>}

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="title">Title</label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="title"
              type="text"
              placeholder="Listing Title"
              name="title" // Add name attribute to match state key
              value={formData.title}
              onChange={handleInputChange} // Use generic handler
              required
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">Description</label>
            <textarea
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="description"
              placeholder="Detailed description of the property"
              name="description" // Add name attribute
              value={formData.description}
              onChange={handleInputChange} // Use generic handler
              rows="4"
            ></textarea>
          </div>

          {/* Price */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="price">Price</label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="price"
              type="number"
              step="0.01"
              placeholder="e.g. 1200.50 or 250000"
              name="price" // Add name attribute
              value={formData.price}
              onChange={handleInputChange} // Use generic handler
              required
            />
          </div>

          {/* Rooms, Area - Layout in a row */}
          <div className="mb-4 flex space-x-4">
            <div className="w-1/2">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="rooms">Rooms</label>
              <input
                className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="rooms"
                type="number"
                step="1"
                placeholder="e.g. 3"
                name="rooms" // Add name attribute
                value={formData.rooms}
                onChange={handleInputChange} // Use generic handler
              />
            </div>
            <div className="w-1/2">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="area">Area (sq ft / sq m)</label>
              <input
                className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="area"
                type="number"
                step="0.01"
                placeholder="e.g. 150.75"
                name="area" // Add name attribute
                value={formData.area}
                onChange={handleInputChange} // Use generic handler
              />
            </div>
          </div>


          {/* Location */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="location">Location</label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="location"
              type="text"
              placeholder="Address, City, State"
              name="location" // Add name attribute
              value={formData.location}
              onChange={handleInputChange} // Use generic handler
              required
            />
          </div>

           {/* Latitude and Longitude Inputs */}
          <div className="mb-4 flex space-x-4">
             <div className="w-1/2">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="latitude">Latitude</label>
                <input
                   className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                   id="latitude"
                   type="number"
                   step="0.00000001"
                   placeholder="e.g. 34.0522"
                   name="latitude" // Add name attribute
                   value={formData.latitude}
                   onChange={handleInputChange} // Use generic handler
                />
             </div>
             <div className="w-1/2">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="longitude">Longitude</label>
                 <input
                   className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                   id="longitude"
                   type="number"
                   step="0.00000001"
                   placeholder="e.g. -118.2437"
                   name="longitude" // Add name attribute
                   value={formData.longitude}
                   onChange={handleInputChange} // Use generic handler
                />
             </div>
          </div>

           {/* Amenities */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="amenities">Amenities (comma-separated)</label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="amenities"
              type="text"
              placeholder="e.g. Parking, Gym, Pool"
              name="amenities" // Add name attribute
              value={formData.amenities}
              onChange={handleInputChange} // Use generic handler
            />
          </div>

          {/* Type */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="type">Listing Type</label>
            <select
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="type"
              name="type" // Add name attribute
              value={formData.type}
              onChange={handleInputChange} // Use generic handler
              required
            >
              <option value="rent">Rent</option>
              <option value="sale">Sale</option>
            </select>
          </div>

          {/* Photos Section */}
           <div className="mb-6">
               <label className="block text-gray-700 text-sm font-bold mb-2">Current Photos</label>
               <div className="flex flex-wrap gap-4 mb-4">
                   {/* Display previews of existing photos */}
                   {formData.existingPhotos.map((filename, index) => (
                       <div key={filename} className="relative w-32 h-32 border border-gray-300 rounded-sm overflow-hidden">
                           <img
                               src={`http://localhost:5000/uploads/${filename}`} // URL to the image
                               alt={`Existing Photo ${index + 1}`}
                               className="w-full h-full object-cover"
                           />
                           {/* Button to remove existing photo */}
                           <button
                               type="button" // Important: type="button" to prevent form submission
                                onClick={() => handleRemoveExistingPhoto(filename)}
                               className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 text-xs"
                           >
                               X
                           </button>
                       </div>
                   ))}
               </div>

               <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="newPhotos">Add New Photos</label>
                <input
                   className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                   id="newPhotos"
                   type="file"
                   multiple
                   accept="image/*"
                   onChange={handleNewPhotosChange} // Use new photos handler
                />
                {/* Optional: Display previews of newly selected photos */}
                 {formData.newPhotos.length > 0 && (
                    <div className="flex flex-wrap gap-4 mt-4">
                        {formData.newPhotos.map((file, index) => (
                             <div key={index} className="relative w-32 h-32 border border-gray-300 rounded-sm overflow-hidden">
                                 {/* Use URL.createObjectURL to create a temporary URL for preview */}
                                 <img
                                     src={URL.createObjectURL(file)}
                                     alt={`New Photo ${index + 1}`}
                                     className="w-full h-full object-cover"
                                     onLoad={() => URL.revokeObjectURL(file)} // Clean up the temporary URL after loading
                                 />
                                 {/* Button to remove newly selected photo */}
                                <button
                                    type="button"
                                     onClick={() => handleRemoveNewPhoto(index)}
                                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 text-xs"
                                >
                                    X
                                </button>
                             </div>
                        ))}
                    </div>
                 )}
           </div>


          {/* Submit Button */}
          <div className="flex items-center justify-center">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-sm focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
              type="submit"
              disabled={submitting || loading} // Disable button while submitting or initial loading
            >
              {submitting ? 'Saving...' : 'Save Changes'} {/* Button text changes based on submitting state */}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditListingPage;