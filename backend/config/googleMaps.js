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
   * Get equipment-specific search keywords
   */
  getSearchKeywords(equipmentType) {
    const keywordMaps = {
      laptop: [
        'computer repair',
        'laptop repair',
        'electronics repair',
        'computer service center',
        'tech repair',
        'PC repair shop'
      ],
      phone: [
        'phone repair',
        'mobile repair',
        'cell phone repair',
        'smartphone repair',
        'electronics repair',
        'mobile service center'
      ],
      tablet: [
        'tablet repair',
        'iPad repair',
        'electronics repair',
        'mobile device repair',
        'tech repair'
      ],
      desktop: [
        'computer repair',
        'desktop repair',
        'PC repair',
        'computer service center',
        'tech repair shop'
      ],
      industrial_machine: [
        'industrial equipment repair',
        'machinery repair',
        'industrial maintenance',
        'equipment service',
        'industrial repair service'
      ],
      hvac: [
        'HVAC repair',
        'air conditioning repair',
        'heating repair',
        'HVAC service',
        'climate control repair'
      ],
      motor: [
        'motor repair',
        'electric motor repair',
        'motor service',
        'industrial motor repair'
      ],
      pump: [
        'pump repair',
        'water pump repair',
        'pump service',
        'industrial pump repair'
      ],
      compressor: [
        'compressor repair',
        'air compressor repair',
        'compressor service',
        'industrial compressor repair'
      ],
      all: [
        'repair service',
        'maintenance service',
        'repair shop',
        'service center',
        'electronics repair',
        'equipment repair'
      ]
    };

    return keywordMaps[equipmentType] || keywordMaps.all;
  }

  /**
   * Search for nearby places with multiple radii and keywords
   */
  async searchNearbyPlaces(latitude, longitude, equipmentType = 'all', maxRadius = 4000) {
    try {
      const keywords = this.getSearchKeywords(equipmentType);
      const radii = [500, 1000, 2000, 3000].filter(r => r <= maxRadius);
      
      console.log(`🔍 Searching for ${equipmentType} repair services...`);
      console.log(`📍 Location: ${latitude}, ${longitude}`);
      console.log(`🔎 Keywords: ${keywords.length}`);
      console.log(`📏 Radii: ${radii.join('m, ')}m`);

      const allPlaces = new Map(); // Use Map to deduplicate by place_id

      // Perform searches with different radii and keywords
      for (const keyword of keywords) {
        for (const radius of radii) {
          try {
            const places = await this.performSingleSearch(latitude, longitude, keyword, radius);
            
            // Add unique places to the map
            places.forEach(place => {
              if (!allPlaces.has(place.id)) {
                allPlaces.set(place.id, place);
              }
            });

            // Small delay to avoid rate limiting
            await this.delay(100);
          } catch (error) {
            console.error(`Search error for "${keyword}" at ${radius}m:`, error.message);
          }
        }
      }

      const uniquePlaces = Array.from(allPlaces.values());
      
      // Sort by rating and number of reviews
      uniquePlaces.sort((a, b) => {
        // Prioritize places with ratings
        if (a.rating && !b.rating) return -1;
        if (!a.rating && b.rating) return 1;
        
        // If both have ratings, sort by rating first, then by number of reviews
        if (a.rating && b.rating) {
          if (Math.abs(a.rating - b.rating) > 0.3) {
            return b.rating - a.rating;
          }
          return b.reviews - a.reviews;
        }
        
        // If neither has ratings, sort by reviews
        return b.reviews - a.reviews;
      });

      console.log(`✅ Found ${uniquePlaces.length} unique service providers`);

      return {
        success: true,
        places: uniquePlaces
      };
    } catch (error) {
      console.error('Places search error:', error);
      return {
        success: false,
        error: 'Places search service error',
        places: []
      };
    }
  }

  /**
   * Perform a single search request
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

        // Filter out permanently closed places
        return places.filter(place => place.businessStatus !== 'CLOSED_PERMANENTLY');
      } else if (response.data.status === 'OVER_QUERY_LIMIT') {
        console.warn('⚠️  Google Maps API quota exceeded');
        return [];
      } else {
        console.warn(`Search returned status: ${response.data.status}`);
        return [];
      }
    } catch (error) {
      console.error('Single search error:', error.message);
      return [];
    }
  }

  /**
   * Search with text query (more flexible)
   */
  async textSearch(query, latitude, longitude, radius = 5000) {
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
      } else {
        return [];
      }
    } catch (error) {
      console.error('Text search error:', error);
      return [];
    }
  }

  /**
   * Enhanced search combining nearby and text search
   */
  async enhancedSearch(latitude, longitude, equipmentType = 'all', maxRadius = 8000) {
    try {
      console.log(`🚀 Starting enhanced search for ${equipmentType}...`);

      const allPlaces = new Map();

      // 1. Perform nearby search with keywords
      const nearbyResult = await this.searchNearbyPlaces(latitude, longitude, equipmentType, maxRadius);
      if (nearbyResult.success) {
        nearbyResult.places.forEach(place => {
          allPlaces.set(place.id, place);
        });
      }

      // 2. Perform text searches for better coverage
      const keywords = this.getSearchKeywords(equipmentType);
      for (const keyword of keywords.slice(0, 3)) { // Use top 3 keywords for text search
        const textResults = await this.textSearch(keyword, latitude, longitude, maxRadius);
        textResults.forEach(place => {
          if (!allPlaces.has(place.id)) {
            allPlaces.set(place.id, place);
          }
        });
        await this.delay(150);
      }

      const uniquePlaces = Array.from(allPlaces.values());

      // Sort by relevance
      uniquePlaces.sort((a, b) => {
        // Calculate relevance score
        const scoreA = this.calculateRelevanceScore(a, latitude, longitude);
        const scoreB = this.calculateRelevanceScore(b, latitude, longitude);
        return scoreB - scoreA;
      });

      console.log(`✅ Enhanced search found ${uniquePlaces.length} providers`);

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
   * Calculate relevance score for a place
   */
  calculateRelevanceScore(place, userLat, userLng) {
    let score = 0;

    // Rating contribution (0-50 points)
    if (place.rating) {
      score += (place.rating / 5) * 40;
    }

    // Review count contribution (0-20 points)
    if (place.reviews) {
      score += Math.min(place.reviews / 10, 20);
    }

    // Distance penalty (closer is better)
    const distance = this.calculateDistance(userLat, userLng, place.latitude, place.longitude);
    const distancePenalty = Math.min(distance / 100, 30); // Max penalty of 30 points
    score -= distancePenalty;

    // Business status bonus
    if (place.isOpen === true) {
      score += 10;
    }

    return score;
  }

  /**
   * Calculate distance between two points (in km)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
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
   * Get place details
   */
  async getPlaceDetails(placeId) {
    try {
      const response = await axios.get(`${this.baseUrl}/place/details/json`, {
        params: {
          place_id: placeId,
          fields: 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,opening_hours,geometry,business_status,price_level,reviews',
          key: this.apiKey
        }
      });

      if (response.data.status === 'OK') {
        const place = response.data.result;
        return {
          success: true,
          place: {
            name: place.name,
            address: place.formatted_address,
            phone: place.formatted_phone_number,
            website: place.website,
            rating: place.rating,
            reviews: place.user_ratings_total,
            openNow: place.opening_hours?.open_now,
            hours: place.opening_hours?.weekday_text,
            latitude: place.geometry?.location.lat,
            longitude: place.geometry?.location.lng,
            businessStatus: place.business_status,
            priceLevel: place.price_level,
            userReviews: place.reviews ? place.reviews.slice(0, 5).map(review => ({
              author: review.author_name,
              rating: review.rating,
              text: review.text,
              time: review.relative_time_description
            })) : []
          }
        };
      } else {
        return {
          success: false,
          error: 'Place details not found'
        };
      }
    } catch (error) {
      console.error('Place details error:', error);
      return {
        success: false,
        error: 'Place details service error'
      };
    }
  }

  /**
   * Get photo URL
   */
  getPhotoUrl(photoReference, maxWidth = 400) {
    if (!photoReference) return null;
    return `${this.baseUrl}/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.apiKey}`;
  }

  /**
   * Delay helper to avoid rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new GoogleMapsService();