const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
  // Check if email is configured
  if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
    console.warn('⚠️  Email service not configured');
    return null;
  }

  try {
    // Gmail configuration
    if (process.env.EMAIL_HOST === 'smtp.gmail.com' || process.env.EMAIL_SERVICE === 'gmail') {
      return nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true for 465, false for 587
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    }

    // Generic SMTP configuration
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  } catch (error) {
    console.error('❌ Error creating email transporter:', error.message);
    return null;
  }
};

// Verify transporter configuration
const verifyTransporter = async () => {
  try {
    const transporter = createTransporter();
    
    await transporter.verify();
    console.log('✅ Email service is ready');
    console.log('   From:', process.env.EMAIL_FROM || process.env.EMAIL_USERNAME);
    return true;
  } catch (error) {
    console.error('❌ Email service verification failed:', error.message);
    return false;
  }
};

module.exports = {
  createTransporter,
  verifyTransporter
};