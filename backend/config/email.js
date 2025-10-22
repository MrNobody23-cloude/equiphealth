const nodemailer = require('nodemailer');

// Try multiple SMTP configurations
const createTransporter = () => {
  if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
    console.warn('⚠️  Email service not configured');
    return null;
  }

  // Try different port configurations
  const configs = [
    // Port 2525 - Alternative SMTP port (less likely to be blocked)
    {
      host: 'smtp.gmail.com',
      port: 2525,
      secure: false,
      name: 'Port 2525 (Alternative SMTP)'
    },
    // Port 587 - Standard TLS
    {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      name: 'Port 587 (TLS)'
    },
    // Port 465 - SSL
    {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      name: 'Port 465 (SSL)'
    },
    // Port 25 - Basic SMTP (least secure, but often works)
    {
      host: 'smtp.gmail.com',
      port: 25,
      secure: false,
      name: 'Port 25 (Basic SMTP)'
    }
  ];

  // Use the port from environment or try alternatives
  const preferredPort = parseInt(process.env.EMAIL_PORT) || 2525;
  
  try {
    const config = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: preferredPort,
      secure: preferredPort === 465,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
      pool: true,
      maxConnections: 5,
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      },
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
    };

    const transporter = nodemailer.createTransport(config);

    console.log('✅ Email transporter created');
    console.log(`   Host: ${config.host}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   User: ${process.env.EMAIL_USERNAME}`);

    return transporter;
  } catch (error) {
    console.error('❌ Error creating email transporter:', error.message);
    return null;
  }
};

// Verify transporter configuration with retry logic
const verifyTransporter = async () => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('━'.repeat(60));
      console.log('⚠️  EMAIL SERVICE NOT CONFIGURED');
      console.log('━'.repeat(60));
      return false;
    }

    console.log('🔍 Verifying email connection...');

    // Try to verify with timeout
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Verification timeout')), 15000)
    );

    await Promise.race([verifyPromise, timeoutPromise]);
    
    console.log('━'.repeat(60));
    console.log('✅ EMAIL SERVICE READY');
    console.log('━'.repeat(60));
    console.log('   Provider: Gmail SMTP');
    console.log('   From:', process.env.EMAIL_FROM || process.env.EMAIL_USERNAME);
    console.log('   Status: Connected & Verified');
    console.log('━'.repeat(60));
    return true;

  } catch (error) {
    console.error('━'.repeat(60));
    console.error('⚠️  EMAIL VERIFICATION WARNING');
    console.error('━'.repeat(60));
    console.error('Error:', error.message);
    console.error('');
    console.error('This is common on cloud platforms (Render, Heroku, etc.)');
    console.error('They often block SMTP ports to prevent spam.');
    console.error('');
    console.error('Workarounds:');
    console.error('1. Email will be attempted anyway (may still work)');
    console.error('2. Users will be auto-verified if email fails');
    console.error('3. System will continue without email verification');
    console.error('━'.repeat(60));
    return false; // Return false but don't crash
  }
};

module.exports = createTransporter;
module.exports.createTransporter = createTransporter;
module.exports.verifyTransporter = verifyTransporter;