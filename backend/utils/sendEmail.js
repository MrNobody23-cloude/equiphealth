/**
 * Universal Email Service
 * Uses global email service wrapper initialized in server.js
 */

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

    // Get email service from global
    const emailService = global.emailService;
    
    if (!emailService) {
      console.warn('⚠️  Email service not initialized');
      return {
        success: false,
        error: 'Email service not initialized',
        provider: 'none'
      };
    }

    // Check if email service is configured
    if (!emailService.isConfigured()) {
      console.warn('⚠️  Email service not configured - email not sent');
      return {
        success: false,
        error: 'Email service not configured',
        provider: 'none',
        autoVerify: true // Flag to auto-verify user
      };
    }

    // Send email
    const result = await emailService.sendEmail(options);
    
    if (result.success) {
      console.log(`✅ Email sent successfully via ${result.provider}`);
    } else {
      console.warn(`⚠️  Email failed: ${result.error}`);
    }

    return result;

  } catch (error) {
    console.error('❌ Email send error:', error.message);
    
    // Return error object instead of throwing
    return {
      success: false,
      error: error.message,
      provider: 'error'
    };
  }
};

module.exports = sendEmail;