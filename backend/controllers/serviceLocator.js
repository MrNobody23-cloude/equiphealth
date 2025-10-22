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

// Get comprehensive search keywords for equipment type
const getSearchKeywords = (equipmentType) => {
  const keywordMaps = {
    // Electronics & Computers
    laptop: [
      'laptop repair', 'computer repair', 'notebook repair', 'laptop service center',
      'computer service', 'electronics repair', 'tech repair', 'laptop screen repair',
      'laptop battery replacement', 'computer hardware repair'
    ],
    desktop: [
      'computer repair', 'desktop repair', 'PC repair', 'computer service center',
      'tech repair shop', 'computer hardware service', 'desktop service'
    ],
    phone: [
      'phone repair', 'mobile repair', 'cell phone repair', 'smartphone repair',
      'mobile service center', 'iPhone repair', 'Android repair', 'screen repair',
      'phone screen replacement', 'mobile phone service'
    ],
    tablet: [
      'tablet repair', 'iPad repair', 'tablet service', 'electronics repair',
      'mobile device repair', 'tablet screen repair'
    ],
    computer: [
      'computer repair', 'PC repair', 'tech repair', 'computer service',
      'IT repair', 'computer support', 'computer maintenance'
    ],
    printer: [
      'printer repair', 'printer service', 'copier repair', 'scanner repair',
      'office equipment repair', 'printer maintenance'
    ],
    monitor: [
      'monitor repair', 'display repair', 'screen repair', 'LCD repair',
      'LED repair', 'computer monitor service'
    ],

    // Industrial Equipment
    motor: [
      'motor repair', 'electric motor repair', 'motor service', 'industrial motor repair',
      'motor rewinding', 'motor maintenance', 'electric motor service'
    ],
    pump: [
      'pump repair', 'water pump repair', 'pump service', 'industrial pump repair',
      'submersible pump repair', 'pump maintenance', 'pump installation'
    ],
    compressor: [
      'compressor repair', 'air compressor repair', 'compressor service',
      'industrial compressor repair', 'AC compressor repair', 'compressor maintenance'
    ],
    generator: [
      'generator repair', 'genset repair', 'generator service', 'diesel generator repair',
      'power generator repair', 'generator maintenance', 'generator installation'
    ],
    turbine: [
      'turbine repair', 'turbine service', 'industrial turbine repair',
      'steam turbine repair', 'turbine maintenance'
    ],
    conveyor: [
      'conveyor repair', 'conveyor system repair', 'material handling repair',
      'industrial equipment repair', 'conveyor maintenance'
    ],
    transformer: [
      'transformer repair', 'electrical transformer repair', 'transformer service',
      'power transformer repair', 'transformer maintenance'
    ],
    industrial_machine: [
      'industrial equipment repair', 'machinery repair', 'industrial maintenance',
      'equipment service', 'industrial repair service', 'machine shop'
    ],

    // HVAC & Appliances
    hvac: [
      'HVAC repair', 'air conditioning repair', 'heating repair', 'HVAC service',
      'AC repair', 'climate control repair', 'HVAC maintenance', 'AC service'
    ],
    refrigerator: [
      'refrigerator repair', 'fridge repair', 'appliance repair', 'refrigerator service',
      'freezer repair', 'appliance service center'
    ],
    washing_machine: [
      'washing machine repair', 'washer repair', 'laundry machine repair',
      'appliance repair', 'dryer repair', 'washing machine service'
    ],
    microwave: [
      'microwave repair', 'microwave oven repair', 'appliance repair',
      'kitchen appliance repair', 'microwave service'
    ],
    dishwasher: [
      'dishwasher repair', 'appliance repair', 'kitchen appliance repair',
      'dishwasher service', 'dishwasher maintenance'
    ],
    water_heater: [
      'water heater repair', 'geyser repair', 'water heater service',
      'boiler repair', 'water heater installation'
    ],

    // Automotive & Heavy Equipment
    vehicle: [
      'auto repair', 'car repair', 'vehicle service', 'automobile repair',
      'mechanic', 'auto service center', 'car service', 'automotive repair'
    ],
    bike: [
      'bike repair', 'motorcycle repair', 'bike service', 'two wheeler repair',
      'motorcycle mechanic', 'bike service center'
    ],
    construction: [
      'construction equipment repair', 'heavy equipment repair', 'excavator repair',
      'bulldozer repair', 'construction machinery service'
    ],
    agricultural: [
      'agricultural equipment repair', 'farm equipment repair', 'tractor repair',
      'agricultural machinery repair', 'farm machinery service'
    ],

    // Power & Energy
    battery: [
      'battery repair', 'UPS repair', 'battery service', 'inverter repair',
      'power backup repair', 'battery replacement', 'UPS service'
    ],
    solar: [
      'solar panel repair', 'solar inverter repair', 'solar system service',
      'renewable energy repair', 'solar panel installation'
    ],
    electrical: [
      'electrical repair', 'electrician', 'electrical service',
      'electrical equipment repair', 'electrical maintenance'
    ],

    // General
    all: [
      'repair service', 'maintenance service', 'repair shop', 'service center',
      'equipment repair', 'appliance repair', 'electronics repair', 'technical service'
    ]
  };

  return keywordMaps[equipmentType] || keywordMaps.all;
};

// Perform nearby search
const performNearbySearch = async (lat, lng, keyword, radius, apiKey) => {
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
      params: {
        location: `${lat},${lng}`,
        radius: radius,
        keyword: keyword,
        key: apiKey
      }
    });

    if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
      return response.data.results || [];
    }
    
    return [];
  } catch (error) {
    console.error(`Nearby search error for "${keyword}":`, error.message);
    return [];
  }
};

// Perform text search
const performTextSearch = async (lat, lng, query, radius, apiKey) => {
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: {
        query: query,
        location: `${lat},${lng}`,
        radius: radius,
        key: apiKey
      }
    });

    if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
      return response.data.results || [];
    }
    
    return [];
  } catch (error) {
    console.error(`Text search error for "${query}":`, error.message);
    return [];
  }
};

// Format place data
const formatPlace = (place, apiKey) => ({
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
  businessStatus: place.business_status,
  photos: place.photos?.slice(0, 3).map(photo => ({
    reference: photo.photo_reference,
    url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${apiKey}`
  })) || []
});

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// @desc    Find nearby service centers with maximum coverage
// @route   GET /api/service-locator
// @access  Protected
router.get('/', async (req, res) => {
  try {
    const { lat, lng, type, radius, address, pincode, city, landmark } = req.query;

    console.log('🔍 Service Locator Request:', req.query);

    let latitude, longitude, locationSource;

    // Determine location based on input
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
    } else if (pincode) {
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
    } else if (landmark) {
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
    } else if (city) {
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
    } else if (address) {
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
    } else {
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

    // Check API key
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      console.error('❌ Google Maps API key not configured');
      return res.status(503).json({
        success: false,
        error: 'Service locator is not configured'
      });
    }

    const searchRadius = parseInt(radius) || 5000;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    console.log('📍 Location:', latitude, longitude);
    console.log('📏 Search Radius:', searchRadius, 'meters');
    console.log('⚙️ Equipment Type:', type);
    console.log('🎯 Source:', locationSource);

    // Get keywords for the equipment type
    const keywords = getSearchKeywords(type);
    console.log(`🔎 Using ${keywords.length} keywords for search`);

    // Use Map to store unique places by place_id
    const placesMap = new Map();

    // Strategy 1: Multiple radius searches (graduated coverage)
    const radii = [
      searchRadius * 0.3,  // 30% of radius
      searchRadius * 0.6,  // 60% of radius
      searchRadius,        // Full radius
      searchRadius * 1.5   // 150% of radius (extended)
    ].map(r => Math.min(Math.round(r), 50000)); // Cap at 50km

    console.log('📏 Search radii:', radii.map(r => `${(r/1000).toFixed(1)}km`).join(', '));

    // Strategy 2: Use all keywords with nearby search
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      
      for (const radius of radii) {
        try {
          const results = await performNearbySearch(latitude, longitude, keyword, radius, apiKey);
          
          results.forEach(place => {
            if (place.business_status !== 'CLOSED_PERMANENTLY' && !placesMap.has(place.place_id)) {
              placesMap.set(place.place_id, formatPlace(place, apiKey));
            }
          });

          // Small delay to avoid rate limiting
          await delay(50);
        } catch (error) {
          console.error(`Error in nearby search for "${keyword}" at ${radius}m:`, error.message);
        }
      }

      // Log progress
      if ((i + 1) % 3 === 0 || i === keywords.length - 1) {
        console.log(`✅ Processed ${i + 1}/${keywords.length} keywords, found ${placesMap.size} unique places`);
      }
    }

    // Strategy 3: Text search for broader coverage (use top 5 keywords)
    console.log('🔍 Performing text searches for broader coverage...');
    const topKeywords = keywords.slice(0, 5);
    
    for (const keyword of topKeywords) {
      for (const radius of radii.slice(1)) { // Skip smallest radius for text search
        try {
          const results = await performTextSearch(latitude, longitude, keyword, radius, apiKey);
          
          results.forEach(place => {
            if (place.business_status !== 'CLOSED_PERMANENTLY' && !placesMap.has(place.place_id)) {
              placesMap.set(place.place_id, formatPlace(place, apiKey));
            }
          });

          await delay(100);
        } catch (error) {
          console.error(`Error in text search for "${keyword}":`, error.message);
        }
      }
    }

    console.log(`✅ Text search complete, total unique places: ${placesMap.size}`);

    // Convert to array
    let places = Array.from(placesMap.values());

    // Calculate distance for each place
    places = places.map(place => {
      const distance = calculateDistance(
        latitude,
        longitude,
        place.location.lat,
        place.location.lng
      );
      return { ...place, distance };
    });

    // Sort by relevance (rating, reviews, distance)
    places.sort((a, b) => {
      // Calculate relevance score
      const scoreA = calculateRelevanceScore(a);
      const scoreB = calculateRelevanceScore(b);
      return scoreB - scoreA;
    });

    console.log(`🎯 Final results: ${places.length} service centers found`);

    res.status(200).json({
      success: true,
      count: places.length,
      location: { latitude, longitude, source: locationSource },
      searchParams: { 
        radius: searchRadius, 
        equipmentType: type,
        keywordsUsed: keywords.length,
        searchStrategies: ['nearby_search', 'text_search', 'multi_radius']
      },
      places: places.slice(0, 60) // Return top 60 results
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

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// Calculate relevance score
function calculateRelevanceScore(place) {
  let score = 0;

  // Rating contribution (0-40 points)
  if (place.rating) {
    score += (place.rating / 5) * 40;
  }

  // Review count contribution (0-25 points)
  if (place.userRatingsTotal) {
    score += Math.min(place.userRatingsTotal / 10, 25);
  }

  // Distance penalty (closer is better, max penalty 30 points)
  if (place.distance) {
    const distancePenalty = Math.min(place.distance / 2, 30);
    score -= distancePenalty;
  }

  // Open now bonus (10 points)
  if (place.openNow === true) {
    score += 10;
  }

  // Photos bonus (5 points)
  if (place.photos && place.photos.length > 0) {
    score += 5;
  }

  return score;
}

module.exports = router;