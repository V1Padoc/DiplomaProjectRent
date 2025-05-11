// frontend/src/pages/CreateListingPage.jsx

import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // To get the token for authenticated request

function CreateListingPage() {
  // State for form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [rooms, setRooms] = useState('');
  const [area, setArea] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [amenities, setAmenities] = useState('');
  const [type, setType] = useState('rent'); // Default type to rent
  const [photos, setPhotos] = useState([]); // State to hold selected file objects

  // State for messages (error, success, loading)
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate(); // For redirection
  const { token, user } = useAuth(); // Get the token and user info from context

  // Optional: Redirect if user is not an owner (though ProtectedRoute handles access)
  // You could use this to display a message within the page if they somehow bypass ProtectedRoute
  // useEffect(() => {
  //     if (user && user.role !== 'owner') {
  //         // Optionally show a message or redirect
  //         console.warn("Non-owner user trying to access CreateListingPage");
  //         // navigate('/'); // Example redirection
  //     }
  // }, [user, navigate]);


  // Function to handle file input change
  const handleFileChange = (e) => {
    // e.target.files is a FileList object. Convert it to an array.
    setPhotos(Array.from(e.target.files));
  };

  // Function to handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');
    setSuccess('');
    setLoading(true);

    // Use FormData to send multipart/form-data (required for file uploads)
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('price', price); // Send as string, backend will parse
    formData.append('rooms', rooms); // Send as string, backend will parse
    formData.append('area', area);   // Send as string, backend will parse
    formData.append('location', location);
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
    formData.append('amenities', amenities);
    formData.append('type', type);
    // Append each selected photo file to the formData under the key 'photos'
    photos.forEach(photo => {
      formData.append('photos', photo); // 'photos' must match the field name in upload.array()
    });

    try {
      // Send the POST request to the backend
      const response = await axios.post('http://localhost:5000/api/listings', formData, {
        headers: {
          // Set the Content-Type header is usually handled automatically by axios when using FormData
          // 'Content-Type': 'multipart/form-data', // Axios sets this automatically with FormData
          'Authorization': `Bearer ${token}` // Include the JWT for authentication
        }
      });

      // If listing is created successfully
      setSuccess(response.data.message);
      console.log('Listing created:', response.data.listing);

      // Clear the form after successful submission (optional)
      setTitle('');
      setDescription('');
      setPrice('');
      setRooms('');
      setArea('');
      setLocation('');
      setAmenities('');
      setType('rent');
      setPhotos([]); // Clear selected files
      // You might want to provide user feedback that files are cleared or reset the input


      // Optional: Redirect to the user's listing management page after a delay
      setTimeout(() => {
         // Navigate to a hypothetical page showing the owner's listings
         // navigate('/my-listings'); // Assuming you have a route like this
         // For now, maybe navigate back to the listings catalog or homepage
         navigate('/listings');
      }, 2000); // Redirect after 2 seconds


    } catch (err) {
      console.error('Error creating listing:', err);
      // Display the error message from the backend response, or a generic message
      setError(err.response?.data?.message || 'Failed to create listing. Please try again.');
    } finally {
      setLoading(false); // Always set loading to false after request completes
    }
  };

  // Render null or a message if the user is not an owner (redundant if ProtectedRoute works, but safe)
  if (!user || user.role !== 'owner') {
      // This case should ideally be handled by ProtectedRoute redirecting to /login or /
       return (
            <div className="container mx-auto px-4 py-8 text-center text-red-600">
                You must be logged in as an owner to create listings.
            </div>
        );
  }


  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen"> {/* Consistent layout styling */}
      <div className="w-full max-w-2xl mx-auto bg-white p-8 rounded-sm shadow-sm"> {/* Form container with card styling */}
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Create New Listing</h1> {/* Styled heading */}

        {/* Display messages */}
        {loading && <div className="text-center text-blue-600 mb-4">Creating listing...</div>}
        {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{success}</div>}
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="title">Title</label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="title"
              type="text"
              placeholder="Listing Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="4" // Set number of rows for the textarea
            ></textarea>
          </div>

          {/* Price */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="price">Price</label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="price"
              type="number" // Use type number for numerical input
              step="0.01" // Allow decimals for price
              placeholder="e.g. 1200.50 or 250000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>

          {/* Rooms, Area - Layout in a row */}
          <div className="mb-4 flex space-x-4">
            <div className="w-1/2"> {/* Half width */}
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="rooms">Rooms</label>
              <input
                className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="rooms"
                type="number"
                step="1"
                placeholder="e.g. 3"
                value={rooms}
                onChange={(e) => setRooms(e.target.value)}
              />
            </div>
            <div className="w-1/2"> {/* Half width */}
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="area">Area (sq ft / sq m)</label>
              <input
                className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="area"
                type="number"
                step="0.01"
                placeholder="e.g. 150.75"
                value={area}
                onChange={(e) => setArea(e.target.value)}
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
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>
          
 {/* --- Add Latitude and Longitude Inputs --- */}
          <div className="mb-4 flex space-x-4">
             <div className="w-1/2"> {/* Half width */}
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="latitude">Latitude</label>
                <input
                   className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                   id="latitude"
                   type="number"
                   step="0.00000001" // Allow high precision decimals
                   placeholder="e.g. 34.0522"
                   value={latitude}
                   onChange={(e) => setLatitude(e.target.value)}
                   // Make required if map is essential, otherwise optional
                />
             </div>
             <div className="w-1/2"> {/* Half width */}
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="longitude">Longitude</label>
                 <input
                   className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                   id="longitude"
                   type="number"
                   step="0.00000001" // Allow high precision decimals
                   placeholder="e.g. -118.2437"
                   value={longitude}
                   onChange={(e) => setLongitude(e.target.value)}
                   // Make required if map is essential, otherwise optional
                />
             </div>
          </div>
          {/* --- End of Latitude and Longitude Inputs --- */}

           {/* Amenities */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="amenities">Amenities (comma-separated)</label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="amenities"
              type="text"
              placeholder="e.g. Parking, Gym, Pool"
              value={amenities}
              onChange={(e) => setAmenities(e.target.value)}
            />
          </div>

          {/* Type */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="type">Listing Type</label>
            <select
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              required
            >
              <option value="rent">Rent</option>
              <option value="sale">Sale</option>
            </select>
          </div>

          {/* Photos */}
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="photos">Photos</label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" // Styled file input
              id="photos"
              type="file"
              multiple // Allow multiple file selection
              accept="image/*" // Suggest image files
              onChange={handleFileChange}
              // 'required' should not be used with multiple files in a single input for basic HTML5 validation
              // You'd need custom validation if you require at least one file.
            />
            {/* Optional: Display selected file names */}
             {photos.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                    Selected files: {photos.map(file => file.name).join(', ')}
                </div>
             )}
          </div>


          {/* Submit Button */}
          <div className="flex items-center justify-center">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-sm focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
              type="submit"
              disabled={loading} // Disable button while loading
            >
              {loading ? 'Creating...' : 'Create Listing'} {/* Button text changes based on loading state */}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateListingPage;