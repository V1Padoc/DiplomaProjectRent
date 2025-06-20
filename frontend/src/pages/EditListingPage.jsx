// frontend/src/pages/EditListingPage.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import api from '../api/api.js';
import { useAuth } from '../context/AuthContext';

// Leaflet Imports
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // Core Leaflet CSS
import L from 'leaflet'; // Leaflet library for icon fix

// Leaflet Geosearch for address search
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css'; // Geosearch CSS

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

// Leaflet icon fix (important for markers to display correctly)
// This is a common workaround for issues with Leaflet's default icon paths in Webpack environments.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});


// Component to handle map click events and display marker
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
                Місцезнаходження об'єкта: <br/> Шир: {position.lat.toFixed(6)}, Довг: {position.lng.toFixed(6)} <br/>
                Натисніть, щоб налаштувати.
            </Popup>
        </Marker>
    );
}

// Component for Address Search Control using Leaflet-Geosearch
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
            searchLabel: 'Введіть адресу, щоб знайти на карті...',
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


function EditListingPage() {
  const { id: listingId } = useParams();
  const [originalListing, setOriginalListing] = useState(null);
  const [formData, setFormData] = useState({
    title: '', description: '', price: '', rooms: '', area: '',
    location: '', latitude: '', longitude: '', amenities: '',
    type: 'monthly-rental', status: '',
  });
  const [displayPhotos, setDisplayPhotos] = useState([]); // Stores {id, type, file?, originalUrl?, previewUrl}
  const [activePhotoId, setActivePhotoId] = useState(null); // For DndContext DragOverlay
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [markerPosition, setMarkerPosition] = useState(null); // LatLng object for Leaflet marker
  const [mapCenter, setMapCenter] = useState([51.505, -0.09]); // Default map center (e.g., London)
  const mapRef = useRef(null); // Ref to access the Leaflet map instance
  const newPhotoInputRef = useRef(null); // Ref for hidden file input
  const photoDropZoneRef = useRef(null); // Ref for the styled drop zone

  const navigate = useNavigate();
  const { token, user } = useAuth();

  // Dnd-kit sensors configuration
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Drag starts after 5px movement
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Effect to fetch listing data when component mounts or listingId/token changes
  useEffect(() => {
    const fetchListingForEdit = async () => {
      try {
        setLoading(true); setError(null); setOriginalListing(null);
        const config = { headers: { 'Authorization': `Bearer ${token}` } };
        const response = await api.get(`/listings/${listingId}/edit`, config);
        const fetchedListing = response.data;
        setOriginalListing(fetchedListing); // Store original listing data
        
        // Populate form data
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
          type: fetchedListing.type || 'monthly-rental',
          status: fetchedListing.status || '',
        });

        // Initialize displayPhotos with existing photos from the fetched listing
        const existingPhotos = Array.isArray(fetchedListing.photos) ? fetchedListing.photos : [];
        setDisplayPhotos(existingPhotos.map((photoUrl, index) => ({
            id: `existing-${listingId}-${index}`, // More stable ID for existing photos
            type: 'existing', // Mark as existing
            originalUrl: photoUrl, // Store the full Cloudinary URL
            previewUrl: photoUrl // Use the same URL for display
        })));

        // Set initial map marker position and center
        if (fetchedListing.latitude && fetchedListing.longitude) {
            const initialPos = { lat: parseFloat(fetchedListing.latitude), lng: parseFloat(fetchedListing.longitude) };
            setMarkerPosition(initialPos);
            setMapCenter([initialPos.lat, initialPos.lng]); // Center map on listing location
        } else {
            setMarkerPosition(null); // No initial marker if no coordinates
        }
      } catch (err) {
        console.error('Помилка при отриманні оголошення для редагування:', err);
        setError(err.response?.data?.message || 'Не вдалося завантажити дані оголошення.');
      } finally { setLoading(false); }
    };
    
    // Fetch data only if listingId and token are available
    if (listingId && token) { fetchListingForEdit(); }
    else if (!token) { setLoading(false); setError('Відсутній токен автентифікації.'); }
  }, [listingId, token]); // Dependencies for this effect

  // Cleanup effect for new photo preview URLs (revokeObjectURL)
  useEffect(() => {
    return () => {
      displayPhotos.forEach(photo => {
        if (photo.type === 'new' && photo.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(photo.previewUrl); // Clean up Blob URLs to prevent memory leaks
        }
      });
    };
  // The dependency array is intentionally empty, or careful about `displayPhotos` changes.
  // If `displayPhotos` is a dependency, this cleanup will run *every* time displayPhotos changes,
  // potentially revoking URLs that are still in use by the UI. This is a common React pitfall.
  // A better approach often involves tracking 'old' photos to revoke their URLs or
  // only revoking when component unmounts. For this case, running only on unmount is safer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Callback to update marker position and form data for latitude/longitude
  const handleMapPositionChange = useCallback((latlng) => {
    setMarkerPosition(latlng);
    setFormData(prev => ({ ...prev, latitude: latlng.lat.toFixed(7), longitude: latlng.lng.toFixed(7) }));
  }, []); // No dependencies, as it only uses latlng directly

  // Callback to handle geocoding results from the search field
  const handleGeocodeResult = useCallback((latlng, addressLabel) => {
    handleMapPositionChange(latlng); // Update marker and lat/lng
    setFormData(prev => ({ ...prev, location: addressLabel })); // Update location text field
    if (mapRef.current) { 
        mapRef.current.flyTo(latlng, 15); // Fly map to result with a higher zoom level
    } else { 
        setMapCenter([latlng.lat, latlng.lng]); // If map ref not ready, just update center state
    }
  }, [handleMapPositionChange]); // Depends on handleMapPositionChange

  // Generic handler for form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handler for adding new photos from file input
  const handleNewPhotosChange = (e) => { 
    const files = Array.from(e.target.files);
    const newPhotoItems = files.map((file, index) => ({
      id: `new-${Date.now()}-${index}-${file.name.replace(/\s+/g, '-')}`, // Create unique ID for new photos
      type: 'new', // Mark as new
      file: file, // Store the actual file object
      previewUrl: URL.createObjectURL(file) // Create a temporary URL for preview
    }));
    setDisplayPhotos(prevPhotos => [...prevPhotos, ...newPhotoItems]);
    if (newPhotoInputRef.current) {
        newPhotoInputRef.current.value = ""; // Clear file input to allow re-selection of same file
    }
  };

  // Drag-and-drop handlers for the photo drop zone
  const handleDrop = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (photoDropZoneRef.current) {
      photoDropZoneRef.current.classList.remove('border-blue-500', 'bg-blue-50'); // Remove drag-over styles
    }
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const files = Array.from(event.dataTransfer.files);
      const newPhotoItems = files.map((file, index) => ({
        id: `new-drop-${Date.now()}-${index}-${file.name.replace(/\s+/g, '-')}`, 
        type: 'new',
        file: file,
        previewUrl: URL.createObjectURL(file)
      }));
      setDisplayPhotos(prevPhotos => [...prevPhotos, ...newPhotoItems]);
      event.dataTransfer.clearData(); // Clear dataTransfer to prevent default browser behavior
    }
  }, []); 

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (photoDropZoneRef.current) {
      photoDropZoneRef.current.classList.add('border-blue-500', 'bg-blue-50'); // Add drag-over styles
    }
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (photoDropZoneRef.current) {
      photoDropZoneRef.current.classList.remove('border-blue-500', 'bg-blue-50'); // Remove drag-over styles
    }
  }, []);

  // Handler for removing a photo from the display list
  const handleRemovePhoto = (idToRemove) => {
    setDisplayPhotos(prevPhotos => {
      const photoToRemove = prevPhotos.find(p => p.id === idToRemove);
      // Revoke Blob URL if it was a new photo to prevent memory leaks
      if (photoToRemove?.type === 'new' && photoToRemove.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photoToRemove.previewUrl);
      }
      return prevPhotos.filter(photo => photo.id !== idToRemove);
    });
  };

  // Dnd-kit handlers for drag and drop reordering
  function handleDragStart(event) { setActivePhotoId(event.active.id); }
  function handleDragEnd(event) {
    const { active, over } = event;
    setActivePhotoId(null); // Clear active photo ID for overlay
    if (over && active.id !== over.id) {
      setDisplayPhotos(items => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex); // Reorder photos in the array
      });
    }
  }
  function handleDragCancel() { setActivePhotoId(null); } // Clear active photo ID if drag is cancelled

  // Handler for form submission (updating listing)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null); setSubmitSuccess(null); setSubmitting(true);
    
    const updateFormData = new FormData();
    // Append form fields to FormData
    Object.keys(formData).forEach(key => {
        // Only allow admin to change status, otherwise it's handled by backend (set to pending)
        if (key === 'status' && user?.role === 'admin' && formData.status !== originalListing?.status) {
             updateFormData.append(key, formData[key]);
        } else if (key !== 'status') { // Always append other fields
            updateFormData.append(key, formData[key]);
        }
    });

    // Create photo manifest:
    // For existing photos, send their original Cloudinary URL.
    // For new photos, send a special marker `__NEW_PHOTO__`.
    const photoManifest = displayPhotos.map(p => p.type === 'existing' ? p.originalUrl : '__NEW_PHOTO__');
    updateFormData.append('photoManifest', JSON.stringify(photoManifest));

    // Append new files to FormData
    displayPhotos.forEach(p => { 
        if (p.type === 'new' && p.file) {
            updateFormData.append('photos', p.file); // 'photos' is the field name for multer
        }
    });

    try {
      const response = await api.put(`/listings/${listingId}`, updateFormData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setSubmitSuccess(response.data.message || "Оголошення успішно оновлено!");
      console.log('Оголошення оновлено:', response.data.listing);
      
      // Cleanup Blob URLs for new photos after successful upload
      displayPhotos.forEach(p => { if (p.type === 'new' && p.previewUrl.startsWith('blob:')) URL.revokeObjectURL(p.previewUrl); });
      
      // Update displayPhotos with the new list of photo URLs received from the server
      const updatedListingFromServer = response.data.listing;
      setOriginalListing(prev => ({...prev, ...updatedListingFromServer })); // Update original listing with new server data
      const serverPhotos = Array.isArray(updatedListingFromServer.photos) ? updatedListingFromServer.photos : [];
      setDisplayPhotos(serverPhotos.map((photoUrl, index) => ({
          id: `updated-${listingId}-${index}`, // Generate new stable IDs
          type: 'existing', // All photos are now existing
          originalUrl: photoUrl,
          previewUrl: photoUrl
      })));
      
      setTimeout(() => { navigate('/manage-listings'); }, 2500); // Redirect after a short delay
    } catch (err) {
      console.error('Помилка при оновленні оголошення:', err);
      setSubmitError(err.response?.data?.message || 'Не вдалося оновити оголошення. Будь ласка, спробуйте ще раз.');
      setTimeout(() => setSubmitError(null), 3000); // Clear error after 3 seconds
    } finally { setSubmitting(false); }
  };

  // Loading and Error states for the page
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-gray-700 p-10 text-center" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
        Завантаження даних оголошення...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-red-600 p-10 text-center" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
        Помилка: {error}
      </div>
    );
  }

  if (!originalListing) {
      // This state implies loading is done, but originalListing is still null (e.g., fetch failed without explicit error).
      return (
          <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-gray-700 p-10 text-center" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
              Дані оголошення недоступні.
          </div>
      );
  }

  // Find the active photo for DragOverlay based on its ID
  const activePhotoForOverlay = activePhotoId ? displayPhotos.find(p => p.id === activePhotoId) : null;

  return (
    <div className="relative flex size-full min-h-screen flex-col bg-slate-50" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
      <div className="px-4 sm:px-10 md:px-20 lg:px-40 flex flex-1 justify-center py-5">
        <div className="layout-content-container flex flex-col max-w-3xl w-full flex-1 bg-white shadow-xl rounded-lg p-6 md:p-8">
          <h1 className="text-[#0d151c] text-2xl sm:text-3xl font-bold leading-tight tracking-tight mb-8 text-center">Редагувати оголошення</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="title">Заголовок</label>
              <input id="title" type="text" placeholder="Назва оголошення" name="title" value={formData.title} onChange={handleInputChange} required
                className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]"/>
            </div>

            <div>
              <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="description">Опис</label>
              <textarea id="description" placeholder="Детальний опис об'єкта" name="description" value={formData.description} onChange={handleInputChange} rows="4"
                className="form-textarea w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]"></textarea>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
              <div>
                <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="price">Ціна</label>
                <input id="price" type="number" step="0.01" placeholder="напр. 1200.50" name="price" value={formData.price} onChange={handleInputChange} required
                  className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]"/>
              </div>
              <div>
                <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="type">Тип оголошення</label>
                <select id="type" name="type" value={formData.type} onChange={handleInputChange} required
                  className="form-select w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]">
                  <option value="monthly-rental">Щомісячна оренда</option>
                  <option value="daily-rental">Щоденна оренда</option>
                </select>
              </div>
              <div>
                <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="rooms">Кімнати (Спальні)</label>
                <input id="rooms" type="number" step="1" placeholder="напр. 3" name="rooms" value={formData.rooms} onChange={handleInputChange}
                  className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]"/>
              </div>
              <div>
                <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="area">Площа (м²)</label>
                <input id="area" type="number" step="0.01" placeholder="напр. 150.75" name="area" value={formData.area} onChange={handleInputChange}
                  className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]"/>
              </div>
            </div>

            <div>
                <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="location">Адреса / Опис місцезнаходження</label>
                <input id="location" type="text" placeholder="напр., вул. Головна, 123, Місто або використовуйте пошук на карті" name="location" value={formData.location} onChange={handleInputChange} required
                    className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]"/>
            </div>
          
            <div>
                <label className="block text-[#49749c] text-sm font-medium mb-2">Оновити місцезнаходження об'єкта на карті</label>
                <MapContainer center={mapCenter} zoom={markerPosition ? 15 : 13} scrollWheelZoom={true} style={{ height: '400px', width: '100%' }} className="rounded-lg border border-slate-300" whenCreated={mapInstance => { mapRef.current = mapInstance; }}>
                    <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                    <LocationMarker onPositionChange={handleMapPositionChange} initialPosition={markerPosition} />
                    <SearchField onLocationSelected={handleGeocodeResult} />
                </MapContainer>
                <p className="text-xs text-slate-500 mt-1">Вибрано: Шир: {formData.latitude || "Н/Д"}, Довг: {formData.longitude || "Н/Д"}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                <div>
                    <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="latitude">Широта (з карти)</label>
                    <input id="latitude" type="text" name="latitude" value={formData.latitude} readOnly placeholder="Встановлюється через карту"
                    className="form-input w-full rounded-lg border-[#cedce8] bg-slate-100 text-sm text-slate-700"/>
                </div>
                <div>
                    <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="longitude">Довгота (з карти)</label>
                    <input id="longitude" type="text" name="longitude" value={formData.longitude} readOnly placeholder="Встановлюється через карту"
                    className="form-input w-full rounded-lg border-[#cedce8] bg-slate-100 text-sm text-[#0d151c]"/>
                </div>
            </div>
            
            <div>
                <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="amenities">Зручності (через кому)</label>
                <input id="amenities" type="text" placeholder="напр., Парковка, Спортзал, Басейн" name="amenities" value={formData.amenities} onChange={handleInputChange}
                className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]"/>
            </div>

            {user && user.role === 'admin' && originalListing && (
             <div className="p-4 border border-orange-300 rounded-lg bg-orange-50">
                <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="status">
                    Статус оголошення (Контроль адміністратора)
                </label>
                <select
                    id="status" name="status" value={formData.status} onChange={handleInputChange}
                    className="form-select w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]"
                >
                    <option value="pending">На розгляді</option>
                    <option value="active">Активне</option>
                    <option value="rejected">Відхилено</option>
                    <option value="archived">В архіві</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Початковий статус: {originalListing.status}. Зміни будуть застосовані після збереження.</p>
            </div>
            )}

            <div>
                <label className="block text-[#49749c] text-sm font-medium mb-2">Фотографії (Перетягніть для зміни порядку)</label>
                <div
                    ref={photoDropZoneRef}
                    onClick={() => newPhotoInputRef.current?.click()} // Click hidden input on drop zone click
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[#dbe0e6] px-6 py-10 sm:py-14 mb-4 cursor-pointer hover:border-blue-400 transition-colors duration-150"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-[#111418] text-base sm:text-lg font-bold leading-tight tracking-tight max-w-[480px] text-center">Перетягніть фотографії сюди</p>
                    <p className="text-slate-600 text-sm font-normal leading-normal max-w-[480px] text-center">Або натисніть, щоб завантажити (Макс. 10МБ на фото)</p>
                </div>
                <input
                    ref={newPhotoInputRef}
                    id="new-photos-input-hidden" 
                    type="file" multiple accept="image/*" onChange={handleNewPhotosChange}
                    className="hidden" // Hidden input for file selection
                />
            
                {/* DndContext for drag-and-drop reordering of photos */}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
                    <SortableContext items={displayPhotos.map(p => p.id)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-2 border border-slate-200 rounded-lg min-h-[100px] bg-slate-50">
                        {displayPhotos.map((photo) => (
                            <SortablePhotoItem
                                key={photo.id} id={photo.id} photo={photo} onRemove={handleRemovePhoto}
                                isExisting={photo.type === 'existing'} // Pass prop to differentiate new/existing for styling
                            />
                        ))}
                        </div>
                    </SortableContext>
                    {/* DragOverlay for smooth dragging visual */}
                    <DragOverlay dropAnimation={null}>
                        {activePhotoForOverlay ? (
                        <div className="relative w-28 h-28 sm:w-32 sm:h-32 border rounded-md overflow-hidden shadow-2xl bg-white z-50">
                            <img src={activePhotoForOverlay.previewUrl} alt="Попередній перегляд перетягування" className="w-full h-full object-cover"/>
                            {activePhotoForOverlay.type === 'existing' && <span className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-xs text-white text-center bg-gray-700 opacity-75">Збережено</span>}
                            {activePhotoForOverlay.type === 'new' && <span className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-xs text-white text-center bg-blue-600 opacity-75">Нове</span>}
                        </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
                {displayPhotos.length === 0 && <p className="text-sm text-slate-500 mt-2">Немає фотографій для цього оголошення. Додайте нові фотографії.</p>}
            </div>

            <div className="mt-10 flex items-center justify-center">
                <button type="submit" disabled={submitting || loading}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-md text-base transition duration-150 ease-in-out disabled:opacity-70">
                {submitting ? 'Збереження...' : 'Зберегти зміни'}
                </button>
            </div>
          </form>

          {/* Messages for submission status */}
          {submitting && !submitSuccess && !submitError && <div className="mt-6 text-center text-blue-600 p-3 bg-blue-50 rounded-md">Збереження змін, будь ласка, зачекайте...</div>}
          {submitSuccess && <div className="mt-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md" role="alert"><p className="font-bold">Успіх!</p><p>{submitSuccess}</p></div>}
          {submitError && <div className="mt-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"><p className="font-bold">Помилка</p><p>{submitError}</p></div>}
          
        </div>
      </div>
      {/* Global CSS for form elements and Leaflet-Geosearch styling */}
      <style jsx global>{`
        .form-input, .form-textarea, .form-select { @apply shadow-sm; }
        .tracking-tight { letter-spacing: -0.025em; }
        /* Custom class for leaflet-geosearch bar to better fit the theme */
        .leaflet-control-geosearch.bar {
            border: 1px solid #cedce8 !important; /* Match form input border */
            border-radius: 0.5rem !important; /* rounded-lg */
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
        }
        .leaflet-control-geosearch.bar form input {
            height: 2.375rem !important; /* Match form input height (py-2 equivalent for text-sm) */
            padding-left: 0.75rem !important;
            padding-right: 0.75rem !important;
            font-size: 0.875rem !important; /* text-sm */
            color: #0d151c !important; /* text-[#0d151c] */
        }
        .leaflet-control-geosearch.bar form input:focus {
            border-color: #3b82f6 !important; /* focus:border-blue-500 */
            box-shadow: 0 0 0 1px #3b82f6 !important; /* focus:ring-1 focus:ring-blue-500 */
        }
        .leaflet-control-geosearch .results > * {
            font-size: 0.875rem !important;
            color: #0d151c !important;
        }
        .leaflet-control-geosearch .results > .active,
        .leaflet-control-geosearch .results > *:hover {
            background-color: #eff6ff !important; /* blue-50 for hover */
            color: #1d4ed8 !important; /* blue-700 for hover text */
        }
      `}</style>
    </div>
  );
}

export default EditListingPage;