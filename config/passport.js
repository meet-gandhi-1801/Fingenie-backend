const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback'
},
async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists with this Google ID
    let user = await User.findOne({ googleId: profile.id });

    if (user) {
      // Existing Google user — just return them
      return done(null, user);
    }

    // Check if email already registered locally
    user = await User.findOne({ email: profile.emails[0].value });

    if (user) {
      // Link Google to existing account
      user.googleId = profile.id;
      user.authProvider = 'google';
      user.isEmailVerified = true;
      user.avatar = profile.photos[0]?.value || null;
      await user.save();
      return done(null, user);
    }

    // Create brand new Google user
    user = await User.create({
      name: profile.displayName,
      email: profile.emails[0].value,
      googleId: profile.id,
      authProvider: 'google',
      isEmailVerified: true, // Google already verified the email
      avatar: profile.photos[0]?.value || null
    });

    return done(null, user);

  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

module.exports = passport;