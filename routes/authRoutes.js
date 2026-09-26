const express = require('express');
const router = express.Router();
const passport = require('passport');
const {
  registerUser,
  verifyOTP,
  resendOTP,
  loginUser,
  refreshToken,
  logout,
  logoutAll
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { generateTokens, hashRefreshToken } = require('../services/tokenService');
const User = require('../models/User');
const { updateProfile } = require('../controllers/authController');




// Local auth
router.post('/register', registerUser);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', loginUser);

// Token management
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.post('/logout-all', protect, logoutAll);
router.put('/update-profile', protect, updateProfile);


// Google OAuth
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      // Generate access and refresh tokens
      const { accessToken, refreshToken: newRefreshToken, sessionId } = generateTokens(req.user._id.toString());

      // Hash refresh token for storage
      const hashedRefreshToken = await hashRefreshToken(newRefreshToken);

      // Store refresh token session
      const userAgent = req.headers['user-agent'] || null;
      await req.user.addRefreshSession(sessionId, hashedRefreshToken, userAgent);

      // Redirect to frontend with tokens
      const isNewUser = req.user.isNewUser || false;

      res.redirect(
        `${process.env.FRONTEND_URL}/auth/success?accessToken=${accessToken}&refreshToken=${newRefreshToken}&name=${encodeURIComponent(req.user.name)}&email=${encodeURIComponent(req.user.email)}&isNewUser=${isNewUser}`
      );
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=${encodeURIComponent('Authentication failed')}`);
    }
  }
);

module.exports = router;