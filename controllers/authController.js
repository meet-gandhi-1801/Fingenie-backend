const User = require('../models/User');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');
const { sendOTPEmail } = require('../services/emailService');
const { generateTokens, hashRefreshToken, generateAccessToken, validateToken, compareRefreshToken } = require('../services/tokenService');

// Generate 6 digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @route  POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const { name, email, password, monthlyIncome } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user (unverified)
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      monthlyIncome,
      isEmailVerified: false
    });

    // Generate and save OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await OTP.create({ email, otp, expiresAt });

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp, 'email-verification');

    if (!emailResult.success) {
      console.error('Email send failed:', emailResult.message);
    }

    res.status(201).json({
      message: 'Registration successful. Please verify your email.',
      email,
      requiresVerification: true
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  POST /api/auth/verify-otp
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find valid OTP
    const otpRecord = await OTP.findOne({
      email,
      otp,
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({
        code: 'INVALID_OTP',
        message: 'Invalid or expired OTP'
      });
    }

    // Mark OTP as verified
    otpRecord.verified = true;
    await otpRecord.save();

    // Mark user as verified
    const user = await User.findOneAndUpdate(
      { email },
      { isEmailVerified: true },
      { new: true }
    );

    // Generate access and refresh tokens
    const { accessToken, refreshToken, sessionId } = generateTokens(user._id.toString());

    // Hash refresh token for storage
    const hashedRefreshToken = await hashRefreshToken(refreshToken);

    // Store refresh token session
    const userAgent = req.headers['user-agent'] || null;
    await user.addRefreshSession(sessionId, hashedRefreshToken, userAgent);

    res.json({
      accessToken,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        monthlyIncome: user.monthlyIncome,
        isEmailVerified: user.isEmailVerified,
        avatar: user.avatar,
        authProvider: user.authProvider
      }
    });

  } catch (error) {
    res.status(500).json({ 
      code: 'SERVER_ERROR',
      message: error.message 
    });
  }
};

// @route  POST /api/auth/resend-otp
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    // Delete old OTPs for this email
    await OTP.deleteMany({ email });

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.create({ email, otp, expiresAt });
    await sendOTPEmail(email, otp, 'email-verification');

    res.json({ message: 'New OTP sent to your email' });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password' 
      });
    }

    // Block Google users from password login
    if (user.authProvider === 'google') {
      return res.status(400).json({
        code: 'GOOGLE_ACCOUNT',
        message: 'This account uses Google sign-in. Please use Google to login.'
      });
    }

    // Check email verification
    if (!user.isEmailVerified) {
      return res.status(401).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email first',
        requiresVerification: true,
        email
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password' 
      });
    }

    // Generate access and refresh tokens
    const { accessToken, refreshToken, sessionId } = generateTokens(user._id.toString());

    // Hash refresh token for storage
    const hashedRefreshToken = await hashRefreshToken(refreshToken);

    // Store refresh token session
    const userAgent = req.headers['user-agent'] || null;
    await user.addRefreshSession(sessionId, hashedRefreshToken, userAgent);

    res.json({
      accessToken,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        monthlyIncome: user.monthlyIncome,
        isEmailVerified: user.isEmailVerified,
        avatar: user.avatar,
        authProvider: user.authProvider
      }
    });

  } catch (error) {
    res.status(500).json({ 
      code: 'SERVER_ERROR',
      message: error.message 
    });
  }
};

// @route  POST /api/auth/refresh-token
// @desc   Generate new access token using refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: incomingRefreshToken } = req.body;

    if (!incomingRefreshToken) {
      return res.status(400).json({
        code: 'MISSING_REFRESH_TOKEN',
        message: 'Refresh token is required'
      });
    }

    // Validate refresh token
    const validation = validateToken(incomingRefreshToken, 'refresh');

    if (!validation.valid) {
      return res.status(401).json({
        code: 'INVALID_REFRESH_TOKEN',
        message: validation.error
      });
    }

    const { id: userId, sessionId } = validation.payload;

    // Fetch user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    // Validate session exists and token matches
    const sessionValidation = user.validateRefreshSession(sessionId);
    if (!sessionValidation.valid) {
      return res.status(401).json({
        code: 'SESSION_INVALID',
        message: sessionValidation.error
      });
    }

    // Compare hashed tokens
    const tokenMatch = await compareRefreshToken(incomingRefreshToken, sessionValidation.session.refreshToken);
    if (!tokenMatch) {
      return res.status(401).json({
        code: 'TOKEN_MISMATCH',
        message: 'Refresh token does not match stored session'
      });
    }

    // Update session's lastUsedAt
    await user.updateSessionLastUsed(sessionId);

    // Generate new access token (and optionally new refresh token for token rotation)
    const newAccessToken = generateAccessToken(userId);

    res.json({
      accessToken: newAccessToken,
      // Option: For additional security, you can also rotate the refresh token here
      // by generating a new one and updating the session
      // For now, we're reusing the same refresh token
    });

  } catch (error) {
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: error.message
    });
  }
};

// @route PUT /api/auth/update-profile
const updateProfile = async (req, res) => {
  try {
    const { name, monthlyIncome, occupation, financialGoals } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (monthlyIncome !== undefined) updateData.monthlyIncome = monthlyIncome;
    if (occupation) updateData.occupation = occupation;
    if (financialGoals) updateData.financialGoals = financialGoals;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  POST /api/auth/logout
// @desc   Logout from current device (invalidate refresh token session)
const logout = async (req, res) => {
  try {
    const { refreshToken: incomingRefreshToken } = req.body;

    if (!incomingRefreshToken) {
      return res.status(400).json({
        code: 'MISSING_REFRESH_TOKEN',
        message: 'Refresh token is required for logout'
      });
    }

    // Decode refresh token to get userId and sessionId
    const validation = validateToken(incomingRefreshToken, 'refresh');
    if (!validation.valid) {
      // Even if token is invalid/expired, we attempt logout
      return res.status(401).json({
        code: 'INVALID_TOKEN',
        message: validation.error
      });
    }

    const { id: userId, sessionId } = validation.payload;

    // Fetch user and remove the session
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    await user.removeRefreshSession(sessionId);

    res.json({
      code: 'SUCCESS',
      message: 'Logged out successfully'
    });

  } catch (error) {
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: error.message
    });
  }
};

// @route  POST /api/auth/logout-all
// @desc   Logout from all devices (clear all refresh token sessions)
// @access Private (requires valid access token)
const logoutAll = async (req, res) => {
  try {
    // req.user is set by protect middleware
    if (!req.user) {
      return res.status(401).json({
        code: 'NOT_AUTHENTICATED',
        message: 'Authentication required'
      });
    }

    // Fetch user and clear all sessions
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    await user.clearAllRefreshSessions();

    res.json({
      code: 'SUCCESS',
      message: 'Logged out from all devices successfully'
    });

  } catch (error) {
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: error.message
    });
  }
};

module.exports = {
  updateProfile,
  registerUser,
  verifyOTP,
  resendOTP,
  loginUser,
  refreshToken,
  logout,
  logoutAll
};