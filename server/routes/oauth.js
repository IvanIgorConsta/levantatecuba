const router = require('express').Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');

// 🔍 LOG TEMPORAL: Verificar rutas OAuth
console.log('🔍 OAuth routes loaded - /api/oauth/google and /api/oauth/google/callback');

router.get('/google',
  passport.authenticate('google', { scope: ['openid','profile','email'] })
);

router.get('/google/callback',
  (req, res, next) => {
    // 🔍 LOG TEMPORAL: Verificar callback recibido
    console.log('🔍 Callback recibido en:', req.originalUrl);
    console.log('🔍 Query params:', req.query);
    next();
  },
  passport.authenticate('google', { session: false, failureRedirect: process.env.PUBLIC_ORIGIN || '/' }),
  (req, res) => {
    const token = jwt.sign(
      { sub: req.user.id, email: req.user.email, name: req.user.name, provider: 'google' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.cookie('token', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 7*24*60*60*1000 });
    res.redirect(process.env.PUBLIC_ORIGIN || '/');
  }
);

module.exports = router;