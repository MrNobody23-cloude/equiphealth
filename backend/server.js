require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/database');
require('./config/passport');
const emailService = require('./config/emailService');

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== TRUST PROXY ====================
app.set('trust proxy', 1);

// ==================== CORS ====================
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'https://equiphealth-23.web.app',
  'https://equiphealth-23.firebaseapp.com'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('⚠️  Blocked origin:', origin);
      callback(null, process.env.NODE_ENV !== 'production');
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ==================== BASIC MIDDLEWARE ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ==================== SESSION ====================
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600,
    crypto: {
      secret: process.env.SESSION_SECRET
    }
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// ==================== PASSPORT ====================
app.use(passport.initialize());
app.use(passport.session());

// ==================== LOGGING MIDDLEWARE ====================
app.use((req, res, next) => {
  console.log(`📍 ${req.method} ${req.path}`);
  next();
});

// ==================== MODELS ====================
const EquipmentHistory = require('./models/EquipmentHistory');

// ==================== MIDDLEWARE ====================
const { protect } = require('./middleware/auth');
const { validatePredictionInput } = require('./utils/validators');

// ==================== CONTROLLERS ====================
let mlPredictionController;
try {
  mlPredictionController = require('./controllers/mlPrediction');
} catch (error) {
  console.warn('⚠️  ML controller not found:', error.message);
}

// ==================== GMAIL OAUTH2 ROUTES ====================

console.log('\n🔧 Registering Gmail OAuth2 routes...');

// Gmail Status
app.get('/auth/gmail/status', (req, res) => {
  console.log('✅ /auth/gmail/status route handler executed');
  try {
    const gmailService = require('./config/gmail');
    const status = gmailService.getStatus();
    const allConfigured = status.hasClientId && status.hasClientSecret && 
                         status.hasRefreshToken && status.hasUserEmail;
    
    res.json({
      success: true,
      configured: allConfigured,
      initialized: status.initialized,
      status: {
        clientId: status.hasClientId ? '✅ Set' : '❌ Missing',
        clientSecret: status.hasClientSecret ? '✅ Set' : '❌ Missing',
        refreshToken: status.hasRefreshToken ? '✅ Set' : '❌ Missing',
        userEmail: status.hasUserEmail ? `✅ ${process.env.GMAIL_USER_EMAIL}` : '❌ Missing',
        method: status.method,
        redirectUri: status.redirectUri
      },
      message: allConfigured 
        ? 'Gmail OAuth2 fully configured' 
        : 'Gmail OAuth2 needs configuration',
      setupUrl: !status.hasRefreshToken
        ? `${req.protocol}://${req.get('host')}/auth/gmail/authorize`
        : null
    });
  } catch (error) {
    console.error('❌ Status route error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Gmail Authorization
app.get('/auth/gmail/authorize', (req, res) => {
  console.log('✅ /auth/gmail/authorize route handler executed');
  try {
    const gmailService = require('./config/gmail');
    const authUrl = gmailService.getAuthUrl();
    console.log('🔗 Redirecting to Google OAuth...');
    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ Authorization error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Authorization Error</title></head>
      <body>
        <h1>❌ Authorization Error</h1>
        <p>${error.message}</p>
        <a href="/">← Back to Home</a>
      </body>
      </html>
    `);
  }
});

// Gmail Callback
app.get('/auth/gmail/callback', async (req, res) => {
  console.log('✅ /auth/gmail/callback route handler executed');
  try {
    const gmailService = require('./config/gmail');
    const { code, error } = req.query;
    
    if (error) {
      return res.status(400).send(`<h1>❌ OAuth Error: ${error}</h1><a href="/auth/gmail/authorize">Try Again</a>`);
    }
    
    if (!code) {
      return res.status(400).send('<h1>❌ Missing authorization code</h1><a href="/auth/gmail/authorize">Try Again</a>');
    }
    
    const tokens = await gmailService.getTokens(code);
    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail OAuth2 Success</title>
        <style>
          body { font-family: Arial; max-width: 800px; margin: 40px auto; padding: 20px; }
          .token-box { background: #f0f0f0; padding: 15px; border-radius: 5px; word-break: break-all; margin: 20px 0; }
          .copy-btn { background: #4285f4; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h1>✅ Gmail OAuth2 Success!</h1>
        ${tokens.refresh_token ? `
          <h2>Your Refresh Token:</h2>
          <div class="token-box" id="token">${tokens.refresh_token}</div>
          <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('token').textContent)">Copy Token</button>
          <h3>Add to Render Environment:</h3>
          <p><code>GMAIL_REFRESH_TOKEN=${tokens.refresh_token}</code></p>
        ` : '<p>No refresh token received. Revoke access and try again.</p>'}
      </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ Callback error:', error);
    res.status(500).send(`<h1>❌ Error: ${error.message}</h1>`);
  }
});

console.log('✅ Gmail OAuth2 routes registered\n');

// ==================== PUBLIC ROUTES ====================

app.get('/', (req, res) => {
  res.json({
    message: '🤖 AI Equipment Health Monitor API',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    database: global.dbConnected ? 'connected' : 'in-memory',
    email: {
      configured: emailService.getStatus().anyAvailable,
      providers: emailService.getStatus().providers
    },
    endpoints: {
      gmailStatus: '/auth/gmail/status',
      gmailAuth: '/auth/gmail/authorize',
      emailStatus: '/api/email/status',
      auth: '/api/auth',
      predict: '/api/predict',
      history: '/api/history',
      stats: '/api/stats',
      serviceLocator: '/api/service-locator'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: global.dbConnected ? 'connected' : 'disconnected',
    email: emailService.getStatus().anyAvailable ? 'ready' : 'not-configured',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  });
});

// Email service status
app.get('/api/email/status', (req, res) => {
  const status = emailService.getStatus();
  res.json({
    success: true,
    status,
    timestamp: new Date().toISOString()
  });
});

// Email health check
app.get('/api/email/health', async (req, res) => {
  try {
    const health = await emailService.healthCheck();
    res.json({
      success: health.healthy,
      ...health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== AUTH ROUTES ====================
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// ==================== SERVICE LOCATOR ROUTES ====================

console.log('🔧 Registering Service Locator routes...');

// Service locator controller
const axios = require('axios');

// Search service providers
app.get('/api/service-locator', async (req, res) => {
  console.log('🔍 Service locator search requested');
  console.log('   Query params:', req.query);
  
  try {
    const { type, latitude, longitude, pincode, radius } = req.query;

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Google Maps API not configured'
      });
    }

    let searchLocation = { lat: null, lng: null };

    // Get coordinates from pincode if provided
    if (pincode) {
      console.log(`📍 Geocoding pincode: ${pincode}`);
      try {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${pincode}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
        const geocodeResponse = await axios.get(geocodeUrl);
        
        if (geocodeResponse.data.status === 'OK' && geocodeResponse.data.results.length > 0) {
          searchLocation = geocodeResponse.data.results[0].geometry.location;
          console.log(`✅ Geocoded: ${searchLocation.lat}, ${searchLocation.lng}`);
        } else {
          return res.status(400).json({
            success: false,
            error: 'Invalid pincode or location not found'
          });
        }
      } catch (geocodeError) {
        console.error('❌ Geocoding error:', geocodeError.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to geocode pincode'
        });
      }
    } else if (latitude && longitude) {
      searchLocation = { lat: parseFloat(latitude), lng: parseFloat(longitude) };
      console.log(`📍 Using coordinates: ${searchLocation.lat}, ${searchLocation.lng}`);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Please provide either pincode or coordinates (latitude and longitude)'
      });
    }

    // Determine search query based on equipment type
    const equipmentTypeMap = {
      laptop: 'laptop repair service',
      desktop: 'computer repair service',
      printer: 'printer repair service',
      fan: 'fan repair service',
      motor: 'motor repair service',
      ac: 'AC repair service',
      refrigerator: 'refrigerator repair service'
    };

    const searchQuery = equipmentTypeMap[type?.toLowerCase()] || 'electronics repair service';
    const searchRadius = radius || 5000; // Default 5km

    console.log(`🔍 Searching for: ${searchQuery} within ${searchRadius}m`);

    // Google Places Nearby Search API
    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${searchLocation.lat},${searchLocation.lng}&radius=${searchRadius}&keyword=${encodeURIComponent(searchQuery)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    
    const placesResponse = await axios.get(placesUrl);

    if (placesResponse.data.status !== 'OK' && placesResponse.data.status !== 'ZERO_RESULTS') {
      console.error('❌ Places API error:', placesResponse.data.status);
      return res.status(500).json({
        success: false,
        error: 'Google Places API error: ' + placesResponse.data.status,
        details: placesResponse.data.error_message
      });
    }

    const providers = placesResponse.data.results.map(place => ({
      id: place.place_id,
      name: place.name,
      address: place.vicinity,
      location: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      },
      rating: place.rating || 0,
      totalRatings: place.user_ratings_total || 0,
      isOpen: place.opening_hours?.open_now,
      types: place.types,
      photos: place.photos?.map(photo => ({
        reference: photo.photo_reference,
        width: photo.width,
        height: photo.height,
        url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      })) || [],
      priceLevel: place.price_level,
      businessStatus: place.business_status
    }));

    console.log(`✅ Found ${providers.length} service providers`);

    res.json({
      success: true,
      count: providers.length,
      providers,
      searchLocation,
      searchRadius,
      equipmentType: type
    });

  } catch (error) {
    console.error('❌ Service locator error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Service locator failed',
      details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

// Get place details
app.get('/api/service-locator/place/:placeId', async (req, res) => {
  console.log('🔍 Place details requested:', req.params.placeId);
  
  try {
    const { placeId } = req.params;

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Google Maps API not configured'
      });
    }

    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,opening_hours,rating,user_ratings_total,reviews,photos,geometry,types,price_level,business_status&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    
    const response = await axios.get(detailsUrl);

    if (response.data.status !== 'OK') {
      return res.status(404).json({
        success: false,
        error: 'Place not found'
      });
    }

    const place = response.data.result;
    
    const details = {
      id: placeId,
      name: place.name,
      address: place.formatted_address,
      phone: place.formatted_phone_number,
      website: place.website,
      location: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      },
      rating: place.rating || 0,
      totalRatings: place.user_ratings_total || 0,
      openingHours: place.opening_hours,
      reviews: place.reviews?.slice(0, 5).map(review => ({
        author: review.author_name,
        rating: review.rating,
        text: review.text,
        time: review.time,
        profilePhoto: review.profile_photo_url
      })) || [],
      photos: place.photos?.map(photo => ({
        reference: photo.photo_reference,
        url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      })) || [],
      types: place.types,
      priceLevel: place.price_level,
      businessStatus: place.business_status
    };

    console.log(`✅ Place details retrieved: ${details.name}`);

    res.json({
      success: true,
      details
    });

  } catch (error) {
    console.error('❌ Place details error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Geocode address/pincode
app.get('/api/service-locator/geocode', async (req, res) => {
  console.log('🌍 Geocoding requested:', req.query.address);
  
  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address or pincode is required'
      });
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Google Maps API not configured'
      });
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    
    const response = await axios.get(geocodeUrl);

    if (response.data.status !== 'OK') {
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }

    const result = response.data.results[0];
    
    const location = {
      formattedAddress: result.formatted_address,
      coordinates: {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng
      },
      placeId: result.place_id,
      types: result.types,
      addressComponents: result.address_components
    };

    console.log(`✅ Geocoded: ${location.formattedAddress}`);

    res.json({
      success: true,
      location
    });

  } catch (error) {
    console.error('❌ Geocoding error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

console.log('✅ Service Locator routes registered\n');

// ==================== PROTECTED ROUTES ====================

app.post('/api/predict', protect, async (req, res) => {
  try {
    if (!mlPredictionController?.analyzeEquipment) {
      return res.status(503).json({
        success: false,
        error: 'ML prediction service is not available'
      });
    }

    const validation = validatePredictionInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error 
      });
    }

    console.log(`\n📊 Analyzing ${req.body.equipmentName || 'equipment'}...`);
    const prediction = await mlPredictionController.analyzeEquipment(req.body);
    console.log(`✅ Analysis complete - Health: ${prediction.health_score}%`);

    if (global.dbConnected) {
      try {
        const history = new EquipmentHistory({
          user: req.user._id,
          equipmentName: req.body.equipmentName || 'Unknown',
          equipmentType: req.body.equipment_type,
          model: req.body.model || req.body.equipmentName,
          sensorData: {
            operating_hours: req.body.operating_hours,
            power_consumption: req.body.power_consumption,
            fan_speed: req.body.fan_speed,
            thermal_throttling: req.body.thermal_throttling,
            gpu_usage: req.body.gpu_usage,
            screen_brightness: req.body.screen_brightness,
            network_activity: req.body.network_activity,
            battery_health: req.body.battery_health,
            cpu_usage: req.body.cpu_usage,
            ram_usage: req.body.ram_usage,
            load_percentage: req.body.load_percentage,
            noise_level: req.body.noise_level,
            rotation_speed: req.body.rotation_speed,
            current_draw: req.body.current_draw,
            oil_quality: req.body.oil_quality,
            efficiency_rating: req.body.efficiency_rating
          },
          prediction: prediction,
          timestamp: new Date()
        });
        await history.save();
        console.log(`💾 Saved for: ${req.user.email}`);
      } catch (dbError) {
        console.log('⚠️  DB save failed:', dbError.message);
      }
    }

    res.json({ 
      success: true, 
      prediction,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Prediction error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/history', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const query = { user: req.user._id };
    
    if (req.query.equipmentType) query.equipmentType = req.query.equipmentType;
    if (req.query.riskLevel) query['prediction.risk_level'] = req.query.riskLevel;

    if (global.dbConnected) {
      const history = await EquipmentHistory.find(query)
        .sort({ timestamp: -1 })
        .limit(limit);
      res.json({ 
        success: true, 
        history, 
        count: history.length 
      });
    } else {
      res.json({ 
        success: true, 
        history: [], 
        count: 0, 
        message: 'Database not connected' 
      });
    }
  } catch (error) {
    console.error('❌ History error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/history/:id', protect, async (req, res) => {
  try {
    if (!global.dbConnected) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not connected' 
      });
    }
    
    const history = await EquipmentHistory.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!history) {
      return res.status(404).json({ 
        success: false, 
        error: 'History entry not found or unauthorized' 
      });
    }
    
    res.json({ success: true, history });
  } catch (error) {
    console.error('❌ History fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.delete('/api/history/:id', protect, async (req, res) => {
  try {
    if (!global.dbConnected) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not connected' 
      });
    }
    
    const result = await EquipmentHistory.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        error: 'Entry not found or unauthorized' 
      });
    }
    
    console.log(`🗑️  Deleted entry: ${req.params.id}`);
    res.json({ 
      success: true, 
      message: 'Entry deleted successfully' 
    });
  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.delete('/api/history', protect, async (req, res) => {
  try {
    if (!global.dbConnected) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not connected' 
      });
    }
    
    const result = await EquipmentHistory.deleteMany({ user: req.user._id });
    console.log(`🗑️  Cleared ${result.deletedCount} entries for: ${req.user.email}`);
    
    res.json({ 
      success: true, 
      message: `Deleted ${result.deletedCount} entries`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('❌ Clear history error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/stats', protect, async (req, res) => {
  try {
    if (!global.dbConnected) {
      return res.json({
        success: true,
        stats: {
          total_analyses: 0,
          equipment_types: {},
          risk_distribution: {},
          average_health_score: 0,
          critical_count: 0,
          high_risk_count: 0
        },
        message: 'Database not connected'
      });
    }

    const totalAnalyses = await EquipmentHistory.countDocuments({ user: req.user._id });
    
    const equipmentTypes = await EquipmentHistory.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: '$equipmentType', count: { $sum: 1 } } }
    ]);

    const riskDistribution = await EquipmentHistory.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: '$prediction.risk_level', count: { $sum: 1 } } }
    ]);

    const healthScores = await EquipmentHistory.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: null, avgHealth: { $avg: '$prediction.health_score' } } }
    ]);

    const criticalEquipment = await EquipmentHistory.countDocuments({
      user: req.user._id,
      'prediction.risk_level': 'critical'
    });

    const highRiskEquipment = await EquipmentHistory.countDocuments({
      user: req.user._id,
      'prediction.risk_level': { $in: ['high', 'critical'] }
    });

    res.json({
      success: true,
      stats: {
        total_analyses: totalAnalyses,
        equipment_types: equipmentTypes.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        risk_distribution: riskDistribution.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        average_health_score: healthScores.length > 0 
          ? Math.round(healthScores[0].avgHealth * 10) / 10 
          : 0,
        critical_count: criticalEquipment,
        high_risk_count: highRiskEquipment
      }
    });
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== ERROR HANDLERS ====================

app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method,
    requestedUrl: req.originalUrl
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ==================== EMAIL SERVICE INITIALIZATION ====================

const initializeEmailService = async () => {
  try {
    console.log('\n' + '━'.repeat(70));
    console.log('📧 MULTI-PROVIDER EMAIL SERVICE INITIALIZATION');
    console.log('━'.repeat(70));

    let attempt = 0;
    const maxAttempts = 5;
    let initialized = false;

    while (attempt < maxAttempts && !initialized) {
      attempt++;
      console.log(`\n🔄 Initialization attempt ${attempt}/${maxAttempts}...`);
      
      initialized = await emailService.initialize();
      
      if (initialized) {
        console.log('\n✅ Email service initialization SUCCESS!');
        break;
      }
      
      if (attempt < maxAttempts) {
        const waitTime = attempt * 3;
        console.log(`⏳ Waiting ${waitTime} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
    }

    if (!initialized) {
      console.error('\n❌ CRITICAL: Email service failed after', maxAttempts, 'attempts');
      console.error('━'.repeat(70));
      
      if (process.env.NODE_ENV === 'production') {
        console.error('🛑 Exiting due to missing email configuration...\n');
        process.exit(1);
      }
      
      return false;
    }

    console.log('\n🏥 Running email service health check...');
    const healthCheck = await emailService.healthCheck();
    
    if (healthCheck.healthy) {
      console.log(`✅ Health check PASSED - Provider: ${healthCheck.provider}`);
    }

    const status = emailService.getStatus();
    console.log('\n📊 Email Service Status:');
    console.log(`   Primary: ${status.currentProvider || 'none'}`);
    console.log(`   Gmail:    ${status.providers.gmail.initialized ? '✅' : '❌'}`);
    console.log(`   SendGrid: ${status.providers.sendgrid.initialized ? '✅' : '❌'}`);
    console.log(`   SMTP:     ${status.providers.smtp.initialized ? '✅' : '❌'}`);
    console.log('━'.repeat(70));

    return true;

  } catch (error) {
    console.error('\n❌ Email error:', error.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    return false;
  }
};

// ==================== SERVER STARTUP ====================

const startServer = async () => {
  try {
    console.log('\n🚀 Starting Equipment Health Monitor Server...\n');
    
    await connectDB();
    
    const emailReady = await initializeEmailService();

    app.listen(PORT, '0.0.0.0', () => {
      const backendUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`;
      
      console.log('═'.repeat(70));
      console.log('  🤖 AI EQUIPMENT HEALTH MONITOR');
      console.log('═'.repeat(70));
      console.log(`📡 Port:       ${PORT}`);
      console.log(`🔗 Backend:    ${backendUrl}`);
      console.log(`🌐 Frontend:   ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`🗄️  Database:   ${global.dbConnected ? '✅ Connected' : '⚠️  Disconnected'}`);
      console.log(`📧 Email:      ${emailReady ? '✅ Ready' : '⚠️  Not Ready'}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('═'.repeat(70));
      console.log('📍 Routes Registered:');
      console.log('   GET  /                                - API Info');
      console.log('   GET  /health                          - Health Check');
      console.log('   GET  /auth/gmail/status               ✅');
      console.log('   GET  /api/email/status                ✅');
      console.log('   POST /api/auth/register               ✅');
      console.log('   POST /api/auth/login                  ✅');
      console.log('   POST /api/predict                     ✅');
      console.log('   GET  /api/history                     ✅');
      console.log('   GET  /api/stats                       ✅');
      console.log('   GET  /api/service-locator             ✅');
      console.log('   GET  /api/service-locator/place/:id   ✅');
      console.log('   GET  /api/service-locator/geocode     ✅');
      console.log('═'.repeat(70) + '\n');
    });

  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

// ==================== SHUTDOWN ====================

process.on('SIGTERM', () => {
  console.log('\nSIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// ==================== START ====================
startServer();

module.exports = app;