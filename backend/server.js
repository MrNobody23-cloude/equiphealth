// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const connectDB = require('./config/database');
require('./config/passport');
const logSanitizer = require('./utils/sanitizeLogs');
const gmailService = require('./config/gmail'); // IMPORTANT: import Gmail service

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

// ━━━━━━━━━━━━━ GMAIL OAUTH2 ROUTES (ALWAYS REGISTERED) ━━━━━━━━━━━━━
console.log('\n🔧 Registering Gmail OAuth2 routes...');

app.get('/auth/gmail/status', async (req, res) => {
  try {
    const status = gmailService.getStatus();
    res.json({
      success: true,
      initialized: status.initialized,
      method: status.method,
      redirectUri: status.redirectUri,
      smtpFallback: status.smtpFallback,
      configured: status.hasClientId && status.hasClientSecret && status.hasUserEmail,
      refreshTokenSet: status.hasRefreshToken,
      status: {
        clientId: status.hasClientId ? '✅' : '❌',
        clientSecret: status.hasClientSecret ? '✅' : '❌',
        refreshToken: status.hasRefreshToken ? '✅' : '❌',
        userEmail: status.hasUserEmail ? `✅ ${process.env.GMAIL_USER_EMAIL}` : '❌'
      },
      setupUrl: !status.hasRefreshToken
        ? `${req.protocol}://${req.get('host')}/auth/gmail/authorize`
        : null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/auth/gmail/authorize', (req, res) => {
  try {
    const authUrl = gmailService.getAuthUrl();
    return res.redirect(authUrl);
  } catch (err) {
    return res.status(500).send(`<h1>Error: ${err.message}</h1>`);
  }
});

app.get('/auth/gmail/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    if (error) return res.send(`<h1>❌ OAuth Error: ${error}</h1>`);
    if (!code) return res.send('<h1>❌ Missing authorization code</h1>');

    const tokens = await gmailService.getTokens(code);
    const rt = tokens.refresh_token;

    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gmail OAuth2 Success</title>
          <style>
            body { font-family: Arial; max-width: 800px; margin: 40px auto; padding: 20px; }
            .token { background: #f0f0f0; padding: 15px; border-radius: 5px; word-break: break-all; font-family: monospace; }
            button { background: #4285f4; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 10px; }
          </style>
        </head>
        <body>
          <h1>✅ Gmail OAuth2 Success</h1>
          ${rt ? `
            <p><strong>Refresh Token (copy and add to Render env as GMAIL_REFRESH_TOKEN):</strong></p>
            <div class="token" id="token">${rt}</div>
            <button onclick="navigator.clipboard.writeText(document.getElementById('token').textContent).then(()=>alert('Copied!'))">
              Copy Token
            </button>
            <p>Scope must include: <code>https://www.googleapis.com/auth/gmail.send</code></p>
          ` : `
            <p>No refresh token returned. You may have already consented. Revoke this app's access from your Google Account (Security > Third-party access) and authorize again.</p>
          `}
        </body>
      </html>
    `);
  } catch (err) {
    return res.status(500).send(`<h1>Error: ${err.message}</h1>`);
  }
});

// Debug: show granted scopes for current token
app.get('/auth/gmail/scopes', async (req, res) => {
  try {
    const ok = await gmailService.initialize();
    if (!ok) {
      return res.status(503).json({ success: false, error: 'Gmail not initialized' });
    }
    const scopes = await gmailService.getGrantedScopes();
    return res.json({
      success: true,
      email: process.env.GMAIL_USER_EMAIL,
      grantedScopes: scopes
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Send a test email
app.post('/auth/gmail/send-test', express.json(), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });

    const result = await gmailService.sendEmail({
      email,
      subject: '✅ Gmail API Test - Equipment Health Monitor',
      html: '<h2>Test OK</h2><p>This is a test sent via Gmail API.</p>'
    });

    if (result.success) return res.json({ success: true, messageId: result.messageId, provider: result.provider });
    return res.status(503).json({ success: false, error: result.error, provider: result.provider });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

console.log('✅ Gmail routes registered\n');
// ━━━━━━━━━━━━━ END GMAIL OAUTH2 ROUTES ━━━━━━━━━━━━━

// ==================== EMAIL STATUS ====================
app.get('/api/email/status', async (req, res) => {
  const status = gmailService.getStatus();
  res.json({
    success: true,
    status: {
      gmailOAuth2: status.initialized ? '✅ Ready' : '❌ Not Ready',
      configured: status.hasClientId && status.hasClientSecret && status.hasUserEmail,
      refreshTokenSet: status.hasRefreshToken,
      method: status.method
    },
    timestamp: new Date().toISOString()
  });
});

// ==================== PUBLIC ROUTES ====================
app.get('/', (req, res) => {
  res.json({
    message: '🤖 AI Equipment Health Monitor API',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    database: global.dbConnected ? 'connected' : 'in-memory',
    email: gmailService.getStatus(),
    endpoints: {
      auth: '/api/auth',
      predict: '/api/predict',
      history: '/api/history',
      stats: '/api/stats',
      serviceLocator: '/api/service-locator',
      emailStatus: '/api/email/status',
      gmailStatus: '/auth/gmail/status'
    }
  });
});

app.get('/health', (req, res) => {
  const status = gmailService.getStatus();
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: global.dbConnected ? 'connected' : 'disconnected',
    email: status.initialized ? 'ready' : 'not-configured',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  });
});

// ==================== AUTH ROUTES ====================
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// ==================== GOOGLE MAPS SCRIPT PROXY ====================
app.get('/api/maps/config', (req, res) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000',
    'https://equiphealth-23.web.app',
    'https://equiphealth-23.firebaseapp.com'
  ];

  const origin = req.headers.origin;
  if (!allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json({
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
    scriptUrl: `https://maps.googleapis.com/maps/api/js?key=${process.env.GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`
  });
});

// ==================== SERVICE LOCATOR ROUTES ====================
console.log('🔧 Registering Service Locator routes...');
const serviceLocatorRoutes = require('./controllers/serviceLocator');
app.use('/api/service-locator', serviceLocatorRoutes);

app.get('/api/service-locator', async (req, res) => {
  console.log('🔍 Service locator:', req.query);

  try {
    const { type, latitude, longitude, pincode, radius } = req.query;

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({ success: false, error: 'Google Maps API not configured' });
    }

    let searchLocation = { lat: null, lng: null };

    if (pincode) {
      console.log(`📍 Geocoding: ${pincode}`);
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${pincode}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      const geocodeResponse = await axios.get(geocodeUrl);

      if (geocodeResponse.data.status === 'OK' && geocodeResponse.data.results.length > 0) {
        searchLocation = geocodeResponse.data.results[0].geometry.location;
        console.log(`✅ Location: ${searchLocation.lat}, ${searchLocation.lng}`);
      } else {
        return res.status(400).json({ success: false, error: 'Invalid pincode' });
      }
    } else if (latitude && longitude) {
      searchLocation = { lat: parseFloat(latitude), lng: parseFloat(longitude) };
    } else {
      return res.status(400).json({ success: false, error: 'Provide pincode or coordinates' });
    }

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
    const searchRadius = radius || 5000;

    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${searchLocation.lat},${searchLocation.lng}&radius=${searchRadius}&keyword=${encodeURIComponent(searchQuery)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const placesResponse = await axios.get(placesUrl);

    if (placesResponse.data.status !== 'OK' && placesResponse.data.status !== 'ZERO_RESULTS') {
      return res.status(500).json({ success: false, error: 'Google Places API error' });
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
        url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      })) || []
    }));

    console.log(`✅ Found ${providers.length} providers`);

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
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/service-locator/place/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params;

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({ success: false, error: 'Google Maps API not configured' });
    }

    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,opening_hours,rating,user_ratings_total,reviews,photos,geometry&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(detailsUrl);

    if (response.data.status !== 'OK') {
      return res.status(404).json({ success: false, error: 'Place not found' });
    }

    const place = response.data.result;

    res.json({
      success: true,
      details: {
        id: placeId,
        name: place.name,
        address: place.formatted_address,
        phone: place.formatted_phone_number,
        website: place.website,
        location: place.geometry.location,
        rating: place.rating || 0,
        totalRatings: place.user_ratings_total || 0,
        openingHours: place.opening_hours,
        reviews: place.reviews?.slice(0, 5) || [],
        photos: place.photos?.map(photo => ({
          url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
        })) || []
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

console.log('✅ Service Locator routes registered\n');

// ==================== PROTECTED ROUTES ====================
const { protect } = require('./middleware/auth');
const EquipmentHistory = require('./models/EquipmentHistory');
const { validatePredictionInput } = require('./utils/validators');

let mlPredictionController;
try {
  mlPredictionController = require('./controllers/mlPrediction');
} catch (error) {
  logSanitizer.warn('⚠️  ML controller not found:', error.message);
}

app.post('/api/predict', protect, async (req, res) => {
  try {
    if (!mlPredictionController?.analyzeEquipment) {
      return res.status(503).json({ success: false, error: 'ML service unavailable' });
    }

    const validation = validatePredictionInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    console.log(`\n📊 Analyzing ${req.body.equipmentName || 'equipment'}...`);
    const prediction = await mlPredictionController.analyzeEquipment(req.body);
    console.log(`✅ Health: ${prediction.health_score}%`);

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
        console.log(`💾 Saved`);
      } catch {
        console.log('⚠️  DB save failed');
      }
    }

    res.json({ success: true, prediction, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('❌ Prediction error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/history', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const query = { user: req.user._id };

    if (req.query.equipmentType) query.equipmentType = req.query.equipmentType;
    if (req.query.riskLevel) query['prediction.risk_level'] = req.query.riskLevel;

    if (global.dbConnected) {
      const history = await EquipmentHistory.find(query).sort({ timestamp: -1 }).limit(limit);
      res.json({ success: true, history, count: history.length });
    } else {
      res.json({ success: true, history: [], count: 0 });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/history/:id', protect, async (req, res) => {
  try {
    if (!global.dbConnected) {
      return res.status(503).json({ success: false, error: 'DB not connected' });
    }
    const history = await EquipmentHistory.findOne({ _id: req.params.id, user: req.user._id });
    if (!history) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/history/:id', protect, async (req, res) => {
  try {
    if (!global.dbConnected) {
      return res.status(503).json({ success: false, error: 'DB not connected' });
    }
    const result = await EquipmentHistory.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!result) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    console.log(`🗑️  Deleted: ${req.params.id}`);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/history', protect, async (req, res) => {
  try {
    if (!global.dbConnected) {
      return res.status(503).json({ success: false, error: 'DB not connected' });
    }
    const result = await EquipmentHistory.deleteMany({ user: req.user._id });
    console.log(`🗑️  Cleared ${result.deletedCount} entries`);
    res.json({ success: true, message: `Deleted ${result.deletedCount}`, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
        }
      });
    }

    const EquipmentHistory = require('./models/EquipmentHistory');

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
        average_health_score: healthScores.length > 0 ? Math.round(healthScores[0].avgHealth * 10) / 10 : 0,
        critical_count: criticalEquipment,
        high_risk_count: highRiskEquipment
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ERROR HANDLERS ====================
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message
  });
});

// ==================== SERVER STARTUP ====================
const startServer = async () => {
  try {
    console.log('\n🚀 Starting Equipment Health Monitor...\n');

    await connectDB();
    await gmailService.initialize();
    await gmailService.verify();

    app.listen(PORT, '0.0.0.0', () => {
      const backendUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`;
      console.log('═'.repeat(70));
      console.log('  🤖 AI EQUIPMENT HEALTH MONITOR');
      console.log('═'.repeat(70));
      console.log(`📡 Port:       ${PORT}`);
      console.log(`🔗 Backend:    ${backendUrl}`);
      console.log(`🌐 Frontend:   ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`🗄️  Database:   ${global.dbConnected ? '✅ Connected' : '⚠️  Disconnected'}`);
      const emailStatus = gmailService.getStatus();
      console.log(`📧 Email:      ${emailStatus.initialized ? '✅ Ready (Gmail API)' : '⚠️  Not Configured'}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('═'.repeat(70) + '\n');
    });
  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
};

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGTERM', () => {
  console.log('\nSIGTERM - shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT - shutting down...');
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// ==================== START ====================
startServer();

module.exports = app;