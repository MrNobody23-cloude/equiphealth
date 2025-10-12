const googleMapsService = require('../config/googleMaps');

class ServiceLocatorController {
  
  /**
   * Get equipment-specific search keyword (deprecated - now in googleMaps.js)
   */
  getSearchKeyword(equipmentType) {
    // This is now handled in googleMapsService
    return equipmentType;
  }

  /**
   * Search for service providers near a location (Enhanced)
   */
  async searchProviders(req, res) {
    try {
      const { latitude, longitude, equipmentType, radius, enhanced } = req.query;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Latitude and longitude are required'
        });
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const searchRadius = parseInt(radius) || 8000;
      const useEnhanced = enhanced === 'true';

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid latitude or longitude'
        });
      }

      console.log(`🔍 Searching providers for ${equipmentType || 'all'} equipment`);
      console.log(`📍 Location: ${lat}, ${lng} | Radius: ${searchRadius}m | Enhanced: ${useEnhanced}`);

      // Use enhanced search for better results
      const result = useEnhanced 
        ? await googleMapsService.enhancedSearch(lat, lng, equipmentType || 'all', searchRadius)
        : await googleMapsService.searchNearbyPlaces(lat, lng, equipmentType || 'all', searchRadius);

      if (result.success) {
        console.log(`✅ Found ${result.places.length} providers`);
        res.json({
          success: true,
          providers: result.places,
          count: result.places.length
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to search providers',
          providers: []
        });
      }
    } catch (error) {
      console.error('❌ Search providers error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        providers: []
      });
    }
  }

  /**
   * Geocode an address to coordinates
   */
  async geocodeAddress(req, res) {
    try {
      const { address } = req.query;

      if (!address) {
        return res.status(400).json({
          success: false,
          error: 'Address is required'
        });
      }

      console.log(`🗺️  Geocoding address: ${address}`);

      const result = await googleMapsService.geocodeAddress(address);

      if (result.success) {
        console.log(`✅ Geocoded to: ${result.latitude}, ${result.longitude}`);
        res.json({
          success: true,
          location: {
            latitude: result.latitude,
            longitude: result.longitude,
            formattedAddress: result.formattedAddress
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error || 'Location not found'
        });
      }
    } catch (error) {
      console.error('❌ Geocode error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get detailed information about a specific place
   */
  async getPlaceDetails(req, res) {
    try {
      const { placeId } = req.params;

      if (!placeId) {
        return res.status(400).json({
          success: false,
          error: 'Place ID is required'
        });
      }

      console.log(`📋 Fetching details for place: ${placeId}`);

      const result = await googleMapsService.getPlaceDetails(placeId);

      if (result.success) {
        res.json({
          success: true,
          place: result.place
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error || 'Place not found'
        });
      }
    } catch (error) {
      console.error('❌ Get place details error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get photo URL
   */
  async getPhoto(req, res) {
    try {
      const { photoReference, maxWidth } = req.query;

      if (!photoReference) {
        return res.status(400).json({
          success: false,
          error: 'Photo reference is required'
        });
      }

      const photoUrl = googleMapsService.getPhotoUrl(photoReference, parseInt(maxWidth) || 400);

      res.json({
        success: true,
        photoUrl
      });
    } catch (error) {
      console.error('❌ Get photo error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = new ServiceLocatorController();