const crypto = require('crypto');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { 
  getVerificationEmailTemplate, 
  getWelcomeEmailTemplate,
  getPasswordResetEmailTemplate 
} = require('../utils/emailTemplates');

// Helper to generate JWT token
const generateToken = (user) => {
  return user.getSignedJwtToken();
};

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
      // If user exists and is verified
      if (existingUser.emailVerified) {
        return res.status(400).json({
          success: false,
          error: 'User already exists with this email'
        });
      } else {
        // User registered but never verified - check if old enough to delete
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

    // Try to send verification email
    try {
      const emailResult = await sendEmail({
        email: user.email,
        subject: '✅ Verify Your Email - Equipment Health Monitor',
        html: getVerificationEmailTemplate(user.name, verificationUrl)
      });

      // Check if email service is not configured (auto-verify scenario)
      if (!emailResult.success && emailResult.autoVerify) {
        console.log(`⚠️  Email service not configured - auto-verifying user: ${user.email}`);
        
        // Auto-activate account
        await user.activateAccount();
        
        const token = generateToken(user);
        
        return res.status(201).json({
          success: true,
          message: 'Registration successful! (Email verification temporarily disabled - you are automatically verified)',
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            emailVerified: true,
            accountStatus: 'active'
          },
          warning: 'Email service not configured. You have been automatically verified.'
        });
      }

      // Email sent successfully
      if (emailResult.success) {
        console.log('✅ Verification email sent successfully');
        
        return res.status(201).json({
          success: true,
          message: 'Registration successful! Please check your email to verify your account before logging in.',
          emailSent: true,
          email: user.email
        });
      }

      // Email failed for other reasons
      console.error('❌ Email sending failed:', emailResult.error);
      
      // Delete user if email fails
      await User.findByIdAndDelete(user._id);
      
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? emailResult.error : undefined
      });

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
        error: 'Failed to send verification email. Please try again later.',
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
      subject: '✅ Verify Your Email - Equipment Health Monitor',
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

    // Send welcome email (non-blocking, don't wait for it)
    sendEmail({
      email: user.email,
      subject: '🎉 Welcome to Equipment Health Monitor!',
      html: getWelcomeEmailTemplate(user.name)
    }).then(() => {
      console.log('✅ Welcome email sent to:', user.email);
    }).catch(err => {
      console.warn('⚠️  Welcome email failed (non-critical):', err.message);
    });

    // Create token
    const token = generateToken(user);

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

    // Check if email is verified for local auth users
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
    const token = generateToken(user);

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

// @desc    Logout user
// @route   POST /api/auth/logout
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
      emailVerified: true
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
      const emailResult = await sendEmail({
        email: user.email,
        subject: '🔒 Password Reset Request - Equipment Health Monitor',
        html: getPasswordResetEmailTemplate(user.name, resetUrl)
      });

      if (emailResult.success) {
        res.status(200).json({
          success: true,
          message: 'Password reset email sent'
        });
      } else {
        throw new Error(emailResult.error);
      }
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
    const token = generateToken(user);

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