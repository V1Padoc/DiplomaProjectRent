// frontend/src/components/ListingFormMap.jsx
import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geosearch/dist/geosearch.css';

// Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Reusable LocationMarker component (internal to ListingFormMap or can be separate)
function LocationMarkerInternal({ onPositionChange, initialPosition }) {
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
            <Popup>Property Location: <br/> Lat: {position.lat.toFixed(6)}, Lng: {position.lng.toFixed(6)}</Popup>
        </Marker>
    );
}

// Reusable SearchField component (internal or separate)
function SearchFieldInternal({ onLocationSelected }) {
    const map = useMap();
    useEffect(() => {
        const provider = new OpenStreetMapProvider();
        const searchControl = new GeoSearchControl({
            provider: provider,
            style: 'bar',
            showMarker: false,
            showPopup: false,
            autoClose: true,
            retainZoomLevel: false,
            animateZoom: true,
            keepResult: true,
            searchLabel: 'Enter address...',
        });
        map.addControl(searchControl);
        map.on('geosearch/showlocation', (result) => {
            const { y: lat, x: lng, label } = result.location;
            onLocationSelected({ lat, lng }, label);
        });
        return () => {
            map.removeControl(searchControl);
            map.off('geosearch/showlocation');
        };
    }, [map, onLocationSelected]);
    return null;
}

function ListingFormMap({ initialLat, initialLng, onLocationUpdate, onAddressUpdate }) {
    const [currentMarkerPosition, setCurrentMarkerPosition] = useState(
        initialLat && initialLng ? { lat: parseFloat(initialLat), lng: parseFloat(initialLng) } : null
    );
    const [currentMapCenter, setCurrentMapCenter] = useState(
        initialLat && initialLng ? [parseFloat(initialLat), parseFloat(initialLng)] : [51.505, -0.09] // Default center
    );
    const mapRef = useRef(null);

    useEffect(() => {
        // Update internal state if initial props change (e.g., when editing an existing listing)
        const newPos = initialLat && initialLng ? { lat: parseFloat(initialLat), lng: parseFloat(initialLng) } : null;
        setCurrentMarkerPosition(newPos);
        if (newPos) {
            setCurrentMapCenter([newPos.lat, newPos.lng]);
        }
    }, [initialLat, initialLng]);


    const handleMapClickOrGeocode = (latlng, addressLabel) => {
        setCurrentMarkerPosition(latlng);
        if (mapRef.current) {
            mapRef.current.flyTo(latlng, 15);
        } else {
            setCurrentMapCenter([latlng.lat, latlng.lng]); // Fallback for initial render
        }
        onLocationUpdate(latlng.lat, latlng.lng); // Update parent form's lat/lng
        if (addressLabel && onAddressUpdate) {
            onAddressUpdate(addressLabel); // Update parent form's address string
        }
    };

    return (
        <MapContainer
            center={currentMapCenter}
            zoom={currentMarkerPosition ? 15 : 13}
            scrollWheelZoom={true}
            style={{ height: '400px', width: '100%' }}
            className="rounded-sm border border-gray-300"
            whenCreated={mapInstance => { mapRef.current = mapInstance; }}
        >
            <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarkerInternal 
                onPositionChange={(latlng) => handleMapClickOrGeocode(latlng)} 
                initialPosition={currentMarkerPosition} 
            />
            <SearchFieldInternal 
                onLocationSelected={(latlng, label) => handleMapClickOrGeocode(latlng, label)} 
            />
        </MapContainer>
    );
}

export default ListingFormMap;