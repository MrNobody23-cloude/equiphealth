require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/database');
require('./config/passport');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy (important for Render/Heroku deployment)
app.set('trust proxy', 1);

// ==================== CORS CONFIGURATION ====================
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'https://equiphealth-23.web.app',
  'https://equiphealth-23.firebaseapp.com'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('⚠️  Blocked origin:', origin);
      // In development, allow it anyway; in production, block it
      callback(null, process.env.NODE_ENV !== 'production');
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration with MongoDB store (Production Ready)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-fallback-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600, // lazy session update
    crypto: {
      secret: process.env.SESSION_SECRET || 'session-encryption-secret'
    }
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in production (HTTPS)
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// ==================== MODELS ====================
const EquipmentHistory = require('./models/EquipmentHistory');

// ==================== CONTROLLERS ====================
const mlPredictionController = require('./controllers/mlPrediction');
const serviceLocatorController = require('./controllers/serviceLocator');

// ==================== MIDDLEWARE ====================
const { protect } = require('./middleware/auth');
const { validatePredictionInput } = require('./utils/validators');

// ==================== ROUTES ====================
const authRoutes = require('./routes/auth');

// ==================== API ENDPOINTS ====================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🤖 AI Equipment Health Monitor API',
    version: '2.0.0',
    status: 'running',
    database: global.dbConnected ? 'connected' : 'in-memory',
    ml_engine: 'Python (scikit-learn)',
    authentication: 'enabled',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      predict: '/api/predict',
      history: '/api/history',
      stats: '/api/stats',
      serviceProviders: '/api/service-providers'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: global.dbConnected ? 'connected' : 'disconnected',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  });
});

// Auth routes
app.use('/api/auth', authRoutes);

// ==================== PROTECTED ROUTES ====================

// Equipment health prediction
app.post('/api/predict', protect, async (req, res) => {
  try {
    const validation = validatePredictionInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error 
      });
    }

    console.log(`\n📊 Analyzing ${req.body.equipmentName || 'equipment'}...`);
    console.log(`   User: ${req.user.email}`);
    console.log(`   Type: ${req.body.equipment_type}`);

    const prediction = await mlPredictionController.analyzeEquipment(req.body);

    console.log(`✅ Analysis complete - Health Score: ${prediction.health_score}%`);

    // Save to database with user reference
    if (global.dbConnected) {
      try {
        const history = new EquipmentHistory({
          user: req.user._id,
          equipmentName: req.body.equipmentName || 'Unknown Equipment',
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
        console.log(`💾 Saved to database for user: ${req.user.email}`);
      } catch (dbError) {
        console.log('⚠️  Database save skipped:', dbError.message);
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
      error: error.message || 'Internal server error'
    });
  }
});

// Get user's prediction history
app.get('/api/history', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const equipmentType = req.query.equipmentType;
    const riskLevel = req.query.riskLevel;

    let query = { user: req.user._id };
    
    if (equipmentType) {
      query.equipmentType = equipmentType;
    }
    
    if (riskLevel) {
      query['prediction.risk_level'] = riskLevel;
    }

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
    console.error('❌ History fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get single history entry
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

// Delete single history entry
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

    console.log(`🗑️  Deleted history entry: ${req.params.id}`);
    res.json({ success: true, message: 'Entry deleted successfully' });

  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Clear all history for user
app.delete('/api/history', protect, async (req, res) => {
  try {
    if (!global.dbConnected) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database not connected' 
      });
    }

    const result = await EquipmentHistory.deleteMany({ user: req.user._id });
    
    console.log(`🗑️  Cleared ${result.deletedCount} history entries for user: ${req.user.email}`);

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

// Get user statistics
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
        average_health_score: healthScores.length > 0 ? Math.round(healthScores[0].avgHealth * 10) / 10 : 0,
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

// Service locator routes
app.get('/api/service-providers', protect, serviceLocatorController.searchProviders.bind(serviceLocatorController));
app.get('/api/geocode', protect, serviceLocatorController.geocodeAddress.bind(serviceLocatorController));
app.get('/api/place/:placeId', protect, serviceLocatorController.getPlaceDetails.bind(serviceLocatorController));

// ==================== ERROR HANDLERS ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method,
    requestedUrl: req.originalUrl
  });
});

// Global error handler
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
    // Check if email is configured
    if (!process.env.SENDGRID_API_KEY && !process.env.EMAIL_USERNAME) {
      console.log('━'.repeat(60));
      console.log('⚠️  EMAIL SERVICE WARNING');
      console.log('━'.repeat(60));
      console.log('Email service not configured!');
      console.log('Email verification will be disabled.');
      console.log('');
      console.log('To enable email features, add ONE of these:');
      console.log('  Option 1 - SendGrid (Recommended):');
      console.log('    SENDGRID_API_KEY=your_api_key');
      console.log('    SENDGRID_FROM_EMAIL=your@email.com');
      console.log('  Option 2 - Gmail SMTP:');
      console.log('    EMAIL_USERNAME=your@gmail.com');
      console.log('    EMAIL_PASSWORD=your_app_password');
      console.log('━'.repeat(60));
      return;
    }

    // Try SendGrid first
    if (process.env.SENDGRID_API_KEY) {
      const { verifySendGrid } = require('./config/sendgrid');
      await verifySendGrid();
      console.log('✅ Email service: SendGrid configured');
    }
    // Fallback to Gmail SMTP
    else if (process.env.EMAIL_USERNAME && process.env.EMAIL_PASSWORD) {
      const { verifyTransporter } = require('./config/email');
      await verifyTransporter();
      console.log('✅ Email service: Gmail SMTP configured');
    }
  } catch (error) {
    console.log('⚠️  Email service initialization failed:', error.message);
    console.log('ℹ️  App will continue without email functionality');
  }
};

// ==================== SERVER STARTUP ====================
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Initialize email service (optional)
    await initializeEmailService();

    // Start Express server
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n' + '═'.repeat(60));
      console.log('  🤖 AI EQUIPMENT HEALTH MONITOR SERVER');
      console.log('═'.repeat(60));
      console.log(`📡 Port:        ${PORT}`);
      console.log(`🔗 Backend:     ${process.env.BACKEND_URL || 'http://localhost:' + PORT}`);
      console.log(`🌐 Frontend:    ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`🗄️  Database:    ${global.dbConnected ? '✅ Connected' : '⚠️  In-Memory Mode'}`);
      console.log(`🐍 ML Engine:   Python (scikit-learn)`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗺️  Maps API:    ${process.env.GOOGLE_MAPS_API_KEY ? '✅ Configured' : '⚠️  Not Configured'}`);
      console.log(`💾 Sessions:    MongoDB Store (Production Ready)`);
      console.log('═'.repeat(60));
      console.log('🔐 Authentication:');
      console.log(`   ✅ Local (Email/Password)`);
      console.log(`   ${process.env.GOOGLE_CLIENT_ID ? '✅' : '⚠️ '} Google OAuth`);
      console.log(`   ${process.env.GITHUB_CLIENT_ID ? '✅' : '⚠️ '} GitHub OAuth`);
      console.log('═'.repeat(60));
      console.log('📍 Available Routes:');
      console.log('   GET  /                     - API Info');
      console.log('   GET  /health               - Health Check');
      console.log('   POST /api/auth/*           - Authentication');
      console.log('   POST /api/predict          - Equipment Analysis');
      console.log('   GET  /api/history          - Prediction History');
      console.log('   GET  /api/stats            - User Statistics');
      console.log('   GET  /api/service-providers - Service Locator');
      console.log('═'.repeat(60) + '\n');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// ==================== GRACEFUL SHUTDOWN ====================
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Start the server
startServer();

module.exports = app;