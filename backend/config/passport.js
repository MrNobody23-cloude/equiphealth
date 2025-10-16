const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const crypto = require('crypto');
const User = require('../models/User');

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const googleCallbackURL = process.env.GOOGLE_CALLBACK_URL || 
    `${process.env.BACKEND_URL}/api/auth/google/callback` ||
    'http://localhost:5000/api/auth/google/callback';

  console.log('🔐 Google OAuth configured');
  console.log('📍 Callback URL:', googleCallbackURL);

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: googleCallbackURL,
        proxy: true,
        scope: ['profile', 'email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log('✅ Google OAuth callback triggered');
          console.log('📧 Email:', profile.emails[0].value);

          // Check if user exists
          let user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            console.log('👤 Existing user found');
            await user.updateLastLogin();
            return done(null, user);
          }

          console.log('✨ Creating new user');

          // Create new user
          user = await User.create({
            name: profile.displayName,
            email: profile.emails[0].value,
            password: crypto.randomBytes(16).toString('hex') + 'Aa1!',
            emailVerified: true,
            provider: 'google',
            providerId: profile.id,
            avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            lastLogin: Date.now()
          });

          console.log('✅ User created:', user.email);
          done(null, user);
        } catch (err) {
          console.error('❌ Google OAuth error:', err);
          done(err, null);
        }
      }
    )
  );
} else {
  console.log('⚠️  Google OAuth not configured');
}

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  const githubCallbackURL = process.env.GITHUB_CALLBACK_URL || 
    `${process.env.BACKEND_URL}/api/auth/github/callback` ||
    'http://localhost:5000/api/auth/github/callback';

  console.log('🔐 GitHub OAuth configured');
  console.log('📍 Callback URL:', githubCallbackURL);

  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: githubCallbackURL,
        scope: ['user:email'],
        proxy: true
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log('✅ GitHub OAuth callback triggered');

          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

          if (!email) {
            console.error('❌ No email in GitHub profile');
            return done(new Error('No email found in GitHub profile'), null);
          }

          console.log('📧 Email:', email);

          let user = await User.findOne({ email });

          if (user) {
            console.log('👤 Existing user found');
            await user.updateLastLogin();
            return done(null, user);
          }

          console.log('✨ Creating new user');

          user = await User.create({
            name: profile.displayName || profile.username || 'GitHub User',
            email: email,
            password: crypto.randomBytes(16).toString('hex') + 'Aa1!',
            emailVerified: true,
            provider: 'github',
            providerId: profile.id,
            avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            lastLogin: Date.now()
          });

          console.log('✅ User created:', user.email);
          done(null, user);
        } catch (err) {
          console.error('❌ GitHub OAuth error:', err);
          done(err, null);
        }
      }
    )
  );
} else {
  console.log('⚠️  GitHub OAuth not configured');
}

module.exports = passport;