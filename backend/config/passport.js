const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const axios = require('axios');
const User = require('../models/User');

// Sessions
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try { const u = await User.findById(id); done(null, u || null); }
  catch (e) { done(e, null); }
});

// Google
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/google/callback`,
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName || 'Google User';
          const avatar = profile.photos?.[0]?.value || null;
          const googleId = profile.id;

          if (!email) return done(new Error('Google did not return an email'), null);

          let user = await User.findOne({ email: email.toLowerCase() });
          if (!user) {
            const randomPassword = require('crypto').randomBytes(32).toString('hex');
            user = await User.create({
              name,
              email: email.toLowerCase(),
              password: randomPassword,
              provider: 'google',
              googleId,
              avatar,
              emailVerified: true,
              accountStatus: 'active',
              isActive: true
            });
          } else {
            user.provider = user.provider === 'local' ? 'local' : 'google';
            user.googleId = user.googleId || googleId;
            user.avatar = user.avatar || avatar;
            user.emailVerified = true;
            user.accountStatus = 'active';
            user.isActive = true;
            await user.save({ validateBeforeSave: false });
          }

          return done(null, user);
        } catch (e) {
          return done(e, null);
        }
      }
    )
  );
} else {
  console.warn('⚠️  GOOGLE_CLIENT_ID/SECRET not set. Google OAuth disabled.');
}

// GitHub
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/github/callback`,
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          let email = profile.emails?.[0]?.value || null;
          // If email hidden, fetch via API (requires scope user:email)
          if (!email) {
            try {
              const { data } = await axios.get('https://api.github.com/user/emails', {
                headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'equiphealth-app' }
              });
              const primary = Array.isArray(data) && data.find(e => e.primary && e.verified);
              email = primary?.email || null;
            } catch {}
          }

          if (!email) return done(new Error('GitHub did not return an email'), null);

          const name = profile.displayName || profile.username || 'GitHub User';
          const avatar = profile.photos?.[0]?.value || null;
          const githubId = profile.id;

          let user = await User.findOne({ email: email.toLowerCase() });
          if (!user) {
            const randomPassword = require('crypto').randomBytes(32).toString('hex');
            user = await User.create({
              name,
              email: email.toLowerCase(),
              password: randomPassword,
              provider: 'github',
              githubId,
              avatar,
              emailVerified: true,
              accountStatus: 'active',
              isActive: true
            });
          } else {
            user.provider = user.provider === 'local' ? 'local' : 'github';
            user.githubId = user.githubId || githubId;
            user.avatar = user.avatar || avatar;
            user.emailVerified = true;
            user.accountStatus = 'active';
            user.isActive = true;
            await user.save({ validateBeforeSave: false });
          }

          return done(null, user);
        } catch (e) {
          return done(e, null);
        }
      }
    )
  );
} else {
  console.warn('⚠️  GITHUB_CLIENT_ID/SECRET not set. GitHub OAuth disabled.');
}

module.exports = passport;