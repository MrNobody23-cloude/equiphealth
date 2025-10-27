/**
 * Universal Email Service
 * Automatically uses available email provider (Gmail OAuth2 or SMTP)
 */

let emailService = null;

const initializeEmailService = () => {
  if (emailService) return emailService;
  
  // Get the email service from server instance
  try {
    const serverModule = require('../server');
    emailService = serverModule.emailService;
    return emailService;
  } catch (error) {
    console.warn('⚠️  Email service not available:', error.message);
    return null;
  }
};

/**
 * Send email using available provider
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 */
const sendEmail = async (options) => {
  try {
    console.log('\n📧 Email Request:');
    console.log(`   To: ${options.email}`);
    console.log(`   Subject: ${options.subject}`);

    // Validate inputs
    if (!options.email || !options.subject || !options.html) {
      throw new Error('Missing required email fields (email, subject, html)');
    }

    // Get email service
    const service = initializeEmailService();
    
    if (!service) {
      console.warn('⚠️  Email service not configured - email not sent');
      return {
        success: false,
        error: 'Email service not configured',
        provider: 'none'
      };
    }

    // Send email
    const result = await service.sendEmail(options);
    
    if (result.success) {
      console.log(`✅ Email sent via ${result.provider}\n`);
    } else {
      console.warn(`⚠️  Email failed: ${result.error}\n`);
    }

    return result;

  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    
    // Return error object instead of throwing
    return {
      success: false,
      error: error.message,
      provider: 'error'
    };
  }
};

module.exports = sendEmail;