const { google } = require('googleapis');
const nodemailer = require('nodemailer');

class GmailService {
  constructor() {
    this.oauth2Client = null;
    this.transporter = null;
    this.initialized = false;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Get redirect URI based on environment
  getRedirectUri() {
    if (process.env.NODE_ENV === 'production') {
      return process.env.GMAIL_REDIRECT_URI || 'https://equiphealth.onrender.com/auth/gmail/callback';
    }
    return 'http://localhost:5000/auth/gmail/callback';
  }

  // Generate OAuth authorization URL
  getAuthUrl(redirectUri) {
    try {
      const clientId = process.env.GMAIL_CLIENT_ID;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in environment variables');
      }

      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri || this.getRedirectUri()
      );

      return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/userinfo.email'
        ]
      });
    } catch (error) {
      console.error('❌ Error generating auth URL:', error);
      throw error;
    }
  }

  // Exchange authorization code for tokens
  async getTokens(code) {
    try {
      const clientId = process.env.GMAIL_CLIENT_ID;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET;
      const redirectUri = this.getRedirectUri();

      if (!clientId || !clientSecret) {
        throw new Error('Gmail OAuth credentials not configured');
      }

      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
      );

      const { tokens } = await oauth2Client.getToken(code);
      
      console.log('✅ Tokens received successfully');
      if (tokens.refresh_token) {
        console.log('✅ Refresh token obtained');
      }
      
      return tokens;
    } catch (error) {
      console.error('❌ Error exchanging code for tokens:', error);
      throw error;
    }
  }

  // Get or refresh access token
  async getAccessToken() {
    try {
      // Check if we have a valid cached token
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        console.log('🔑 Using cached access token');
        return this.accessToken;
      }

      if (!this.oauth2Client) {
        throw new Error('OAuth2 client not initialized');
      }

      console.log('🔄 Refreshing access token...');
      
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('Failed to obtain access token');
      }

      // Cache the token
      this.accessToken = credentials.access_token;
      this.tokenExpiry = Date.now() + (credentials.expiry_date ? credentials.expiry_date - Date.now() - 300000 : 3300000); // 5 min buffer
      
      console.log('✅ Access token refreshed successfully');
      return this.accessToken;

    } catch (error) {
      console.error('❌ Failed to get access token:', error.message);
      throw error;
    }
  }

  // Initialize Gmail service
  async initialize() {
    try {
      const {
        GMAIL_CLIENT_ID,
        GMAIL_CLIENT_SECRET,
        GMAIL_REFRESH_TOKEN,
        GMAIL_USER_EMAIL
      } = process.env;

      // Validate required credentials
      if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
        console.log('⚠️  Gmail OAuth credentials not set');
        return false;
      }

      if (!GMAIL_REFRESH_TOKEN) {
        console.log('⚠️  GMAIL_REFRESH_TOKEN not set');
        return false;
      }

      if (!GMAIL_USER_EMAIL) {
        console.log('⚠️  GMAIL_USER_EMAIL not set');
        return false;
      }

      // Create OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        GMAIL_CLIENT_ID,
        GMAIL_CLIENT_SECRET,
        this.getRedirectUri()
      );

      // Set refresh token
      this.oauth2Client.setCredentials({
        refresh_token: GMAIL_REFRESH_TOKEN
      });

      // Get initial access token
      try {
        await this.getAccessToken();
        console.log('✅ OAuth2 initialized with valid access token');
      } catch (tokenError) {
        console.error('❌ Failed to get initial access token:', tokenError.message);
        throw new Error('Invalid refresh token. Re-authorize at /auth/gmail/authorize');
      }

      this.initialized = true;
      console.log(`✅ Gmail OAuth2 service initialized for: ${GMAIL_USER_EMAIL}`);
      return true;

    } catch (error) {
      console.error('❌ Gmail initialization failed:', error.message);
      this.initialized = false;
      return false;
    }
  }

  // Create transporter with fresh access token
  async createTransporter() {
    try {
      const accessToken = await this.getAccessToken();

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_USER_EMAIL,
          clientId: process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          refreshToken: process.env.GMAIL_REFRESH_TOKEN,
          accessToken: accessToken
        },
        // Connection settings optimized for Render
        pool: true,
        maxConnections: 1,
        maxMessages: 3,
        rateDelta: 1000,
        rateLimit: 3,
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 30000,
        socketTimeout: 30000,
        // Retry configuration
        retry: {
          times: 3,
          delay: 1000
        }
      });

      // Verify connection
      await transporter.verify();
      console.log('✅ SMTP transporter created and verified');

      return transporter;

    } catch (error) {
      console.error('❌ Failed to create transporter:', error.message);
      throw error;
    }
  }

  // Send email with retry logic
  async sendEmail({ email, subject, html, text }, retryCount = 0) {
    const maxRetries = 3;
    
    // Initialize if not already done
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('Gmail service not initialized. Complete setup at /auth/gmail/authorize');
      }
    }

    try {
      console.log(`📧 Sending email to: ${email} (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      // Create fresh transporter
      const transporter = await this.createTransporter();

      const mailOptions = {
        from: `"Equipment Health Monitor" <${process.env.GMAIL_USER_EMAIL}>`,
        to: email,
        subject: subject,
        html: html,
        text: text || this.stripHtml(html),
        // Add headers for better deliverability
        headers: {
          'X-Mailer': 'Equipment Health Monitor',
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
          'Importance': 'Normal'
        }
      };

      const result = await transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully`);
      console.log(`   To: ${email}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Message ID: ${result.messageId}`);
      
      // Close transporter
      transporter.close();
      
      return {
        success: true,
        messageId: result.messageId,
        provider: 'gmail-oauth2'
      };

    } catch (error) {
      console.error(`❌ Email sending failed (attempt ${retryCount + 1}):`, error.message);
      
      // Handle specific errors
      if (error.message.includes('invalid_grant') || error.message.includes('Token has been expired or revoked')) {
        // Clear cached token and retry
        this.accessToken = null;
        this.tokenExpiry = null;
        
        if (retryCount < maxRetries) {
          console.log('🔄 Token expired, refreshing and retrying...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.sendEmail({ email, subject, html, text }, retryCount + 1);
        }
        throw new Error('Gmail refresh token expired. Re-authorize at /auth/gmail/authorize');
      }
      
      if (error.message.includes('Invalid login')) {
        throw new Error('Gmail authentication failed. Check OAuth2 credentials.');
      }

      // Retry on network errors
      if ((error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ESOCKET') && retryCount < maxRetries) {
        console.log(`🔄 Network error, retrying in ${(retryCount + 1) * 2} seconds...`);
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
        return this.sendEmail({ email, subject, html, text }, retryCount + 1);
      }
      
      throw error;
    }
  }

  // Send test email
  async sendTestEmail(recipientEmail) {
    try {
      const testHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background: #f5f5f5;
              }
              .container {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              .header {
                background: rgba(255,255,255,0.95);
                padding: 40px;
                text-align: center;
              }
              .header h1 {
                margin: 0;
                color: #667eea;
                font-size: 32px;
              }
              .content {
                background: white;
                padding: 40px;
              }
              .success-icon {
                font-size: 72px;
                text-align: center;
                margin: 20px 0;
              }
              .info-box {
                background: #f3f4f6;
                border-left: 4px solid #667eea;
                padding: 20px;
                margin: 25px 0;
                border-radius: 4px;
              }
              .info-box strong {
                color: #667eea;
                display: block;
                margin-bottom: 10px;
              }
              .footer {
                text-align: center;
                padding: 30px;
                color: rgba(255,255,255,0.95);
                font-size: 14px;
              }
              table {
                width: 100%;
                margin-top: 10px;
              }
              td {
                padding: 5px 0;
              }
              .label {
                font-weight: 600;
                color: #555;
              }
              .value {
                color: #777;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📧 Gmail OAuth2 Test</h1>
              </div>
              <div class="content">
                <div class="success-icon">✅</div>
                <h2 style="text-align: center; color: #10b981; margin: 0 0 20px 0;">Test Successful!</h2>
                <p style="text-align: center; font-size: 16px;">
                  Your Gmail OAuth2 integration is working perfectly!
                </p>
                <div class="info-box">
                  <strong>📊 Configuration Details:</strong>
                  <table>
                    <tr>
                      <td class="label">Authentication:</td>
                      <td class="value">OAuth2</td>
                    </tr>
                    <tr>
                      <td class="label">Service:</td>
                      <td class="value">Gmail API</td>
                    </tr>
                    <tr>
                      <td class="label">From:</td>
                      <td class="value">${process.env.GMAIL_USER_EMAIL}</td>
                    </tr>
                    <tr>
                      <td class="label">Time:</td>
                      <td class="value">${new Date().toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td class="label">Environment:</td>
                      <td class="value">${process.env.NODE_ENV || 'development'}</td>
                    </tr>
                    <tr>
                      <td class="label">Server:</td>
                      <td class="value">Render.com</td>
                    </tr>
                  </table>
                </div>
                <p style="margin-top: 25px;">
                  Your Equipment Health Monitor application is now fully configured to send email notifications
                  for equipment diagnostics, alerts, maintenance schedules, and critical system reports.
                </p>
                <p style="background: #e0f2fe; padding: 15px; border-radius: 6px; border-left: 4px solid #0284c7; margin-top: 20px;">
                  <strong style="color: #0369a1;">💡 Next Steps:</strong><br>
                  Email notifications are now active for:<br>
                  • Equipment health alerts<br>
                  • Predictive maintenance warnings<br>
                  • System diagnostics reports<br>
                  • Critical failure notifications
                </p>
              </div>
              <div class="footer">
                <strong>Equipment Health Monitor</strong><br>
                Powered by AI & Machine Learning<br>
                © ${new Date().getFullYear()} EquipHealth Team
              </div>
            </div>
          </body>
        </html>
      `;

      return await this.sendEmail({
        email: recipientEmail,
        subject: '✅ Gmail OAuth2 Test - Success! | Equipment Health Monitor',
        html: testHtml
      });

    } catch (error) {
      throw new Error(`Test email failed: ${error.message}`);
    }
  }

  // Strip HTML tags
  stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  // Verify Gmail configuration
  async verify() {
    try {
      if (!this.initialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return false;
        }
      }
      
      console.log('🔍 Verifying Gmail SMTP connection...');
      
      // Create and verify transporter
      const transporter = await this.createTransporter();
      
      console.log('✅ Gmail OAuth2 service verified and ready to send emails');
      
      // Close transporter
      transporter.close();
      
      return true;
      
    } catch (error) {
      console.error('❌ Gmail verification failed:', error.message);
      return false;
    }
  }

  // Get service status
  getStatus() {
    return {
      initialized: this.initialized,
      hasClientId: !!process.env.GMAIL_CLIENT_ID,
      hasClientSecret: !!process.env.GMAIL_CLIENT_SECRET,
      hasRefreshToken: !!process.env.GMAIL_REFRESH_TOKEN,
      hasUserEmail: !!process.env.GMAIL_USER_EMAIL,
      hasAccessToken: !!this.accessToken,
      tokenExpiry: this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : null,
      method: 'OAuth2',
      redirectUri: this.getRedirectUri()
    };
  }

  // Force reinitialize
  async reinitialize() {
    console.log('🔄 Force reinitializing Gmail service...');
    this.initialized = false;
    this.oauth2Client = null;
    this.transporter = null;
    this.accessToken = null;
    this.tokenExpiry = null;
    return await this.initialize();
  }
}

// Export singleton instance
module.exports = new GmailService();