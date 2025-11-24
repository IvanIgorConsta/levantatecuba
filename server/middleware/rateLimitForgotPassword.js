// ============================================================================
// RATE LIMITING MIDDLEWARE - FORGOT PASSWORD
// Máximo 5 peticiones por hora por IP/email
// ============================================================================

// Almacenamiento en memoria (en producción usar Redis)
const attempts = new Map();

// Configuración
const MAX_ATTEMPTS = 5;
const WINDOW_HOURS = 1;
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000; // 1 hora en ms

/**
 * Middleware de rate limiting para forgot password
 */
const rateLimitForgotPassword = (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const email = req.body?.email || 'no-email';
    const key = `${ip}:${email}`;
    
    const now = Date.now();
    
    // Obtener intentos previos o crear entrada nueva
    let userAttempts = attempts.get(key);
    
    if (!userAttempts) {
      userAttempts = {
        count: 0,
        firstAttempt: now,
        lastAttempt: now
      };
    }
    
    // Limpiar ventana si ha pasado el tiempo
    if (now - userAttempts.firstAttempt > WINDOW_MS) {
      userAttempts = {
        count: 0,
        firstAttempt: now,
        lastAttempt: now
      };
    }
    
    // Verificar si se superó el límite
    if (userAttempts.count >= MAX_ATTEMPTS) {
      const timeLeft = WINDOW_MS - (now - userAttempts.firstAttempt);
      const minutesLeft = Math.ceil(timeLeft / (1000 * 60));
      
      console.log(`🚫 Rate limit exceeded for ${key}: ${userAttempts.count} attempts`);
      
      return res.status(429).json({
        error: 'Demasiados intentos',
        message: `Has excedido el límite de ${MAX_ATTEMPTS} intentos por hora. Inténtalo nuevamente en ${minutesLeft} minutos.`,
        retryAfter: timeLeft
      });
    }
    
    // Incrementar contador y actualizar
    userAttempts.count++;
    userAttempts.lastAttempt = now;
    attempts.set(key, userAttempts);
    
    console.log(`🔄 Forgot password attempt ${userAttempts.count}/${MAX_ATTEMPTS} for ${key}`);
    
    // Limpiar entradas antiguas cada 100 requests para evitar memory leaks
    if (attempts.size > 100) {
      cleanOldEntries();
    }
    
    next();
  } catch (error) {
    console.error('❌ Error en rate limiting:', error.message);
    // En caso de error, permitir que continue (fail-open)
    next();
  }
};

/**
 * Limpiar entradas antiguas del Map para evitar memory leaks
 */
function cleanOldEntries() {
  const now = Date.now();
  const keysToDelete = [];
  
  for (const [key, data] of attempts.entries()) {
    if (now - data.firstAttempt > WINDOW_MS) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => attempts.delete(key));
  console.log(`🧹 Limpiadas ${keysToDelete.length} entradas antiguas de rate limit`);
}

/**
 * Función para limpiar todos los intentos (útil para testing)
 */
const clearAllAttempts = () => {
  attempts.clear();
  console.log('🗑️ Todos los intentos de rate limit limpiados');
};

/**
 * Función para obtener estadísticas (útil para monitoreo)
 */
const getStats = () => {
  return {
    totalEntries: attempts.size,
    maxAttempts: MAX_ATTEMPTS,
    windowHours: WINDOW_HOURS,
    entries: Array.from(attempts.entries()).map(([key, data]) => ({
      key,
      count: data.count,
      firstAttempt: new Date(data.firstAttempt).toISOString(),
      lastAttempt: new Date(data.lastAttempt).toISOString()
    }))
  };
};

module.exports = {
  rateLimitForgotPassword,
  clearAllAttempts,
  getStats
};
