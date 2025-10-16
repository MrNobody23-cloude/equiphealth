const createEmailTransporter = require('../config/email');

const sendEmail = async (options) => {
  try {
    // Create transporter
    const transporter = createEmailTransporter();

    if (!transporter) {
      throw new Error('Email service not configured. Please set EMAIL_USERNAME and EMAIL_PASSWORD.');
    }

    // Verify transporter configuration
    await transporter.verify();

    // Email options
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
      to: options.email,
      subject: options.subject,
      html: options.html || options.message,
      text: options.text || options.message
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully to:', options.email);
    console.log('   Message ID:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('❌ Email service error:', error.message);
    throw new Error(`Email could not be sent: ${error.message}`);
  }
};

module.exports = sendEmail;