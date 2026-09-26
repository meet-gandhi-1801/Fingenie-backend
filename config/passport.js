const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
  proxy: true // Allows proper headers from Render (https instead of http)
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
      // Case 3: Brand new user via Google
      user = await User.create({
        name: profile.displayName,
        email: profile.emails[0].value,
        googleId: profile.id,
        authProvider: 'google',
        isEmailVerified: true,
        avatar: profile.photos[0]?.value || null
      });
      user.isNewUser = true;
      // Pass isNewUser flag
      return done(null, user);

    } catch (error) {
      return done(error, null);
    }
  }));

passport.serializeUser((user, done) => {
  done(null, user._id || user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
module.exports = passport;