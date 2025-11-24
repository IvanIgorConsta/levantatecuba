// server/redactor_ia/services/iifConverter.js
/**
 * IIF TO PROMPT CONVERTER
 * 
 * Convierte Image Instruction Format (IIF) estructurado a prompt final limpio
 * para enviar a modelos de generación de imágenes (DALL-E, etc.)
 */

const { buildDynamicNegative } = require('./imageInstructionBuilder');

/**
 * Convierte IIF a prompt final estructurado
 * @param {Object} iif - IIF estructurado
 * @param {Object} options - Opciones de conversión
 * @returns {Object} {prompt, negative, metadata}
 */
function convertIIFtoPrompt(iif, options = {}) {
  console.log('[IIF:Converter] 📝 Convirtiendo IIF a prompt final');
  
  const {
    includeTitle = true,
    maxLength = 900,
    emphasizeContext = true
  } = options;
  
  // 1. Construir contexto base
  let baseContext = '';
  if (includeTitle && iif.news_context.title) {
    baseContext = `${iif.news_context.title}. `;
  }
  
  // 2. Construir descripción de escena temática
  const sceneDescription = buildSceneDescription(iif);
  
  // 3. Construir ambiente geográfico/cultural
  const environmentDescription = buildEnvironmentDescription(iif);
  
  // 4. Estilo artístico
  const styleDescription = iif.art_style || 'Ilustración editorial a todo color, estilo cómic/novela gráfica moderna';
  
  // 5. Composición y lighting
  const technicalDescription = `Composición: ${iif.composition}. Iluminación: ${iif.lighting}.`;
  
  // 6. Elementos permitidos (banderas, landmarks)
  const allowedElementsDescription = buildAllowedElementsDescription(iif);
  
  // 7. Ensamblar prompt completo
  let promptParts = [
    baseContext,
    sceneDescription,
    styleDescription,
    environmentDescription,
    allowedElementsDescription,
    technicalDescription
  ].filter(Boolean);
  
  let fullPrompt = promptParts.join(' ').trim();
  
  // 8. Recortar si excede longitud máxima
  if (fullPrompt.length > maxLength) {
    console.log(`[IIF:Converter] ⚠️ Prompt recortado de ${fullPrompt.length} a ${maxLength} caracteres`);
    fullPrompt = fullPrompt.substring(0, maxLength);
    // Intentar cortar en un punto natural
    const lastPeriod = fullPrompt.lastIndexOf('.');
    if (lastPeriod > maxLength * 0.8) {
      fullPrompt = fullPrompt.substring(0, lastPeriod + 1);
    }
  }
  
  // 9. Construir negative prompt dinámico
  const negativePrompt = buildDynamicNegative(iif);
  
  console.log(`[IIF:Converter] ✅ Prompt generado: ${fullPrompt.length} chars`);
  console.log(`[IIF:Converter] negative_count=${negativePrompt.split(',').length} items`);
  console.log(`[IIF:Converter] preview="${fullPrompt.substring(0, 120)}..."`);
  
  return {
    prompt: fullPrompt,
    negative: negativePrompt,
    metadata: {
      country: iif.country,
      country_code: iif.country_code,
      scene_type: iif.scene_type,
      style: iif.style,
      composition: iif.composition,
      flags_allowed: iif.flags_allowed,
      flags_forbidden: iif.flags_forbidden,
      prompt_length: fullPrompt.length,
      negative_length: negativePrompt.length
    }
  };
}

/**
 * Construye descripción de escena temática
 * @param {Object} iif - IIF estructurado
 * @returns {string} Descripción de escena
 */
function buildSceneDescription(iif) {
  const emotion = iif.emotion ? `Emoción: ${iif.emotion}. ` : '';
  const elements = iif.theme_elements ? `Elementos: ${iif.theme_elements}. ` : '';
  
  return `${emotion}${elements}`.trim();
}

/**
 * Construye descripción de ambiente geográfico/cultural
 * @param {Object} iif - IIF estructurado
 * @returns {string} Descripción de ambiente
 */
function buildEnvironmentDescription(iif) {
  const parts = [];
  
  if (iif.city_style) {
    parts.push(`Estilo urbano: ${iif.city_style}`);
  }
  
  if (iif.architecture) {
    parts.push(`Arquitectura: ${iif.architecture}`);
  }
  
  if (iif.environment) {
    parts.push(`Entorno: ${iif.environment}`);
  }
  
  if (iif.climate) {
    parts.push(`Clima: ${iif.climate}`);
  }
  
  if (iif.colors) {
    parts.push(`Paleta de colores: ${iif.colors}`);
  }
  
  return parts.join('. ') + (parts.length > 0 ? '.' : '');
}

/**
 * Construye descripción de elementos permitidos
 * @param {Object} iif - IIF estructurado
 * @returns {string} Descripción de elementos permitidos
 */
function buildAllowedElementsDescription(iif) {
  const parts = [];
  
  if (iif.flags_allowed && iif.flags_allowed.length > 0) {
    // Solo mencionar banderas si son relevantes al tema
    const relevantFlags = iif.flags_allowed.slice(0, 2); // Máximo 2 para no saturar
    if (relevantFlags.length > 0) {
      parts.push(`Banderas contextuales permitidas: ${relevantFlags.join(', ')}`);
    }
  }
  
  if (iif.landmarks_allowed && iif.landmarks_allowed.length > 0) {
    const relevantLandmarks = iif.landmarks_allowed.slice(0, 3);
    parts.push(`Referencias visuales permitidas: ${relevantLandmarks.join(', ')}`);
  }
  
  return parts.join('. ') + (parts.length > 0 ? '.' : '');
}

/**
 * Convierte IIF a formato legacy (para compatibilidad)
 * @param {Object} iif - IIF estructurado
 * @returns {Object} Formato legacy compatible con buildImagePromptFromDraft
 */
function convertIIFtoLegacyFormat(iif) {
  const converted = convertIIFtoPrompt(iif);
  
  return {
    prompt: converted.prompt,
    negative: converted.negative,
    locale: 'es-CU',
    style: iif.style || 'comic_editorial',
    context: {
      category: iif.news_context.category,
      tags: iif.news_context.tags,
      country: iif.country,
      countryCode: iif.country_code,
      contextId: iif.scene_type,
      disaster: iif.scene_type === 'natural_disaster',
      iif_enabled: true
    },
    signals: {
      title: iif.news_context.title,
      country: iif.country
    },
    themeResult: {
      contextId: iif.scene_type,
      disaster: iif.scene_type === 'natural_disaster',
      confidence: 0.9,
      visualSceneType: iif.scene_type
    }
  };
}

/**
 * Genera resumen legible del IIF (para debugging)
 * @param {Object} iif - IIF estructurado
 * @returns {string} Resumen legible
 */
function summarizeIIF(iif) {
  return `
IIF Summary:
  Country: ${iif.country} (${iif.country_code})
  Scene: ${iif.scene_type}
  Style: ${iif.style}
  Emotion: ${iif.emotion}
  Flags Allowed: ${iif.flags_allowed.length} | Forbidden: ${iif.flags_forbidden.length}
  Skylines Forbidden: ${iif.skyline_forbidden.length}
  `.trim();
}

module.exports = {
  convertIIFtoPrompt,
  convertIIFtoLegacyFormat,
  buildSceneDescription,
  buildEnvironmentDescription,
  summarizeIIF
};
