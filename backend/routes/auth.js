// backend/routes/auth.js
const express = require('express');
const passport = require('passport');
const router = express.Router();

const authController = require('../controllers/auth');
let protect;
try {
  ({ protect } = require('../middleware/auth'));
} catch (e) {
  console.warn('⚠️  middleware/auth protect not found:', e?.message);
}

// Debug what the controller actually exports
const exported = Object.keys(authController || {});
console.log('🔎 authController exports:', exported);

// Helpers to guard missing handlers/middleware
function ensureFn(fn, name) {
  if (typeof fn !== 'function') {
    console.warn(`⚠️  Missing handler: ${name} - registering fallback 501 responder`);
    return (req, res) =>
      res.status(501).json({
        success: false,
        error: `Handler '${name}' not implemented`
      });
  }
  return fn;
}
function hasFn(obj, name) {
  return obj && typeof obj[name] === 'function';
}

// ============ PUBLIC (LOCAL) ============
router.post('/register', ensureFn(authController.register, 'register'));
router.post('/login', ensureFn(authController.login, 'login'));
router.get('/verify-email/:token', ensureFn(authController.verifyEmail, 'verifyEmail'));
router.post('/resend-verification', ensureFn(authController.resendVerification, 'resendVerification'));
router.post('/forgot-password', ensureFn(authController.forgotPassword, 'forgotPassword'));
router.put('/reset-password/:token', ensureFn(authController.resetPassword, 'resetPassword'));

// ============ GOOGLE OAUTH (SERVER-SIDE REDIRECT FLOW) ============
// Only register if passport is configured for google
router.get(
  '/google',
  (req, res, next) => {
    if (!passport || typeof passport.authenticate !== 'function') {
      return res.status(503).json({ success: false, error: 'Google OAuth not configured' });
    }
    passport.authenticate('google', {
      scope: ['openid', 'email', 'profile'],
      prompt: 'select_account'
    })(req, res, next);
  }
);

router.get(
  '/google/callback',
  (req, res, next) => {
    if (!passport || typeof passport.authenticate !== 'function') {
      return res.status(503).json({ success: false, error: 'Google OAuth not configured' });
    }
    passport.authenticate('google', { session: false, failureRedirect: '/api/auth/google/failure' })(req, res, next);
  },
  ensureFn(authController.googleOAuthCallbackRedirect, 'googleOAuthCallbackRedirect')
);

router.get('/google/failure', (req, res) => {
  res.status(401).json({ success: false, error: 'Google authentication failed' });
});

// Optional: Google client-side token sign-in
if (hasFn(authController, 'googleTokenSignIn')) {
  router.post('/google/token', authController.googleTokenSignIn);
} else {
  console.warn("ℹ️  Skipping route POST /google/token (missing 'googleTokenSignIn')");
}

// ============ GITHUB OAUTH (SERVER-SIDE REDIRECT FLOW) ============
// Only register if passport is configured for github
router.get(
  '/github',
  (req, res, next) => {
    if (!passport || typeof passport.authenticate !== 'function') {
      return res.status(503).json({ success: false, error: 'GitHub OAuth not configured' });
    }
    passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
  }
);

router.get(
  '/github/callback',
  (req, res, next) => {
    if (!passport || typeof passport.authenticate !== 'function') {
      return res.status(503).json({ success: false, error: 'GitHub OAuth not configured' });
    }
    passport.authenticate('github', { session: false, failureRedirect: '/api/auth/github/failure' })(req, res, next);
  },
  ensureFn(authController.githubOAuthCallbackRedirect, 'githubOAuthCallbackRedirect')
);

router.get('/github/failure', (req, res) => {
  res.status(401).json({ success: false, error: 'GitHub authentication failed' });
});

// ============ PRIVATE ============
// Support both GET and POST logout (to match different frontends)
if (protect) {
  router.get('/me', ensureFn(protect, 'protect'), ensureFn(authController.getMe, 'getMe'));

  router.post('/logout', ensureFn(protect, 'protect'), ensureFn(authController.logout, 'logout'));
  router.get('/logout', ensureFn(protect, 'protect'), ensureFn(authController.logout, 'logout'));

  router.delete('/cleanup-unverified', ensureFn(protect, 'protect'), ensureFn(authController.cleanupUnverifiedUsers, 'cleanupUnverifiedUsers'));
} else {
  console.warn('⚠️  Protect middleware missing - registering /me, /logout, /cleanup-unverified as unprotected (501)');
  router.get('/me', ensureFn(authController.getMe, 'getMe'));
  router.post('/logout', ensureFn(authController.logout, 'logout'));
  router.get('/logout', ensureFn(authController.logout, 'logout'));
  router.delete('/cleanup-unverified', ensureFn(authController.cleanupUnverifiedUsers, 'cleanupUnverifiedUsers'));
}

module.exports = router;