// server/redactor_ia/services/imageInstructionBuilder.js
/**
 * IMAGE INSTRUCTION FORMAT (IIF) BUILDER
 * 
 * Construye bloques IIF estructurados para generación de imágenes contextualizadas.
 * Combina perfiles de país + perfiles temáticos para crear instrucciones precisas.
 */

const { getCountryProfile } = require('./countryProfiles');
const { getThemeProfile, detectThemeFromContent } = require('./themeProfiles');
const { detectCountry } = require('../utils/contextBuilder');

/**
 * Construye Image Instruction Format (IIF) completo
 * @param {Object} news - Objeto de noticia con {title, summary, content, tags, category, sources}
 * @param {Object} options - Opciones adicionales
 * @returns {Object} IIF estructurado
 */
function buildImageInstructionFormat(news, options = {}) {
  const {
    title = '',
    summary = '',
    content = '',
    tags = [],
    category = '',
    sources = []
  } = news;
  
  console.log('[IIF:Builder] 🎨 Construyendo Image Instruction Format');
  
  // 1. Detectar país
  const countryDetection = detectCountry({ title, summary, tags, sources });
  const countryName = countryDetection.country || 'global';
  const countryProfile = getCountryProfile(countryName);
  
  console.log(`[IIF:Builder] country="${countryName}" confidence=${countryDetection.confidence || 0}`);
  
  // 2. Detectar tema/categoría
  const themeProfile = options.forceTheme 
    ? getThemeProfile(options.forceTheme)
    : detectThemeFromContent({ title, summary, tags, category });
  
  console.log(`[IIF:Builder] theme="${themeProfile.scene_type}" emotion="${themeProfile.emotion.substring(0, 40)}..."`);
  
  // 3. Construir IIF estructurado
  const iif = {
    // Identificación
    country: countryName,
    country_code: countryProfile.code || 'GLOBAL',
    region: countryProfile.region || 'Global',
    
    // Estilo visual del país
    region_style: countryProfile.region || 'global',
    city_style: countryProfile.city_style || 'ciudad urbana moderna',
    architecture: countryProfile.architecture || 'contemporánea',
    climate: countryProfile.climate || 'templado',
    people_style: countryProfile.people_style || 'población diversa',
    environment: countryProfile.environment || 'entorno urbano',
    colors: countryProfile.colors || 'colores neutros',
    
    // Restricciones de país
    flags_allowed: countryProfile.flags_allowed || [],
    flags_forbidden: countryProfile.flags_forbidden || [],
    landmarks_allowed: countryProfile.landmarks_allowed || [],
    landmarks_forbidden: countryProfile.landmarks_forbidden || [],
    skyline_forbidden: countryProfile.skyline_forbidden || [],
    
    // Perfil temático
    scene_type: themeProfile.scene_type || 'generic_scene',
    emotion: themeProfile.emotion || 'neutral',
    theme_elements: themeProfile.elements || '',
    composition: themeProfile.composition || 'equilibrada',
    lighting: themeProfile.lighting || 'natural',
    
    // Estilo global
    style: 'comic_editorial',
    art_style: 'Ilustración editorial a todo color, estilo cómic/novela gráfica moderna',
    
    // Restricciones globales
    avoid: [
      themeProfile.avoid || '',
      'texto legible',
      'logos de marcas',
      'watermarks',
      'readable signage'
    ].filter(Boolean),
    
    // Contexto de la noticia
    news_context: {
      title: title.substring(0, 200),
      category: category || 'general',
      tags: tags.slice(0, 5)
    }
  };
  
  // 4. Validar coherencia
  validateIIF(iif);
  
  return iif;
}

/**
 * Valida coherencia del IIF (detecta conflictos)
 * @param {Object} iif - IIF construido
 */
function validateIIF(iif) {
  const warnings = [];
  
  // Validar que no haya banderas prohibidas en permitidas
  const allowedSet = new Set(iif.flags_allowed.map(f => f.toLowerCase()));
  const forbiddenSet = new Set(iif.flags_forbidden.map(f => f.toLowerCase()));
  
  const conflicts = [...allowedSet].filter(flag => forbiddenSet.has(flag));
  if (conflicts.length > 0) {
    warnings.push(`Conflicto de banderas: ${conflicts.join(', ')}`);
  }
  
  // Validar que el país no esté en skyline_forbidden
  if (iif.skyline_forbidden.some(s => s.toLowerCase().includes(iif.country.toLowerCase()))) {
    warnings.push(`País "${iif.country}" en su propia lista de skylines prohibidos`);
  }
  
  if (warnings.length > 0) {
    console.warn('[IIF:Validator] ⚠️ Advertencias:', warnings.join('; '));
  }
  
  console.log('[IIF:Builder] ✅ IIF construido y validado');
}

/**
 * Construye negative prompt dinámico basado en IIF
 * @param {Object} iif - IIF estructurado
 * @returns {string} Negative prompt
 */
function buildDynamicNegative(iif) {
  const negatives = [
    // Restricciones globales base
    'text',
    'letters',
    'logos',
    'watermarks',
    'readable signage',
    
    // Banderas prohibidas (normalizado)
    ...iif.flags_forbidden.map(f => `${f} flag`),
    
    // Skylines prohibidos
    ...iif.skyline_forbidden.map(s => `${s} skyline`),
    
    // Landmarks prohibidos
    ...iif.landmarks_forbidden.map(l => `${l}`),
    
    // Elementos a evitar del tema
    ...iif.avoid.filter(Boolean),
    
    // Prohibir entornos corporativos genéricos
    'corporate boardroom',
    'corporate office',
    'business meeting room',
    'generic office space'
  ];
  
  // Deduplicar y limpiar
  const uniqueNegatives = [...new Set(negatives)]
    .filter(n => n && n.trim().length > 0)
    .map(n => n.trim().toLowerCase());
  
  return uniqueNegatives.join(', ');
}

/**
 * Verifica si un país está en contexto permitido
 * @param {string} countryName - Nombre del país a verificar
 * @param {Object} iif - IIF estructurado
 * @returns {boolean} True si está permitido
 */
function isCountryAllowed(countryName, iif) {
  if (!countryName || !iif) return false;
  
  const normalized = countryName.toLowerCase();
  const iifCountry = iif.country.toLowerCase();
  
  // El país de la noticia siempre está permitido
  if (normalized === iifCountry) return true;
  
  // Verificar si está en forbidden
  const isForbidden = iif.flags_forbidden.some(f => 
    f.toLowerCase().includes(normalized)
  );
  
  return !isForbidden;
}

module.exports = {
  buildImageInstructionFormat,
  buildDynamicNegative,
  validateIIF,
  isCountryAllowed
};
