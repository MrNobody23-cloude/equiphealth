const express = require('express');
const passport = require('passport');
const router = express.Router();

const authController = require('../controllers/auth');
const { protect } = require('../middleware/auth');

// Local
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', authController.forgotPassword);
router.put('/reset-password/:token', authController.resetPassword);

// Google OAuth
router.get(
  '/google',
  (req, res, next) => {
    passport.authenticate('google', {
      scope: ['openid', 'email', 'profile'],
      prompt: 'select_account',
      state: req.query.state || ''
    })(req, res, next);
  }
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/auth/google/failure' }),
  authController.googleOAuthCallbackRedirect
);

router.get('/google/failure', (req, res) => {
  res.status(401).json({ success: false, error: 'Google authentication failed' });
});

// Client-side Google token
router.post('/google/token', authController.googleTokenSignIn);

// GitHub OAuth
router.get(
  '/github',
  (req, res, next) => {
    passport.authenticate('github', {
      scope: ['user:email'],
      state: req.query.state || ''
    })(req, res, next);
  }
);

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/api/auth/github/failure' }),
  authController.githubOAuthCallbackRedirect
);

router.get('/github/failure', (req, res) => {
  res.status(401).json({ success: false, error: 'GitHub authentication failed' });
});

// Private
router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);

// Maintenance
router.delete('/cleanup-unverified', protect, authController.cleanupUnverifiedUsers);

module.exports = router;