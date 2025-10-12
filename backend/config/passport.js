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
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists
          let user = await User.findOne({ 
            $or: [
              { providerId: profile.id, provider: 'google' },
              { email: profile.emails[0].value }
            ]
          });

          if (user) {
            // Update user info
            if (!user.providerId) {
              user.providerId = profile.id;
              user.provider = 'google';
            }
            user.avatar = profile.photos[0]?.value;
            user.emailVerified = profile.emails[0]?.verified || false;
            await user.save();
          } else {
            // Create new user
            user = await User.create({
              name: profile.displayName,
              email: profile.emails[0].value,
              provider: 'google',
              providerId: profile.id,
              avatar: profile.photos[0]?.value,
              emailVerified: profile.emails[0]?.verified || false
            });
          }

          await user.updateLastLogin();
          done(null, user);
        } catch (error) {
          console.error('Google OAuth Error:', error);
          done(error, null);
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
        callbackURL: process.env.GITHUB_CALLBACK_URL,
        scope: ['user:email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.username}@github.com`;

          // Check if user exists
          let user = await User.findOne({ 
            $or: [
              { providerId: profile.id, provider: 'github' },
              { email: email }
            ]
          });

          if (user) {
            // Update user info
            if (!user.providerId) {
              user.providerId = profile.id;
              user.provider = 'github';
            }
            user.avatar = profile.photos[0]?.value;
            await user.save();
          } else {
            // Create new user
            user = await User.create({
              name: profile.displayName || profile.username,
              email: email,
              provider: 'github',
              providerId: profile.id,
              avatar: profile.photos[0]?.value,
              emailVerified: false
            });
          }

          await user.updateLastLogin();
          done(null, user);
        } catch (error) {
          console.error('GitHub OAuth Error:', error);
          done(error, null);
        }
      }
    )
  );
}

module.exports = passport;