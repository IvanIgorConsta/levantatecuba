// src/utils/shareUtils.js
// Utilidades para compartir noticias en redes sociales

/**
 * Genera un hook atractivo basado en el título sin duplicarlo
 * @param {string} titulo - Título de la noticia
 * @param {string} categoria - Categoría de la noticia
 * @returns {string} Hook generado
 */
function generateHook(titulo, categoria) {
  if (!titulo) return '';
  
  // Patrones de hook según categoría
  const patterns = {
    'Política': ['🔴 Alerta:', '📢 Urgente:', '🔥 De última hora:', '⚠️ Importante:'],
    'Economía': ['💰 Economía:', '📊 Análisis:', '💵 Impacto económico:', '📈 Situación:'],
    'Internacional': ['🌎 Internacional:', '🌍 Desde el mundo:', '🗺️ Global:', '🌐 Noticias:'],
    'Socio político': ['👥 Sociedad:', '📣 Denuncia:', '🔊 Casos que importan:', '⚖️ Justicia:'],
    'Tecnología': ['💻 Tech:', '🚀 Innovación:', '⚡ Tecnología:', '📱 Digital:'],
    'Tendencia': ['📰 Tendencia:', '🔥 Viral:', '👀 No te pierdas:', '📌 Destacado:'],
    'General': ['📰 Nuevo:', '📢 Información:', '🔔 Noticia:', '📣 Reportaje:']
  };
  
  // Seleccionar patrón aleatorio según categoría
  const categoryPatterns = patterns[categoria] || patterns['General'];
  const randomPattern = categoryPatterns[Math.floor(Math.random() * categoryPatterns.length)];
  
  return `${randomPattern} ${titulo}`;
}

/**
 * Genera un resumen limpio sin repetir el título
 * @param {string} bajada - Bajada de la noticia (preferida)
 * @param {string} contenido - Contenido HTML de la noticia (fallback)
 * @param {string} titulo - Título para verificar duplicación
 * @param {number} maxLength - Longitud máxima (default: 180)
 * @returns {string} Resumen limpio
 */
function generateSummary(bajada, contenido, titulo, maxLength = 180) {
  let summary = '';
  
  // Opción 1: Usar bajada si existe
  if (bajada && bajada.trim()) {
    summary = bajada.trim();
  }
  // Opción 2: Generar desde contenido
  else if (contenido && contenido.trim()) {
    // Limpiar HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contenido;
    const cleanText = tempDiv.textContent || tempDiv.innerText || '';
    
    // Normalizar espacios
    const normalized = cleanText
      .replace(/\s+/g, ' ')
      .trim();
    
    // Buscar primer párrafo significativo (>50 chars)
    const sentences = normalized.split(/[.!?]+/).filter(s => s.trim().length > 50);
    if (sentences.length > 0) {
      summary = sentences[0].trim();
    } else {
      summary = normalized.substring(0, maxLength);
    }
  }
  
  // Si no hay resumen, usar un texto por defecto
  if (!summary || summary.length < 20) {
    return 'Lee los detalles completos en el enlace.';
  }
  
  // Truncar a maxLength sin cortar palabras
  if (summary.length > maxLength) {
    const truncated = summary.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.8) {
      summary = truncated.substring(0, lastSpace).trim() + '…';
    } else {
      summary = truncated.trim() + '…';
    }
  }
  
  // CRÍTICO: Verificar que no comience con el título
  const titleClean = (titulo || '').toLowerCase().trim();
  const summaryClean = summary.toLowerCase().trim();
  
  if (titleClean && summaryClean.startsWith(titleClean.substring(0, 30))) {
    // Buscar segunda oración
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contenido || '';
    const cleanText = (tempDiv.textContent || tempDiv.innerText || '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 50);
    if (sentences.length > 1) {
      summary = sentences[1].trim();
      if (summary.length > maxLength) {
        summary = summary.substring(0, maxLength - 3).trim() + '…';
      }
    } else {
      summary = 'Lee los detalles completos en el enlace.';
    }
  }
  
  return summary;
}

/**
 * Convierte etiquetas en hashtags seguros para redes sociales
 * @param {string[]} etiquetas - Array de etiquetas
 * @param {number} max - Máximo de hashtags (default: 3)
 * @returns {string[]} Array de hashtags limpios
 */
function generateHashtags(etiquetas, max = 3) {
  if (!Array.isArray(etiquetas) || etiquetas.length === 0) {
    return [];
  }
  
  return etiquetas
    .slice(0, max)
    .map(tag => {
      // Limpiar la etiqueta
      let clean = tag
        .trim()
        .replace(/\s+/g, '') // Sin espacios
        .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9_]/g, '') // Solo alfanuméricos y acentos
        .replace(/^[0-9]+/, ''); // No comenzar con números
      
      // Si queda vacío, descartar
      if (!clean) return null;
      
      // Capitalizar primera letra
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
      
      return `#${clean}`;
    })
    .filter(Boolean);
}

/**
 * Genera el texto completo del post para Facebook
 * @param {Object} noticia - Objeto de noticia con todos los campos
 * @param {string} url - URL canónica de la noticia
 * @returns {string} Texto completo formateado para el post
 */
export function generateFacebookPostText(noticia, url) {
  if (!noticia) return '';
  
  const { titulo, bajada, contenido, categoria, etiquetas } = noticia;
  
  // 1. Título (sin hook)
  const title = titulo || 'Sin título';
  
  // 2. Generar resumen (sin repetir título)
  const summary = generateSummary(bajada, contenido, titulo, 180);
  
  // 3. Generar hashtags (siempre incluir #Cuba primero)
  const tagHashtags = generateHashtags(etiquetas, 3);
  
  // Agregar hashtag de categoría
  const categoryHashtag = categoria ? `#${categoria.replace(/\s+/g, '')}` : null;
  
  // Combinar hashtags: Cuba + categoría + tags (máximo 5 total)
  const allHashtags = ['#Cuba'];
  if (categoryHashtag && !allHashtags.includes(categoryHashtag)) {
    allHashtags.push(categoryHashtag);
  }
  tagHashtags.forEach(tag => {
    if (!allHashtags.includes(tag) && allHashtags.length < 5) {
      allHashtags.push(tag);
    }
  });
  
  const hashtags = allHashtags.join(' ');
  
  // 4. Construir texto final: TÍTULO → RESUMEN → ENLACE → HASHTAGS
  const postText = `${title}

${summary}

${url}

${hashtags}`;
  
  return postText;
}

/**
 * Genera un texto sugerido para el primer comentario
 * @param {string} categoria - Categoría de la noticia
 * @param {string} url - URL canónica de la noticia
 * @returns {string} Texto del comentario sugerido
 */
export function generateFirstCommentSuggestion(categoria, url) {
  // Preguntas contextuales según categoría
  const questions = {
    'Política': [
      '¿Qué opinas de esta situación política?',
      '¿Crees que esto traerá cambios significativos?',
      '¿Cómo afecta esto a la población cubana?'
    ],
    'Economía': [
      '¿Cómo impacta esto en la economía familiar?',
      '¿Crees que mejorará la situación económica?',
      '¿Qué medidas deberían tomarse?'
    ],
    'Internacional': [
      '¿Cómo ves la posición de la comunidad internacional?',
      '¿Qué implicaciones tiene esto para Cuba?',
      '¿Debería haber más presión internacional?'
    ],
    'Socio político': [
      '¿Conoces casos similares?',
      '¿Crees que se investigan estos casos con suficiente transparencia?',
      '¿Qué medidas deberían tomarse para evitar esto?'
    ],
    'Tecnología': [
      '¿Qué opinas de este avance tecnológico?',
      '¿Cómo podría esto ayudar a los cubanos?',
      '¿Has tenido experiencias similares?'
    ],
    'Tendencia': [
      '¿Qué te parece esta tendencia?',
      '¿Habías escuchado sobre esto antes?',
      '¿Cómo afecta esto a la comunidad?'
    ],
    'General': [
      '¿Qué opinas sobre este tema?',
      '¿Has experimentado algo similar?',
      '¿Crees que es importante discutir esto?'
    ]
  };
  
  // Seleccionar pregunta aleatoria según categoría
  const categoryQuestions = questions[categoria] || questions['General'];
  const randomQuestion = categoryQuestions[Math.floor(Math.random() * categoryQuestions.length)];
  
  // Construir comentario sugerido con enlace
  const comment = `Para más detalles, lee la noticia completa en el enlace del post:

${url}

💬 ${randomQuestion}`;
  
  return comment;
}

/**
 * Copia texto al portapapeles
 * @param {string} text - Texto a copiar
 * @returns {Promise<boolean>} true si se copió exitosamente
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback para navegadores antiguos
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '1px';
      textArea.style.height = '1px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      return success;
    }
  } catch (err) {
    return false;
  }
}

/**
 * Construye la URL completa de Facebook sharer con quote
 * @param {string} url - URL canónica de la noticia
 * @param {string} quote - Texto del post (quote)
 * @returns {string} URL completa de Facebook sharer
 */
export function buildFacebookShareUrl(url, quote) {
  const encodedUrl = encodeURIComponent(url);
  const encodedQuote = encodeURIComponent(quote);
  
  return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedQuote}`;
}
