/**
 * Prompt Builder para generación de imágenes con IA
 * Construye prompts específicos según estilo, rol y contenido
 */

/**
 * Convierte texto HTML a resumen plano
 * @param {string} text - Texto con posible HTML
 * @returns {string} Texto plano truncado a 450 caracteres
 */
function toSummary(text) {
  if (!text) return "";
  
  // Eliminar HTML tags
  const plainText = text.replace(/<[^>]+>/g, " ");
  
  // Normalizar espacios
  const normalized = plainText
    .replace(/\s+/g, " ")
    .trim();
  
  // Truncar a 450 caracteres
  if (normalized.length <= 450) {
    return normalized;
  }
  
  return normalized.substring(0, 450).trim() + "...";
}

/**
 * Construye prompt principal para generación de imagen
 * @param {Object} params - Parámetros del prompt
 * @param {string} params.title - Título de la noticia
 * @param {string} params.summary - Resumen del contenido
 * @param {string} params.style - Estilo: "realista", "ilustracion", "infografia"
 * @param {string} params.role - Rol: "cover"/"main" (16:9) o "secondary"/"optional" (1:1)
 * @returns {string} Prompt completo
 */
function buildPrompt({ title, summary, style, role }) {
  const isMain = role === 'cover' || role === 'main';
  const aspectText = isMain ? 'formato 16:9' : 'formato 1:1';
  
  let basePrompt = "";
  
  // Prompts diferenciados por rol
  if (isMain) {
    // Portada: enfoque principal, vista amplia
    basePrompt = `Crear imagen de portada editorial principal sobre: "${title}". `;
    if (summary && summary.length > 10) {
      basePrompt += `Contexto completo: ${summary}. `;
    }
    basePrompt += "Composición amplia y completa que capture la esencia total del tema. ";
  } else {
    // Secundaria: enfoque complementario, detalle específico
    basePrompt = `Crear imagen secundaria editorial complementaria sobre: "${title}". `;
    if (summary && summary.length > 10) {
      // Usar solo parte del resumen para generar perspectiva diferente
      const shortSummary = summary.substring(0, 150);
      basePrompt += `Enfoque en detalle específico: ${shortSummary}. `;
    }
    basePrompt += "Vista cercana o detalle particular que complemente la imagen principal. ";
    basePrompt += "Perspectiva diferente, elemento secundario o ángulo alternativo del tema. ";
  }
  
  let stylePrompt = "";
  
  switch (style) {
    case "realista":
      if (isMain) {
        stylePrompt = "Estilo: fotografía editorial realista de portada, sin texto ni logos, composición amplia, luz natural, vista general, calidad profesional";
      } else {
        stylePrompt = "Estilo: fotografía editorial realista de detalle, sin texto ni logos, enfoque cercano, iluminación dramática, perspectiva íntima";
      }
      break;
      
    case "ilustracion":
      if (isMain) {
        stylePrompt = "Estilo: ilustración editorial minimalista principal, vector-like, sin texto ni logos, composición completa, paleta vibrante, elementos múltiples";
      } else {
        stylePrompt = "Estilo: ilustración editorial de detalle, vector-like, sin texto ni logos, elemento único destacado, paleta complementaria, enfoque simplificado";
      }
      break;
      
    case "infografia":
      if (isMain) {
        stylePrompt = "Estilo: infografía editorial completa, sin texto, múltiples elementos visuales conectados, vista panorámica de datos, diseño comprehensivo";
      } else {
        stylePrompt = "Estilo: infografía de detalle específico, sin texto, elemento visual único o métrica destacada, diseño focalizado, dato particular";
      }
      break;
      
    default:
      if (isMain) {
        stylePrompt = "Estilo: imagen editorial profesional principal, sin texto ni logos, composición equilibrada completa";
      } else {
        stylePrompt = "Estilo: imagen editorial de apoyo, sin texto ni logos, detalle o perspectiva alternativa";
      }
  }
  
  const formatPrompt = `${aspectText}, alta resolución`;
  
  // Agregar modificador único para aumentar variación
  const uniqueModifier = isMain ? ", vista completa y comprehensiva" : ", detalle específico y complementario";
  
  return `${basePrompt}${stylePrompt}, ${formatPrompt}${uniqueModifier}`;
}

/**
 * Construye prompt negativo para evitar elementos no deseados
 * @returns {string} Prompt negativo
 */
function buildNegativePrompt() {
  return "texto, letras, marcas de agua, logos, ruido, artefactos, baja resolución, distorsiones, texto superpuesto, watermarks, signatures";
}

/**
 * Construye prompt seguro cuando el contenido es flaggeado por moderación
 * @param {Object} params - Parámetros básicos
 * @param {string} params.title - Título de la noticia (será abstraído)
 * @returns {string} Prompt abstracto seguro
 */
function buildSafePrompt({ title }) {
  // Crear abstracción segura del tema basada en palabras clave generales
  const safeKeywords = extractSafeKeywords(title);
  
  const abstractPrompt = `Composición abstracta con formas y colores que simbolicen ${safeKeywords}. ` +
    "Diseño minimalista, sin personas, sin símbolos específicos, sin texto, " +
    "usando elementos geométricos y gradientes suaves que transmitan el concepto de manera universal. " +
    "Paleta de colores profesional, composición equilibrada, alta calidad";
  
  return abstractPrompt;
}

/**
 * Extrae palabras clave seguras de un título
 * @param {string} title - Título original
 * @returns {string} Palabras clave abstraídas
 */
function extractSafeKeywords(title) {
  if (!title) return "información general";
  
  // Mapeo de conceptos a abstracciones seguras
  const keywordMap = {
    'economía': 'progreso económico',
    'crisis': 'transformación',
    'política': 'desarrollo social',
    'energía': 'sostenibilidad',
    'tecnología': 'innovación',
    'educación': 'conocimiento',
    'salud': 'bienestar',
    'cultura': 'diversidad cultural',
    'internacional': 'conexión global',
    'sociedad': 'comunidad'
  };
  
  const titleLower = title.toLowerCase();
  
  for (const [keyword, safe] of Object.entries(keywordMap)) {
    if (titleLower.includes(keyword)) {
      return safe;
    }
  }
  
  return "desarrollo y progreso";
}

module.exports = {
  buildPrompt,
  buildNegativePrompt,
  buildSafePrompt,
  toSummary
};
