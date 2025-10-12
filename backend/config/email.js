const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  // Gmail configuration
  if (process.env.EMAIL_HOST === 'smtp.gmail.com') {
    return nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  // Generic SMTP configuration
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Verify transporter configuration
const verifyTransporter = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email service is ready');
    return true;
  } catch (error) {
    console.error('❌ Email service error:', error.message);
    console.log('⚠️  Email verification will be disabled. Configure EMAIL_* variables in .env');
    return false;
  }
};

module.exports = {
  createTransporter,
  verifyTransporter
};