/**
 * Obtiene la lista de redirects permitidos desde variables de entorno
 */
function getAllowedRedirects() {
  const allowedStr = process.env.FRONTEND_ALLOWED_REDIRECTS || 'http://localhost:5173';
  return allowedStr.split(',').map(url => url.trim());
}

/**
 * Valida si una URL de redirect está permitida
 */
function isValidRedirect(redirectUrl) {
  if (!redirectUrl) return false;
  
  try {
    const url = new URL(redirectUrl);
    const allowedRedirects = getAllowedRedirects();
    
    // Verificar si la URL está en la lista blanca
    return allowedRedirects.some(allowed => {
      try {
        const allowedUrl = new URL(allowed);
        return url.origin === allowedUrl.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Normaliza y valida una URL de redirect
 * Retorna una URL válida o la primera de la lista blanca
 */
function normalizeRedirect(redirectUrl) {
  if (isValidRedirect(redirectUrl)) {
    return redirectUrl;
  }
  
  // Si no es válida, retornar la primera URL de la lista blanca
  const allowedRedirects = getAllowedRedirects();
  return allowedRedirects[0];
}

/**
 * Agrega query parameter a una URL
 */
function addQueryParam(url, key, value) {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set(key, value);
    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Obtiene la URL base para callbacks OAuth
 */
function getOAuthRedirectBase() {
  return process.env.OAUTH_REDIRECT_BASE || 'http://localhost:5000';
}

module.exports = {
  getAllowedRedirects,
  isValidRedirect,
  normalizeRedirect,
  addQueryParam,
  getOAuthRedirectBase
};
