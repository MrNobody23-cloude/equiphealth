// backend/controllers/auth.js
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const {
  getVerificationEmailTemplate,
  getWelcomeEmailTemplate,
  getPasswordResetEmailTemplate
} = require('../utils/emailTemplates');

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Helper: set readable cookie for SPA (frontend domain cannot clear API cookie; but this helps session consistency)
function setFrontTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: false,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

// ==================== LOCAL AUTH ====================

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, error: 'Please provide name, email and password' });

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      if (existingUser.emailVerified) {
        return res.status(400).json({ success: false, error: 'User already exists with this email' });
      } else {
        const hours = (Date.now() - existingUser.createdAt) / 36e5;
        if (hours > 24) await User.findByIdAndDelete(existingUser._id);
        else return res.status(400).json({ success: false, error: 'An account with this email is pending verification. Please check your email or try again later.', pendingVerification: true });
      }
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      provider: 'local',
      emailVerified: false,
      accountStatus: 'pending'
    });

    const verificationToken = user.getEmailVerificationToken();
    await user.save();

    const verificationUrl = `${FRONTEND_URL}/verify-email/${verificationToken}`;
    const emailResult = await sendEmail({
      email: user.email,
      subject: 'Verify Your Email - Equipment Health Monitor',
      html: getVerificationEmailTemplate(user.name, verificationUrl)
    });

    if (!emailResult.success) {
      try { await User.findByIdAndDelete(user._id); } catch {}
      return res.status(503).json({ success: false, error: 'Unable to send verification email at the moment. Please try again later.', provider: emailResult.provider });
    }

    return res.status(201).json({ success: true, message: 'Registration successful! Please check your email to verify your account.', emailSent: true, email: user.email });
  } catch {
    return res.status(500).json({ success: false, error: 'Error in registration process' });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Please provide email' });

    const user = await User.findOne({ email: email.toLowerCase(), emailVerified: false, provider: 'local' });
    if (!user) return res.status(404).json({ success: false, error: 'No unverified account found with this email' });

    const hours = (Date.now() - user.createdAt) / 36e5;
    if (hours > 24) {
      await User.findByIdAndDelete(user._id);
      return res.status(410).json({ success: false, error: 'Verification link expired. Please register again.', expired: true });
    }

    const verificationToken = user.getEmailVerificationToken();
    await user.save();

    const verificationUrl = `${FRONTEND_URL}/verify-email/${verificationToken}`;
    const emailResult = await sendEmail({
      email: user.email,
      subject: 'Verify Your Email - Equipment Health Monitor',
      html: getVerificationEmailTemplate(user.name, verificationUrl)
    });

    if (!emailResult.success) return res.status(503).json({ success: false, error: 'Unable to send verification email right now. Please try again later.', provider: emailResult.provider });

    return res.status(200).json({ success: true, message: 'Verification email sent! Please check your inbox.' });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to resend verification email' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Please provide email and password' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    if (user.provider === 'local' && !user.emailVerified) return res.status(403).json({ success: false, error: 'Please verify your email before logging in.', emailNotVerified: true });

    if (user.accountStatus !== 'active' || user.isActive === false) return res.status(403).json({ success: false, error: 'Your account is not active. Please contact support.' });

    if (typeof user.updateLastLogin === 'function') await user.updateLastLogin();
    else { user.lastLogin = new Date(); await user.save({ validateBeforeSave: false }); }

    const token = user.getSignedJwtToken();
    return res.status(200).json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, provider: user.provider, emailVerified: user.emailVerified } });
  } catch {
    return res.status(500).json({ success: false, error: 'Error in login process' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const emailVerificationToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ emailVerificationToken, emailVerificationExpire: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired verification token', expired: true });

    await user.activateAccount();
    sendEmail({ email: user.email, subject: 'Welcome to Equipment Health Monitor!', html: getWelcomeEmailTemplate(user.name) }).catch(() => {});
    const token = user.getSignedJwtToken();

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully! Your account is now active.',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, emailVerified: user.emailVerified, accountStatus: user.accountStatus }
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Error in email verification process' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase(), emailVerified: true });
    if (!user) return res.status(404).json({ success: false, error: 'No verified account found with that email' });

    const resetToken = user.getResetPasswordToken();
    await user.save();

    const resetUrl = `${FRONTEND_URL}/reset-password/${resetToken}`;
    const emailResult = await sendEmail({
      email: user.email,
      subject: 'Password Reset Request',
      html: getPasswordResetEmailTemplate(user.name, resetUrl)
    });

    if (!emailResult.success) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      return res.status(503).json({ success: false, error: 'Unable to send password reset email. Please try again later.' });
    }

    return res.status(200).json({ success: true, message: 'Password reset email sent' });
  } catch {
    return res.status(500).json({ success: false, error: 'Error in password reset process' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ resetPasswordToken, resetPasswordExpire: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    if (!req.body.password) return res.status(400).json({ success: false, error: 'Password is required' });

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    const token = user.getSignedJwtToken();
    return res.status(200).json({ success: true, token, message: 'Password reset successful' });
  } catch {
    return res.status(500).json({ success: false, error: 'Error in password reset process' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    return res.status(200).json({ success: true, user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, provider: user.provider, emailVerified: user.emailVerified, accountStatus: user.accountStatus } });
  } catch {
    return res.status(500).json({ success: false, error: 'Error fetching user data' });
  }
};

// IMPORTANT: clear API cookie on logout (frontend also clears its own cookie/localStorage)
exports.logout = async (req, res) => {
  try {
    if (typeof req.logout === 'function') req.logout(() => {});
  } catch {}

  res.clearCookie('token', {
    httpOnly: false,
    secure: true,
    sameSite: 'none',
    path: '/'
  });

  return res.status(200).json({ success: true, message: 'Logged out successfully' });
};

exports.cleanupUnverifiedUsers = async (req, res) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await User.deleteMany({ emailVerified: false, provider: 'local', createdAt: { $lt: oneDayAgo } });
    return res.status(200).json({ success: true, message: `Deleted ${result.deletedCount} unverified users`, count: result.deletedCount });
  } catch {
    return res.status(500).json({ success: false, error: 'Error cleaning up unverified users' });
  }
};

// ==================== GOOGLE / GITHUB (REDIRECT FLOW) ====================

exports.googleOAuthCallbackRedirect = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.redirect(`${FRONTEND_URL}/login?error=google_auth_failed`);

    if (typeof user.updateLastLogin === 'function') await user.updateLastLogin();
    else { user.lastLogin = new Date(); await user.save({ validateBeforeSave: false }); }

    const token = user.getSignedJwtToken();
    setFrontTokenCookie(res, token);

    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`);
  } catch {
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('google_signin_failed')}`);
  }
};

exports.githubOAuthCallbackRedirect = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.redirect(`${FRONTEND_URL}/login?error=github_auth_failed`);

    if (typeof user.updateLastLogin === 'function') await user.updateLastLogin();
    else { user.lastLogin = new Date(); await user.save({ validateBeforeSave: false }); }

    const token = user.getSignedJwtToken();
    setFrontTokenCookie(res, token);

    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`);
  } catch {
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('github_signin_failed')}`);
  }
};