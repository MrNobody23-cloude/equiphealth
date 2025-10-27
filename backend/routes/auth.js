// backend/routes/auth.js
const express = require('express');
const passport = require('passport');
const router = express.Router();

const authController = require('../controllers/auth');
const { protect } = require('../middleware/auth');

// Local auth
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', authController.forgotPassword);
router.put('/reset-password/:token', authController.resetPassword);

// Google OAuth (server-side redirect flow)
router.get(
  '/google',
  passport.authenticate('google', { scope: ['openid', 'email', 'profile'], prompt: 'select_account' })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/auth/google/failure' }),
  authController.googleOAuthSuccess
);

router.get('/google/failure', (req, res) => {
  res.status(401).json({ success: false, error: 'Google authentication failed' });
});

// Google ID Token sign-in (client-side flow)
router.post('/google/token', authController.googleTokenSignIn);

// Private
router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);

// Maintenance
router.delete('/cleanup-unverified', protect, authController.cleanupUnverifiedUsers);

module.exports = router;