const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('./config/passport');
const connectDB = require('./config/database');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to database
connectDB();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session middleware (for OAuth)
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Models
const EquipmentHistory = require('./models/EquipmentHistory');

// Controllers
const mlPredictionController = require('./controllers/mlPrediction');
const serviceLocatorController = require('./controllers/serviceLocator');

// Middleware
const { protect } = require('./middleware/auth');
const { validatePredictionInput } = require('./utils/validators');

// Routes
const authRoutes = require('./routes/auth');

// ==================== ROUTES ====================

// Health check
app.get('/', (req, res) => {
  res.json({
    message: '🤖 AI Equipment Health Monitor API',
    version: '2.0.0',
    status: 'running',
    database: global.dbConnected ? 'connected' : 'in-memory',
    ml_engine: 'Python (scikit-learn)',
    authentication: 'enabled',
    timestamp: new Date().toISOString()
  });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Protected routes - Equipment health prediction
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

// Protected routes - History
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

// Service locator routes (protected)
app.get('/api/service-providers', protect, serviceLocatorController.searchProviders.bind(serviceLocatorController));
app.get('/api/geocode', protect, serviceLocatorController.geocodeAddress.bind(serviceLocatorController));
app.get('/api/place/:placeId', protect, serviceLocatorController.getPlaceDetails.bind(serviceLocatorController));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// Start server
const startServer = async () => {
  await connectDB();

  const { verifyTransporter } = require('./config/email');
  await verifyTransporter();

  app.listen(PORT, () => {
    console.log('\n' + '═'.repeat(60));
    console.log('  🤖 AI EQUIPMENT HEALTH MONITOR SERVER');
    console.log('═'.repeat(60));
    console.log(`📡 Server:     https://equiphealth-7cf34.web.app`);
    console.log(`🗄️  Database:   ${global.dbConnected ? '✅ Connected' : '⚠️  In-Memory Mode'}`);
    console.log(`🔐 Auth:       ✅ Enabled (JWT + OAuth)`);
    console.log(`🐍 ML Engine:  Python (scikit-learn)`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗺️  Maps API:   ${process.env.GOOGLE_MAPS_API_KEY ? '✅ Configured' : '⚠️  Not Configured'}`);
    console.log('═'.repeat(60));
    console.log('🔐 Authentication Methods:');
    console.log(`   ✅ Local (Email/Password)`);
    console.log(`   ${process.env.GOOGLE_CLIENT_ID ? '✅' : '⚠️ '} Google OAuth`);
    console.log(`   ${process.env.GITHUB_CLIENT_ID ? '✅' : '⚠️ '} GitHub OAuth`);
    console.log('═'.repeat(60) + '\n');
  });
};

startServer();

module.exports = app;