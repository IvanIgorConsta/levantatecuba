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
 * Construye prompt contextual desde bajada, contenido, título, categoría y tags
 * 
 * FILOSOFÍA:
 * - SIEMPRE usar contexto completo (bajada > contenido > título)
 * - Si el contenido es POLÍTICO → Usa prompt profesional contextual (NO genérico)
 * - Si NO es político → Usa prompt contextual basado en brief real
 * 
 * @param {string} title - Título de la noticia (REQUERIDO)
 * @param {Object} [options] - Opciones adicionales
 * @param {string} [options.bajada] - Bajada/resumen (PRIORIDAD ALTA para contexto)
 * @param {string} [options.content] - Contenido completo del borrador
 * @param {string} [options.category] - Categoría de la noticia
 * @param {Array<string>} [options.tags] - Tags/etiquetas
 * @returns {{ prompt: string, negative: string, style: string, mode: string }}
 */
function buildNeoRenaissancePrompt(title, options = {}) {
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    console.warn('[PromptBuilder] Título vacío, usando prompt por defecto');
    return {
      prompt: 'Ilustración editorial moderna y profesional para noticia periodística.',
      negative: '',
      style: 'editorial',
      mode: 'generic_fallback'
    };
  }
  
  // Extraer parámetros contextuales
  const bajada = options.bajada || '';
  const content = options.content || '';
  const category = options.category || '';
  const tags = options.tags || [];
  
  // DETECCIÓN DE CONTENIDO POLÍTICO
  const textToAnalyze = (title + ' ' + bajada + ' ' + content).substring(0, 1500);
  
  if (isPoliticalContent(textToAnalyze)) {
    // CASO POLÍTICO: Usar prompt profesional contextual (detecta subtemas)
    const prompt = buildPoliticalImagePrompt(title, content, bajada, category);
    
    console.log(`[PromptBuilder] 🎯 POLÍTICO detectado → Prompt contextual profesional (${prompt.length} chars)`);
    console.log(`[PromptBuilder] Enfoque: Tema específico basado en contexto, NO patrón genérico`);
    
    return {
      prompt,
      negative: '',
      style: 'cinematic_editorial',
      mode: 'political_contextual'
    };
  }
  
  // CASO NO POLÍTICO: Usar prompt contextual basado en brief completo
  const prompt = buildImagePromptFromTitle({
    title,
    bajada,
    contenido: content,
    category,
    tags
  });
  
  console.log(`[PromptBuilder] ✅ NO político → Prompt contextual generado (${prompt.length} chars)`);
  console.log(`[PromptBuilder] Contexto: bajada=${!!bajada} content=${content.length}chars category="${category}" tags=${tags.length}`);
  console.log(`[PromptBuilder] Preview: "${prompt.substring(0, 100)}..."`);
  
  return {
    prompt,
    negative: '',
    style: 'editorial',
    mode: 'contextual'
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
