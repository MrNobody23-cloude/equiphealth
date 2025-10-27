const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Create basic SMTP transporter with multiple port fallback
 */
const createTransporter = () => {
  try {
    const {
      EMAIL_HOST,
      EMAIL_PORT,
      EMAIL_USERNAME,
      EMAIL_PASSWORD,
      EMAIL_FROM
    } = process.env;

    // Validate required fields
    if (!EMAIL_USERNAME || !EMAIL_PASSWORD) {
      console.warn('⚠️  Basic SMTP credentials not configured');
      return null;
    }

    if (transporter) {
      return transporter;
    }

    // Use the port from environment or default to 587
    const port = parseInt(EMAIL_PORT) || 587;
    const host = EMAIL_HOST || 'smtp.gmail.com';

    const config = {
      host: host,
      port: port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user: EMAIL_USERNAME,
        pass: EMAIL_PASSWORD
      },
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000,   // 30 seconds
      socketTimeout: 60000,      // 60 seconds
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      },
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
    };

    transporter = nodemailer.createTransport(config);

    console.log(`✅ SMTP transporter created`);
    console.log(`   Host: ${config.host}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   User: ${EMAIL_USERNAME}`);

    return transporter;

  } catch (error) {
    console.error('❌ Failed to create SMTP transporter:', error.message);
    return null;
  }
};

/**
 * Verify SMTP connection with timeout
 */
const verifyTransporter = async () => {
  try {
    const trans = createTransporter();
    
    if (!trans) {
      console.log('⚠️  SMTP transporter not available');
      return false;
    }

    console.log('🔍 Verifying SMTP connection...');

    // Try to verify with timeout
    const verifyPromise = trans.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SMTP verification timeout after 15s')), 15000)
    );

    await Promise.race([verifyPromise, timeoutPromise]);
    
    console.log('✅ SMTP connection verified successfully');
    console.log(`   From: ${process.env.EMAIL_FROM || process.env.EMAIL_USERNAME}`);
    return true;

  } catch (error) {
    console.error('━'.repeat(60));
    console.error('⚠️  SMTP VERIFICATION WARNING');
    console.error('━'.repeat(60));
    console.error('Error:', error.message);
    console.error('');
    console.error('Common on cloud platforms (Render, Heroku, Railway):');
    console.error('• SMTP ports often blocked to prevent spam');
    console.error('• Email sending may still work despite verification failure');
    console.error('• Users will be auto-verified until email is configured');
    console.error('━'.repeat(60));
    return false;
  }
};

/**
 * Get transporter instance (creates if not exists)
 */
const getTransporter = () => {
  if (!transporter) {
    return createTransporter();
  }
  return transporter;
};

module.exports = {
  createTransporter,
  verifyTransporter,
  getTransporter
};