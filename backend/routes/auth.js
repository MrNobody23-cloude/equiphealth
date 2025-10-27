// backend/routes/auth.js
const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth');
const { protect } = require('../middleware/auth');

// Public
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', authController.forgotPassword);
router.put('/reset-password/:token', authController.resetPassword);

// Private
router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);

// Maintenance
router.delete('/cleanup-unverified', protect, authController.cleanupUnverifiedUsers);

module.exports = router;