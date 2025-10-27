// backend/utils/sendEmail.js
// Uses Gmail API (OAuth2). SMTP fallback is disabled by default to avoid transporter/port timeouts.

const gmailService = require('../config/gmail');

/**
 * Send email using Gmail API (HTTPS). Never throws; returns { success, provider, messageId, error }.
 * @param {Object} options
 * @param {string} options.email
 * @param {string} options.subject
 * @param {string} options.html
 * @param {string} [options.text]
 */
const sendEmail = async (options) => {
  try {
    console.log('\n📧 Email Request:');
    console.log(`   To: ${options.email}`);
    console.log(`   Subject: ${options.subject}`);

    if (!options?.email || !options?.subject || !options?.html) {
      return { success: false, provider: 'gmail-api', error: 'Missing required email fields (email, subject, html)' };
    }

    // Send via Gmail API (fallback to SMTP only if ENABLE_SMTP_FALLBACK=true)
    const result = await gmailService.sendEmail(options);
    return result;
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    return { success: false, provider: 'gmail-api', error: error.message };
  }
};

module.exports = sendEmail;