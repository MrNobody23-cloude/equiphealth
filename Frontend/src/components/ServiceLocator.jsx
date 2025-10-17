import { useState, useEffect } from 'react';
import api from '../services/api';
import './ServiceLocator.css';

const ServiceLocator = ({ equipmentList }) => {
  const [searchMethod, setSearchMethod] = useState('current'); // current, pincode, city, landmark, coordinates
  const [location, setLocation] = useState(null);
  const [searchInputs, setSearchInputs] = useState({
    pincode: '',
    city: '',
    landmark: '',
    address: '',
    latitude: '',
    longitude: ''
  });
  const [equipmentType, setEquipmentType] = useState('motor');
  const [radius, setRadius] = useState(5000);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [searchedLocation, setSearchedLocation] = useState(null);

  // Get current location on mount
  useEffect(() => {
    if (searchMethod === 'current') {
      getCurrentLocation();
    }
  }, [searchMethod]);

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
        setLocationError('Unable to get location. Try another search method.');
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

    // Build search parameters based on method
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

      const response = await api.get('/service-locator', { params });

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
    window.open(url, '_blank');
  };

  return (
    <div className="service-locator">
      <div className="locator-header">
        <h2>🔧 Service Center Locator</h2>
        <p>Find nearby equipment repair and maintenance services</p>
      </div>

      {/* Search Method Selection */}
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

      {/* Location Status */}
      {searchMethod === 'current' && (
        <div className={`location-status ${location ? 'active' : 'inactive'}`}>
          {location ? (
            <>
              <span className="status-icon">📍</span>
              <span>Location: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span>
              <button onClick={getCurrentLocation} className="btn-link">
                🔄 Refresh
              </button>
            </>
          ) : (
            <>
              <span className="status-icon">⚠️</span>
              <span>{locationError || 'Getting your location...'}</span>
              {locationError && (
                <button onClick={getCurrentLocation} className="btn-link">
                  Try again
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Searched Location Display */}
      {searchedLocation && (
        <div className="searched-location">
          <span className="status-icon">✅</span>
          <span>Searching near: {searchedLocation.source || `${searchedLocation.latitude.toFixed(4)}, ${searchedLocation.longitude.toFixed(4)}`}</span>
        </div>
      )}

      {/* Search Form */}
      <form onSubmit={handleSearch} className="locator-form">
        {/* Pincode Input */}
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

        {/* City/Area Input */}
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

        {/* Landmark Input */}
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

        {/* Address Input */}
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

        {/* Coordinates Input */}
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

        {/* Equipment Type */}
        <div className="form-group">
          <label htmlFor="equipmentType">⚙️ Equipment Type</label>
          <select
            id="equipmentType"
            value={equipmentType}
            onChange={(e) => setEquipmentType(e.target.value)}
            className="form-select"
          >
            <option value="motor">Motor</option>
            <option value="pump">Pump</option>
            <option value="compressor">Compressor</option>
            <option value="generator">Generator</option>
            <option value="turbine">Turbine</option>
            <option value="conveyor">Conveyor</option>
          </select>
        </div>

        {/* Search Radius */}
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

        {/* Error Message */}
        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
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

      {/* Results */}
      {services.length > 0 && (
        <div className="service-results">
          <div className="results-header">
            <h3>🎯 Found {services.length} Service Centers</h3>
            {searchedLocation && (
              <p className="results-subtitle">
                Near {searchedLocation.source || 'your location'}
              </p>
            )}
          </div>
          <div className="services-grid">
            {services.map((service) => (
              <div key={service.id} className="service-card">
                {service.photos && service.photos.length > 0 && (
                  <div className="service-image">
                    <img src={service.photos[0].url} alt={service.name} />
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
                  >
                    🗺️ Open in Google Maps
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && services.length === 0 && !error && searchedLocation && (
        <div className="no-results">
          <span className="no-results-icon">🔍</span>
          <h3>No Service Centers Found</h3>
          <p>Try increasing the search radius or searching in a different area.</p>
        </div>
      )}
    </div>
  );
};

export default ServiceLocator;