const gmailService = require('../config/gmail');

/**
 * Send email directly from your Gmail account using Gmail API
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
    if (!options.email || !options.subject || (!options.html && !options.message)) {
      throw new Error('Missing required email fields');
    }

    // Send via Gmail API
    const result = await gmailService.sendEmail(options);

    console.log('✅ Email sent successfully from your Gmail account\n');

    return result;

  } catch (error) {
    console.error('❌ Email send failed:', error.message);

    // Return error object instead of throwing
    return {
      success: false,
      error: error.message,
      provider: 'gmail-api'
    };
  }
};

module.exports = sendEmail;