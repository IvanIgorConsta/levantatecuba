// server/redactor_ia/config/freshness.js
/**
 * Configuración de frescura (recencia) para priorizar noticias recientes
 */

const FRESHNESS = {
  // Ventana de tiempo por defecto (en horas)
  WINDOW_HOURS_DEFAULT: 48, // 2 días
  
  // Máximo de artículos por dominio en una corrida
  PER_SOURCE_CAP: 5,
  
  // Vida media para decaimiento exponencial (en horas)
  // Después de 24h, el score de frescura cae a ~50%
  DECAY_HALF_LIFE_HOURS: 24,
  
  // Opciones disponibles para UI
  WINDOW_OPTIONS: [
    { value: 12, label: '12 horas' },
    { value: 24, label: '24 horas (1 día)' },
    { value: 48, label: '48 horas (2 días)' },
    { value: 72, label: '72 horas (3 días)' },
    { value: 168, label: '7 días' }
  ],
  
  // Umbral para badge "Nuevo" (en horas)
  NEW_BADGE_THRESHOLD_HOURS: 24
};

// Ventanas de frescura por categoría (en horas)
const CATEGORY_WINDOWS = {
  'Tecnología': 36,      // horas
  'Tendencia': 24,       // más agresivo para virales
  'Internacional': 72    // más amplio
};

/**
 * Calcula score de frescura usando decaimiento exponencial
 * @param {Date} publishedAt - Fecha de publicación
 * @returns {number} Score entre 0 y 1 (1 = muy reciente)
 */
function freshnessScore(publishedAt) {
  if (!publishedAt || !(publishedAt instanceof Date) || isNaN(publishedAt.getTime())) {
    return 0;
  }
  
  const nowMs = Date.now();
  const ageHours = (nowMs - publishedAt.getTime()) / (1000 * 60 * 60);
  
  // Decaimiento exponencial: e^(-ageHours / halfLife)
  const score = Math.exp(-ageHours / FRESHNESS.DECAY_HALF_LIFE_HOURS);
  
  return Math.max(0, Math.min(1, score)); // Clamp entre 0 y 1
}

/**
 * Verifica si un artículo es "nuevo" (para badge)
 * @param {Date} publishedAt - Fecha de publicación
 * @returns {boolean}
 */
function isNewArticle(publishedAt) {
  if (!publishedAt || !(publishedAt instanceof Date) || isNaN(publishedAt.getTime())) {
    return false;
  }
  
  const nowMs = Date.now();
  const ageHours = (nowMs - publishedAt.getTime()) / (1000 * 60 * 60);
  
  return ageHours <= FRESHNESS.NEW_BADGE_THRESHOLD_HOURS;
}

/**
 * Extrae hostname de una URL
 * @param {string} url - URL completa
 * @returns {string} Hostname normalizado
 */
function hostOf(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) {
    return '';
  }
}

/**
 * Normaliza URL para deduplicación (remueve query params y anchors)
 * @param {string} url - URL completa
 * @returns {string} URL canónica
 */
function canonicalUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    // Solo mantener protocolo, host y pathname (sin query ni hash)
    return `${u.protocol}//${u.host}${u.pathname}`.toLowerCase();
  } catch (e) {
    return url.toLowerCase();
  }
}

module.exports = {
  FRESHNESS,
  CATEGORY_WINDOWS,
  freshnessScore,
  isNewArticle,
  hostOf,
  canonicalUrl
};
