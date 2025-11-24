const jwt = require("jsonwebtoken");

/**
 * Genera un JWT con el payload estándar
 */
function generateJWT(user) {
  const payload = {
    sub: user._id.toString(),
    role: user.role,
    aud: "levantatecuba",
    iss: "levantatecuba-api"
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, { 
    expiresIn: "7d"
  });
}

/**
 * Genera un state JWT para OAuth (corto plazo)
 */
function generateStateJWT(data) {
  return jwt.sign(data, process.env.JWT_SECRET, { 
    expiresIn: "10m",
    audience: "oauth-state",
    issuer: "levantatecuba-api"
  });
}

/**
 * Verifica y decodifica un state JWT
 */
function verifyStateJWT(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      audience: "oauth-state",
      issuer: "levantatecuba-api"
    });
  } catch (error) {
    throw new Error("State JWT inválido o expirado");
  }
}

/**
 * Verifica un JWT estándar
 */
function verifyJWT(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      audience: "levantatecuba",
      issuer: "levantatecuba-api"
    });
  } catch (error) {
    throw new Error("JWT inválido o expirado");
  }
}

/**
 * Configura cookie con el JWT
 */
function setJWTCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'Lax',
    secure: isProduction,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
  };
  
  // Agregar domain si está configurado
  if (process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }
  
  res.cookie('token', token, cookieOptions);
}

/**
 * Limpia la cookie JWT
 */
function clearJWTCookie(res) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  };
  
  if (process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }
  
  res.clearCookie('token', cookieOptions);
}

module.exports = {
  generateJWT,
  generateStateJWT,
  verifyStateJWT,
  verifyJWT,
  setJWTCookie,
  clearJWTCookie
};
