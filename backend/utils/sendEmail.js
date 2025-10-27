// backend/utils/sendEmail.js
const gmailService = require('../config/gmail');

/**
 * Send email via Gmail API (OAuth2). Never throws; returns { success, provider, messageId, error }.
 */
const sendEmail = async (options) => {
  try {
    console.log('\n📧 Email Request:');
    console.log(`   To: ${options.email}`);
    console.log(`   Subject: ${options.subject}`);

    if (!options?.email || !options?.subject || !options?.html) {
      return { success: false, provider: 'gmail-api', error: 'Missing required email fields (email, subject, html)' };
    }

    const result = await gmailService.sendEmail(options);
    return result;
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    return { success: false, provider: 'gmail-api', error: error.message };
  }
};

module.exports = sendEmail;