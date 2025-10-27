// backend/controllers/auth.js
const crypto = require('crypto');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { 
  getVerificationEmailTemplate, 
  getWelcomeEmailTemplate,
  getPasswordResetEmailTemplate 
} = require('../utils/emailTemplates');

// Email verification is compulsory: if email fails to send, registration fails with 503.

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Please provide name, email and password' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      if (existingUser.emailVerified) {
        return res.status(400).json({ success: false, error: 'User already exists with this email' });
      } else {
        const hoursSinceCreation = (Date.now() - existingUser.createdAt) / (1000 * 60 * 60);
        if (hoursSinceCreation > 24) {
          console.log('⚠️  Deleting old unverified user:', existingUser.email);
          await User.findByIdAndDelete(existingUser._id);
        } else {
          return res.status(400).json({
            success: false,
            error: 'An account with this email is pending verification. Please check your email or try again later.',
            pendingVerification: true
          });
        }
      }
    }

    // Create pending user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      provider: 'local',
      emailVerified: false,
      accountStatus: 'pending'
    });

    console.log('✅ User created (pending verification):', user.email);

    // Generate verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save();

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    // Attempt to send verification email via Gmail API
    const emailResult = await sendEmail({
      email: user.email,
      subject: 'Verify Your Email - Equipment Health Monitor',
      html: getVerificationEmailTemplate(user.name, verificationUrl)
    });

    if (!emailResult.success) {
      console.warn(`❌ Verification email failed (${emailResult.provider}): ${emailResult.error}`);

      // Delete pending user since verification email couldn't be sent
      try {
        await User.findByIdAndDelete(user._id);
        console.log('🗑️  Pending user removed due to email failure');
      } catch (delErr) {
        console.error('⚠️  Failed to delete pending user:', delErr.message);
      }

      return res.status(503).json({
        success: false,
        error: 'Unable to send verification email at the moment. Please try again later.',
        provider: emailResult.provider
      });
    }

    console.log('✅ Verification email sent successfully');
    return res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      emailSent: true,
      email: user.email
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    return res.status(500).json({ success: false, error: 'Error in registration process' });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide email' });
    }

    const user = await User.findOne({ 
      email: email.toLowerCase(),
      emailVerified: false,
      provider: 'local'
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'No unverified account found with this email' });
    }

    const hoursSinceCreation = (Date.now() - user.createdAt) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      await User.findByIdAndDelete(user._id);
      return res.status(410).json({
        success: false,
        error: 'Verification link expired. Please register again.',
        expired: true
      });
    }

    const verificationToken = user.getEmailVerificationToken();
    await user.save();

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    const emailResult = await sendEmail({
      email: user.email,
      subject: 'Verify Your Email - Equipment Health Monitor',
      html: getVerificationEmailTemplate(user.name, verificationUrl)
    });

    if (!emailResult.success) {
      console.warn(`❌ Resend verification failed (${emailResult.provider}): ${emailResult.error}`);
      return res.status(503).json({
        success: false,
        error: 'Unable to send verification email right now. Please try again later.',
        provider: emailResult.provider
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Verification email sent! Please check your inbox.'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ success: false, error: 'Failed to resend verification email' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    if (user.provider === 'local' && !user.emailVerified) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email before logging in.',
        emailNotVerified: true
      });
    }

    if (user.accountStatus !== 'active' || user.isActive === false) {
      return res.status(403).json({
        success: false,
        error: 'Your account is not active. Please contact support.'
      });
    }

    await user.updateLastLogin();
    const token = user.getSignedJwtToken();

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        provider: user.provider,
        emailVerified: user.emailVerified
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Error in login process' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const emailVerificationToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      emailVerificationToken,
      emailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token',
        expired: true
      });
    }

    await user.activateAccount();

    // Fire-and-forget welcome email (non-critical)
    sendEmail({
      email: user.email,
      subject: 'Welcome to Equipment Health Monitor!',
      html: getWelcomeEmailTemplate(user.name)
    }).catch(() => {});

    const token = user.getSignedJwtToken();

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully! Your account is now active.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
        accountStatus: user.accountStatus
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({ success: false, message: 'Error in email verification process' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ 
      email: req.body.email.toLowerCase(),
      emailVerified: true
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'No verified account found with that email' });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const emailResult = await sendEmail({
      email: user.email,
      subject: 'Password Reset Request',
      html: getPasswordResetEmailTemplate(user.name, resetUrl)
    });

    if (!emailResult.success) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      return res.status(503).json({
        success: false,
        error: 'Unable to send password reset email. Please try again later.'
      });
    }

    return res.status(200).json({ success: true, message: 'Password reset email sent' });

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, error: 'Error in password reset process' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        provider: user.provider,
        emailVerified: user.emailVerified,
        accountStatus: user.accountStatus
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ success: false, error: 'Error fetching user data' });
  }
};

exports.cleanupUnverifiedUsers = async (req, res) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await User.deleteMany({
      emailVerified: false,
      provider: 'local',
      createdAt: { $lt: oneDayAgo }
    });

    return res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} unverified users`,
      count: result.deletedCount
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return res.status(500).json({ success: false, error: 'Error cleaning up unverified users' });
  }
};