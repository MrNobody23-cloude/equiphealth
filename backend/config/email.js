const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Create basic SMTP transporter
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
    if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USERNAME || !EMAIL_PASSWORD) {
      console.warn('⚠️  Basic SMTP credentials not configured');
      return null;
    }

    if (transporter) {
      return transporter;
    }

    transporter = nodemailer.createTransporter({
      host: EMAIL_HOST,
      port: parseInt(EMAIL_PORT),
      secure: parseInt(EMAIL_PORT) === 465,
      auth: {
        user: EMAIL_USERNAME,
        pass: EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    console.log(`✅ SMTP transporter created: ${EMAIL_HOST}:${EMAIL_PORT}`);
    return transporter;

  } catch (error) {
    console.error('❌ Failed to create SMTP transporter:', error.message);
    return null;
  }
};

/**
 * Verify SMTP connection
 */
const verifyTransporter = async () => {
  try {
    const trans = createTransporter();
    
    if (!trans) {
      return false;
    }

    await trans.verify();
    console.log('✅ SMTP connection verified');
    return true;

  } catch (error) {
    console.error('❌ SMTP verification failed:', error.message);
    return false;
  }
};

module.exports = {
  createTransporter,
  verifyTransporter
};