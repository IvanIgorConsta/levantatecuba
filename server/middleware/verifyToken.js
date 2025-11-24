const jwt = require("jsonwebtoken");
const { verifyJWT } = require("../utils/jwtUtils");
const User = require("../models/User");

module.exports = async function (req, res, next) {
  let token = null;
  
  // 1. Intentar obtener token del header Authorization
  const authHeader = req.headers["authorization"];
  if (authHeader) {
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7); // Elimina "Bearer "
    } else {
      token = authHeader;
    }
  }
  
  // 2. Si no hay token en header, intentar obtener de cookie
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  console.debug('[AUTH] verifyToken check', { 
    hasAuthHeader: !!req.headers["authorization"], 
    hasCookie: !!req.cookies?.token,
    hasToken: !!token,
    path: req.path 
  });

  if (!token) {
    console.debug('[AUTH] 401 - No token provided');
    return res.status(401).json({ error: "Acceso denegado. No se proporcionó token." });
  }

  try {
    // Usar la función de utilidad para verificar JWT
    const verified = verifyJWT(token);
    
    console.log('[AUTH] verifyToken -> payload:', { 
      sub: verified.sub, 
      email: verified.email,
      name: verified.name,
      role: verified.role,
      nickname: verified.nickname
    });
    
    // Enriquecer req.user con todos los datos disponibles
    req.user = {
      sub: verified.sub,           // ID del usuario
      id: verified.sub,            // Compatibilidad legacy
      email: verified.email || '',
      name: verified.name || '',
      nombre: verified.name || '',  // Alias para compatibilidad
      username: verified.nickname || verified.username || '',
      nickname: verified.nickname || '',
      role: verified.role || 'user',
      firstName: verified.firstName || '',
      lastName: verified.lastName || ''
    };
    
    // Compatibilidad con código existente
    req.userId = verified.sub; // El nuevo formato usa 'sub' en lugar de 'id'
    req.userRole = verified.role || 'user';
    
    next();
  } catch (err) {
    console.error("❌ Error al verificar token:", err.message);
    res.status(401).json({ error: "Token no válido o expirado." });
  }
};
