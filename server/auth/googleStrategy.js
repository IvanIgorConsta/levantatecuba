const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');

// 🔍 LOG TEMPORAL: Verificar GOOGLE_CALLBACK_URL
console.log('🔍 GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL);

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // TODO: busca o crea usuario en tu DB con profile.id / profile.emails[0].value
      const user = { id: profile.id, email: profile.emails?.[0]?.value, name: profile.displayName };
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));
