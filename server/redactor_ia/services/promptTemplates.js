// server/redactor_ia/services/promptTemplates.js
/**
 * SISTEMA DE PROMPTS CONTEXTUALES PARA IMÁGENES EDITORIALES
 * 
 * Pipeline contextual:
 * Bajada + Contenido + Título + Categoría + Tags → Prompt específico al tema → DALL·E 3
 * 
 * OBJETIVO:
 * - Evitar patrones genéricos repetitivos ("mujer damnificada en calles destruidas")
 * - Generar covers específicos al tema real de cada noticia
 * - Usar contexto completo para decisiones visuales inteligentes
 */

const { 
  buildImagePromptFromTitle,
  buildPoliticalImagePrompt,
  isPoliticalContent
} = require('../utils/titleTransformer');

/**
 * Construye prompt DIRECTO desde título
 * 
 * MODO DIRECTO:
 * - Solo usa el título de la noticia
 * - Sin filtros, sin restricciones, sin detección de contenido
 * - Envía directamente al proveedor de imágenes
 * 
 * @param {string} title - Título de la noticia (REQUERIDO)
 * @param {Object} [options] - Opciones adicionales (ignoradas en modo directo)
 * @returns {{ prompt: string, negative: string, style: string, mode: string }}
 */
function buildNeoRenaissancePrompt(title, options = {}) {
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    console.warn('[PromptBuilder] Título vacío, usando prompt por defecto');
    return {
      prompt: 'Imagen periodística editorial, formato horizontal.',
      negative: '',
      style: 'editorial',
      mode: 'generic_fallback'
    };
  }
  
  // MODO DIRECTO: Solo título + contexto mínimo
  const prompt = `${title.trim()}. Imagen periodística, formato horizontal 16:9.`;
  
  console.log(`[PromptBuilder] 🚀 MODO DIRECTO → Título enviado al proveedor`);
  console.log(`[PromptBuilder] Prompt (${prompt.length} chars): "${prompt}"`);
  
  return {
    prompt,
    negative: '',
    style: 'editorial',
    mode: 'direct_title'
  };
}

/**
 * @deprecated - Función legacy mantenida solo para compatibilidad
 * El nuevo sistema NO usa esta función
 */
function buildPrompt(theme, signals) {
  console.warn('[PromptBuilder] buildPrompt() legacy llamado, usando nuevo sistema literal');
  const title = signals?.title || '';
  return buildNeoRenaissancePrompt(title);
}

module.exports = {
  buildNeoRenaissancePrompt, // Nombre mantenido por compatibilidad, pero ahora es literal
  buildPrompt // Legacy compatibility
};
