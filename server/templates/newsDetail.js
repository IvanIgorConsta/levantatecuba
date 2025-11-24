// server/templates/newsDetail.js

/**
 * Genera HTML completo con meta-tags Open Graph para detalle de noticia
 * Usado por bots de redes sociales (Facebook, Twitter, LinkedIn, etc.)
 * 
 * @param {Object} noticia - Documento de noticia desde MongoDB
 * @param {string} baseUrl - URL base del sitio (ej: https://levantatecuba.com)
 * @returns {string} HTML completo con meta-tags
 */
function generateNewsDetailHTML(noticia, baseUrl) {
  // Construir URL canónica
  const canonicalUrl = `${baseUrl}/noticias/${noticia._id}`;
  
  // Generar descripción (og:description)
  let description = '';
  if (noticia.bajada && noticia.bajada.trim()) {
    // Si existe bajada, usarla directamente
    description = noticia.bajada.trim();
  } else {
    // Generar resumen desde el contenido
    description = generateSummaryFromContent(noticia.contenido);
  }
  
  // Truncar descripción a 180 caracteres sin cortar palabras
  description = truncateText(description, 180);
  
  // Construir URL de imagen
  let imageUrl = `${baseUrl}/img/default-cover.jpg`; // Fallback
  if (noticia.imagen && noticia.imagen.trim()) {
    const img = noticia.imagen.trim();
    // Si es ruta relativa, convertir a absoluta
    if (img.startsWith('/')) {
      imageUrl = `${baseUrl}${img}`;
    } else if (img.startsWith('http')) {
      imageUrl = img;
    } else {
      imageUrl = `${baseUrl}/${img}`;
    }
  }
  
  // Fecha de publicación en formato ISO
  const publishedTime = (noticia.publishedAt || noticia.createdAt || new Date()).toISOString();
  
  // Tags (máximo 3)
  const tags = (noticia.etiquetas || []).slice(0, 3);
  
  // Categoría
  const section = noticia.categoria || 'General';
  
  // Título limpio (sin HTML)
  const title = stripHtml(noticia.titulo);
  
  // Autor
  const author = noticia.autor || 'Redacción LevántateCuba';
  
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${escapeHtml(title)} | LevántateCuba</title>
  <meta name="title" content="${escapeHtml(title)}">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="author" content="${escapeHtml(author)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="LevántateCuba">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="es_ES">
  
  <!-- Article Meta Tags -->
  <meta property="article:published_time" content="${publishedTime}">
  <meta property="article:section" content="${escapeHtml(section)}">
  <meta property="article:author" content="${escapeHtml(author)}">
  ${tags.map(tag => `<meta property="article:tag" content="${escapeHtml(tag)}">`).join('\n  ')}
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@levantatecuba">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
  
  <!-- Favicon -->
  <link rel="icon" type="image/x-icon" href="${baseUrl}/favicon.ico">
  
  <!-- Refresh to SPA after 1 second (for real users, not bots) -->
  <meta http-equiv="refresh" content="1;url=${escapeHtml(canonicalUrl)}">
</head>
<body style="margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; background: #18181b; color: #e4e4e7;">
  <div style="max-width: 800px; margin: 0 auto;">
    <h1 style="font-size: 2rem; font-weight: bold; margin-bottom: 1rem; color: #fafafa;">${escapeHtml(title)}</h1>
    <p style="font-size: 1.125rem; color: #a1a1aa; margin-bottom: 1.5rem;">${escapeHtml(description)}</p>
    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 1.5rem;">
    <p style="color: #71717a;">Cargando artículo completo...</p>
    <p style="color: #71717a; font-size: 0.875rem;">Si no se redirige automáticamente, <a href="${escapeHtml(canonicalUrl)}" style="color: #ef4444; text-decoration: underline;">haga clic aquí</a>.</p>
  </div>
</body>
</html>`;
}

/**
 * Genera un resumen desde el contenido HTML
 * Elimina tags, extrae primer párrafo significativo
 * 
 * @param {string} html - Contenido HTML de la noticia
 * @returns {string} Resumen limpio
 */
function generateSummaryFromContent(html) {
  if (!html || typeof html !== 'string') return '';
  
  // Eliminar estilos y scripts
  let text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  
  // Eliminar todos los tags HTML
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decodificar entidades HTML comunes
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Normalizar espacios
  text = text.replace(/\s+/g, ' ').trim();
  
  // Buscar el primer párrafo significativo (>50 caracteres)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 50);
  if (sentences.length > 0) {
    return sentences[0].trim();
  }
  
  // Si no hay párrafos largos, devolver los primeros 200 caracteres
  return text.substring(0, 200).trim();
}

/**
 * Trunca texto a un máximo de caracteres sin cortar palabras
 * 
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @returns {string} Texto truncado
 */
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  
  // Cortar en el límite
  let truncated = text.substring(0, maxLength);
  
  // Buscar el último espacio para no cortar palabras
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.8) { // Solo si no cortamos más del 20%
    truncated = truncated.substring(0, lastSpace);
  }
  
  // Añadir puntos suspensivos si se truncó
  return truncated.trim() + '…';
}

/**
 * Elimina tags HTML de un string
 * 
 * @param {string} html - String con HTML
 * @returns {string} String sin HTML
 */
function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Escapa caracteres especiales para HTML
 * 
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado
 */
function escapeHtml(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { generateNewsDetailHTML };

/**
 * INSTRUCCIONES DE VERIFICACIÓN:
 * 
 * 1. Deploy o levantar el servidor en producción
 * 
 * 2. Copiar la URL de una noticia pública, por ejemplo:
 *    https://levantatecuba.com/noticias/673123abc456def789012345
 * 
 * 3. Entrar en el Facebook Sharing Debugger:
 *    https://developers.facebook.com/tools/debug/
 * 
 * 4. Pegar la URL y pulsar "Scrape Again"
 * 
 * 5. Verificar que:
 *    ✅ El título (og:title) aparece solo una vez
 *    ✅ La descripción (og:description) es el resumen, sin repetir el título
 *    ✅ La imagen (og:image) es la correcta y se muestra
 *    ✅ La fecha (article:published_time) aparece en "Article properties"
 *    ✅ La categoría (article:section) aparece en "Article properties"
 *    ✅ Los tags (article:tag) aparecen en "Article properties"
 * 
 * 6. Para verificar en Twitter:
 *    https://cards-dev.twitter.com/validator
 * 
 * 7. Para verificar en LinkedIn:
 *    https://www.linkedin.com/post-inspector/
 * 
 * NOTAS:
 * - Los bots ven el HTML con meta-tags
 * - Los usuarios reales se redirigen al SPA React después de 1 segundo
 * - Si Facebook muestra caché antiguo, usar "Scrape Again" múltiples veces
 * - Puede tardar hasta 24h en actualizarse en algunos casos
 */
