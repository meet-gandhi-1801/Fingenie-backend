const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validateToken } = require('../services/tokenService');

const protect = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (req.headers.authorization && 
      req.headers.authorization.startsWith('Bearer')) {
    
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ 
      code: 'NO_TOKEN',
      message: 'Not authorized, no token provided' 
    });
  }

  try {
    // Validate token using tokenService
    const validation = validateToken(token, 'access');

    if (!validation.valid) {
      return res.status(401).json({
        code: 'TOKEN_INVALID',
        message: validation.error
      });
    }

    // Check if token type is 'refresh' - reject it for API calls
    if (validation.payload.type === 'refresh') {
      return res.status(401).json({
        code: 'WRONG_TOKEN_TYPE',
        message: 'Refresh tokens cannot be used for API calls. Use access token instead.'
      });
    }

    // Attach user to request (without password)
    req.user = await User.findById(validation.payload.id).select('-password');

    if (!req.user) {
      return res.status(401).json({
        code: 'USER_NOT_FOUND',
        message: 'User associated with token not found'
      });
    }

    next(); // Move to the actual route handler

  } catch (error) {
    res.status(401).json({ 
      code: 'AUTH_ERROR',
      message: 'Authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = { protect };