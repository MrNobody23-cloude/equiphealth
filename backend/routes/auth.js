const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/auth');
const { protect } = require('../middleware/auth');

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Auth routes are working',
    timestamp: new Date().toISOString()
  });
});

// Local auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.get('/me', protect, authController.getMe);

// Email verification
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

// Password reset
router.post('/forgot-password', authController.forgotPassword);
router.put('/reset-password/:token', authController.resetPassword);

// Cleanup (for admin or cron job)
router.delete('/cleanup-unverified', protect, authController.cleanupUnverifiedUsers);

// Google OAuth routes
router.get('/google', (req, res, next) => {
  console.log('🔵 Initiating Google OAuth flow');
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: true
  })(req, res, next);
});

router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: process.env.FRONTEND_URL + '/login?error=oauth_failed',
    session: true
  }),
  (req, res) => {
    console.log('✅ Google OAuth success');
    console.log('👤 User:', req.user.email);
    
    const token = req.user.getSignedJwtToken();
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${token}`;
    console.log('🔄 Redirecting to:', redirectUrl);
    
    res.redirect(redirectUrl);
  }
);

// GitHub OAuth routes
router.get('/github', (req, res, next) => {
  console.log('🔵 Initiating GitHub OAuth flow');
  passport.authenticate('github', { 
    scope: ['user:email'],
    session: true
  })(req, res, next);
});

router.get('/github/callback',
  passport.authenticate('github', { 
    failureRedirect: process.env.FRONTEND_URL + '/login?error=oauth_failed',
    session: true
  }),
  (req, res) => {
    console.log('✅ GitHub OAuth success');
    console.log('👤 User:', req.user.email);
    
    const token = req.user.getSignedJwtToken();
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${token}`;
    console.log('🔄 Redirecting to:', redirectUrl);
    
    res.redirect(redirectUrl);
  }
);

module.exports = router;