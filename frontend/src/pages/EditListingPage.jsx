// frontend/src/pages/EditListingPage.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react'; // Added useRef, useCallback
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// *** NEW: Leaflet Imports ***
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // Core Leaflet CSS
import L from 'leaflet'; // Leaflet library for icon fix

// Leaflet Geosearch for address search
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css'; // Geosearch CSS

// *** Leaflet icon fix (important for markers to display correctly) ***
// This is a common workaround for issues with Leaflet's default icon paths in Webpack environments.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});
// *** END OF LEAFLET IMPORTS & ICON FIX ***


// *** NEW: Component to handle map click events and display marker ***
// This component listens for map clicks and updates the parent's position state.
function LocationMarker({ onPositionChange, initialPosition }) {
    const [position, setPosition] = useState(initialPosition);
    const map = useMapEvents({
        click(e) {
            map.flyTo(e.latlng, map.getZoom()); // Fly to clicked location
            setPosition(e.latlng); // Set marker position
            onPositionChange(e.latlng); // Pass latlng back to parent component
        },
    });

    // Effect to update marker position if initialPosition prop changes (e.g., from geocoding)
    useEffect(() => {
        // Only update if initialPosition is set and differs from current position
        if (initialPosition && (!position || initialPosition.lat !== position.lat || initialPosition.lng !== position.lng)) {
            setPosition(initialPosition);
            // Ensure map is ready before flying to to prevent errors during unmount/remount
            if (map) {
                map.flyTo(initialPosition, map.getZoom());
            }
        }
    }, [initialPosition, map, position]);

    return position === null ? null : (
        <Marker position={position}>
            <Popup>
                Property Location: <br/> Lat: {position.lat.toFixed(6)}, Lng: {position.lng.toFixed(6)} <br/>
                Click anywhere on the map to adjust.
            </Popup>
        </Marker>
    );
}
// *** END OF LocationMarker COMPONENT ***


// *** NEW: Component for Address Search Control using Leaflet-Geosearch ***
// This component adds a search bar to the map that finds addresses and updates the map.
const SearchField = ({ onLocationSelected }) => {
    const map = useMap(); // Access the Leaflet map instance

    useEffect(() => {
        const provider = new OpenStreetMapProvider(); // Using OpenStreetMap for geocoding
        const searchControl = new GeoSearchControl({
            provider: provider,
            style: 'bar', // Visual style of the search control ('bar' or 'button')
            showMarker: false, // We'll handle the marker ourselves via LocationMarker
            showPopup: false, // Don't show default popup
            autoClose: true, // Close search results panel after selection
            retainZoomLevel: false, // Do not keep current zoom level after search
            animateZoom: true, // Animate map movement to result
            keepResult: true, // Keep the search result text in the bar
            searchLabel: 'Enter address to find on map...',
        });

        map.addControl(searchControl); // Add the search control to the map

        // Listen to the geosearch result event
        map.on('geosearch/showlocation', (result) => {
            // result.location contains { x: longitude, y: latitude, label: address_string }
            const { y: lat, x: lng, label } = result.location;
            onLocationSelected({ lat, lng }, label); // Pass lat/lng and the full address label back
        });

        // Cleanup function: remove the control and event listener when component unmounts
        return () => {
            map.removeControl(searchControl);
            map.off('geosearch/showlocation');
        };
    }, [map, onLocationSelected]); // Rerun effect if map instance or callback changes

    return null; // This component doesn't render any visible JSX itself, it just adds a control to the map
};
// *** END OF SearchField COMPONENT ***


function EditListingPage() {
  // Get the 'id' parameter from the URL (the listing ID)
  const { id: listingId } = useParams(); // Renamed 'id' to 'listingId' for clarity

  // State for the original listing data fetched from the backend
  const [originalListing, setOriginalListing] = useState(null);

  // State for the form fields (initialized with original data after fetch)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    rooms: '',
    area: '',
    location: '', // This will now hold the address string
    latitude: '', // Managed by map interaction
    longitude: '', // Managed by map interaction
    amenities: '',
    type: 'rent',
    existingPhotos: [],
    newPhotos: []
  });

  // State for messages (loading, error, submission feedback)
  const [loading, setLoading] = useState(true); // For initial data fetch loading
  const [error, setError] = useState(null); // For initial data fetch errors
  const [submitting, setSubmitting] = useState(false); // For form submission loading
  const [submitError, setSubmitError] = useState(null); // For form submission errors
  const [submitSuccess, setSubmitSuccess] = useState(null); // For form submission success

  // *** NEW: Map related state ***
  const [markerPosition, setMarkerPosition] = useState(null); // { lat: number, lng: number }
  // Default map center (e.g., a general location or a default city like London)
  const [mapCenter, setMapCenter] = useState([51.505, -0.09]); // London coordinates
  const mapRef = useRef(null); // Ref to access the Leaflet map instance directly if needed

  const navigate = useNavigate();
  const { token, user } = useAuth(); // Get token and user info for auth/authz


  // --- Effect to fetch the listing data for editing ---
  useEffect(() => {
    const fetchListingForEdit = async () => {
      try {
        setLoading(true);
        setError(null);
        setOriginalListing(null); // Clear previous listing data

        const config = {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        };
        const response = await axios.get(`http://localhost:5000/api/listings/${listingId}/edit`, config);

        const fetchedListing = response.data;
        setOriginalListing(fetchedListing);

        // --- Initialize form state with fetched data ---
        setFormData({
          title: fetchedListing.title || '',
          description: fetchedListing.description || '',
          price: fetchedListing.price !== null ? fetchedListing.price.toString() : '',
          rooms: fetchedListing.rooms !== null ? fetchedListing.rooms.toString() : '',
          area: fetchedListing.area !== null ? fetchedListing.area.toString() : '',
          location: fetchedListing.location || '',
          latitude: fetchedListing.latitude !== null ? fetchedListing.latitude.toString() : '',
          longitude: fetchedListing.longitude !== null ? fetchedListing.longitude.toString() : '',
          amenities: fetchedListing.amenities || '',
          type: fetchedListing.type || 'rent',
          existingPhotos: Array.isArray(fetchedListing.photos) ? fetchedListing.photos : [],
          newPhotos: []
        });

        // *** NEW: Initialize map center and marker from fetched listing data ***
        if (fetchedListing.latitude && fetchedListing.longitude) {
            const initialPos = { lat: parseFloat(fetchedListing.latitude), lng: parseFloat(fetchedListing.longitude) };
            setMarkerPosition(initialPos); // Set marker position
            setMapCenter([initialPos.lat, initialPos.lng]); // Set map center
        } else {
            // If no coordinates in fetched listing, ensure marker is null (no marker shown initially)
            setMarkerPosition(null);
            // Keep default map center if no coordinates
        }
        // --- End of initializing form state & map state ---

        console.log('Listing data for editing fetched:', fetchedListing);

      } catch (err) {
        console.error('Error fetching listing for edit:', err);
        if (err.response) {
            if (err.response.status === 404) {
                 setError('Listing not found.');
            } else if (err.response.status === 403) {
                 setError('You do not have permission to edit this listing.');
            } else if (err.response.status === 401) {
                 setError('Authentication required to edit listing.');
            } else {
                 setError('Failed to fetch listing data for editing. Please try again.');
            }
        } else {
             setError('Network error while fetching listing data.');
        }
      } finally {
        setLoading(false);
      }
    };

    if (listingId && token) {
       fetchListingForEdit();
    } else if (!token) {
        setLoading(false);
        setError('Authentication token missing.');
    }
  }, [listingId, token, navigate]);


  // --- NEW: Callback for map position change ---
  const handleMapPositionChange = useCallback((latlng) => {
    setMarkerPosition(latlng); // Update the state that controls the marker
    setFormData(prevFormData => ({
        ...prevFormData,
        latitude: latlng.lat.toFixed(7), // Update latitude form field with high precision
        longitude: latlng.lng.toFixed(7) // Update longitude form field with high precision
    }));
  }, []);

  // --- NEW: Callback for geocode result (address search) ---
  const handleGeocodeResult = useCallback((latlng, addressLabel) => {
    handleMapPositionChange(latlng); // Update marker and lat/lng inputs
    setFormData(prevFormData => ({
        ...prevFormData,
        location: addressLabel // Update the address form field with the geocoded address
    }));
    // If mapRef is available, fly to the new location and zoom in
    if (mapRef.current) {
        mapRef.current.flyTo(latlng, 15); // Zoom level 15 is a good street-level zoom
    } else {
        // Fallback for initial render if mapRef isn't ready yet, set mapCenter for the first render
        setMapCenter([latlng.lat, latlng.lng]);
    }
  }, [handleMapPositionChange]);


  // --- Handle form input changes (existing) ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // --- Handle new file input change (existing) ---
  const handleNewPhotosChange = (e) => {
    setFormData({
      ...formData,
      newPhotos: [...formData.newPhotos, ...Array.from(e.target.files)]
    });
  };

  // --- Handle removing an existing photo (existing) ---
  const handleRemoveExistingPhoto = (filenameToRemove) => {
     setFormData({
       ...formData,
       existingPhotos: formData.existingPhotos.filter(filename => filename !== filenameToRemove)
     });
  };

   // --- Handle removing a newly selected photo before submission (existing) ---
   const handleRemoveNewPhoto = (indexToRemove) => {
       setFormData({
           ...formData,
           newPhotos: formData.newPhotos.filter((_, index) => index !== indexToRemove)
       });
   };


  // --- Handle form submission (Update Listing) (existing, but uses new formData fields) ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(true);

    const updateFormData = new FormData();
    Object.keys(formData).forEach(key => {
        if (key !== 'existingPhotos' && key !== 'newPhotos') {
            updateFormData.append(key, formData[key]);
        }
    });

    formData.existingPhotos.forEach(filename => {
        updateFormData.append('existingPhotos', filename);
    });

    formData.newPhotos.forEach(file => {
        updateFormData.append('photos', file);
    });

    try {
      const response = await axios.put(`http://localhost:5000/api/listings/${listingId}`, updateFormData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setSubmitSuccess(response.data.message);
      console.log('Listing updated:', response.data.listing);

      setTimeout(() => {
        navigate(`/listings/${listingId}`);
      }, 2000);

    } catch (err) {
      console.error('Error updating listing:', err);
      setSubmitError(err.response?.data?.message || 'Failed to update listing. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  // --- Conditional Rendering for initial fetch states (existing) ---
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

  if (!originalListing) {
      return (
          <div className="container mx-auto px-4 py-8 text-center text-gray-700 min-h-screen">
              Listing data not available.
          </div>
      );
  }

  // Render the edit form once data is loaded and user is authorized (handled by ProtectedRoute)
  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen">
      <div className="w-full max-w-3xl mx-auto bg-white p-8 rounded-sm shadow-sm"> {/* Increased max-width for map */}
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Edit Listing</h1>

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
              id="title" type="text" placeholder="Listing Title" name="title" value={formData.title} onChange={handleInputChange} required
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">Description</label>
            <textarea
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="description" placeholder="Detailed description of the property" name="description" value={formData.description} onChange={handleInputChange} rows="4"
            ></textarea>
          </div>

          {/* Price */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="price">Price</label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="price" type="number" step="0.01" placeholder="e.g. 1200.50 or 250000" name="price" value={formData.price} onChange={handleInputChange} required
            />
          </div>

          {/* Rooms, Area - Layout in a row */}
          <div className="mb-4 flex space-x-4">
            <div className="w-1/2">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="rooms">Rooms</label>
              <input
                className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="rooms" type="number" step="1" placeholder="e.g. 3" name="rooms" value={formData.rooms} onChange={handleInputChange}
              />
            </div>
            <div className="w-1/2">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="area">Area (sq ft / sq m)</label>
              <input
                className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="area" type="number" step="0.01" placeholder="e.g. 150.75" name="area" value={formData.area} onChange={handleInputChange}
              />
            </div>
          </div>

          {/* --- MODIFIED Location / Address Input --- */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="location">
                Address / Location Description
            </label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="location" type="text" placeholder="e.g., 123 Main St, City or use map search"
              name="location" value={formData.location} onChange={handleInputChange} required
            />
          </div>
          {/* --- END OF MODIFIED Location Input --- */}
          
          {/* --- NEW: MAP INTEGRATION --- */}
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
                Update Property Location on Map (Click to place/move marker, use search bar)
            </label>
            <MapContainer
                center={mapCenter} // Initial center, set from fetched data or default
                zoom={markerPosition ? 15 : 13} // Zoom in if marker exists, otherwise default
                scrollWheelZoom={true} // Allow zooming with mouse wheel
                style={{ height: '400px', width: '100%' }} // Fixed size for the map container
                className="rounded-sm border border-gray-300" // Add some styling
                whenCreated={mapInstance => { mapRef.current = mapInstance; }} // Get reference to the map instance
            >
                <TileLayer
                    attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" // OpenStreetMap tiles
                />
                {/* LocationMarker component handles clicks and displays the marker */}
                <LocationMarker onPositionChange={handleMapPositionChange} initialPosition={markerPosition} />
                {/* SearchField component adds the address search bar */}
                <SearchField onLocationSelected={handleGeocodeResult} />
            </MapContainer>
            <p className="text-xs text-gray-600 mt-1">
                Selected Coordinates: Lat: {formData.latitude || "N/A"}, Lng: {formData.longitude || "N/A"}
            </p>
          </div>
          {/* --- END OF MAP INTEGRATION --- */}

          {/* Latitude and Longitude Inputs (now read-only, populated by map) */}
          <div className="mb-4 flex space-x-4">
             <div className="w-1/2">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="latitude">Latitude (from map)</label>
                <input
                   className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 bg-gray-100 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                   id="latitude" type="text" name="latitude" value={formData.latitude} readOnly // Make read-only
                   placeholder="Click on map or search"
                />
             </div>
             <div className="w-1/2">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="longitude">Longitude (from map)</label>
                 <input
                   className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 bg-gray-100 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                   id="longitude" type="text" name="longitude" value={formData.longitude} readOnly // Make read-only
                   placeholder="Click on map or search"
                />
             </div>
          </div>
          
           {/* Amenities */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="amenities">Amenities (comma-separated)</label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="amenities" type="text" placeholder="e.g. Parking, Gym, Pool" name="amenities" value={formData.amenities} onChange={handleInputChange}
            />
          </div>

          {/* Type */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="type">Listing Type</label>
            <select
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="type" name="type" value={formData.type} onChange={handleInputChange} required
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
                               src={`http://localhost:5000/uploads/${filename}`}
                               alt={`Existing Photo ${index + 1}`}
                               className="w-full h-full object-cover"
                           />
                           {/* Button to remove existing photo */}
                           <button
                               type="button"
                                onClick={() => handleRemoveExistingPhoto(filename)}
                               className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 text-xs leading-none flex items-center justify-center w-5 h-5"
                           >
                               X
                           </button>
                       </div>
                   ))}
               </div>

               <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="newPhotos">Add New Photos</label>
                <input
                   className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                   id="newPhotos" type="file" multiple accept="image/*" onChange={handleNewPhotosChange}
                />
                {/* Optional: Display previews of newly selected photos */}
                 {formData.newPhotos.length > 0 && (
                    <div className="flex flex-wrap gap-4 mt-4">
                        {formData.newPhotos.map((file, index) => (
                             <div key={index} className="relative w-32 h-32 border border-gray-300 rounded-sm overflow-hidden">
                                 <img
                                     src={URL.createObjectURL(file)}
                                     alt={`New Photo ${file.name}`}
                                     className="w-full h-full object-cover"
                                     onLoad={() => URL.revokeObjectURL(file)} // Clean up the temporary URL after loading
                                 />
                                <button
                                    type="button"
                                     onClick={() => handleRemoveNewPhoto(index)}
                                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 text-xs leading-none flex items-center justify-center w-5 h-5"
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
              type="submit" disabled={submitting || loading}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditListingPage;