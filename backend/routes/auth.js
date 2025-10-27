// backend/routes/auth.js
const express = require('express');
const passport = require('passport');
const router = express.Router();

const authController = require('../controllers/auth');
const { protect } = require('../middleware/auth');

// Uncomment to debug what your controller actually exports
// console.log('authController keys:', Object.keys(authController || {}));

// ============ PUBLIC (LOCAL) ============
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', authController.forgotPassword);
router.put('/reset-password/:token', authController.resetPassword);

// ============ GOOGLE OAUTH (SERVER-SIDE REDIRECT FLOW) ============
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/auth/google/failure' }),
  authController.googleOAuthCallbackRedirect
);

router.get('/google/failure', (req, res) => {
  res.status(401).json({ success: false, error: 'Google authentication failed' });
});

// Optional: Google client-side token sign-in (if you use Firebase or Identity Services)
router.post('/google/token', authController.googleTokenSignIn);

// ============ GITHUB OAUTH (SERVER-SIDE REDIRECT FLOW) ============
router.get(
  '/github',
  passport.authenticate('github', {
    scope: ['user:email'],
  })
);

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/api/auth/github/failure' }),
  authController.githubOAuthCallbackRedirect
);

router.get('/github/failure', (req, res) => {
  res.status(401).json({ success: false, error: 'GitHub authentication failed' });
});

// ============ PRIVATE ============
router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);
router.delete('/cleanup-unverified', protect, authController.cleanupUnverifiedUsers);

module.exports = router;