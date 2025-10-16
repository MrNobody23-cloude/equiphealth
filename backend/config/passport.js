const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user
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
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        proxy: true
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log('Google OAuth callback triggered');
          console.log('Profile:', profile.emails[0].value);

          // Check if user exists
          let user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            console.log('Existing user found:', user.email);
            
            // Update last login
            await user.updateLastLogin();
            
            return done(null, user);
          }

          console.log('Creating new user from Google OAuth');

          // Create new user
          user = await User.create({
            name: profile.displayName,
            email: profile.emails[0].value,
            password: crypto.randomBytes(16).toString('hex') + 'Aa1!', // Random secure password
            emailVerified: true, // OAuth users are auto-verified
            provider: 'google',
            providerId: profile.id,
            avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            lastLogin: Date.now()
          });

          console.log('New user created:', user.email);
          done(null, user);
        } catch (err) {
          console.error('Google OAuth error:', err);
          done(err, null);
        }
      }
    )
  );
}

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || '/api/auth/github/callback',
        scope: ['user:email'],
        proxy: true
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log('GitHub OAuth callback triggered');

          // Get email from profile
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

          if (!email) {
            console.error('No email found in GitHub profile');
            return done(new Error('No email found in GitHub profile'), null);
          }

          console.log('GitHub email:', email);

          // Check if user exists
          let user = await User.findOne({ email });

          if (user) {
            console.log('Existing user found:', user.email);
            
            // Update last login
            await user.updateLastLogin();
            
            return done(null, user);
          }

          console.log('Creating new user from GitHub OAuth');

          // Create new user
          user = await User.create({
            name: profile.displayName || profile.username || 'GitHub User',
            email: email,
            password: crypto.randomBytes(16).toString('hex') + 'Aa1!', // Random secure password
            emailVerified: true, // OAuth users are auto-verified
            provider: 'github',
            providerId: profile.id,
            avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            lastLogin: Date.now()
          });

          console.log('New user created:', user.email);
          done(null, user);
        } catch (err) {
          console.error('GitHub OAuth error:', err);
          done(err, null);
        }
      }
    )
  );
}

module.exports = passport;