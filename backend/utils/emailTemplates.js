const getVerificationEmailTemplate = (name, verificationUrl) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: #ffffff;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 40px 30px;
        }
        .content h2 {
          color: #1e293b;
          margin: 0 0 20px 0;
          font-size: 24px;
        }
        .content p {
          color: #475569;
          line-height: 1.6;
          margin: 0 0 20px 0;
        }
        .button {
          display: inline-block;
          padding: 14px 32px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin: 20px 0;
        }
        .button:hover {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        }
        .footer {
          background-color: #f8fafc;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          color: #64748b;
          font-size: 14px;
          margin: 5px 0;
        }
        .footer a {
          color: #3b82f6;
          text-decoration: none;
        }
        .warning {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .warning p {
          color: #92400e;
          margin: 0;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🤖 Equipment Health Monitor</h1>
          <p>Intelligent Diagnostics & Predictive Maintenance</p>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>Welcome to Equipment Health Monitor! We're excited to have you on board.</p>
          <p>To get started, please verify your email address by clicking the button below:</p>
          
          <center>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </center>

          <p>Or copy and paste this link into your browser:</p>
          <p style="background-color: #f1f5f9; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 13px; color: #475569;">
            ${verificationUrl}
          </p>

          <div class="warning">
            <p><strong>⏰ This link will expire in 24 hours.</strong></p>
          </div>

          <p>If you didn't create an account with us, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>© 2024 Equipment Health Monitor. All rights reserved.</p>
          <p>This is an automated email, please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getWelcomeEmailTemplate = (name) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome!</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #ffffff;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .content {
          padding: 40px 30px;
        }
        .content h2 {
          color: #1e293b;
          margin: 0 0 20px 0;
          font-size: 24px;
        }
        .content p {
          color: #475569;
          line-height: 1.6;
          margin: 0 0 20px 0;
        }
        .features {
          background-color: #f8fafc;
          padding: 20px;
          border-radius: 6px;
          margin: 20px 0;
        }
        .feature-item {
          display: flex;
          align-items: start;
          margin-bottom: 15px;
        }
        .feature-icon {
          font-size: 24px;
          margin-right: 15px;
        }
        .feature-text {
          flex: 1;
        }
        .feature-text strong {
          color: #1e293b;
          display: block;
          margin-bottom: 5px;
        }
        .footer {
          background-color: #f8fafc;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          color: #64748b;
          font-size: 14px;
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Email Verified!</h1>
        </div>
        <div class="content">
          <h2>Welcome aboard, ${name}! 🎉</h2>
          <p>Your email has been successfully verified. You now have full access to all features of Equipment Health Monitor.</p>
          
          <div class="features">
            <div class="feature-item">
              <div class="feature-icon">🤖</div>
              <div class="feature-text">
                <strong>AI-Powered Diagnostics</strong>
                <span style="color: #64748b; font-size: 14px;">Get intelligent health predictions for your equipment using machine learning</span>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">📊</div>
              <div class="feature-text">
                <strong>Real-Time Monitoring</strong>
                <span style="color: #64748b; font-size: 14px;">Track equipment health metrics and receive instant alerts</span>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🔧</div>
              <div class="feature-text">
                <strong>Service Locator</strong>
                <span style="color: #64748b; font-size: 14px;">Find nearby maintenance experts when you need them</span>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">📈</div>
              <div class="feature-text">
                <strong>Analytics Dashboard</strong>
                <span style="color: #64748b; font-size: 14px;">Visualize trends and make data-driven maintenance decisions</span>
              </div>
            </div>
          </div>

          <p>Ready to get started? Log in to your account and start monitoring your equipment!</p>
        </div>
        <div class="footer">
          <p>© 2024 Equipment Health Monitor. All rights reserved.</p>
          <p>Need help? Contact us at support@equipmenthealth.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getPasswordResetEmailTemplate = (name, resetUrl) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: #ffffff;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .content {
          padding: 40px 30px;
        }
        .content h2 {
          color: #1e293b;
          margin: 0 0 20px 0;
          font-size: 24px;
        }
        .content p {
          color: #475569;
          line-height: 1.6;
          margin: 0 0 20px 0;
        }
        .button {
          display: inline-block;
          padding: 14px 32px;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin: 20px 0;
        }
        .warning {
          background-color: #fef2f2;
          border-left: 4px solid #ef4444;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .warning p {
          color: #991b1b;
          margin: 0;
          font-size: 14px;
        }
        .footer {
          background-color: #f8fafc;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          color: #64748b;
          font-size: 14px;
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>We received a request to reset your password for your Equipment Health Monitor account.</p>
          
          <center>
            <a href="${resetUrl}" class="button">Reset Password</a>
          </center>

          <p>Or copy and paste this link into your browser:</p>
          <p style="background-color: #f1f5f9; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 13px; color: #475569;">
            ${resetUrl}
          </p>

          <div class="warning">
            <p><strong>⏰ This link will expire in 10 minutes.</strong></p>
            <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
          </div>
        </div>
        <div class="footer">
          <p>© 2024 Equipment Health Monitor. All rights reserved.</p>
          <p>This is an automated email, please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  getVerificationEmailTemplate,
  getWelcomeEmailTemplate,
  getPasswordResetEmailTemplate
};