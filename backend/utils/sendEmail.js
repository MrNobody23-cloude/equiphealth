const { createTransporter } = require('../config/email');

const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    const message = {
      from: process.env.EMAIL_FROM,
      to: options.email,
      subject: options.subject,
      html: options.html,
      text: options.text
    };

    const info = await transporter.sendMail(message);
    
    console.log(`✅ Email sent to ${options.email}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email send error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = sendEmail;