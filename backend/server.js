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
      console.log('⚠️ Blocked origin:', origin);
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

// ==================== EMAIL SERVICE WRAPPER ====================
class EmailServiceWrapper {
  constructor() {
    this.gmailService = null;
    this.basicEmailTransporter = null;
    this.gmailReady = false;
    this.basicEmailReady = false;
  }

  async initialize() {
    console.log('\n' + '━'.repeat(70));
    console.log('📧 EMAIL SERVICE INITIALIZATION');
    console.log('━'.repeat(70));

    // Try Gmail OAuth2 first
    try {
      this.gmailService = require('./config/gmail');
      console.log('\n🔄 Initializing Gmail OAuth2...');
      this.gmailReady = await this.gmailService.initialize();
      
      if (this.gmailReady) {
        console.log('✅ Gmail OAuth2 initialized');
        const verified = await this.gmailService.verify();
        if (verified) {
          console.log('✅ Gmail OAuth2 verified and ready');
          console.log('━'.repeat(70));
          return true;
        }
      }
    } catch (error) {
      console.error('❌ Gmail OAuth2 failed:', error.message);
    }

    // Try basic SMTP as fallback
    try {
      const emailConfig = require('./config/email');
      this.basicEmailTransporter = emailConfig.createTransporter;
      
      console.log('\n🔄 Initializing basic SMTP...');
      this.basicEmailReady = await emailConfig.verifyTransporter();
      
      if (this.basicEmailReady) {
        console.log('✅ Basic SMTP initialized');
        console.log('━'.repeat(70));
        return true;
      }
    } catch (error) {
      console.error('❌ Basic SMTP failed:', error.message);
    }

    console.log('⚠️  No email service available - app will continue without email');
    console.log('━'.repeat(70));
    return false;
  }

  async sendEmail({ email, subject, html, text }) {
    // Try Gmail OAuth2 first
    if (this.gmailReady && this.gmailService) {
      try {
        console.log('📧 Sending via Gmail OAuth2...');
        return await this.gmailService.sendEmail({ email, subject, html, text });
      } catch (error) {
        console.error('❌ Gmail OAuth2 failed:', error.message);
        console.log('🔄 Falling back to basic SMTP...');
      }
    }

    // Fallback to basic SMTP
    if (this.basicEmailReady && this.basicEmailTransporter) {
      try {
        console.log('📧 Sending via basic SMTP...');
        const transporter = this.basicEmailTransporter();
        
        if (!transporter) {
          throw new Error('SMTP transporter not available');
        }

        const result = await transporter.sendMail({
          from: `"Equipment Health Monitor" <${process.env.EMAIL_FROM || process.env.EMAIL_USERNAME}>`,
          to: email,
          subject: subject,
          html: html,
          text: text || html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        });

        console.log(`✅ Email sent via SMTP - ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId, provider: 'smtp' };

      } catch (error) {
        console.error('❌ Basic SMTP failed:', error.message);
        return { success: false, error: error.message, provider: 'smtp' };
      }
    }

    // No email service available
    return { 
      success: false, 
      error: 'Email service not configured', 
      provider: 'none' 
    };
  }

  getStatus() {
    return {
      gmailOAuth2: this.gmailReady ? '✅ Ready' : '❌ Not Available',
      basicSMTP: this.basicEmailReady ? '✅ Ready' : '❌ Not Available',
      anyAvailable: this.gmailReady || this.basicEmailReady,
      primaryProvider: this.gmailReady ? 'Gmail OAuth2' : this.basicEmailReady ? 'Basic SMTP' : 'None'
    };
  }
}

const emailServiceWrapper = new EmailServiceWrapper();

// Export email service for use in other modules
module.exports.emailService = emailServiceWrapper;

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
  console.warn('⚠️ ML controller not found:', error.message);
}

// ==================== GMAIL OAUTH2 ROUTES ====================

if (emailServiceWrapper.gmailService) {
  app.get('/auth/gmail/status', (req, res) => {
    try {
      const status = emailServiceWrapper.gmailService.getStatus();
      const allConfigured = status.hasClientId && status.hasClientSecret && 
                           status.hasRefreshToken && status.hasUserEmail;

      res.json({
        success: true,
        configured: allConfigured,
        initialized: status.initialized,
        status: {
          clientId: status.hasClientId ? '✅' : '❌',
          clientSecret: status.hasClientSecret ? '✅' : '❌',
          refreshToken: status.hasRefreshToken ? '✅' : '❌',
          userEmail: status.hasUserEmail ? `✅ ${process.env.GMAIL_USER_EMAIL}` : '❌',
          method: status.method
        },
        setupUrl: !status.hasRefreshToken
          ? `${req.protocol}://${req.get('host')}/auth/gmail/authorize`
          : null
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/auth/gmail/authorize', (req, res) => {
    try {
      const authUrl = emailServiceWrapper.gmailService.getAuthUrl();
      res.redirect(authUrl);
    } catch (error) {
      res.status(500).send(`<h1>Error: ${error.message}</h1>`);
    }
  });

  app.get('/auth/gmail/callback', async (req, res) => {
    try {
      const { code, error } = req.query;

      if (error) {
        return res.send(`<h1>❌ OAuth Error: ${error}</h1>`);
      }

      if (!code) {
        return res.send('<h1>❌ Missing authorization code</h1>');
      }

      const tokens = await emailServiceWrapper.gmailService.getTokens(code);

      res.send(`
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
          <h1>✅ Success!</h1>
          ${tokens.refresh_token ? `
            <h2>Your Refresh Token:</h2>
            <div class="token" id="token">${tokens.refresh_token}</div>
            <button onclick="navigator.clipboard.writeText(document.getElementById('token').textContent).then(() => alert('Copied!'))">
              Copy Token
            </button>
            <p>Add to Render Environment: <code>GMAIL_REFRESH_TOKEN=${tokens.refresh_token.substring(0, 30)}...</code></p>
          ` : '<p>No refresh token. Revoke access and try again.</p>'}
        </body>
        </html>
      `);
    } catch (error) {
      res.status(500).send(`<h1>Error: ${error.message}</h1>`);
    }
  });

  app.post('/auth/gmail/send-test', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email required' });
      }

      const result = await emailServiceWrapper.gmailService.sendTestEmail(email);
      res.json({ success: true, messageId: result.messageId });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

// ==================== EMAIL SERVICE STATUS ====================

app.get('/api/email/status', (req, res) => {
  res.json({
    success: true,
    status: emailServiceWrapper.getStatus(),
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
    email: emailServiceWrapper.getStatus(),
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
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: global.dbConnected ? 'connected' : 'disconnected',
    email: emailServiceWrapper.getStatus().anyAvailable ? 'ready' : 'not-configured',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  });
});

// ==================== AUTH ROUTES ====================
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// ==================== SERVICE LOCATOR ROUTES ====================
const serviceLocatorRoutes = require('./controllers/serviceLocator');
app.use('/api/service-locator', serviceLocatorRoutes);

// ==================== PROTECTED ROUTES ====================
const { protect } = require('./middleware/auth');

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
      } catch (dbError) {
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
    const emailReady = await emailServiceWrapper.initialize();

    app.listen(PORT, '0.0.0.0', () => {
      const backendUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`;
      
      console.log('═'.repeat(70));
      console.log('  🤖 AI EQUIPMENT HEALTH MONITOR');
      console.log('═'.repeat(70));
      console.log(`📡 Port:       ${PORT}`);
      console.log(`🔗 Backend:    ${backendUrl}`);
      console.log(`🌐 Frontend:   ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`🗄️  Database:   ${global.dbConnected ? '✅ Connected' : '⚠️  Disconnected'}`);
      console.log(`📧 Email:      ${emailReady ? '✅ Ready' : '⚠️  Not Configured'}`);
      const emailStatus = emailServiceWrapper.getStatus();
      console.log(`   Provider:   ${emailStatus.primaryProvider}`);
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