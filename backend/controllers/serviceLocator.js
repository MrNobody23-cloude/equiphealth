const express = require('express');
const router = express.Router();
const axios = require('axios');

// Helper: Geocode address/pincode/landmark to coordinates
const geocodeLocation = async (address) => {
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: address,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
        formattedAddress: response.data.results[0].formatted_address
      };
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error.message);
    return null;
  }
};

// @desc    Find nearby service centers
// @route   GET /api/service-locator
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { lat, lng, type, radius, address, pincode, city, landmark } = req.query;

    console.log('🔍 Service Locator Request:', req.query);

    let latitude, longitude, locationSource;

    // Priority 1: Use coordinates if provided
    if (lat && lng) {
      latitude = parseFloat(lat);
      longitude = parseFloat(lng);
      locationSource = 'coordinates';
      
      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates'
        });
      }
    }
    // Priority 2: Use pincode
    else if (pincode) {
      console.log('📮 Geocoding pincode:', pincode);
      const geocoded = await geocodeLocation(pincode);
      
      if (!geocoded) {
        return res.status(400).json({
          success: false,
          error: 'Could not find location for this pincode'
        });
      }
      
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      locationSource = `pincode: ${pincode} (${geocoded.formattedAddress})`;
    }
    // Priority 3: Use landmark
    else if (landmark) {
      console.log('🏛️ Geocoding landmark:', landmark);
      const geocoded = await geocodeLocation(landmark);
      
      if (!geocoded) {
        return res.status(400).json({
          success: false,
          error: 'Could not find this landmark'
        });
      }
      
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      locationSource = `landmark: ${landmark} (${geocoded.formattedAddress})`;
    }
    // Priority 4: Use city
    else if (city) {
      console.log('🏙️ Geocoding city:', city);
      const geocoded = await geocodeLocation(city);
      
      if (!geocoded) {
        return res.status(400).json({
          success: false,
          error: 'Could not find this city'
        });
      }
      
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      locationSource = `city: ${city} (${geocoded.formattedAddress})`;
    }
    // Priority 5: Use full address
    else if (address) {
      console.log('🏠 Geocoding address:', address);
      const geocoded = await geocodeLocation(address);
      
      if (!geocoded) {
        return res.status(400).json({
          success: false,
          error: 'Could not find this address'
        });
      }
      
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      locationSource = `address: ${geocoded.formattedAddress}`;
    }
    // No location provided
    else {
      return res.status(400).json({
        success: false,
        error: 'Please provide location (coordinates, pincode, city, landmark, or address)'
      });
    }

    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        error: 'Coordinates out of range'
      });
    }

    // Check if Google Maps API key is configured
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      console.error('❌ Google Maps API key not configured');
      return res.status(503).json({
        success: false,
        error: 'Service locator is not configured'
      });
    }

    const searchRadius = parseInt(radius) || 5000; // Default 5km

    // Determine search keyword
    let keyword = 'equipment repair service';
    if (type) {
      const typeKeywords = {
        motor: 'electric motor repair service',
        pump: 'industrial pump repair service',
        compressor: 'compressor repair service',
        generator: 'generator repair service',
        turbine: 'turbine service center',
        conveyor: 'conveyor system repair'
      };
      keyword = typeKeywords[type.toLowerCase()] || `${type} repair service`;
    }

    console.log('🔍 Searching for:', keyword);
    console.log('📍 Location:', latitude, longitude);
    console.log('📏 Radius:', searchRadius, 'meters');
    console.log('🎯 Source:', locationSource);

    // Call Google Places API
    const placesUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
    const response = await axios.get(placesUrl, {
      params: {
        location: `${latitude},${longitude}`,
        radius: searchRadius,
        keyword: keyword,
        key: process.env.GOOGLE_MAPS_API_KEY
      },
      timeout: 10000
    });

    console.log('📡 Google API Status:', response.data.status);

    // Handle zero results
    if (response.data.status === 'ZERO_RESULTS') {
      console.log('⚠️  No results, trying broader search...');
      
      const broadResponse = await axios.get(placesUrl, {
        params: {
          location: `${latitude},${longitude}`,
          radius: searchRadius * 2,
          keyword: 'industrial repair service',
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });

      if (broadResponse.data.status === 'OK') {
        const places = formatPlaces(broadResponse.data.results);
        return res.status(200).json({
          success: true,
          count: places.length,
          location: { latitude, longitude, source: locationSource },
          searchParams: { radius: searchRadius * 2, keyword: 'industrial repair service' },
          places
        });
      }

      return res.status(200).json({
        success: true,
        count: 0,
        location: { latitude, longitude, source: locationSource },
        places: [],
        message: 'No service centers found nearby. Try increasing the search radius.'
      });
    }

    if (response.data.status !== 'OK') {
      console.error('❌ Google API Error:', response.data.status);
      return res.status(500).json({
        success: false,
        error: `Google Maps API error: ${response.data.status}`
      });
    }

    // Format results
    const places = formatPlaces(response.data.results);

    console.log(`✅ Found ${places.length} service centers`);

    res.status(200).json({
      success: true,
      count: places.length,
      location: { latitude, longitude, source: locationSource },
      searchParams: { radius: searchRadius, keyword },
      places
    });

  } catch (error) {
    console.error('❌ Service Locator Error:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service locations',
      message: error.message
    });
  }
});

// Helper function to format places
function formatPlaces(results) {
  return results.slice(0, 10).map(place => ({
    id: place.place_id,
    name: place.name,
    address: place.vicinity || place.formatted_address || 'Address not available',
    location: {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng
    },
    rating: place.rating || null,
    userRatingsTotal: place.user_ratings_total || 0,
    types: place.types || [],
    openNow: place.opening_hours?.open_now || null,
    photos: place.photos?.slice(0, 1).map(photo => ({
      reference: photo.photo_reference,
      url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    })) || []
  }));
}

module.exports = router;