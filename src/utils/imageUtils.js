/**
 * Construye la URL del cover con cache-bust
 * @param {string} url - URL del cover (puede tener o no extensión)
 * @param {string} hash - Hash para cache-bust
 * @returns {string|null} URL con versión o null
 */
export function buildCoverSrc(url, hash = '') {
  if (!url) return null;
  
  // Si ya tiene parámetros de query, no agregar más
  if (url.includes('?')) return url;
  
  // Agregar cache-bust si hay hash
  return hash ? `${url}?v=${hash}` : url;
}

/**
 * Normaliza datos de noticia para consumir cover/imagen indistintamente
 * @param {Object} item - Noticia o borrador
 * @returns {Object} Item con propiedades normalizadas
 */
export function normalizeCoverData(item) {
  if (!item) return item;
  
  return {
    ...item,
    _cover: item.cover || item.coverUrl || item.imagen || item.imagenes?.[0] || null,
    _coverHash: item.coverHash || item.hash || '',
    _coverKind: item.coverKind || item.imageKind || item.kind || null
  };
}

/**
 * Normaliza array de noticias
 * @param {Array} items - Array de noticias
 * @returns {Array} Array normalizado
 */
export function normalizeNewsArray(items) {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeCoverData);
}
