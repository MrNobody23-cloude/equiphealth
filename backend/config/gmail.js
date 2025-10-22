const { google } = require('googleapis');
const nodemailer = require('nodemailer');

class GmailService {
  constructor() {
    this.oauth2Client = null;
    this.transporter = null;
    this.initialized = false;
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

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent', // Force consent screen to get refresh token
        scope: [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/userinfo.email'
        ]
      });

      return authUrl;
    } catch (error) {
      console.error('Error generating auth URL:', error);
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
      } else {
        console.log('⚠️  No refresh token - you may have authorized before');
      }
      
      return tokens;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error(`Failed to get tokens: ${error.message}`);
    }
  }

  // Initialize Gmail service with OAuth2
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
        console.log('   Required: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET');
        return false;
      }

      if (!GMAIL_REFRESH_TOKEN) {
        console.log('⚠️  GMAIL_REFRESH_TOKEN not set');
        console.log(`   Visit: ${this.getRedirectUri().replace('/callback', '/authorize')}`);
        console.log('   to complete OAuth2 authorization');
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

      // Test getting access token
      try {
        const { token } = await this.oauth2Client.getAccessToken();
        if (!token) {
          throw new Error('Failed to obtain access token');
        }
        console.log('✅ OAuth2 access token obtained successfully');
      } catch (tokenError) {
        console.error('❌ Failed to get access token:', tokenError.message);
        throw new Error('Invalid or expired refresh token. Re-authorize at /auth/gmail/authorize');
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
      if (!this.oauth2Client) {
        throw new Error('OAuth2 client not initialized');
      }

      // Get fresh access token
      const { token } = await this.oauth2Client.getAccessToken();

      if (!token) {
        throw new Error('Failed to obtain access token');
      }

      // Create transporter with OAuth2
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_USER_EMAIL,
          clientId: process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          refreshToken: process.env.GMAIL_REFRESH_TOKEN,
          accessToken: token
        },
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production'
        }
      });

      // Verify transporter
      await transporter.verify();
      return transporter;

    } catch (error) {
      console.error('❌ Failed to create transporter:', error.message);
      throw error;
    }
  }

  // Send email using OAuth2
  async sendEmail({ email, subject, html, text }) {
    // Initialize if not already done
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('Gmail service not initialized. Complete OAuth2 setup at /auth/gmail/authorize');
      }
    }

    try {
      // Create fresh transporter with new access token
      const transporter = await this.createTransporter();

      const mailOptions = {
        from: `"Equipment Health Monitor" <${process.env.GMAIL_USER_EMAIL}>`,
        to: email,
        subject: subject,
        html: html,
        text: text || this.stripHtml(html)
      };

      const result = await transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully`);
      console.log(`   To: ${email}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Message ID: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId,
        provider: 'gmail-oauth2'
      };

    } catch (error) {
      console.error('❌ Email sending failed:', error.message);
      
      // Handle specific error cases
      if (error.message.includes('invalid_grant')) {
        throw new Error('Gmail refresh token expired or revoked. Please re-authorize at /auth/gmail/authorize');
      }
      
      if (error.message.includes('Invalid login')) {
        throw new Error('Gmail authentication failed. Check your OAuth2 credentials.');
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
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 10px;
                overflow: hidden;
              }
              .header {
                background: rgba(255,255,255,0.95);
                padding: 30px;
                text-align: center;
              }
              .header h1 {
                margin: 0;
                color: #667eea;
                font-size: 28px;
              }
              .content {
                background: white;
                padding: 30px;
              }
              .success-icon {
                font-size: 64px;
                text-align: center;
                margin: 20px 0;
              }
              .info-box {
                background: #f3f4f6;
                border-left: 4px solid #667eea;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .info-box strong {
                color: #667eea;
              }
              .footer {
                text-align: center;
                padding: 20px;
                color: rgba(255,255,255,0.9);
                font-size: 14px;
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
                <h2 style="text-align: center; color: #10b981;">Test Successful!</h2>
                <p style="text-align: center; font-size: 16px;">
                  Your Gmail OAuth2 integration is working perfectly!
                </p>
                <div class="info-box">
                  <strong>Configuration Details:</strong><br>
                  • Authentication: OAuth2<br>
                  • Service: Gmail API<br>
                  • From: ${process.env.GMAIL_USER_EMAIL}<br>
                  • Time: ${new Date().toLocaleString()}<br>
                  • Environment: ${process.env.NODE_ENV || 'development'}
                </div>
                <p>
                  Your Equipment Health Monitor application is now ready to send email notifications
                  for equipment diagnostics, alerts, and reports.
                </p>
              </div>
              <div class="footer">
                Equipment Health Monitor | Powered by AI
              </div>
            </div>
          </body>
        </html>
      `;

      return await this.sendEmail({
        email: recipientEmail,
        subject: '✅ Gmail OAuth2 Test - Success!',
        html: testHtml
      });

    } catch (error) {
      throw new Error(`Test email failed: ${error.message}`);
    }
  }

  // Strip HTML tags from content
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
      
      // Try to create a transporter to verify everything works
      await this.createTransporter();
      console.log('✅ Gmail OAuth2 service verified and ready');
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
      method: 'OAuth2',
      redirectUri: this.getRedirectUri()
    };
  }
}

// Export singleton instance
module.exports = new GmailService();