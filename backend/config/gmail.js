// backend/config/gmail.js
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

class GmailService {
  constructor() {
    this.oauth2Client = null;
    this.initialized = false;
    this.gmailApi = null;
    this.smtpEnabled = (process.env.ENABLE_SMTP_FALLBACK || 'false').toLowerCase() === 'true';
  }

  getRedirectUri() {
    if (process.env.NODE_ENV === 'production') {
      return process.env.GMAIL_REDIRECT_URI || 'https://equiphealth.onrender.com/auth/gmail/callback';
    }
    return 'http://localhost:5000/auth/gmail/callback';
  }

  getFrom() {
    return {
      name: process.env.EMAIL_FROM_NAME || 'Equipment Health Monitor',
      email: process.env.EMAIL_FROM_ADDRESS || process.env.GMAIL_USER_EMAIL
    };
  }

  // Generate OAuth authorization URL
  getAuthUrl(redirectUri) {
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

      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      const { tokens } = await oauth2Client.getToken(code);

      return tokens;
    } catch (error) {
      console.error('❌ Error exchanging code for tokens:', error.message);
      throw error;
    }
  }

  async initialize() {
    try {
      const {
        GMAIL_CLIENT_ID,
        GMAIL_CLIENT_SECRET,
        GMAIL_REFRESH_TOKEN,
        GMAIL_USER_EMAIL
      } = process.env;

      if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !GMAIL_USER_EMAIL) {
        console.log('⚠️  Gmail OAuth2 credentials not fully set');
        this.initialized = false;
        return false;
      }

      this.oauth2Client = new google.auth.OAuth2(
        GMAIL_CLIENT_ID,
        GMAIL_CLIENT_SECRET,
        this.getRedirectUri()
      );

      this.oauth2Client.setCredentials({
        refresh_token: GMAIL_REFRESH_TOKEN
      });

      // Test access token retrieval
      const tokenResp = await this.oauth2Client.getAccessToken();
      if (!tokenResp?.token) {
        throw new Error('Failed to obtain Gmail access token. Re-authorize.');
      }

      this.gmailApi = google.gmail({ version: 'v1', auth: this.oauth2Client });
      this.initialized = true;

      console.log(`✅ Gmail API initialized for: ${GMAIL_USER_EMAIL}`);
      return true;
    } catch (error) {
      console.error('❌ Gmail initialization failed:', error.message);
      this.initialized = false;
      return false;
    }
  }

  // Build raw RFC 2822 email message and return base64url string
  buildRawMessage({ to, subject, html, text }) {
    const { name: fromName, email: fromEmail } = this.getFrom();

    const subjectEncoded = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const plain = text || (html ? html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '');

    const messageParts = [
      `From: ${fromName} <${fromEmail}>`,
      `To: ${to}`,
      `Subject: ${subjectEncoded}`,
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="boundaryABC123"',
      '',
      '--boundaryABC123',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      plain,
      '',
      '--boundaryABC123',
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      html || '',
      '',
      '--boundaryABC123--'
    ];

    const message = messageParts.join('\r\n');

    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // Primary: Gmail API over HTTPS (no SMTP)
  async sendViaApi({ email, subject, html, text }) {
    if (!this.initialized) {
      const ok = await this.initialize();
      if (!ok) {
        throw new Error('Gmail API not initialized. Configure OAuth2 or re-authorize.');
      }
    }

    const raw = this.buildRawMessage({ to: email, subject, html, text });

    try {
      const res = await this.gmailApi.users.messages.send({
        userId: 'me',
        requestBody: { raw }
      });

      const id = res?.data?.id;
      if (!id) throw new Error('Gmail API returned no message id');

      console.log(`✅ Gmail API: sent to ${email} (id: ${id})`);
      return { success: true, messageId: id, provider: 'gmail-api' };
    } catch (error) {
      const msg = error?.response?.data?.error?.message || error.message;
      console.error('❌ Gmail API send failed:', msg);

      // Common token issues
      if (msg.includes('invalid_grant') || msg.includes('Token has been expired') || msg.includes('invalid_token')) {
        throw new Error('Gmail refresh token invalid or expired. Re-authorize at /auth/gmail/authorize');
      }

      // Network/transient errors should bubble to controller as failure
      throw new Error(`Gmail API error: ${msg}`);
    }
  }

  // Optional: SMTP fallback using App Password (disabled by default)
  async sendViaSmtp({ email, subject, html, text }) {
    if (!this.smtpEnabled) {
      throw new Error('SMTP fallback disabled');
    }

    const user = process.env.EMAIL_USER || process.env.GMAIL_USER_EMAIL;
    const pass = process.env.EMAIL_PASSWORD;
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.EMAIL_PORT || '587', 10);
    const secure = (process.env.EMAIL_SECURE || 'false').toLowerCase() === 'true' || port === 465;

    if (!user || !pass) {
      throw new Error('SMTP credentials not set');
    }

    const { name: fromName, email: fromEmail } = this.getFrom();

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }, // Use Gmail App Password
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: { servername: host, rejectUnauthorized: false }
    });

    try {
      const res = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject,
        html,
        text: text || html?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
      });
      transporter.close();

      console.log(`✅ Gmail SMTP: sent to ${email} (id: ${res?.messageId || 'n/a'})`);
      return { success: true, messageId: res?.messageId || null, provider: 'gmail-smtp' };
    } catch (error) {
      transporter.close();
      throw new Error(`Gmail SMTP error: ${error.message}`);
    }
  }

  // Public method used by app
  async sendEmail({ email, subject, html, text }) {
    // Try Gmail API first (HTTPS)
    try {
      return await this.sendViaApi({ email, subject, html, text });
    } catch (apiErr) {
      // If SMTP fallback is enabled, try it; otherwise fail
      if (this.smtpEnabled) {
        console.warn('⚠️  Falling back to Gmail SMTP (App Password)...');
        try {
          return await this.sendViaSmtp({ email, subject, html, text });
        } catch (smtpErr) {
          return { success: false, error: smtpErr.message, provider: 'gmail-smtp' };
        }
      }
      return { success: false, error: apiErr.message, provider: 'gmail-api' };
    }
  }

  async sendTestEmail(recipientEmail) {
    const { name: fromName, email: fromEmail } = this.getFrom();

    const testHtml = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif;">
          <h2>✅ Gmail API Test</h2>
          <p>This is a test email from <strong>${fromName}</strong> (${fromEmail}).</p>
          <ul>
            <li>Provider: Gmail API</li>
            <li>Time: ${new Date().toLocaleString()}</li>
            <li>Environment: ${process.env.NODE_ENV || 'development'}</li>
          </ul>
        </body>
      </html>
    `;

    return await this.sendEmail({
      email: recipientEmail,
      subject: '✅ Gmail API Test - Equipment Health Monitor',
      html: testHtml
    });
  }

  async verify() {
    try {
      if (!this.initialized) {
        const ok = await this.initialize();
        if (!ok) return false;
      }
      const res = await this.gmailApi.users.getProfile({ userId: 'me' });
      const emailAddress = res?.data?.emailAddress;
      console.log(`✅ Gmail API verified for: ${emailAddress || process.env.GMAIL_USER_EMAIL}`);
      return true;
    } catch (error) {
      console.error('❌ Gmail verification failed:', error.message);
      return false;
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      hasClientId: !!process.env.GMAIL_CLIENT_ID,
      hasClientSecret: !!process.env.GMAIL_CLIENT_SECRET,
      hasRefreshToken: !!process.env.GMAIL_REFRESH_TOKEN,
      hasUserEmail: !!process.env.GMAIL_USER_EMAIL,
      method: 'Gmail API (OAuth2)',
      redirectUri: this.getRedirectUri(),
      smtpFallback: this.smtpEnabled
    };
  }

  async reinitialize() {
    console.log('🔄 Reinitializing Gmail service...');
    this.oauth2Client = null;
    this.gmailApi = null;
    this.initialized = false;
    return await this.initialize();
  }
}

module.exports = new GmailService();