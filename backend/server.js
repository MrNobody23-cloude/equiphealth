require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/database');
require('./config/passport');
const gmailService = require('./config/gmail');

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

// ==================== GMAIL OAUTH2 ROUTES ====================

console.log('\n🔧 Registering Gmail OAuth2 routes...');

// Route 1: Gmail Status
app.get('/auth/gmail/status', (req, res) => {
  console.log('✅ /auth/gmail/status route handler executed');
  try {
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

// Route 2: Gmail Authorization
app.get('/auth/gmail/authorize', (req, res) => {
  console.log('✅ /auth/gmail/authorize route handler executed');
  try {
    const authUrl = gmailService.getAuthUrl();
    console.log('🔗 Redirecting to Google OAuth...');
    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ Authorization error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authorization Error</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto; background: #fee2e2; }
          .error { background: white; padding: 30px; border-radius: 12px; border-left: 4px solid #ef4444; }
          h1 { color: #dc2626; margin-top: 0; }
          a { color: #2563eb; text-decoration: none; font-weight: 600; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Authorization Error</h1>
          <p><strong>Failed to start OAuth flow</strong></p>
          <p>Error: ${error.message}</p>
          <p style="margin-top: 20px;">
            <a href="/">← Back to Home</a>
          </p>
        </div>
      </body>
      </html>
    `);
  }
});

// Route 3: Gmail Callback
app.get('/auth/gmail/callback', async (req, res) => {
  console.log('✅ /auth/gmail/callback route handler executed');
  console.log('Query params:', Object.keys(req.query));
  
  try {
    const { code, error } = req.query;
    
    // Handle OAuth errors
    if (error) {
      console.error('❌ OAuth error from Google:', error);
      
      if (error === 'access_denied') {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Access Denied</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                padding: 40px;
                max-width: 700px;
                margin: 0 auto;
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 16px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                border-left: 6px solid #f59e0b;
              }
              h1 { color: #92400e; margin: 0 0 20px 0; }
              p { color: #78350f; line-height: 1.6; margin: 10px 0; }
              .note {
                background: #dbeafe;
                padding: 20px;
                border-radius: 8px;
                margin: 25px 0;
                border-left: 4px solid #3b82f6;
              }
              ol { margin: 10px 0; padding-left: 25px; color: #1e3a8a; }
              li { margin: 8px 0; line-height: 1.5; }
              a { color: #2563eb; text-decoration: none; font-weight: 600; }
              a:hover { text-decoration: underline; }
              .btn {
                display: inline-block;
                background: #3b82f6;
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                text-decoration: none;
                margin-top: 20px;
              }
              .btn:hover { background: #2563eb; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>⚠️ Access Denied</h1>
              <p>You canceled the Gmail authorization process.</p>
              <div class="note">
                <strong style="color: #1e40af;">💡 To enable Gmail integration:</strong>
                <ol>
                  <li>Make sure you're using the correct Google account</li>
                  <li>Ensure this email is added as a test user in Google Cloud Console</li>
                  <li>Try authorizing again and click "Allow" when prompted</li>
                </ol>
              </div>
              <a href="/auth/gmail/authorize" class="btn">🔄 Try Again</a>
            </div>
          </body>
          </html>
        `);
      }
      
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>OAuth Error</title>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto; background: #fee2e2; }
            .error { background: white; padding: 30px; border-radius: 12px; border-left: 4px solid #ef4444; }
            h1 { color: #dc2626; }
            a { color: #2563eb; text-decoration: none; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ OAuth Error</h1>
            <p>Error from Google: <strong>${error}</strong></p>
            <p style="margin-top: 20px;">
              <a href="/auth/gmail/authorize">← Try Again</a>
            </p>
          </div>
        </body>
        </html>
      `);
    }
    
    if (!code) {
      console.error('❌ No authorization code received');
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Missing Code</title>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial; padding: 40px; max-width: 600px; margin: 0 auto; background: #fee2e2; }
            .error { background: white; padding: 30px; border-radius: 12px; border-left: 4px solid #ef4444; }
            h1 { color: #dc2626; }
            a { color: #2563eb; text-decoration: none; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Missing Authorization Code</h1>
            <p>No authorization code was received from Google.</p>
            <p style="margin-top: 20px;">
              <a href="/auth/gmail/authorize">← Try Again</a>
            </p>
          </div>
        </body>
        </html>
      `);
    }
    
    console.log('🔑 Exchanging authorization code for tokens...');
    const tokens = await gmailService.getTokens(code);
    console.log('✅ Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token
    });
    
    // Get backend URL for instructions
    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    
    // Success page - NO HARDCODED SECRETS
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail OAuth2 Success ✅</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 16px;
            max-width: 900px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          h1 { color: #10b981; font-size: 32px; margin-bottom: 15px; }
          h2 { color: #1f2937; font-size: 24px; margin: 30px 0 15px; }
          h3 { color: #374151; font-size: 18px; margin: 20px 0 10px; }
          p { color: #6b7280; line-height: 1.6; margin-bottom: 15px; }
          .token-box {
            background: #1f2937;
            color: #10b981;
            padding: 15px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            word-break: break-all;
            max-height: 150px;
            overflow-y: auto;
            margin: 15px 0;
            border: 2px solid #374151;
          }
          .copy-btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 10px;
            transition: all 0.2s;
          }
          .copy-btn:hover { background: #2563eb; transform: translateY(-1px); }
          .warning {
            background: #fef3c7;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #f59e0b;
            margin: 20px 0;
          }
          .warning strong { color: #92400e; font-size: 16px; }
          .steps {
            background: #f3f4f6;
            padding: 25px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .steps ol { margin: 15px 0; padding-left: 25px; }
          .steps li { margin: 12px 0; line-height: 1.8; color: #374151; }
          code {
            background: #1f2937;
            color: #10b981;
            padding: 3px 8px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
          }
          small {
            display: block;
            color: #9ca3af;
            margin-top: 5px;
            font-size: 13px;
          }
          .info-box {
            background: #dbeafe;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
            margin: 20px 0;
          }
          .credential-placeholder {
            color: #9ca3af;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Gmail OAuth2 Authorization Successful!</h1>
          <p style="font-size: 16px;">Your Gmail API has been authorized successfully!</p>

          ${tokens.refresh_token ? `
            <div class="warning">
              <strong>⚠️ CRITICAL - Save This Token Immediately!</strong>
              <p style="margin-top: 10px; color: #78350f;">
                Add this refresh token to your Render environment variables now.
              </p>
            </div>

            <h2>🔑 Your Refresh Token</h2>
            <div class="token-box" id="token">${tokens.refresh_token}</div>
            <button class="copy-btn" onclick="copy()">📋 Copy Refresh Token</button>

            <div class="steps">
              <h3>🚀 Render Deployment Setup</h3>
              <ol>
                <li>
                  <strong>Open Render Dashboard</strong>
                  <br>Go to your service → <strong>Environment</strong> tab
                </li>
                <li>
                  <strong>Add/Update these environment variables:</strong>
                  <br><br>
                  <code>GMAIL_CLIENT_ID</code>
                  <small>Get from Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs</small>
                  <br><br>
                  <code>GMAIL_CLIENT_SECRET</code>
                  <small>Get from the same location in Google Cloud Console</small>
                  <br><br>
                  <code>GMAIL_REFRESH_TOKEN</code>
                  <small>Use the token displayed above (starts with <span class="credential-placeholder">${tokens.refresh_token.substring(0, 20)}...</span>)</small>
                  <br><br>
                  <code>GMAIL_USER_EMAIL</code>
                  <small>Your authorized Gmail address</small>
                  <br><br>
                  <code>GMAIL_REDIRECT_URI</code>
                  <small>${backendUrl}/auth/gmail/callback</small>
                </li>
                <li>
                  <strong>Save Changes</strong>
                  <br>Render will automatically redeploy (~2-3 minutes)
                </li>
                <li>
                  <strong>Verify Setup</strong>
                  <br>Visit: <code>${backendUrl}/auth/gmail/status</code>
                </li>
              </ol>
            </div>

            <div class="info-box">
              <h3 style="margin-top: 0; color: #1e40af;">💻 Local Development (.env file)</h3>
              <p style="color: #1e3a8a;">Add these variables to your <code>.env</code> file:</p>
              <code style="display: block; margin: 5px 0;">GMAIL_CLIENT_ID=<span class="credential-placeholder">your_client_id_from_google_console</span></code>
              <code style="display: block; margin: 5px 0;">GMAIL_CLIENT_SECRET=<span class="credential-placeholder">your_client_secret_from_google_console</span></code>
              <code style="display: block; margin: 5px 0;">GMAIL_REFRESH_TOKEN=${tokens.refresh_token}</code>
              <code style="display: block; margin: 5px 0;">GMAIL_USER_EMAIL=<span class="credential-placeholder">your-email@gmail.com</span></code>
              <code style="display: block; margin: 5px 0;">GMAIL_REDIRECT_URI=http://localhost:5000/auth/gmail/callback</code>
            </div>

            <div class="warning" style="background: #fee2e2; border-color: #ef4444;">
              <strong style="color: #991b1b;">🔒 Security Warning</strong>
              <p style="color: #991b1b; margin-top: 10px;">
                • Never commit this token to Git<br>
                • Store only in environment variables<br>
                • This token allows sending emails from your account<br>
                • Keep it secret and secure
              </p>
            </div>
          ` : `
            <div class="warning">
              <strong>ℹ️ No Refresh Token Received</strong>
              <p style="margin-top: 10px; color: #78350f;">
                This happens when you've already authorized this app.
              </p>
              <h3 style="color: #92400e; margin-top: 15px;">To get a new refresh token:</h3>
              <ol style="margin: 10px 0; padding-left: 20px; color: #78350f;">
                <li>Visit <a href="https://myaccount.google.com/permissions" target="_blank" style="color: #2563eb;">Google Account Permissions</a></li>
                <li>Find "Equipment Health Monitor" and remove access</li>
                <li><a href="/auth/gmail/authorize" style="color: #2563eb;">Authorize again</a></li>
                <li>Click "Allow" on all permissions</li>
              </ol>
            </div>
          `}

          <p style="margin-top: 30px; text-align: center; color: #9ca3af; font-size: 14px;">
            You can close this window after saving the token
          </p>
        </div>

        <script>
          function copy() {
            const text = document.getElementById('token').textContent.trim();
            navigator.clipboard.writeText(text).then(() => {
              const btn = event.target;
              btn.textContent = '✅ Copied to Clipboard!';
              btn.style.background = '#10b981';
              setTimeout(() => {
                btn.textContent = '📋 Copy Refresh Token';
                btn.style.background = '#3b82f6';
              }, 3000);
            }).catch(() => {
              alert('Failed to copy. Please select and copy manually.');
            });
          }
        </script>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('❌ Gmail callback error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authorization Failed</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial; padding: 40px; max-width: 700px; margin: 0 auto; background: #fee2e2; }
          .error { background: white; padding: 30px; border-radius: 12px; border-left: 4px solid #ef4444; }
          h1 { color: #dc2626; margin-top: 0; }
          pre { background: #1f2937; color: #10b981; padding: 15px; border-radius: 6px; overflow-x: auto; font-size: 13px; }
          a { color: #2563eb; text-decoration: none; font-weight: 600; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Authorization Failed</h1>
          <p><strong>Error:</strong> ${error.message}</p>
          ${process.env.NODE_ENV !== 'production' ? `<pre>${error.stack}</pre>` : ''}
          <p style="margin-top: 25px;">
            <a href="/auth/gmail/authorize">← Try Again</a>
          </p>
        </div>
      </body>
      </html>
    `);
  }
});

// Route 4: Send Test Email
app.post('/auth/gmail/send-test', async (req, res) => {
  console.log('✅ /auth/gmail/send-test route handler executed');
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    console.log(`📧 Sending test email to: ${email}`);
    const result = await gmailService.sendTestEmail(email);
    
    console.log(`✅ Test email sent successfully`);
    res.json({
      success: true,
      message: 'Test email sent successfully',
      messageId: result.messageId,
      recipient: email,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Test email error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

console.log('✅ Gmail OAuth2 routes registered\n');

// ==================== MODELS ====================
const EquipmentHistory = require('./models/EquipmentHistory');

// ==================== MIDDLEWARE ====================
const { protect } = require('./middleware/auth');
const { validatePredictionInput } = require('./utils/validators');

// ==================== CONTROLLERS ====================
let mlPredictionController;
let serviceLocatorController;

try {
  mlPredictionController = require('./controllers/mlPrediction');
} catch (error) {
  console.warn('⚠️  ML controller not found:', error.message);
}

try {
  serviceLocatorController = require('./controllers/serviceLocator');
} catch (error) {
  console.warn('⚠️  Service locator not found:', error.message);
}

// ==================== PUBLIC ROUTES ====================

app.get('/', (req, res) => {
  const gmailStatus = gmailService.getStatus();
  res.json({
    message: '🤖 AI Equipment Health Monitor API',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    database: global.dbConnected ? 'connected' : 'in-memory',
    email: {
      configured: gmailStatus.initialized,
      method: 'Gmail OAuth2'
    },
    endpoints: {
      gmailStatus: '/auth/gmail/status',
      gmailAuth: '/auth/gmail/authorize',
      auth: '/api/auth',
      predict: '/api/predict',
      history: '/api/history',
      stats: '/api/stats'
    }
  });
});

app.get('/health', (req, res) => {
  const gmailStatus = gmailService.getStatus();
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: global.dbConnected ? 'connected' : 'disconnected',
    email: gmailStatus.initialized ? 'ready' : 'not-configured',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  });
});

// ==================== AUTH ROUTES ====================
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

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

// ==================== SERVICE LOCATOR ====================

app.get('/api/service-providers', protect, async (req, res) => {
  try {
    if (!serviceLocatorController) {
      return res.status(503).json({
        success: false,
        error: 'Service locator is not available'
      });
    }
    
    if (typeof serviceLocatorController.searchProviders === 'function') {
      return await serviceLocatorController.searchProviders(req, res);
    } else if (typeof serviceLocatorController === 'function') {
      return serviceLocatorController(req, res);
    }
    
    res.status(503).json({
      success: false,
      error: 'Service provider search method not available'
    });
  } catch (error) {
    console.error('❌ Service provider error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/geocode', protect, async (req, res) => {
  try {
    if (!serviceLocatorController?.geocodeAddress) {
      return res.status(503).json({
        success: false,
        error: 'Geocoding service is not available'
      });
    }
    return await serviceLocatorController.geocodeAddress(req, res);
  } catch (error) {
    console.error('❌ Geocoding error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/place/:placeId', protect, async (req, res) => {
  try {
    if (!serviceLocatorController?.getPlaceDetails) {
      return res.status(503).json({
        success: false,
        error: 'Place details service is not available'
      });
    }
    return await serviceLocatorController.getPlaceDetails(req, res);
  } catch (error) {
    console.error('❌ Place details error:', error);
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

// ==================== INITIALIZATION ====================

const initializeEmailService = async () => {
  try {
    console.log('\n📧 Initializing Gmail OAuth2 Service...');
    const status = gmailService.getStatus();
    
    console.log('Configuration Check:');
    console.log(`   GMAIL_CLIENT_ID:     ${status.hasClientId ? '✅' : '❌'}`);
    console.log(`   GMAIL_CLIENT_SECRET: ${status.hasClientSecret ? '✅' : '❌'}`);
    console.log(`   GMAIL_REFRESH_TOKEN: ${status.hasRefreshToken ? '✅' : '❌'}`);
    console.log(`   GMAIL_USER_EMAIL:    ${status.hasUserEmail ? '✅' : '❌'}`);
    
    if (!status.hasClientId || !status.hasClientSecret) {
      console.log('⚠️  Gmail OAuth credentials not set in .env');
      return false;
    }
    
    if (!status.hasRefreshToken) {
      const setupUrl = status.redirectUri.replace('/callback', '/authorize');
      console.log('⚠️  Gmail refresh token not found');
      console.log(`   Setup at: ${setupUrl}`);
      return false;
    }

    const initialized = await gmailService.initialize();
    
    if (initialized) {
      await gmailService.verify();
      console.log('✅ Gmail OAuth2 service is ready\n');
      return true;
    }
    
    console.log('❌ Gmail initialization failed\n');
    return false;
    
  } catch (error) {
    console.error('❌ Email service error:', error.message);
    return false;
  }
};

const startServer = async () => {
  try {
    console.log('\n🚀 Starting Equipment Health Monitor Server...\n');
    
    await connectDB();
    const emailReady = await initializeEmailService();

    app.listen(PORT, '0.0.0.0', () => {
      const backendUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      
      console.log('═'.repeat(60));
      console.log('  🤖 AI EQUIPMENT HEALTH MONITOR');
      console.log('═'.repeat(60));
      console.log(`📡 Port:       ${PORT}`);
      console.log(`🔗 Backend:    ${backendUrl}`);
      console.log(`🌐 Frontend:   ${frontendUrl}`);
      console.log(`🗄️  Database:   ${global.dbConnected ? '✅ Connected' : '⚠️  Disconnected'}`);
      console.log(`📧 Gmail:      ${emailReady ? '✅ Ready' : '⚠️  Not Configured'}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('═'.repeat(60));
      console.log('📍 Gmail OAuth2 Routes:');
      console.log('   GET  /auth/gmail/status       ✅');
      console.log('   GET  /auth/gmail/authorize    ✅');
      console.log('   GET  /auth/gmail/callback     ✅');
      console.log('   POST /auth/gmail/send-test    ✅');
      console.log('═'.repeat(60));
      console.log('📍 API Routes:');
      console.log('   GET  /                        - API Info');
      console.log('   GET  /health                  - Health Check');
      console.log('   POST /api/auth/*              - Authentication');
      console.log('   POST /api/predict             - Equipment Analysis');
      console.log('   GET  /api/history             - History');
      console.log('   GET  /api/stats               - Statistics');
      console.log('═'.repeat(60) + '\n');
      
      if (!emailReady) {
        console.log(`📧 Gmail Setup: ${backendUrl}/auth/gmail/authorize\n`);
      }
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