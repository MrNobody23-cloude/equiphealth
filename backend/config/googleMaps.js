const axios = require('axios');

class GoogleMapsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api';
  }

  /**
   * Geocode an address to latitude/longitude
   */
  async geocodeAddress(address) {
    try {
      const response = await axios.get(`${this.baseUrl}/geocode/json`, {
        params: {
          address: address,
          key: this.apiKey
        }
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        return {
          success: true,
          latitude: location.lat,
          longitude: location.lng,
          formattedAddress: response.data.results[0].formatted_address
        };
      } else {
        return {
          success: false,
          error: 'Location not found'
        };
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      return {
        success: false,
        error: 'Geocoding service error'
      };
    }
  }

  /**
   * Get comprehensive equipment-specific search keywords
   */
  getSearchKeywords(equipmentType) {
    const keywordMaps = {
      // Electronics & Computers
      laptop: [
        'laptop repair', 'computer repair', 'notebook repair', 'laptop service center',
        'computer service', 'electronics repair', 'tech repair', 'laptop screen repair',
        'laptop battery replacement', 'computer hardware repair', 'laptop keyboard repair',
        'laptop charger repair', 'laptop upgrade service'
      ],
      desktop: [
        'computer repair', 'desktop repair', 'PC repair', 'computer service center',
        'tech repair shop', 'computer hardware service', 'desktop service',
        'PC maintenance', 'computer upgrade'
      ],
      phone: [
        'phone repair', 'mobile repair', 'cell phone repair', 'smartphone repair',
        'mobile service center', 'iPhone repair', 'Android repair', 'screen repair',
        'phone screen replacement', 'mobile phone service', 'phone battery replacement',
        'mobile screen fix', 'smartphone service'
      ],
      tablet: [
        'tablet repair', 'iPad repair', 'tablet service', 'electronics repair',
        'mobile device repair', 'tablet screen repair', 'iPad screen replacement',
        'tablet battery replacement'
      ],
      computer: [
        'computer repair', 'PC repair', 'tech repair', 'computer service',
        'IT repair', 'computer support', 'computer maintenance', 'computer shop',
        'tech support'
      ],
      printer: [
        'printer repair', 'printer service', 'copier repair', 'scanner repair',
        'office equipment repair', 'printer maintenance', 'printer fix',
        'copier service'
      ],
      monitor: [
        'monitor repair', 'display repair', 'screen repair', 'LCD repair',
        'LED repair', 'computer monitor service', 'monitor fix'
      ],

      // Industrial Equipment
      motor: [
        'motor repair', 'electric motor repair', 'motor service', 'industrial motor repair',
        'motor rewinding', 'motor maintenance', 'electric motor service', 'motor shop',
        'motor coil rewinding', 'AC motor repair', 'DC motor repair'
      ],
      pump: [
        'pump repair', 'water pump repair', 'pump service', 'industrial pump repair',
        'submersible pump repair', 'pump maintenance', 'pump installation',
        'centrifugal pump repair', 'pump motor repair'
      ],
      compressor: [
        'compressor repair', 'air compressor repair', 'compressor service',
        'industrial compressor repair', 'AC compressor repair', 'compressor maintenance',
        'compressor installation', 'screw compressor repair'
      ],
      generator: [
        'generator repair', 'genset repair', 'generator service', 'diesel generator repair',
        'power generator repair', 'generator maintenance', 'generator installation',
        'alternator repair', 'genset service'
      ],
      turbine: [
        'turbine repair', 'turbine service', 'industrial turbine repair',
        'steam turbine repair', 'turbine maintenance', 'gas turbine service'
      ],
      conveyor: [
        'conveyor repair', 'conveyor system repair', 'material handling repair',
        'industrial equipment repair', 'conveyor maintenance', 'belt conveyor repair'
      ],
      transformer: [
        'transformer repair', 'electrical transformer repair', 'transformer service',
        'power transformer repair', 'transformer maintenance', 'transformer rewinding'
      ],
      industrial_machine: [
        'industrial equipment repair', 'machinery repair', 'industrial maintenance',
        'equipment service', 'industrial repair service', 'machine shop',
        'industrial mechanic', 'machinery service'
      ],

      // HVAC & Appliances
      hvac: [
        'HVAC repair', 'air conditioning repair', 'heating repair', 'HVAC service',
        'AC repair', 'climate control repair', 'HVAC maintenance', 'AC service',
        'air conditioner repair', 'central AC repair', 'ductless AC repair'
      ],
      refrigerator: [
        'refrigerator repair', 'fridge repair', 'appliance repair', 'refrigerator service',
        'freezer repair', 'appliance service center', 'fridge service',
        'refrigerator maintenance'
      ],
      washing_machine: [
        'washing machine repair', 'washer repair', 'laundry machine repair',
        'appliance repair', 'dryer repair', 'washing machine service',
        'washer service', 'laundry appliance repair'
      ],
      microwave: [
        'microwave repair', 'microwave oven repair', 'appliance repair',
        'kitchen appliance repair', 'microwave service', 'oven repair'
      ],
      dishwasher: [
        'dishwasher repair', 'appliance repair', 'kitchen appliance repair',
        'dishwasher service', 'dishwasher maintenance', 'dishwasher fix'
      ],
      water_heater: [
        'water heater repair', 'geyser repair', 'water heater service',
        'boiler repair', 'water heater installation', 'geyser service',
        'tankless water heater repair'
      ],

      // Automotive & Heavy Equipment
      vehicle: [
        'auto repair', 'car repair', 'vehicle service', 'automobile repair',
        'mechanic', 'auto service center', 'car service', 'automotive repair',
        'auto garage', 'car mechanic', 'vehicle maintenance'
      ],
      bike: [
        'bike repair', 'motorcycle repair', 'bike service', 'two wheeler repair',
        'motorcycle mechanic', 'bike service center', 'motorcycle service',
        'bike garage', 'scooter repair'
      ],
      construction: [
        'construction equipment repair', 'heavy equipment repair', 'excavator repair',
        'bulldozer repair', 'construction machinery service', 'heavy machinery repair',
        'earthmoving equipment repair'
      ],
      agricultural: [
        'agricultural equipment repair', 'farm equipment repair', 'tractor repair',
        'agricultural machinery repair', 'farm machinery service', 'tractor service',
        'agricultural mechanic'
      ],

      // Power & Energy
      battery: [
        'battery repair', 'UPS repair', 'battery service', 'inverter repair',
        'power backup repair', 'battery replacement', 'UPS service',
        'inverter service', 'battery maintenance'
      ],
      solar: [
        'solar panel repair', 'solar inverter repair', 'solar system service',
        'renewable energy repair', 'solar panel installation', 'solar service',
        'solar panel maintenance'
      ],
      electrical: [
        'electrical repair', 'electrician', 'electrical service',
        'electrical equipment repair', 'electrical maintenance', 'electrical contractor',
        'electrical work'
      ],

      // General
      all: [
        'repair service', 'maintenance service', 'repair shop', 'service center',
        'equipment repair', 'appliance repair', 'electronics repair', 'technical service',
        'repair and service', 'maintenance center'
      ]
    };

    return keywordMaps[equipmentType] || keywordMaps.all;
  }

  /**
   * Enhanced search with multiple strategies
   */
  async enhancedSearch(latitude, longitude, equipmentType = 'all', maxRadius = 10000) {
    try {
      console.log(`🚀 Enhanced search for ${equipmentType} within ${maxRadius}m`);

      const allPlaces = new Map();
      const keywords = this.getSearchKeywords(equipmentType);
      const radii = [
        Math.round(maxRadius * 0.3),
        Math.round(maxRadius * 0.6),
        maxRadius,
        Math.min(Math.round(maxRadius * 1.5), 50000)
      ];

      console.log(`🔎 Using ${keywords.length} keywords`);
      console.log(`📏 Search radii: ${radii.map(r => (r/1000).toFixed(1) + 'km').join(', ')}`);

      // Nearby search
      for (let i = 0; i < keywords.length; i++) {
        for (const radius of radii) {
          try {
            const places = await this.performSingleSearch(latitude, longitude, keywords[i], radius);
            places.forEach(place => {
              if (!allPlaces.has(place.id)) {
                allPlaces.set(place.id, place);
              }
            });
            await this.delay(50);
          } catch (error) {
            console.error(`Search error for "${keywords[i]}":`, error.message);
          }
        }
        
        if ((i + 1) % 5 === 0) {
          console.log(`✅ Progress: ${i + 1}/${keywords.length} keywords, ${allPlaces.size} places found`);
        }
      }

      // Text search for top keywords
      const topKeywords = keywords.slice(0, 7);
      for (const keyword of topKeywords) {
        for (const radius of radii.slice(1)) {
          try {
            const textResults = await this.textSearch(keyword, latitude, longitude, radius);
            textResults.forEach(place => {
              if (!allPlaces.has(place.id)) {
                allPlaces.set(place.id, place);
              }
            });
            await this.delay(100);
          } catch (error) {
            console.error(`Text search error for "${keyword}":`, error.message);
          }
        }
      }

      const uniquePlaces = Array.from(allPlaces.values());

      // Sort by relevance
      uniquePlaces.sort((a, b) => {
        const scoreA = this.calculateRelevanceScore(a, latitude, longitude);
        const scoreB = this.calculateRelevanceScore(b, latitude, longitude);
        return scoreB - scoreA;
      });

      console.log(`✅ Enhanced search complete: ${uniquePlaces.length} unique service providers found`);

      return {
        success: true,
        places: uniquePlaces
      };
    } catch (error) {
      console.error('Enhanced search error:', error);
      return {
        success: false,
        error: 'Enhanced search failed',
        places: []
      };
    }
  }

  /**
   * Perform a single nearby search
   */
  async performSingleSearch(latitude, longitude, keyword, radius) {
    try {
      const response = await axios.get(`${this.baseUrl}/place/nearbysearch/json`, {
        params: {
          location: `${latitude},${longitude}`,
          radius: radius,
          keyword: keyword,
          key: this.apiKey
        }
      });

      if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
        const places = (response.data.results || []).map(place => ({
          id: place.place_id,
          name: place.name,
          location: place.vicinity || place.formatted_address || 'Address not available',
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          rating: place.rating || 0,
          reviews: place.user_ratings_total || 0,
          types: place.types || [],
          isOpen: place.opening_hours?.open_now,
          businessStatus: place.business_status,
          icon: place.icon,
          photos: place.photos ? place.photos.map(photo => photo.photo_reference) : []
        }));

        return places.filter(place => place.businessStatus !== 'CLOSED_PERMANENTLY');
      }
      
      return [];
    } catch (error) {
      console.error('Single search error:', error.message);
      return [];
    }
  }

  /**
   * Text search
   */
  async textSearch(query, latitude, longitude, radius = 10000) {
    try {
      const response = await axios.get(`${this.baseUrl}/place/textsearch/json`, {
        params: {
          query: query,
          location: `${latitude},${longitude}`,
          radius: radius,
          key: this.apiKey
        }
      });

      if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
        const places = (response.data.results || []).map(place => ({
          id: place.place_id,
          name: place.name,
          location: place.formatted_address || place.vicinity || 'Address not available',
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          rating: place.rating || 0,
          reviews: place.user_ratings_total || 0,
          types: place.types || [],
          isOpen: place.opening_hours?.open_now,
          businessStatus: place.business_status
        }));

        return places.filter(place => place.businessStatus !== 'CLOSED_PERMANENTLY');
      }
      
      return [];
    } catch (error) {
      console.error('Text search error:', error);
      return [];
    }
  }

  /**
   * Calculate relevance score
   */
  calculateRelevanceScore(place, userLat, userLng) {
    let score = 0;

    // Rating (0-40 points)
    if (place.rating) {
      score += (place.rating / 5) * 40;
    }

    // Reviews (0-25 points)
    if (place.reviews) {
      score += Math.min(place.reviews / 10, 25);
    }

    // Distance (penalty, max -30 points)
    const distance = this.calculateDistance(userLat, userLng, place.latitude, place.longitude);
    const distancePenalty = Math.min(distance / 2, 30);
    score -= distancePenalty;

    // Open now (+10 points)
    if (place.isOpen === true) {
      score += 10;
    }

    // Has photos (+5 points)
    if (place.photos && place.photos.length > 0) {
      score += 5;
    }

    return score;
  }

  /**
   * Calculate distance (Haversine)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get photo URL
   */
  getPhotoUrl(photoReference, maxWidth = 400) {
    if (!photoReference) return null;
    return `${this.baseUrl}/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.apiKey}`;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new GoogleMapsService();