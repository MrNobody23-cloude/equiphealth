const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
  // Check if email is configured
  if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
    console.warn('⚠️  Email service not configured');
    return null;
  }

  try {
    // Use port 465 with SSL (works better on Render)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // Use SSL
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      },
      // Longer timeouts for Render
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000,   // 30 seconds
      socketTimeout: 60000      // 60 seconds
    });

    console.log('✅ Email transporter created successfully');
    return transporter;
  } catch (error) {
    console.error('❌ Error creating email transporter:', error.message);
    return null;
  }
};

// Verify transporter configuration
const verifyTransporter = async () => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('━'.repeat(60));
      console.log('⚠️  EMAIL SERVICE NOT CONFIGURED');
      console.log('Email verification will be disabled.');
      console.log('━'.repeat(60));
      return false;
    }

    console.log('🔍 Verifying email connection to Gmail...');
    console.log('   Host: smtp.gmail.com');
    console.log('   Port: 465 (SSL)');
    console.log('   User:', process.env.EMAIL_USERNAME);

    await transporter.verify();
    
    console.log('━'.repeat(60));
    console.log('✅ EMAIL SERVICE READY');
    console.log('━'.repeat(60));
    console.log('   Provider: Gmail');
    console.log('   From:', process.env.EMAIL_FROM || process.env.EMAIL_USERNAME);
    console.log('━'.repeat(60));
    return true;
  } catch (error) {
    console.error('━'.repeat(60));
    console.error('❌ EMAIL VERIFICATION FAILED');
    console.error('Error:', error.message);
    console.error('━'.repeat(60));
    return false;
  }
};

module.exports = {
  createTransporter,
  verifyTransporter
};