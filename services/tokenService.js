const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Generate both access and refresh tokens with a new session ID
 * @param {string} userId - User ID to encode in tokens
 * @returns {Promise<{accessToken, refreshToken, sessionId}>}
 */
const generateTokens = (userId) => {
  try {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET not configured in environment variables');
    }

    const sessionId = uuidv4();

    // Generate access token (15 minutes)
    const accessToken = jwt.sign(
      { id: userId, type: 'access' },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Generate refresh token (30 days) - includes sessionId for validation
    const refreshToken = jwt.sign(
      { id: userId, sessionId, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    return {
      accessToken,
      refreshToken,
      sessionId
    };
  } catch (error) {
    throw new Error(`Failed to generate tokens: ${error.message}`);
  }
};

/**
 * Validate a token with optional type checking
 * Supports both new tokens (with type) and old tokens (without type for backward compat)
 * @param {string} token - Token to validate
 * @param {string} expectedType - Expected token type ('access', 'refresh', or null for any)
 * @returns {{valid: boolean, payload?: object, error?: string}}
 */
const validateToken = (token, expectedType = null) => {
  try {
    if (!JWT_SECRET) {
      return { valid: false, error: 'JWT_SECRET not configured' };
    }

    const payload = jwt.verify(token, JWT_SECRET);

    // Check token type if expectedType is specified
    if (expectedType) {
      if (!payload.type) {
        // Old token without type field - log deprecation but allow for backward compatibility
        if (expectedType === 'access') {
          console.warn(
            `[DEPRECATED] Old JWT token without type field used. ` +
            `User ID: ${payload.id}. Please use new token format with 'type' field.`
          );
          return { valid: true, payload, isDeprecated: true };
        } else {
          // Refresh type shouldn't be used for old tokens
          return { valid: false, error: 'Invalid token type for this endpoint' };
        }
      }

      if (payload.type !== expectedType) {
        return { valid: false, error: `Expected token type '${expectedType}', got '${payload.type}'` };
      }
    }

    return { valid: true, payload };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Token has expired' };
    } else if (error.name === 'JsonWebTokenError') {
      return { valid: false, error: 'Invalid token signature' };
    } else if (error.name === 'NotBeforeError') {
      return { valid: false, error: 'Token not yet valid' };
    }
    return { valid: false, error: `Token validation failed: ${error.message}` };
  }
};

/**
 * Decode a token without verification (useful for inspection)
 * @param {string} token - Token to decode
 * @returns {{payload: object, error?: string}}
 */
const decodeToken = (token) => {
  try {
    const payload = jwt.decode(token);
    if (!payload) {
      return { error: 'Failed to decode token' };
    }
    return { payload };
  } catch (error) {
    return { error: `Decode failed: ${error.message}` };
  }
};

/**
 * Hash a refresh token for secure storage in the database
 * @param {string} token - Refresh token to hash
 * @returns {Promise<string>} - Hashed token
 */
const hashRefreshToken = async (token) => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedToken = await bcrypt.hash(token, salt);
    return hashedToken;
  } catch (error) {
    throw new Error(`Failed to hash refresh token: ${error.message}`);
  }
};

/**
 * Compare a refresh token with its hash
 * @param {string} token - Plain refresh token
 * @param {string} hashedToken - Hashed token from database
 * @returns {Promise<boolean>}
 */
const compareRefreshToken = async (token, hashedToken) => {
  try {
    return await bcrypt.compare(token, hashedToken);
  } catch (error) {
    throw new Error(`Failed to compare refresh token: ${error.message}`);
  }
};

/**
 * Generate a new access token from a valid refresh token
 * Used in the refresh-token endpoint
 * @param {string} userId - User ID to encode
 * @returns {string} - New access token
 */
const generateAccessToken = (userId) => {
  try {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    const accessToken = jwt.sign(
      { id: userId, type: 'access' },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    return accessToken;
  } catch (error) {
    throw new Error(`Failed to generate access token: ${error.message}`);
  }
};

module.exports = {
  generateTokens,
  validateToken,
  decodeToken,
  hashRefreshToken,
  compareRefreshToken,
  generateAccessToken,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY
};
