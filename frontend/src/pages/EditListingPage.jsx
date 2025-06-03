// frontend/src/pages/EditListingPage.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// Import the new map component
import ListingFormMap from '../components/ListingFormMap'; // <--- NEW IMPORT

// @dnd-kit imports for drag-and-drop photo reordering
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay, // For a smoother dragging visual
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy, // Or verticalListSortingStrategy / horizontalListSortingStrategy
} from '@dnd-kit/sortable';

// Import the reusable SortablePhotoItem component
import { SortablePhotoItem } from '../components/SortablePhotoItem'; // Adjust path if needed


// All Leaflet related imports, fixes, and components (L, MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, GeoSearchControl, OpenStreetMapProvider, LocationMarker, SearchField)
// were removed from here and are now encapsulated within ListingFormMap.jsx


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
    latitude: '', // Managed by map interaction, passed to map component
    longitude: '', // Managed by map interaction, passed to map component
    amenities: '',
    type: 'monthly-rental', // Default to new type
    status: '', // For admin to change status
  });

  // `displayPhotos` manages all photos (existing from server + newly added files)
  // Each item: { id: string, type: 'existing' | 'new', originalFilename?: string, file?: File, previewUrl: string }
  const [displayPhotos, setDisplayPhotos] = useState([]);
  const [activePhotoId, setActivePhotoId] = useState(null); // For DragOverlay

  // State for messages (loading, error, submission feedback)
  const [loading, setLoading] = useState(true); // For initial data fetch loading
  const [error, setError] = useState(null); // For initial data fetch errors
  const [submitting, setSubmitting] = useState(false); // For form submission loading
  const [submitError, setSubmitError] = useState(null); // For form submission errors
  const [submitSuccess, setSubmitSuccess] = useState(null); // For form submission success

  // Removed map related state (markerPosition, mapCenter, mapRef) as they are internal to ListingFormMap
  const newPhotoInputRef = useRef(null); // Ref to clear the file input

  const navigate = useNavigate();
  const { token, user } = useAuth(); // Get token and user info for auth/authz

  // Dnd-kit Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
          latitude: fetchedListing.latitude !== null ? fetchedListing.latitude.toString() : '', // Set latitude for map component
          longitude: fetchedListing.longitude !== null ? fetchedListing.longitude.toString() : '', // Set longitude for map component
          amenities: fetchedListing.amenities || '',
          type: fetchedListing.type || 'monthly-rental',
          status: fetchedListing.status || '', // Initialize status for admin
        });

        // Initialize displayPhotos with existing photos from the fetched listing
        const existingPhotos = Array.isArray(fetchedListing.photos) ? fetchedListing.photos : [];
        setDisplayPhotos(existingPhotos.map((filename, index) => ({
          id: `existing-${Date.now()}-${index}-${filename}`, // Create a unique ID for DND
          type: 'existing',
          originalFilename: filename, // Store original filename for server-side processing
          previewUrl: `http://localhost:5000/uploads/${filename}` // URL for displaying
        })));

        // Marker position and map center are now handled internally by ListingFormMap
        // based on initialLat/Lng props.
      } catch (err) {
        console.error('Error fetching listing for edit:', err);
        setError(err.response?.data?.message || 'Failed to fetch listing data.');
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
  }, [listingId, token]);

  // Effect to revoke object URLs for new photos when the component unmounts
  useEffect(() => {
    return () => {
      displayPhotos.forEach(photo => {
        if (photo.type === 'new' && photo.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(photo.previewUrl);
        }
      });
    };
  }, [displayPhotos]); // Added displayPhotos here to ensure cleanup on changes

  // Callback to receive latitude and longitude updates from the map component
  const handleMapLocationUpdate = useCallback((lat, lng) => {
    setFormData(prevFormData => ({
        ...prevFormData,
        latitude: lat.toFixed(7), // Update latitude form field with high precision
        longitude: lng.toFixed(7) // Update longitude form field with high precision
    }));
  }, []);

  // Callback to receive address string updates from the map component (e.g., from geocoding)
  const handleMapAddressUpdate = useCallback((address) => {
    setFormData(prevFormData => ({
        ...prevFormData,
        location: address // Update the address form field with the geocoded address
    }));
  }, []);


  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // Handle adding new file(s)
  const handleNewPhotosChange = (e) => {
    const files = Array.from(e.target.files);
    const newPhotoItems = files.map((file, index) => ({
      id: `new-${Date.now()}-${index}-${file.name}`, // Unique ID for DND
      type: 'new',
      file: file, // Store the actual File object
      previewUrl: URL.createObjectURL(file) // Create temporary URL for preview
    }));
    setDisplayPhotos(prevPhotos => [...prevPhotos, ...newPhotoItems]);
    if (newPhotoInputRef.current) newPhotoInputRef.current.value = ""; // Clear file input
  };

  // Handle removing a photo (existing or new)
  const handleRemovePhoto = (idToRemove) => {
    setDisplayPhotos(prevPhotos => {
      const photoToRemove = prevPhotos.find(p => p.id === idToRemove);
      if (photoToRemove && photoToRemove.type === 'new' && photoToRemove.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photoToRemove.previewUrl); // Revoke URL for new photos
      }
      return prevPhotos.filter(photo => photo.id !== idToRemove);
    });
  };

  // DND Handlers
  function handleDragStart(event) {
    setActivePhotoId(event.active.id); // Set the ID of the photo being dragged
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActivePhotoId(null); // Clear active item after drag ends

    if (over && active.id !== over.id) {
      setDisplayPhotos((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex); // Reorder photos array
      });
    }
  }
  function handleDragCancel() {
    setActivePhotoId(null); // Clear active item if drag is cancelled
  }


  // Handle form submission (Update Listing)
  const handleSubmit = async (e) => {
    e.preventDefault();

    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(true);

    const updateFormData = new FormData();
    Object.keys(formData).forEach(key => {
        // Only append status if it's explicitly set AND different from original for admin
        if (key === 'status' && user?.role === 'admin' && formData.status !== originalListing?.status) {
             updateFormData.append(key, formData[key]);
        } else if (key !== 'status') { // Always append other fields
            updateFormData.append(key, formData[key]);
        }
    });

    // Create a manifest of photo filenames/placeholders in their current order
    const photoManifest = displayPhotos.map(photo => {
      return photo.type === 'existing' ? photo.originalFilename : '__NEW_PHOTO__';
    });
    updateFormData.append('photoManifest', JSON.stringify(photoManifest));

    // Append actual new photo files
    displayPhotos.forEach(photo => {
      if (photo.type === 'new' && photo.file) {
        updateFormData.append('photos', photo.file); // 'photos' field for new files
      }
    });

    try {
      const response = await axios.put(`http://localhost:5000/api/listings/${listingId}`, updateFormData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setSubmitSuccess(response.data.message);
      console.log('Listing updated:', response.data.listing);

      // Clean up blob URLs for any new photos that were just uploaded
      displayPhotos.forEach(p => {
          if (p.type === 'new' && p.previewUrl.startsWith('blob:')) URL.revokeObjectURL(p.previewUrl);
      });

      // Update `displayPhotos` state with the new list of existing photos from the server
      const updatedListingFromServer = response.data.listing;
      setOriginalListing(prev => ({...prev, ...updatedListingFromServer })); // Update original listing with fresh data
      
      const serverPhotos = updatedListingFromServer.photos || [];
      setDisplayPhotos(serverPhotos.map((filename, index) => ({
        id: `updated-${Date.now()}-${index}-${filename}`, // Generate new IDs
        type: 'existing',
        originalFilename: filename,
        previewUrl: `http://localhost:5000/uploads/${filename}`
      })));

      setTimeout(() => {
       navigate('/manage-listings'); // Redirect after successful update
      }, 2000);

    } catch (err) {
      console.error('Error updating listing:', err);
      setSubmitError(err.response?.data?.message || 'Failed to update listing. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  // Conditional Rendering for initial fetch states
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

  // Find the photo currently being dragged for the DragOverlay
  const activePhotoForOverlay = activePhotoId ? displayPhotos.find(p => p.id === activePhotoId) : null;

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

          {/* Location / Address Input */}
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
          
          {/* Map Integration using ListingFormMap */}
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
                Update Property Location on Map (Click to place/move marker, use search bar)
            </label>
            <ListingFormMap
                initialLat={formData.latitude ? parseFloat(formData.latitude) : null} // Pass initial coordinates
                initialLng={formData.longitude ? parseFloat(formData.longitude) : null}
                onLocationUpdate={handleMapLocationUpdate} // Passes (lat, lng)
                onAddressUpdate={handleMapAddressUpdate} // Passes (addressLabel)
            />
            <p className="text-xs text-gray-600 mt-1">
                Selected Coordinates: Lat: {formData.latitude || "N/A"}, Lng: {formData.longitude || "N/A"}
            </p>
          </div>

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
              <option value="monthly-rental">Monthly Rental</option>
              <option value="daily-rental">Daily Rental</option>
            </select>
          </div>

          {/* Admin: Status update */}
          {user && user.role === 'admin' && originalListing && (
             <div className="mb-4 p-4 border border-orange-300 rounded-md bg-orange-50">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="status">
                    Listing Status (Admin Control)
                </label>
                <select
                    id="status"
                    name="status"
                    value={formData.status} // Controlled by formData.status
                    onChange={handleInputChange}
                    className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="rejected">Rejected</option>
                    <option value="archived">Archived</option>
                </select>
                <p className="text-xs text-gray-600 mt-1">Current status: {originalListing.status}. Change will apply on save.</p>
            </div>
          )}


          {/* Photos Section with @dnd-kit */}
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="new-photos-input">
              Photos (Drag to reorder, add new below)
            </label>
            <input
              ref={newPhotoInputRef} // Assign ref to clear input
              id="new-photos-input"
              type="file" multiple accept="image/*" onChange={handleNewPhotosChange}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-sm cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-4"
            />
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={displayPhotos.map(p => p.id)} strategy={rectSortingStrategy}>
                <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-sm min-h-[120px] bg-gray-50">
                  {displayPhotos.map((photo) => (
                    <SortablePhotoItem
                      key={photo.id}
                      id={photo.id}
                      photo={photo}
                      onRemove={handleRemovePhoto}
                      isExisting={photo.type === 'existing'} // Pass prop to differentiate existing vs. new
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activePhotoForOverlay ? (
                  <div className="relative w-32 h-32 border rounded-sm overflow-hidden shadow-xl bg-white">
                     <img src={activePhotoForOverlay.previewUrl} alt="Dragging preview" className="w-full h-full object-cover"/>
                     {/* Optional labels for drag overlay */}
                     {activePhotoForOverlay.type === 'existing' && <span className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-xs text-white text-center bg-gray-700 opacity-75">Saved</span>}
                     {activePhotoForOverlay.type === 'new' && <span className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-xs text-white text-center bg-blue-600 opacity-75">New</span>}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
             {displayPhotos.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">No photos for this listing. Add some new photos.</p>
            )}
          </div>
          {/* End of Photos Section */}

          <div className="flex items-center justify-center mt-6">
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