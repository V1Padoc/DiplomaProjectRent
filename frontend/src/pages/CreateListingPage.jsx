// frontend/src/pages/CreateListingPage.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react'; // Added useEffect, useRef, useCallback
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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
        if (initialPosition && (!position || initialPosition.lat !== position.lat || initialPosition.lng !== position.lng)) {
            setPosition(initialPosition);
            map.flyTo(initialPosition, map.getZoom());
        }
    }, [initialPosition, map, position]); // Depend on initialPosition, map, and internal position

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


function CreateListingPage() {
  // State for form fields (existing)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [rooms, setRooms] = useState('');
  const [area, setArea] = useState('');
  const [location, setLocation] = useState(''); // This will now hold the address string
  const [latitude, setLatitude] = useState(''); // Managed by map interaction
  const [longitude, setLongitude] = useState(''); // Managed by map interaction
  const [amenities, setAmenities] = useState('');
  const [type, setType] = useState('rent');
  const [photos, setPhotos] = useState([]);

  // State for messages (error, success, loading)
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // *** NEW: State for map and marker ***
  const [markerPosition, setMarkerPosition] = useState(null); // { lat: number, lng: number }
  // Default map center (e.g., a general location or a default city like London)
  const [mapCenter, setMapCenter] = useState([51.505, -0.09]); // London coordinates
  const mapRef = useRef(null); // Ref to access the Leaflet map instance directly if needed

  const fileInputRef = useRef(null); // Ref to clear file input after submission

  const navigate = useNavigate();
  const { token, user } = useAuth();

  // Optional: Redirect if user is not an owner (handled by ProtectedRoute generally)
  // Removed the useEffect for this as it's typically handled by a router guard.

  // Callback for when the map's marker position changes (via click or geocoding)
  const handleMapPositionChange = useCallback((latlng) => {
    setMarkerPosition(latlng); // Update the state that controls the marker
    setLatitude(latlng.lat.toFixed(7)); // Update latitude form field with high precision
    setLongitude(latlng.lng.toFixed(7)); // Update longitude form field with high precision
  }, []); // Dependencies are empty because the callback only depends on setMarkerPosition, setLatitude, setLongitude which are stable.

  // Callback for when an address is selected via the geosearch control
  const handleGeocodeResult = useCallback((latlng, addressLabel) => {
    handleMapPositionChange(latlng); // Update marker and lat/lng inputs
    setLocation(addressLabel); // Update the address form field with the geocoded address
    // If mapRef is available, fly to the new location and zoom in
    if (mapRef.current) {
        mapRef.current.flyTo(latlng, 15); // Zoom level 15 is a good street-level zoom
    } else {
        // Fallback for initial render if mapRef isn't ready yet, set mapCenter for the first render
        setMapCenter([latlng.lat, latlng.lng]);
    }
  }, [handleMapPositionChange]); // Depends on handleMapPositionChange

  // Function to handle file input change (existing)
  const handleFileChange = (e) => {
    setPhotos(Array.from(e.target.files));
  };

  // Function to handle form submission (modified to include map data)
  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');
    setSuccess('');
    setLoading(true);

    // Use FormData to send multipart/form-data (required for file uploads)
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('price', price);
    formData.append('rooms', rooms);
    formData.append('area', area);
    formData.append('location', location); // Send the address string
    formData.append('latitude', latitude);   // Send latitude from map
    formData.append('longitude', longitude); // Send longitude from map
    formData.append('amenities', amenities);
    formData.append('type', type);
    photos.forEach(photo => {
      formData.append('photos', photo); // 'photos' must match the field name in upload.array()
    });

    try {
      const response = await axios.post('http://localhost:5000/api/listings', formData, {
        headers: {
          'Authorization': `Bearer ${token}` // Include the JWT for authentication
        }
      });

      setSuccess(response.data.message);
      console.log('Listing created:', response.data.listing);

      // Clear the form after successful submission
      setTitle('');
      setDescription('');
      setPrice('');
      setRooms('');
      setArea('');
      setLocation('');
      setLatitude('');
      setLongitude('');
      setAmenities('');
      setType('rent');
      setPhotos([]); // Clear selected files array
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Clear the file input element visually
      }
      setMarkerPosition(null); // Clear the map marker

      // Optional: Redirect to a different page after a delay
      setTimeout(() => {
         navigate('/listings'); // Navigate to the main listings catalog
      }, 2000);

    } catch (err) {
      console.error('Error creating listing:', err);
      setError(err.response?.data?.message || 'Failed to create listing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render null or a message if the user is not an owner (redundant if ProtectedRoute works, but safe)
  if (!user || user.role !== 'owner') {
       return (
            <div className="container mx-auto px-4 py-8 text-center text-red-600">
                You must be logged in as an owner to create listings.
            </div>
        );
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen">
      <div className="w-full max-w-3xl mx-auto bg-white p-8 rounded-sm shadow-sm"> {/* Increased max-width for map */}
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Create New Listing</h1>

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
              id="title" type="text" placeholder="Listing Title" value={title} onChange={(e) => setTitle(e.target.value)} required
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">Description</label>
            <textarea
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="description" placeholder="Detailed description of the property" value={description} onChange={(e) => setDescription(e.target.value)} rows="4"
            ></textarea>
          </div>

          {/* Price */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="price">Price</label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="price" type="number" step="0.01" placeholder="e.g. 1200.50 or 250000" value={price} onChange={(e) => setPrice(e.target.value)} required
            />
          </div>

          {/* Rooms, Area - Layout in a row */}
          <div className="mb-4 flex space-x-4">
            <div className="w-1/2">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="rooms">Rooms</label>
              <input
                className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="rooms" type="number" step="1" placeholder="e.g. 3" value={rooms} onChange={(e) => setRooms(e.target.value)}
              />
            </div>
            <div className="w-1/2">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="area">Area (sq ft / sq m)</label>
              <input
                className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="area" type="number" step="0.01" placeholder="e.g. 150.75" value={area} onChange={(e) => setArea(e.target.value)}
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
              value={location} onChange={(e) => setLocation(e.target.value)} required
            />
          </div>
          {/* --- END OF MODIFIED Location Input --- */}
          
          {/* --- NEW: MAP INTEGRATION --- */}
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
                Set Property Location on Map (Click to place/move marker, use search bar)
            </label>
            <MapContainer
                center={mapCenter} // Initial center of the map
                zoom={13} // Initial zoom level
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
                Selected Coordinates: Lat: {latitude || "N/A"}, Lng: {longitude || "N/A"}
            </p>
          </div>
          {/* --- END OF MAP INTEGRATION --- */}

          {/* Latitude and Longitude Inputs (now read-only, populated by map) */}
          <div className="mb-4 flex space-x-4">
             <div className="w-1/2">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="latitude">Latitude (from map)</label>
                <input
                   className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 bg-gray-100 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                   id="latitude" type="text" value={latitude} readOnly // Make read-only
                   placeholder="Click on map or search"
                />
             </div>
             <div className="w-1/2">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="longitude">Longitude (from map)</label>
                 <input
                   className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 bg-gray-100 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                   id="longitude" type="text" value={longitude} readOnly // Make read-only
                   placeholder="Click on map or search"
                />
             </div>
          </div>
          
           {/* Amenities */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="amenities">Amenities (comma-separated)</label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="amenities" type="text" placeholder="e.g. Parking, Gym, Pool" value={amenities} onChange={(e) => setAmenities(e.target.value)}
            />
          </div>

          {/* Type */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="type">Listing Type</label>
            <select
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="type" value={type} onChange={(e) => setType(e.target.value)} required
            >
              <option value="rent">Rent</option>
              <option value="sale">Sale</option>
            </select>
          </div>

          {/* Photos */}
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="photos">Photos</label>
            <input
              ref={fileInputRef} // Assign the ref to the file input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              id="photos" type="file" multiple accept="image/*" onChange={handleFileChange}
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
              type="submit" disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateListingPage;