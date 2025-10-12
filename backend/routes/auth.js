const express = require('express');
const router = express.Router();
const passport = require('passport');
const { body } = require('express-validator');
const {
  register,
  login,
  getMe,
  logout,
  oauthSuccess,
  verifyEmail,
  resendVerification
} = require('../controllers/auth');
const { protect } = require('../middleware/auth');

// Local authentication routes
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
  ],
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  login
);

// Email verification routes
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);

router.get('/me', protect, getMe);
router.get('/logout', protect, logout);

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_auth_failed`,
    session: false
  }),
  oauthSuccess
);

// GitHub OAuth routes
router.get(
  '/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

router.get(
  '/github/callback',
  passport.authenticate('github', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=github_auth_failed`,
    session: false
  }),
  oauthSuccess
);

module.exports = router;