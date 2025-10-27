// backend/config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Serialize/deserialize for session (even if we return JWT, Passport needs these)
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user || null);
  } catch (err) {
    done(err, null);
  }
});

// Google OAuth Strategy (server-side flow)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/google/callback`;

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = (profile.emails && profile.emails[0]?.value) || null;
          const name = profile.displayName || 'Google User';
          const avatar = (profile.photos && profile.photos[0]?.value) || null;

          if (!email) {
            return done(new Error('Google profile did not return an email.'), null);
          }

          let user = await User.findOne({ email: email.toLowerCase() });

          if (!user) {
            // Create new user with Google provider
            const crypto = require('crypto');
            const randomPassword = crypto.randomBytes(32).toString('hex');

            user = await User.create({
              name,
              email: email.toLowerCase(),
              password: randomPassword, // never used, but satisfies schema
              provider: 'google',
              googleId,
              avatar,
              emailVerified: true,
              accountStatus: 'active',
              isActive: true
            });
          } else {
            // Update existing user to be Google-verified and active
            user.provider = user.provider === 'local' ? 'local' : 'google';
            user.googleId = user.googleId || googleId;
            user.avatar = user.avatar || avatar;
            user.emailVerified = true;
            user.accountStatus = 'active';
            user.isActive = true;
            await user.save({ validateBeforeSave: false });
          }

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
} else {
  console.warn('⚠️  GOOGLE_CLIENT_ID/SECRET not set. Google OAuth disabled.');
}

module.exports = passport;