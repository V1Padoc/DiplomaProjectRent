// frontend/src/pages/CreateListingPage.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import api from '../api/api.js';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Leaflet Imports
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet Geosearch
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css';

// @dnd-kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';

import { SortablePhotoItem } from '../components/SortablePhotoItem';

// Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function LocationMarker({ onPositionChange, initialPosition }) {
    const [position, setPosition] = useState(initialPosition);
    const map = useMapEvents({
        click(e) {
            map.flyTo(e.latlng, map.getZoom());
            setPosition(e.latlng);
            onPositionChange(e.latlng);
        },
    });

    useEffect(() => {
        if (initialPosition && (!position || initialPosition.lat !== position.lat || initialPosition.lng !== position.lng)) {
            setPosition(initialPosition);
            if (map) map.flyTo(initialPosition, map.getZoom());
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

const SearchField = ({ onLocationSelected }) => {
    const map = useMap();
    useEffect(() => {
        const provider = new OpenStreetMapProvider();
        const searchControl = new GeoSearchControl({
            provider: provider, style: 'bar', showMarker: false, showPopup: false,
            autoClose: true, retainZoomLevel: false, animateZoom: true, keepResult: true,
            searchLabel: 'Введіть адресу...', // Translated
        });
        map.addControl(searchControl);
        map.on('geosearch/showlocation', (result) => {
            const { y: lat, x: lng, label } = result.location;
            onLocationSelected({ lat, lng }, label);
        });
        return () => { map.removeControl(searchControl); map.off('geosearch/showlocation'); };
    }, [map, onLocationSelected]);
    return null;
};


function CreateListingPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [rooms, setRooms] = useState('');
  const [area, setArea] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [amenities, setAmenities] = useState('');
  const [type, setType] = useState('monthly-rental');
  const [photos, setPhotos] = useState([]);
  const [activePhotoId, setActivePhotoId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [mapCenter, setMapCenter] = useState([51.505, -0.09]);
  const mapRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoDropZoneRef = useRef(null); // Ref for the styled drop zone

  const navigate = useNavigate();
  const { token, user } = useAuth();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleMapPositionChange = useCallback((latlng) => {
    setMarkerPosition(latlng);
    setLatitude(latlng.lat.toFixed(7));
    setLongitude(latlng.lng.toFixed(7));
  }, []);

  const handleGeocodeResult = useCallback((latlng, addressLabel) => {
    handleMapPositionChange(latlng);
    setLocation(addressLabel);
    if (mapRef.current) {
        mapRef.current.flyTo(latlng, 15);
    } else {
        setMapCenter([latlng.lat, latlng.lng]);
    }
  }, [handleMapPositionChange]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map((file) => ({
      id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${file.name}`,
      file: file,
      previewUrl: URL.createObjectURL(file)
    }));
    setPhotos(prevPhotos => [...prevPhotos, ...newPhotos]);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const handleDrop = useCallback((event) => { // Handle drop event for styled zone
    event.preventDefault();
    event.stopPropagation();
    photoDropZoneRef.current.classList.remove('border-blue-500', 'bg-blue-50'); // Remove active styling
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const files = Array.from(event.dataTransfer.files);
        const newPhotos = files.map((file) => ({
            id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${file.name}`,
            file: file,
            previewUrl: URL.createObjectURL(file)
        }));
        setPhotos(prevPhotos => [...prevPhotos, ...newPhotos]);
        event.dataTransfer.clearData();
    }
  }, []);

  const handleDragOver = useCallback((event) => { // Handle drag over for styled zone
    event.preventDefault();
    event.stopPropagation();
    photoDropZoneRef.current.classList.add('border-blue-500', 'bg-blue-50'); // Add active styling
  }, []);

  const handleDragLeave = useCallback((event) => { // Handle drag leave for styled zone
    event.preventDefault();
    event.stopPropagation();
    photoDropZoneRef.current.classList.remove('border-blue-500', 'bg-blue-50'); // Remove active styling
  }, []);


  const handleRemovePhoto = (idToRemove) => {
    setPhotos(prevPhotos => {
      const photoToRemove = prevPhotos.find(p => p.id === idToRemove);
      if (photoToRemove) URL.revokeObjectURL(photoToRemove.previewUrl);
      return prevPhotos.filter(photo => photo.id !== idToRemove);
    });
  };

  function handleDragStart(event) { setActivePhotoId(event.active.id); }
  function handleDragEnd(event) {
    const { active, over } = event;
    setActivePhotoId(null);
    if (over && active.id !== over.id) {
      setPhotos((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }
  function handleDragCancel() { setActivePhotoId(null); }

  useEffect(() => {
    return () => { photos.forEach(photo => URL.revokeObjectURL(photo.previewUrl)); };
  }, [photos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);

    const formDataToSend = new FormData();
    formDataToSend.append('title', title);
    formDataToSend.append('description', description);
    formDataToSend.append('price', price);
    formDataToSend.append('rooms', rooms);
    formDataToSend.append('area', area);
    formDataToSend.append('location', location);
    formDataToSend.append('latitude', latitude);
    formDataToSend.append('longitude', longitude);
    formDataToSend.append('amenities', amenities);
    formDataToSend.append('type', type);
    photos.forEach(photoObject => { formDataToSend.append('photos', photoObject.file); });

    try {
      const response = await api.post('/listings', formDataToSend, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setSuccess("Оголошення успішно створено! Вас буде перенаправлено за кілька секунд."); // Translated
      console.log('Оголошення створено:', response.data.listing); // Translated
      setTitle(''); setDescription(''); setPrice(''); setRooms(''); setArea('');
      setLocation(''); setLatitude(''); setLongitude(''); setAmenities('');
      setType('monthly-rental'); setPhotos([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMarkerPosition(null);
      setTimeout(() => { navigate('/listings'); }, 2500);
    } catch (err) {
      console.error('Помилка при створенні оголошення:', err); // Translated
      setError(err.response?.data?.message || 'Не вдалося створити оголошення. Будь ласка, спробуйте ще раз.'); // Translated
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'owner') {
       return (
            <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-red-600 p-10 text-center" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
                Доступ заборонено. Ви повинні увійти як власник, щоб створювати оголошення. {/* Translated */}
            </div>
        );
  }

  const activePhotoForOverlay = activePhotoId ? photos.find(p => p.id === activePhotoId) : null;

  return (
    <div className="relative flex size-full min-h-screen flex-col bg-slate-50" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
      <div className="px-4 sm:px-10 md:px-20 lg:px-40 flex flex-1 justify-center py-5">
        <div className="layout-content-container flex flex-col max-w-3xl w-full flex-1 bg-white shadow-xl rounded-lg p-6 md:p-8">
          <h1 className="text-[#0d151c] text-2xl sm:text-3xl font-bold leading-tight tracking-tight mb-8 text-center">Створити нове оголошення</h1> {/* Translated */}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="title">Заголовок</label> {/* Translated */}
              <input id="title" type="text" placeholder="напр., Затишна квартира в центрі" value={title} onChange={(e) => setTitle(e.target.value)} required // Translated
                className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]"/>
            </div>

            <div>
              <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="description">Опис</label> {/* Translated */}
              <textarea id="description" placeholder="Детальний опис об'єкта..." value={description} onChange={(e) => setDescription(e.target.value)} rows="4" // Translated
                className="form-textarea w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]"></textarea>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
              <div>
                <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="price">Ціна</label> {/* Translated */}
                <input id="price" type="number" step="0.01" placeholder="напр. 1200.50" value={price} onChange={(e) => setPrice(e.target.value)} required // Translated
                  className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]"/>
              </div>
              <div>
                <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="type">Тип оголошення</label> {/* Translated */}
                <select id="type" value={type} onChange={(e) => setType(e.target.value)} required
                  className="form-select w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]">
                  <option value="monthly-rental">Щомісячна оренда</option> {/* Translated */}
                  <option value="daily-rental">Щоденна оренда</option> {/* Translated */}
                </select>
              </div>
              <div>
                <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="rooms">Кімнати (Спальні)</label> {/* Translated */}
                <input id="rooms" type="number" step="1" placeholder="напр. 3" value={rooms} onChange={(e) => setRooms(e.target.value)} // Translated
                  className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]"/>
              </div>
              <div>
                <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="area">Площа (м²)</label> {/* Translated */}
                <input id="area" type="number" step="0.01" placeholder="напр. 150.75" value={area} onChange={(e) => setArea(e.target.value)} // Translated
                  className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]"/>
              </div>
            </div>
            
            <div>
                <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="location">Адреса / Опис місцезнаходження</label> {/* Translated */}
                <input id="location" type="text" placeholder="напр., вул. Головна, 123, Місто або використовуйте пошук на карті" value={location} onChange={(e) => setLocation(e.target.value)} required // Translated
                    className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]"/>
            </div>
          
            <div>
                <label className="block text-[#49749c] text-sm font-medium mb-2">Встановити місцезнаходження об'єкта на карті</label> {/* Translated */}
                <MapContainer center={mapCenter} zoom={13} scrollWheelZoom={true} style={{ height: '400px', width: '100%' }} className="rounded-lg border border-slate-300" whenCreated={mapInstance => { mapRef.current = mapInstance; }}>
                    <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                    <LocationMarker onPositionChange={handleMapPositionChange} initialPosition={markerPosition} />
                    <SearchField onLocationSelected={handleGeocodeResult} />
                </MapContainer>
                <p className="text-xs text-slate-500 mt-1">Вибрано: Шир: {latitude || "Н/Д"}, Довг: {longitude || "Н/Д"}</p> {/* Translated N/A to Н/Д */}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                <div>
                    <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="latitude">Широта (з карти)</label> {/* Translated */}
                    <input id="latitude" type="text" value={latitude} readOnly placeholder="Встановлюється через карту" // Translated
                    className="form-input w-full rounded-lg border-[#cedce8] bg-slate-100 text-sm text-slate-700"/>
                </div>
                <div>
                    <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="longitude">Довгота (з карти)</label> {/* Translated */}
                    <input id="longitude" type="text" value={longitude} readOnly placeholder="Встановлюється через карту" // Translated
                    className="form-input w-full rounded-lg border-[#cedce8] bg-slate-100 text-sm text-slate-700"/>
                </div>
            </div>
            
            <div>
                <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="amenities">Зручності (через кому)</label> {/* Translated */}
                <input id="amenities" type="text" placeholder="напр., Парковка, Спортзал, Басейн" value={amenities} onChange={(e) => setAmenities(e.target.value)} // Translated
                className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c]"/>
            </div>

            <div>
                <label className="block text-[#49749c] text-sm font-medium mb-2">Фотографії (Перетягніть для зміни порядку)</label> {/* Translated */}
                {/* Styled Drop Zone */}
                <div
                    ref={photoDropZoneRef}
                    onClick={() => fileInputRef.current?.click()} // Trigger hidden file input
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[#dbe0e6] px-6 py-10 sm:py-14 mb-4 cursor-pointer hover:border-blue-400 transition-colors duration-150"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-[#111418] text-base sm:text-lg font-bold leading-tight tracking-tight max-w-[480px] text-center">Перетягніть фотографії сюди</p> {/* Translated */}
                    <p className="text-slate-600 text-sm font-normal leading-normal max-w-[480px] text-center">Або натисніть, щоб завантажити (Макс. 10МБ на фото)</p> {/* Translated */}
                </div>
                <input ref={fileInputRef} id="photos-input-hidden" type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden"/>
            
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
                    <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-2 border border-slate-200 rounded-lg min-h-[100px] bg-slate-50">
                        {photos.map((photo) => (
                            <SortablePhotoItem key={photo.id} id={photo.id} photo={photo} onRemove={handleRemovePhoto} />
                        ))}
                        </div>
                    </SortableContext>
                    <DragOverlay dropAnimation={null}>
                        {activePhotoForOverlay ? (
                        <div className="relative w-28 h-28 sm:w-32 sm:h-32 border rounded-md overflow-hidden shadow-2xl bg-white z-50">
                            <img src={activePhotoForOverlay.previewUrl} alt="Drag" className="w-full h-full object-cover"/>
                        </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
                {photos.length === 0 && <p className="text-sm text-slate-500 mt-2">Фотографії ще не вибрано.</p>} {/* Translated */}
            </div>

            <div className="mt-10 flex items-center justify-center">
                <button type="submit" disabled={loading}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-md text-base transition duration-150 ease-in-out disabled:opacity-70">
                {loading ? 'Створення...' : 'Створити оголошення'} {/* Translated */}
                </button>
            </div>
          </form>

          {/* Moved Messages to the bottom of the form area */}
          {loading && !success && !error && <div className="mt-6 text-center text-blue-600 p-3 bg-blue-50 rounded-md">Створення оголошення, будь ласка, зачекайте...</div>} {/* Translated */}
          {success && <div className="mt-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md" role="alert"><p className="font-bold">Успіх!</p><p>{success}</p></div>} {/* Translated */}
          {error && <div className="mt-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"><p className="font-bold">Помилка</p><p>{error}</p></div>} {/* Translated */}

        </div>
      </div>
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
            height: 2.375rem !important; /* Match form input height (py-2 equivalent) */
            padding-left: 0.75rem !important;
            padding-right: 0.75rem !important;
            font-size: 0.875rem !important; /* text-sm */
            color: #0d151c !important; /* text-[#0d151c] */
        }
        .leaflet-control-geosearch.bar form input:focus {
            border-color: #3b82f6 !important; /* focus:border-blue-500 */
            outline: 1px solid #3b82f6 !important; /* focus:ring-blue-500 (approximated) */
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

export default CreateListingPage;