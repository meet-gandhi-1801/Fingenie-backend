const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  financialGoals: {
    type: [String],
    default: []
  },
  occupation: {
    type: String,
    default: null
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    // Not required — Google users have no password
  },
  monthlyIncome: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  // NEW FIELDS
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  googleId: {
    type: String,
    default: null
  },
  avatar: {
    type: String,
    default: null
  },
  refreshTokenSessions: [
    {
      sessionId: {
        type: String,
        required: true
        
      },
      refreshToken: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      expiresAt: {
        type: Date,
        required: true
      },
      userAgent: {
        type: String,
        default: null
      },
      lastUsedAt: {
        type: Date,
        default: null
      }
    }
  ]
}, { timestamps: true });

// Method to add a refresh token session
UserSchema.methods.addRefreshSession = function(sessionId, refreshToken, userAgent = null) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  this.refreshTokenSessions.push({
    sessionId,
    refreshToken,
    userAgent,
    expiresAt,
    createdAt: new Date(),
    lastUsedAt: null
  });
  
  return this.save();
};

// Method to validate a refresh token session
UserSchema.methods.validateRefreshSession = function(sessionId) {
  const session = this.refreshTokenSessions.find(s => s.sessionId === sessionId);
  
  if (!session) {
    return { valid: false, error: 'Session not found' };
  }
  
  if (new Date() > session.expiresAt) {
    return { valid: false, error: 'Session expired' };
  }
  
  return { valid: true, session };
};

// Method to remove a specific refresh token session (logout from one device)
UserSchema.methods.removeRefreshSession = function(sessionId) {
  this.refreshTokenSessions = this.refreshTokenSessions.filter(s => s.sessionId !== sessionId);
  return this.save();
};

// Method to clear all refresh token sessions (global logout)
UserSchema.methods.clearAllRefreshSessions = function() {
  this.refreshTokenSessions = [];
  return this.save();
};

// Method to update lastUsedAt timestamp for a session
UserSchema.methods.updateSessionLastUsed = function(sessionId) {
  const session = this.refreshTokenSessions.find(s => s.sessionId === sessionId);
  if (session) {
    session.lastUsedAt = new Date();
    return this.save();
  }
  return Promise.resolve();
};

module.exports = mongoose.model('User', UserSchema);