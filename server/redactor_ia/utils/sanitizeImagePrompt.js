// server/redactor_ia/utils/sanitizeImagePrompt.js
/**
 * SISTEMA NEO-RENAISSANCE - Wrapper de fallback
 * 
 * Este módulo actúa como FALLBACK y wrapper simple sobre el sistema Neo-Renaissance.
 * TODAS las funciones ahora usan el transformador de título + estilo fijo.
 * 
 * Pipeline: Título → transformTitleToConcept() → Estilo Neo-Renaissance → Prompt
 * 
 * NO hay:
 * - Análisis de contenido
 * - Detección de países
 * - Detección de personas
 * - Filtros geopolíticos
 * - Lógica compleja
 */

const { buildNeoRenaissancePrompt } = require('../services/promptTemplates');

/**
 * Genera prompt Neo-Renaissance desde título
 * @param {Object} params
 * @param {string} params.title - Título de la noticia (ÚNICO input necesario)
 * @param {string} params.locale - Locale (IGNORADO, ya no se usa)
 * @returns {string} Prompt Neo-Renaissance completo
 */
function sanitizeImagePrompt({ title, locale = 'es-CU' }) {
  console.log(`[Neo-Renaissance:Sanitizer] Generando prompt desde título`);
  
  const { prompt } = buildNeoRenaissancePrompt(title);
  return prompt;
}

/**
 * Prompt de fallback cuando no hay título
 * @returns {string} Prompt Neo-Renaissance genérico
 */
function getSymbolicFallbackPrompt(locale = 'es-CU') {
  console.log('[Neo-Renaissance:Sanitizer] Usando fallback simbólico');
  const { prompt } = buildNeoRenaissancePrompt('noticia editorial');
  return prompt;
}

/**
 * Prompt de fallback genérico
 * @returns {string} Prompt Neo-Renaissance genérico
 */
function getGenericFallbackPrompt(locale = 'es-CU') {
  console.log('[Neo-Renaissance:Sanitizer] Usando fallback genérico');
  const { prompt } = buildNeoRenaissancePrompt('escena periodística');
  return prompt;
}

/**
 * @deprecated - NO-OP: Sin detección de contenido sensible
 */
function hasSensitiveContent(text) {
  return false;
}

/**
 * @deprecated - NO-OP: Sin overlay de banderas
 */
function allowFlags(title, intent) {
  return false;
}

/**
 * @deprecated - NO-OP: Sin detección de intent
 */
function detectVisualIntentFromTitle(titleRaw = '') {
  return 'generic';
}

module.exports = {
  sanitizeImagePrompt,
  getSymbolicFallbackPrompt,
  getGenericFallbackPrompt,
  hasSensitiveContent,          // NO-OP (compatibilidad)
  detectVisualIntentFromTitle,  // NO-OP (compatibilidad)
  allowFlags                     // NO-OP (compatibilidad)
};
