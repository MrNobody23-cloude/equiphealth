const crypto = require('crypto');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { 
  getVerificationEmailTemplate, 
  getWelcomeEmailTemplate,
  getPasswordResetEmailTemplate 
} = require('../utils/emailTemplates');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, email and password'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      if (existingUser.emailVerified) {
        return res.status(400).json({
          success: false,
          error: 'User already exists with this email'
        });
      } else {
        // User registered but never verified - allow re-registration
        console.log('⚠️  Deleting unverified user:', existingUser.email);
        await User.findByIdAndDelete(existingUser._id);
      }
    }

    // Check if email service is configured
    const emailConfigured = !!(process.env.EMAIL_USERNAME && process.env.EMAIL_PASSWORD);

    if (!emailConfigured) {
      return res.status(503).json({
        success: false,
        error: 'Email verification service is not configured. Please contact administrator.',
        emailServiceDown: true
      });
    }

    // Create user with pending status
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

    // Create verification URL
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    console.log('🔗 Verification URL:', verificationUrl);

    // Send verification email
    try {
      const emailResult = await sendEmail({
        email: user.email,
        subject: 'Verify Your Email - Equipment Health Monitor',
        html: getVerificationEmailTemplate(user.name, verificationUrl)
      });

      if (emailResult.success) {
        console.log('✅ Verification email sent successfully');
        
        res.status(201).json({
          success: true,
          message: 'Registration successful! Please check your email to verify your account before logging in.',
          emailSent: true,
          email: user.email
        });
      } else {
        // Email failed - delete user from database
        console.error('❌ Email sending failed, deleting user');
        await User.findByIdAndDelete(user._id);
        
        throw new Error(emailResult.error || 'Failed to send verification email');
      }
    } catch (emailError) {
      console.error('❌ Email error:', emailError);
      
      // Delete user if email fails
      try {
        await User.findByIdAndDelete(user._id);
        console.log('🗑️  User deleted due to email failure');
      } catch (deleteError) {
        console.error('Error deleting user:', deleteError);
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again later or contact support.',
        details: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Error in registration process'
    });
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email'
      });
    }

    const user = await User.findOne({ 
      email: email.toLowerCase(),
      emailVerified: false,
      provider: 'local'
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No unverified account found with this email'
      });
    }

    // Check if user was created more than 24 hours ago
    const hoursSinceCreation = (Date.now() - user.createdAt) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      // Delete old unverified user
      await User.findByIdAndDelete(user._id);
      return res.status(410).json({
        success: false,
        error: 'Verification link expired. Please register again.',
        expired: true
      });
    }

    // Generate new verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save();

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    // Send email
    const emailResult = await sendEmail({
      email: user.email,
      subject: 'Verify Your Email - Equipment Health Monitor',
      html: getVerificationEmailTemplate(user.name, verificationUrl)
    });

    if (emailResult.success) {
      res.status(200).json({
        success: true,
        message: 'Verification email sent! Please check your inbox.'
      });
    } else {
      throw new Error(emailResult.error);
    }

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend verification email'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // STRICT: Check if email is verified for local auth users
    if (user.provider === 'local' && !user.emailVerified) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email before logging in. Check your inbox for the verification link.',
        emailNotVerified: true,
        email: user.email
      });
    }

    // Check if account is active
    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Your account is not active. Please contact support.',
        accountInactive: true
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been deactivated. Please contact support.',
        accountDeactivated: true
      });
    }

    // Update last login
    await user.updateLastLogin();

    // Create token
    const token = user.getSignedJwtToken();

    res.status(200).json({
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

    console.log('✅ User logged in:', user.email);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Error in login process'
    });
  }
};

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
  try {
    // Get hashed token
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

    console.log('✅ Verifying email for user:', user.email);

    // Activate account
    await user.activateAccount();

    console.log('✅ Email verified and account activated:', user.email);

    // Send welcome email (non-blocking)
    sendEmail({
      email: user.email,
      subject: 'Welcome to Equipment Health Monitor!',
      html: getWelcomeEmailTemplate(user.name)
    }).then(() => {
      console.log('✅ Welcome email sent to:', user.email);
    }).catch(err => {
      console.warn('⚠️  Welcome email failed (non-critical):', err.message);
    });

    // Create token
    const token = user.getSignedJwtToken();

    res.status(200).json({
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
    res.status(500).json({
      success: false,
      message: 'Error in email verification process'
    });
  }
};

// @desc    Logout user
// @route   GET /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
  });
  
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
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
    res.status(500).json({
      success: false,
      error: 'Error fetching user data'
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ 
      email: req.body.email.toLowerCase(),
      emailVerified: true // Only allow verified users to reset password
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No verified account found with that email'
      });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();
    await user.save();

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset Request',
        html: getPasswordResetEmailTemplate(user.name, resetUrl)
      });

      res.status(200).json({
        success: true,
        message: 'Password reset email sent'
      });
    } catch (error) {
      console.error('Reset email error:', error);
      
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      return res.status(500).json({
        success: false,
        error: 'Email could not be sent'
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Error in password reset process'
    });
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Create token
    const token = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      token,
      message: 'Password reset successful'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Error in password reset process'
    });
  }
};

// @desc    Cleanup unverified users (older than 24 hours)
// @route   DELETE /api/auth/cleanup-unverified (internal use)
// @access  Private/Admin
exports.cleanupUnverifiedUsers = async (req, res) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await User.deleteMany({
      emailVerified: false,
      provider: 'local',
      createdAt: { $lt: oneDayAgo }
    });

    console.log(`🧹 Cleaned up ${result.deletedCount} unverified users`);

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} unverified users`,
      count: result.deletedCount
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: 'Error cleaning up unverified users'
    });
  }
};