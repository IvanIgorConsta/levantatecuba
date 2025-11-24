/**
 * Utilidades para validación y manejo de Open Graph
 * @module utils/og
 */

const fetch = require('node-fetch');

/**
 * Verifica que una URL sea absoluta y HTTPS
 * @param {string} url - URL a validar
 * @returns {boolean} True si es válida
 */
function assertHttpsAbsolute(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Verifica el tamaño de una imagen mediante HEAD request
 * @param {string} imageUrl - URL de la imagen
 * @returns {Promise<{valid: boolean, contentType?: string, contentLength?: number, error?: string}>}
 */
async function assertImageSize(imageUrl) {
  if (!assertHttpsAbsolute(imageUrl)) {
    return {
      valid: false,
      error: 'URL debe ser HTTPS absoluta'
    };
  }
  
  try {
    const response = await fetch(imageUrl, {
      method: 'HEAD',
      timeout: 5000
    });
    
    if (!response.ok) {
      return {
        valid: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
    
    const contentType = response.headers.get('content-type');
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    
    // Validar tipo de contenido
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!contentType || !validTypes.some(type => contentType.includes(type))) {
      return {
        valid: false,
        contentType,
        error: `Tipo de contenido inválido: ${contentType}`
      };
    }
    
    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (contentLength > maxSize) {
      return {
        valid: false,
        contentType,
        contentLength,
        error: `Imagen muy grande: ${(contentLength / 1024 / 1024).toFixed(2)}MB (máx 5MB)`
      };
    }
    
    return {
      valid: true,
      contentType,
      contentLength
    };
    
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Sanitiza un string para uso seguro en meta tags HTML
 * @param {string} text - Texto a sanitizar
 * @param {number} maxLength - Longitud máxima (opcional)
 * @returns {string} Texto sanitizado
 */
function sanitizeForMeta(text, maxLength = 0) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  let sanitized = text
    // Eliminar tags HTML
    .replace(/<[^>]*>/g, '')
    // Eliminar saltos de línea y tabs
    .replace(/[\r\n\t]+/g, ' ')
    // Eliminar espacios múltiples
    .replace(/\s+/g, ' ')
    // Escapar comillas
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    // Escapar caracteres especiales
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&(?!(amp|lt|gt|quot|#39);)/g, '&amp;')
    .trim();
  
  if (maxLength > 0 && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength).trim() + '...';
  }
  
  return sanitized;
}

/**
 * Genera un objeto de meta tags Open Graph estándar
 * @param {Object} options
 * @returns {Object} Meta tags formateados
 */
function generateOGTags(options) {
  const {
    title = 'LevantateCuba',
    description = 'Portal de noticias e información sobre Cuba',
    url = 'https://levantatecuba.com',
    image = 'https://levantatecuba.com/img/og-default.jpg',
    type = 'website',
    siteName = 'LevantateCuba',
    author = null,
    publishedTime = null
  } = options;
  
  const tags = {
    'og:title': sanitizeForMeta(title, 60),
    'og:description': sanitizeForMeta(description, 160),
    'og:url': url,
    'og:image': image,
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:type': type,
    'og:site_name': siteName,
    'twitter:card': 'summary_large_image',
    'twitter:title': sanitizeForMeta(title, 60),
    'twitter:description': sanitizeForMeta(description, 160),
    'twitter:image': image
  };
  
  if (type === 'article') {
    if (author) tags['article:author'] = sanitizeForMeta(author);
    if (publishedTime) tags['article:published_time'] = publishedTime;
  }
  
  return tags;
}

/**
 * Valida un objeto de configuración Open Graph
 * @param {Object} ogConfig
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateOGConfig(ogConfig) {
  const errors = [];
  
  // Validar campos requeridos
  if (!ogConfig.title || ogConfig.title.length === 0) {
    errors.push('Título es requerido');
  } else if (ogConfig.title.length > 60) {
    errors.push('Título muy largo (máx 60 caracteres)');
  }
  
  if (!ogConfig.description || ogConfig.description.length === 0) {
    errors.push('Descripción es requerida');
  } else if (ogConfig.description.length > 160) {
    errors.push('Descripción muy larga (máx 160 caracteres)');
  }
  
  if (!ogConfig.url) {
    errors.push('URL es requerida');
  } else if (!assertHttpsAbsolute(ogConfig.url)) {
    errors.push('URL debe ser HTTPS absoluta');
  }
  
  if (!ogConfig.image) {
    errors.push('Imagen es requerida');
  } else if (!assertHttpsAbsolute(ogConfig.image)) {
    errors.push('URL de imagen debe ser HTTPS absoluta');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Construye URL pública absoluta
 * @param {string} path - Ruta relativa
 * @param {string} origin - Origen base (opcional)
 * @returns {string} URL absoluta
 */
function buildPublicUrl(path, origin = null) {
  const base = origin || process.env.PUBLIC_ORIGIN || 'https://levantatecuba.com';
  
  // Si path ya es absoluto, devolverlo
  if (path && (path.startsWith('http://') || path.startsWith('https://'))) {
    return path;
  }
  
  // Asegurar que path empiece con /
  const cleanPath = path && !path.startsWith('/') ? `/${path}` : (path || '');
  
  try {
    const url = new URL(cleanPath, base);
    return url.toString();
  } catch {
    return base;
  }
}

module.exports = {
  assertHttpsAbsolute,
  assertImageSize,
  sanitizeForMeta,
  generateOGTags,
  validateOGConfig,
  buildPublicUrl
};

