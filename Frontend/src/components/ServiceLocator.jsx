import { useState, useEffect, useRef } from 'react';
import './ServiceLocator.css';

import api from '../services/api';
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function ServiceLocator() {
  const [equipmentType, setEquipmentType] = useState('all');
  const [searchLocation, setSearchLocation] = useState('');
  const [serviceProviders, setServiceProviders] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (window.google && window.google.maps) {
      initMap();
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', initMap);
      return () => {
        existingScript.removeEventListener('load', initMap);
      };
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = initMap;
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        script.onload = null;
      }
    };
  }, []);

  useEffect(() => {
    if (userLocation && googleMapRef.current) {
      searchNearbyProviders(userLocation.latitude, userLocation.longitude);
    }
  }, [userLocation, equipmentType]);

  const initMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps) return;
    if (googleMapRef.current) return;

    const center = { lat: 20.5937, lng: 78.9629 };

    googleMapRef.current = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: 4.5,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
        {
          featureType: 'administrative',
          elementType: 'geometry',
          stylers: [{ color: '#334155' }]
        },
        {
          featureType: 'road',
          elementType: 'geometry',
          stylers: [{ color: '#334155' }]
        },
        {
          featureType: 'water',
          elementType: 'geometry',
          stylers: [{ color: '#0f172a' }]
        }
      ]
    });
  };

  const searchNearbyProviders = async (lat, lng) => {
  setLoading(true);
  setError(null);

  try {
    const response = await api.get('/service-providers', {
      params: {
        latitude: lat,
        longitude: lng,
        equipmentType: equipmentType,
        radius: 8000,
        enhanced: true
      }
    });

    const data = response.data;

    if (data.success) {
      setServiceProviders(data.providers || []);
      updateMapMarkers(data.providers || [], { latitude: lat, longitude: lng });
    } else {
      setError(data.error || 'Failed to search providers');
      setServiceProviders([]);
    }
  } catch (err) {
    setError('Failed to connect to service.');
    setServiceProviders([]);
  } finally {
    setLoading(false);
  }
  };

  const geocodeAndSearch = async () => {
  if (!searchLocation.trim()) return;

  setLoading(true);
  setError(null);

  try {
    const response = await api.get('/geocode', {
      params: { address: searchLocation }
    });

    const data = response.data;

    if (data.success) {
      const { latitude, longitude } = data.location;
      setUserLocation({ latitude, longitude });
      
      if (googleMapRef.current) {
        googleMapRef.current.setCenter({ lat: latitude, lng: longitude });
        googleMapRef.current.setZoom(12);
      }
      
      await searchNearbyProviders(latitude, longitude);
    } else {
      setError(data.error || 'Location not found');
      setLoading(false);
    }
  } catch (err) {
    setError('Failed to find location.');
    setLoading(false);
  }
  };

  const openInGoogleMaps = (provider) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(provider.name)}&query_place_id=${provider.id}`;
    window.open(url, '_blank');
  };

  const updateMapMarkers = (providers, location) => {
    if (!googleMapRef.current || !window.google) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();

    // Add user location marker
    if (location) {
      const userMarker = new window.google.maps.Marker({
        position: { lat: location.latitude, lng: location.longitude },
        map: googleMapRef.current,
        title: 'Your Location',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#10b981',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3
        },
        zIndex: 1000
      });
      
      const userInfoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="color: #000; padding: 10px; text-align: center;">
            <h3 style="margin: 0 0 5px 0; font-size: 16px; font-weight: 700; color: #10b981;">📍 Your Location</h3>
            <p style="margin: 0; font-size: 13px; color: #666;">Search centered here</p>
          </div>
        `
      });

      userMarker.addListener('click', () => {
        userInfoWindow.open(googleMapRef.current, userMarker);
      });

      markersRef.current.push(userMarker);
      bounds.extend({ lat: location.latitude, lng: location.longitude });
    }

    // Add provider markers
    providers.forEach((provider, index) => {
      const marker = new window.google.maps.Marker({
        position: { lat: provider.latitude, lng: provider.longitude },
        map: googleMapRef.current,
        title: provider.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#60a5fa',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        },
        animation: window.google.maps.Animation.DROP,
        zIndex: index
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="color: #000; padding: 12px; min-width: 220px; max-width: 300px;">
            <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 700; color: #1e293b;">${provider.name}</h3>
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #475569; line-height: 1.4;">
              📍 ${provider.location}
            </p>
            ${provider.rating ? `
              <div style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 14px;">⭐ ${provider.rating.toFixed(1)}</span>
                <span style="font-size: 12px; color: #64748b;">(${provider.reviews} review${provider.reviews !== 1 ? 's' : ''})</span>
              </div>
            ` : ''}
            ${provider.isOpen !== undefined ? `
              <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 600; color: ${provider.isOpen ? '#10b981' : '#ef4444'};">
                ${provider.isOpen ? '🟢 Open Now' : '🔴 Closed'}
              </p>
            ` : ''}
            <button
              onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(provider.name)}&query_place_id=${provider.id}', '_blank')"
              style="
                width: 100%;
                padding: 10px 16px;
                background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
              "
              onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(37, 99, 235, 0.4)'"
              onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(37, 99, 235, 0.3)'"
            >
              📍 Open in Google Maps
            </button>
          </div>
        `
      });

      marker.addListener('click', () => {
        // Close all other info windows
        markersRef.current.forEach(m => {
          if (m.infoWindow) {
            m.infoWindow.close();
          }
        });
        infoWindow.open(googleMapRef.current, marker);
      });

      marker.infoWindow = infoWindow;
      markersRef.current.push(marker);
      bounds.extend({ lat: provider.latitude, lng: provider.longitude });
    });

    if (markersRef.current.length > 0) {
      googleMapRef.current.fitBounds(bounds);
      
      // Adjust zoom if too close
      const listener = window.google.maps.event.addListener(googleMapRef.current, 'idle', () => {
        if (googleMapRef.current.getZoom() > 15) {
          googleMapRef.current.setZoom(15);
        }
        window.google.maps.event.removeListener(listener);
      });
    }
  };

  const detectLocation = () => {
    setLoadingLocation(true);
    setError(null);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setLoadingLocation(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setError('Unable to detect location. Please enter manually or allow location access.');
          setLoadingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      setError('Geolocation is not supported by your browser.');
      setLoadingLocation(false);
    }
  };

  const handleSearch = () => {
    if (searchLocation.trim()) {
      geocodeAndSearch();
    }
  };

  return (
    <div className="service-locator">
      <div className="locator-header">
        <h2 className="locator-title">🔧 Find Service Centers</h2>
        <p className="locator-subtitle">
          Locate trusted maintenance experts near you for equipment repair and servicing
        </p>
      </div>

      <div className="search-section">
        <div className="search-filters">
          <div className="filter-group">
            <label>🔨 Equipment Type</label>
            <select
              value={equipmentType}
              onChange={(e) => setEquipmentType(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Types</option>
              <option value="laptop">💻 Laptop</option>
              <option value="phone">📱 Phone</option>
              <option value="tablet">📱 Tablet</option>
              <option value="desktop">🖥️ Desktop</option>
              <option value="industrial_machine">🏭 Industrial Machine</option>
              <option value="hvac">❄️ HVAC System</option>
              <option value="motor">⚙️ Motor</option>
              <option value="pump">💧 Pump</option>
              <option value="compressor">🔧 Compressor</option>
            </select>
          </div>

          <div className="filter-group">
            <label>📍 Location</label>
            <div className="location-input-group">
              <input
                type="text"
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter city, address or zip code"
                className="filter-input"
              />
              <button
                onClick={handleSearch}
                disabled={loading || !searchLocation.trim()}
                className="search-btn"
                title="Search location"
              >
                {loading ? '⏳' : '🔍'}
              </button>
              <button
                onClick={detectLocation}
                disabled={loadingLocation}
                className="detect-btn"
                title="Use my current location"
              >
                {loadingLocation ? '⏳' : '📍'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        {loading && (
          <div className="location-detected loading">
            <div className="loading-spinner"></div>
            <span>🔄 Searching for service providers...</span>
          </div>
        )}
        
        {userLocation && !loading && !error && (
          <div className="location-detected success">
            ✅ Found <strong>{serviceProviders.length}</strong> service provider{serviceProviders.length !== 1 ? 's' : ''} near you. Click markers on the map for details.
          </div>
        )}
      </div>

      <div className="map-section">
        <div className="map-header">
          <h3>
            📍 {serviceProviders.length} Service {serviceProviders.length === 1 ? 'Provider' : 'Providers'} Found
          </h3>
          {serviceProviders.length > 0 && (
            <p className="map-subtitle">
              Click on blue markers to view provider details and directions
            </p>
          )}
        </div>
        <div ref={mapRef} className="google-map"></div>
      </div>
    </div>
  );
}

export default ServiceLocator;