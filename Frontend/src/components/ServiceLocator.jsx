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
  
  // Google Maps state
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapLoadError, setMapLoadError] = useState(false);
  const googleMapsScriptLoadedRef = useRef(false);

  // Load Google Maps API dynamically from .env
  useEffect(() => {
    const loadGoogleMapsScript = () => {
      // Check if already loaded
      if (window.google && window.google.maps) {
        setMapLoaded(true);
        googleMapsScriptLoadedRef.current = true;
        return;
      }

      // Check if script is already being loaded
      if (googleMapsScriptLoadedRef.current) {
        return;
      }

      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        console.error('❌ Google Maps API key not found in .env file');
        setMapLoadError(true);
        return;
      }

      console.log('🗺️ Loading Google Maps API...');
      googleMapsScriptLoadedRef.current = true;

      // Create script element
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        console.log('✅ Google Maps API loaded successfully');
        setMapLoaded(true);
      };

      script.onerror = () => {
        console.error('❌ Failed to load Google Maps API');
        setMapLoadError(true);
        googleMapsScriptLoadedRef.current = false;
      };

      document.head.appendChild(script);
    };

    loadGoogleMapsScript();
  }, []);

  useEffect(() => {
    if (searchMethod === 'current') {
      getCurrentLocation();
    }
  }, [searchMethod]);

  // Initialize map when location is available
  useEffect(() => {
    if (mapLoaded && searchedLocation && mapRef.current && !mapLoadError) {
      initializeMap();
    }
  }, [mapLoaded, searchedLocation, mapLoadError]);

  // Update markers when services change
  useEffect(() => {
    if (mapInstanceRef.current && services.length > 0 && mapLoaded) {
      updateMapMarkers();
    }
  }, [services, mapLoaded]);

  const initializeMap = () => {
    if (!window.google || !window.google.maps || !mapRef.current || !searchedLocation) {
      console.warn('⚠️ Google Maps not ready yet');
      return;
    }

    try {
      const mapOptions = {
        center: {
          lat: searchedLocation.latitude,
          lng: searchedLocation.longitude
        },
        zoom: 13,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }]
          }
        ]
      };

      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, mapOptions);

      // Add user location marker (blue dot)
      new window.google.maps.Marker({
        position: { 
          lat: searchedLocation.latitude, 
          lng: searchedLocation.longitude 
        },
        map: mapInstanceRef.current,
        title: 'Your Location',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 4
        },
        zIndex: 1000
      });

      // Add search radius circle
      new window.google.maps.Circle({
        map: mapInstanceRef.current,
        center: { 
          lat: searchedLocation.latitude, 
          lng: searchedLocation.longitude 
        },
        radius: radius,
        fillColor: '#4285F4',
        fillOpacity: 0.08,
        strokeColor: '#4285F4',
        strokeOpacity: 0.4,
        strokeWeight: 2
      });

      console.log('✅ Map initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing map:', error);
      setMapLoadError(true);
    }
  };

  const updateMapMarkers = () => {
    if (!mapInstanceRef.current || !window.google || !window.google.maps) {
      console.warn('⚠️ Map not ready for markers');
      return;
    }

    try {
      // Clear existing service markers (keep user location marker)
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];

      const bounds = new window.google.maps.LatLngBounds();

      // Add user location to bounds
      if (searchedLocation) {
        bounds.extend({
          lat: searchedLocation.latitude,
          lng: searchedLocation.longitude
        });
      }

      // Add markers for each service
      services.forEach((service, index) => {
        const position = {
          lat: service.location.lat,
          lng: service.location.lng
        };

        const marker = new window.google.maps.Marker({
          position: position,
          map: mapInstanceRef.current,
          title: service.name,
          label: {
            text: `${index + 1}`,
            color: 'white',
            fontWeight: 'bold',
            fontSize: '14px'
          },
          icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new window.google.maps.Size(40, 40)
          },
          animation: window.google.maps.Animation.DROP
        });

        // Create info window content
        const infoWindowContent = `
          <div style="padding: 12px; max-width: 280px; font-family: 'Segoe UI', sans-serif;">
            <h3 style="margin: 0 0 10px 0; font-size: 17px; color: #2d3748; font-weight: 700;">
              ${service.name}
            </h3>
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #4a5568; line-height: 1.5;">
              📍 ${service.address}
            </p>
            ${service.rating ? `
              <div style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 14px; font-weight: 600; color: #f59e0b;">
                  ⭐ ${service.rating.toFixed(1)}
                </span>
                <span style="font-size: 12px; color: #718096;">
                  (${service.userRatingsTotal} reviews)
                </span>
              </div>
            ` : ''}
            ${service.openNow !== null ? `
              <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 600;">
                <span style="color: ${service.openNow ? '#10b981' : '#ef4444'};">
                  ${service.openNow ? '🟢 Open Now' : '🔴 Closed'}
                </span>
              </p>
            ` : ''}
            <a 
              href="https://www.google.com/maps/search/?api=1&query=${service.location.lat},${service.location.lng}" 
              target="_blank"
              rel="noopener noreferrer"
              style="
                display: inline-block; 
                padding: 8px 16px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; 
                text-decoration: none; 
                border-radius: 6px; 
                font-size: 13px; 
                font-weight: 600;
                margin-top: 6px;
                box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
              "
            >
              🗺️ Get Directions
            </a>
          </div>
        `;

        const infoWindow = new window.google.maps.InfoWindow({
          content: infoWindowContent
        });

        marker.addListener('click', () => {
          // Close all other info windows
          markersRef.current.forEach(m => {
            if (m.infoWindow) {
              m.infoWindow.close();
            }
          });
          infoWindow.open(mapInstanceRef.current, marker);
        });

        marker.infoWindow = infoWindow;
        bounds.extend(position);
        markersRef.current.push(marker);
      });

      // Fit map to show all markers
      if (services.length > 0) {
        mapInstanceRef.current.fitBounds(bounds);
        
        // Adjust zoom if too close
        const listener = window.google.maps.event.addListener(mapInstanceRef.current, 'idle', () => {
          if (mapInstanceRef.current.getZoom() > 16) {
            mapInstanceRef.current.setZoom(16);
          }
          window.google.maps.event.removeListener(listener);
        });
      }

      console.log(`✅ Added ${services.length} markers to map`);
    } catch (error) {
      console.error('❌ Error updating markers:', error);
    }
  };

  const getCurrentLocation = () => {
    setLocationError('');
    
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported by your browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLoading(false);
        console.log('✅ Location acquired:', position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.error('❌ Geolocation error:', error);
        setLocationError('Unable to get location. Please enable location services or try another search method.');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearchInputs(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setError('');
    setServices([]);
    setSearchedLocation(null);

    const params = {
      type: equipmentType,
      radius: radius
    };

    switch (searchMethod) {
      case 'current':
        if (!location) {
          setError('Current location not available. Try another search method.');
          return;
        }
        params.lat = location.latitude;
        params.lng = location.longitude;
        break;

      case 'pincode':
        if (!searchInputs.pincode.trim()) {
          setError('Please enter a pincode');
          return;
        }
        params.pincode = searchInputs.pincode.trim();
        break;

      case 'city':
        if (!searchInputs.city.trim()) {
          setError('Please enter a city or area name');
          return;
        }
        params.city = searchInputs.city.trim();
        break;

      case 'landmark':
        if (!searchInputs.landmark.trim()) {
          setError('Please enter a landmark name');
          return;
        }
        params.landmark = searchInputs.landmark.trim();
        break;

      case 'address':
        if (!searchInputs.address.trim()) {
          setError('Please enter an address');
          return;
        }
        params.address = searchInputs.address.trim();
        break;

      case 'coordinates':
        const lat = parseFloat(searchInputs.latitude);
        const lng = parseFloat(searchInputs.longitude);
        
        if (isNaN(lat) || isNaN(lng)) {
          setError('Please enter valid coordinates');
          return;
        }
        
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          setError('Coordinates out of range');
          return;
        }
        
        params.lat = lat;
        params.lng = lng;
        break;

      default:
        setError('Please select a search method');
        return;
    }

    setLoading(true);

    try {
      console.log('🔍 Searching with params:', params);

      const response = await api.get('/service-locator', params);

      console.log('📡 Response:', response.data);

      if (response.data.success) {
        setServices(response.data.places || []);
        setSearchedLocation(response.data.location);
        
        if (response.data.places.length === 0) {
          setError(response.data.message || 'No service centers found. Try increasing radius or different location.');
        }
      } else {
        setError(response.data.error || 'Failed to find service centers');
      }
    } catch (err) {
      console.error('❌ Search error:', err);
      setError(err.message || 'Failed to search for service centers');
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
  };

  const openInMaps = (lat, lng, name) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const scrollToMap = () => {
    if (mapRef.current) {
      mapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="service-locator">
      <div className="locator-header">
        <h2>🔧 Service Center Locator</h2>
        <p>Find nearby equipment repair and maintenance services</p>
      </div>

      <div className="search-method-tabs">
        <button
          className={`tab-btn ${searchMethod === 'current' ? 'active' : ''}`}
          onClick={() => setSearchMethod('current')}
        >
          📍 Current Location
        </button>
        <button
          className={`tab-btn ${searchMethod === 'pincode' ? 'active' : ''}`}
          onClick={() => setSearchMethod('pincode')}
        >
          📮 Pincode
        </button>
        <button
          className={`tab-btn ${searchMethod === 'city' ? 'active' : ''}`}
          onClick={() => setSearchMethod('city')}
        >
          🏙️ City/Area
        </button>
        <button
          className={`tab-btn ${searchMethod === 'landmark' ? 'active' : ''}`}
          onClick={() => setSearchMethod('landmark')}
        >
          🏛️ Landmark
        </button>
        <button
          className={`tab-btn ${searchMethod === 'address' ? 'active' : ''}`}
          onClick={() => setSearchMethod('address')}
        >
          🏠 Address
        </button>
        <button
          className={`tab-btn ${searchMethod === 'coordinates' ? 'active' : ''}`}
          onClick={() => setSearchMethod('coordinates')}
        >
          🗺️ Coordinates
        </button>
      </div>

      {searchMethod === 'current' && (
        <div className={`location-status ${location ? 'active' : 'inactive'}`}>
          {location ? (
            <>
              <span className="status-icon">📍</span>
              <span>Location: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span>
              <button onClick={getCurrentLocation} className="btn-link" type="button">
                🔄 Refresh
              </button>
            </>
          ) : (
            <>
              <span className="status-icon">⚠️</span>
              <span>{locationError || 'Getting your location...'}</span>
              {locationError && (
                <button onClick={getCurrentLocation} className="btn-link" type="button">
                  Try again
                </button>
              )}
            </>
          )}
        </div>
      )}

      {searchedLocation && (
        <div className="searched-location">
          <span className="status-icon">✅</span>
          <span>Searching near: {searchedLocation.source || `${searchedLocation.latitude.toFixed(4)}, ${searchedLocation.longitude.toFixed(4)}`}</span>
        </div>
      )}

      <form onSubmit={handleSearch} className="locator-form">
        {searchMethod === 'pincode' && (
          <div className="form-group">
            <label htmlFor="pincode">📮 Enter Pincode / ZIP Code</label>
            <input
              type="text"
              id="pincode"
              name="pincode"
              value={searchInputs.pincode}
              onChange={handleInputChange}
              placeholder="e.g., 380001, 400001, 10001"
              className="form-input"
              required
            />
            <span className="input-hint">Enter your area pincode</span>
          </div>
        )}

        {searchMethod === 'city' && (
          <div className="form-group">
            <label htmlFor="city">🏙️ Enter City or Area Name</label>
            <input
              type="text"
              id="city"
              name="city"
              value={searchInputs.city}
              onChange={handleInputChange}
              placeholder="e.g., Ahmedabad, Mumbai, Vastrapur"
              className="form-input"
              required
            />
            <span className="input-hint">City, town, or area name</span>
          </div>
        )}

        {searchMethod === 'landmark' && (
          <div className="form-group">
            <label htmlFor="landmark">🏛️ Enter Landmark</label>
            <input
              type="text"
              id="landmark"
              name="landmark"
              value={searchInputs.landmark}
              onChange={handleInputChange}
              placeholder="e.g., Gateway of India, Sabarmati Ashram"
              className="form-input"
              required
            />
            <span className="input-hint">Famous landmark or building</span>
          </div>
        )}

        {searchMethod === 'address' && (
          <div className="form-group">
            <label htmlFor="address">🏠 Enter Full Address</label>
            <textarea
              id="address"
              name="address"
              value={searchInputs.address}
              onChange={handleInputChange}
              placeholder="e.g., Plot 123, GIDC Estate, Ahmedabad, Gujarat, India"
              className="form-textarea"
              rows="3"
              required
            />
            <span className="input-hint">Complete address with city and state</span>
          </div>
        )}

        {searchMethod === 'coordinates' && (
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="latitude">Latitude</label>
              <input
                type="number"
                id="latitude"
                name="latitude"
                value={searchInputs.latitude}
                onChange={handleInputChange}
                placeholder="e.g., 23.0225"
                step="any"
                className="form-input"
                required
              />
              <span className="input-hint">-90 to 90</span>
            </div>
            <div className="form-group">
              <label htmlFor="longitude">Longitude</label>
              <input
                type="number"
                id="longitude"
                name="longitude"
                value={searchInputs.longitude}
                onChange={handleInputChange}
                placeholder="e.g., 72.5714"
                step="any"
                className="form-input"
                required
              />
              <span className="input-hint">-180 to 180</span>
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="equipmentType">⚙️ Equipment Type</label>
          <select
            id="equipmentType"
            value={equipmentType}
            onChange={(e) => setEquipmentType(e.target.value)}
            className="form-select"
          >
            <optgroup label="🖥️ Electronics & Computers">
              <option value="laptop">Laptop / Notebook</option>
              <option value="desktop">Desktop Computer / PC</option>
              <option value="phone">Mobile Phone / Smartphone</option>
              <option value="tablet">Tablet / iPad</option>
              <option value="computer">Computer (General)</option>
              <option value="printer">Printer / Scanner</option>
              <option value="monitor">Monitor / Display</option>
            </optgroup>
            
            <optgroup label="🏭 Industrial Equipment">
              <option value="motor">Electric Motor</option>
              <option value="pump">Pump / Water Pump</option>
              <option value="compressor">Compressor / Air Compressor</option>
              <option value="generator">Generator / Genset</option>
              <option value="turbine">Turbine</option>
              <option value="conveyor">Conveyor System</option>
              <option value="transformer">Transformer</option>
              <option value="industrial_machine">Industrial Machinery</option>
            </optgroup>
            
            <optgroup label="❄️ HVAC & Appliances">
              <option value="hvac">HVAC / Air Conditioning</option>
              <option value="refrigerator">Refrigerator / Freezer</option>
              <option value="washing_machine">Washing Machine</option>
              <option value="microwave">Microwave Oven</option>
              <option value="dishwasher">Dishwasher</option>
              <option value="water_heater">Water Heater / Geyser</option>
            </optgroup>
            
            <optgroup label="🚗 Automotive & Heavy Equipment">
              <option value="vehicle">Vehicle / Automobile</option>
              <option value="bike">Bike / Motorcycle</option>
              <option value="construction">Construction Equipment</option>
              <option value="agricultural">Agricultural Equipment</option>
            </optgroup>
            
            <optgroup label="🔌 Power & Energy">
              <option value="battery">Battery / UPS</option>
              <option value="solar">Solar Panel / Inverter</option>
              <option value="electrical">Electrical Equipment</option>
            </optgroup>
            
            <optgroup label="🔧 General">
              <option value="all">All Equipment Types</option>
            </optgroup>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="radius">
            📏 Search Radius: {(radius / 1000).toFixed(1)} km
          </label>
          <input
            type="range"
            id="radius"
            min="1000"
            max="50000"
            step="1000"
            value={radius}
            onChange={(e) => setRadius(parseInt(e.target.value))}
            className="form-range"
          />
          <div className="range-labels">
            <span>1 km</span>
            <span>25 km</span>
            <span>50 km</span>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {mapLoadError && (
          <div className="alert alert-warning">
            <span className="alert-icon">⚠️</span>
            <span>Google Maps failed to load. Map view will not be available, but search results will still display.</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary btn-large"
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              <span>Searching...</span>
            </>
          ) : (
            <>
              <span>🔍</span>
              <span>Find Service Centers</span>
            </>
          )}
        </button>
      </form>

      {/* Google Maps */}
      {searchedLocation && !mapLoadError && (
        <div className="map-section">
          <div className="map-header">
            <h3>📍 Service Centers Map</h3>
            <p className="map-subtitle">
              {services.length > 0 
                ? `Showing ${services.length} service center${services.length > 1 ? 's' : ''} within ${(radius / 1000).toFixed(1)} km`
                : 'Search for service centers to see them on the map'
              }
            </p>
          </div>
          {mapLoaded ? (
            <div ref={mapRef} className="google-map"></div>
          ) : (
            <div className="map-loading">
              <div className="spinner-large"></div>
              <p>Loading Google Maps...</p>
              <span className="loading-hint">This may take a few seconds</span>
            </div>
          )}
        </div>
      )}

      {/* Results Grid */}
      {services.length > 0 && (
        <div className="service-results">
          <div className="results-header">
            <h3>🎯 Found {services.length} Service Centers</h3>
            {searchedLocation && (
              <p className="results-subtitle">
                Near {searchedLocation.source || 'your location'}
              </p>
            )}
            {!mapLoadError && mapLoaded && (
              <button onClick={scrollToMap} className="btn-view-map" type="button">
                🗺️ View on Map
              </button>
            )}
          </div>
          <div className="services-grid">
            {services.map((service, index) => (
              <div key={service.id} className="service-card">
                <div className="service-number">{index + 1}</div>
                {service.photos && service.photos.length > 0 && (
                  <div className="service-image">
                    <img 
                      src={service.photos[0].url} 
                      alt={service.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="service-info">
                  <h4>{service.name}</h4>
                  <p className="service-address">📍 {service.address}</p>
                  
                  {service.rating && (
                    <div className="service-rating">
                      <span className="stars">⭐ {service.rating.toFixed(1)}</span>
                      <span className="reviews">({service.userRatingsTotal} reviews)</span>
                    </div>
                  )}
                  
                  {service.openNow !== null && (
                    <p className={`service-status ${service.openNow ? 'open' : 'closed'}`}>
                      {service.openNow ? '🟢 Open Now' : '🔴 Closed'}
                    </p>
                  )}
                  
                  {searchedLocation && (
                    <p className="service-distance">
                      📏 {calculateDistance(
                        searchedLocation.latitude,
                        searchedLocation.longitude,
                        service.location.lat,
                        service.location.lng
                      )} km away
                    </p>
                  )}
                  
                  <button
                    onClick={() => openInMaps(service.location.lat, service.location.lng, service.name)}
                    className="btn btn-secondary btn-block"
                    type="button"
                  >
                    🗺️ Get Directions
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && services.length === 0 && !error && searchedLocation && (
        <div className="no-results">
          <span className="no-results-icon">🔍</span>
          <h3>No Service Centers Found</h3>
          <p>Try increasing the search radius or searching in a different area.</p>
          <button 
            onClick={() => setRadius(Math.min(radius * 2, 50000))} 
            className="btn btn-primary"
            type="button"
            style={{ marginTop: '20px' }}
          >
            🔄 Increase Radius to {Math.min((radius * 2) / 1000, 50).toFixed(1)} km
          </button>
        </div>
      )}
    </div>
  );
};

export default ServiceLocator;