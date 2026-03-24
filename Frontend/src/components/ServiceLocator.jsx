import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import './ServiceLocator.css';

const ServiceLocator = ({ equipmentList }) => {
  const [searchMethod, setSearchMethod] = useState('current');
  const [location, setLocation] = useState(null);
  const [searchInputs, setSearchInputs] = useState({
    pincode: '',
    city: '',
    landmark: '',
    address: '',
    latitude: '',
    longitude: ''
  });
  const [equipmentType, setEquipmentType] = useState('laptop');
  const [radius, setRadius] = useState(5000);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [searchedLocation, setSearchedLocation] = useState(null);
  
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapLoadError, setMapLoadError] = useState(false);
  const googleMapsScriptLoadedRef = useRef(false);

  useEffect(() => {
    const loadGoogleMapsScript = () => {
      if (window.google && window.google.maps) {
        setMapLoaded(true);
        googleMapsScriptLoadedRef.current = true;
        return;
      }
      if (googleMapsScriptLoadedRef.current) return;

      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setMapLoadError(true);
        return;
      }

      googleMapsScriptLoadedRef.current = true;
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => setMapLoaded(true);
      script.onerror = () => setMapLoadError(true);
      document.head.appendChild(script);
    };
    loadGoogleMapsScript();
  }, []);

  useEffect(() => {
    if (searchMethod === 'current') getCurrentLocation();
  }, [searchMethod]);

  useEffect(() => {
    if (mapLoaded && searchedLocation && mapRef.current && !mapLoadError) {
      initializeMap();
    }
  }, [mapLoaded, searchedLocation, mapLoadError]);

  useEffect(() => {
    if (mapInstanceRef.current && services.length > 0 && mapLoaded) {
      updateMapMarkers();
    }
  }, [services, mapLoaded]);

  const initializeMap = () => {
    if (!window.google || !window.google.maps || !mapRef.current || !searchedLocation) return;
    try {
      const mapOptions = {
        center: { lat: searchedLocation.latitude, lng: searchedLocation.longitude },
        zoom: 13,
        styles: [
          { featureType: 'all', elementType: 'all', stylers: [{ saturation: -100 }, { lightness: -50 }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#131517' }] }
        ],
        disableDefaultUI: true,
        zoomControl: true
      };
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, mapOptions);
      new window.google.maps.Marker({
        position: { lat: searchedLocation.latitude, lng: searchedLocation.longitude },
        map: mapInstanceRef.current,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#ACCBDA', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
      });
    } catch (e) {
      setMapLoadError(true);
    }
  };

  const updateMapMarkers = () => {
    if (!mapInstanceRef.current || !window.google || !window.google.maps) return;
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    const bounds = new window.google.maps.LatLngBounds();
    if (searchedLocation) bounds.extend({ lat: searchedLocation.latitude, lng: searchedLocation.longitude });

    services.forEach((service) => {
      const marker = new window.google.maps.Marker({
        position: { lat: service.location.lat, lng: service.location.lng },
        map: mapInstanceRef.current,
        title: service.name
      });
      bounds.extend({ lat: service.location.lat, lng: service.location.lng });
      markersRef.current.push(marker);
    });
    if (services.length > 0) mapInstanceRef.current.fitBounds(bounds);
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLoading(false);
      },
      () => setLoading(false),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setError(''); setServices([]); setSearchedLocation(null);
    const params = { type: equipmentType, radius: radius };
    
    if (searchMethod === 'current') {
      if (!location) return setError('Location unavailable');
      params.lat = location.latitude; params.lng = location.longitude;
    } else {
      params[searchMethod] = searchInputs[searchMethod];
    }

    setLoading(true);
    try {
      const response = await api.get('/service-locator', params);
      if (response.data.success) {
        setServices(response.data.places || []);
        setSearchedLocation(response.data.location);
      } else {
        setError(response.data.error || 'No centers found');
      }
    } catch (err) {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
  };

  const openInMaps = (lat, lng) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  return (
    <div className="locator-container">
      <div className="service-sidebar">
        <h2 className="sidebar-title">Service Network</h2>
        <p className="sidebar-subtitle">Locate Certified Technical Diagnostics</p>
        
        <div className="search-method-tabs" style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem'}}>
          {['current', 'pincode', 'city', 'landmark', 'address'].map(m => (
            <button 
              key={m} 
              className={`nav-btn ${searchMethod === m ? 'active' : ''}`}
              onClick={() => setSearchMethod(m)}
              style={{textTransform: 'capitalize', fontSize: '0.7rem'}}
            >
              {m === 'current' ? 'My Location' : m}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="monitor-form" style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
          {searchMethod !== 'current' && (
            <div className="form-group">
              <label>Enter {searchMethod}</label>
              <input 
                type="text" 
                value={searchInputs[searchMethod]} 
                onChange={(e) => setSearchInputs({...searchInputs, [searchMethod]: e.target.value})}
                placeholder={`Search by ${searchMethod}...`}
              />
            </div>
          )}
          
          <div className="form-group">
            <label>Equipment Category</label>
            <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)}>
              <option value="laptop">Laptop / Computing</option>
              <option value="phone">Mobile / Tablet</option>
              <option value="industrial_machine">Industrial Assets</option>
              <option value="hvac">HVAC / Climate</option>
              <option value="motor">Electrical Motors</option>
            </select>
          </div>

          <button type="submit" disabled={loading} className="monitor-btn">
            {loading ? 'Scanning...' : 'Search Network'}
          </button>
        </form>

        <div className="service-results" style={{marginTop: '2rem'}}>
          {services.map((service) => (
            <div key={service.id} className="service-card" onClick={() => openInMaps(service.location.lat, service.location.lng)}>
              <div className="provider-info">
                <span className="provider-type">Certified Partner</span>
                <h3 className="provider-name">{service.name}</h3>
                <p className="provider-address">{service.address}</p>
              </div>
              <div className="provider-stats">
                <div className="rating">⭐ {service.rating?.toFixed(1) || 'N/A'}</div>
                {searchedLocation && (
                  <div className="distance">
                    {calculateDistance(searchedLocation.latitude, searchedLocation.longitude, service.location.lat, service.location.lng)} km
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="map-container">
        {mapLoaded ? (
          <div ref={mapRef} style={{width: '100%', height: '100%'}}></div>
        ) : (
          <div className="map-placeholder">
            <div className="map-icon">🗺️</div>
            <div className="map-hint">Initialising Global Service Network...</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceLocator;