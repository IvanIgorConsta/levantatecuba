/**
 * Helper para generar HTML con Open Graph tags para bots de redes sociales
 * (Facebook, WhatsApp, Twitter, LinkedIn, etc.)
 * 
 * Creado: 2025-12-01
 * Propósito: Servir meta tags OG dinámicas para previews de noticias en redes sociales
 */

/**
 * Escapa caracteres HTML especiales para evitar XSS
 * @param {string} str - String a escapar
 * @returns {string} String escapado
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Extrae texto plano del HTML y lo trunca
 * @param {string} html - Contenido HTML
 * @param {number} maxLength - Longitud máxima
 * @returns {string} Texto plano truncado
 */
function extractPlainText(html, maxLength = 200) {
  if (!html) return '';
  
  // Remover tags HTML
  let text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Truncar si es necesario
  if (text.length > maxLength) {
    text = text.substring(0, maxLength - 3) + '...';
  }
  
  return text;
}

/**
 * Genera HTML completo con Open Graph tags
 * @param {Object} options - Opciones
 * @param {string} options.title - Título de la página
 * @param {string} options.description - Descripción
 * @param {string} options.imageUrl - URL de la imagen (absoluta)
 * @param {string} options.url - URL canónica
 * @param {string} [options.type='article'] - Tipo de contenido
 * @param {string} [options.siteName='LevántateCuba'] - Nombre del sitio
 * @returns {string} HTML completo
 */
function renderOgPage(options) {
  const {
    title,
    description,
    imageUrl,
    url,
    type = 'article',
    siteName = 'LevántateCuba'
  } = options;
  
  // Escapar todos los valores para seguridad
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(extractPlainText(description, 200));
  const safeImageUrl = escapeHtml(imageUrl);
  const safeUrl = escapeHtml(url);
  const safeSiteName = escapeHtml(siteName);
  
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} | ${safeSiteName}</title>
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="${safeSiteName}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:image" content="${safeImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:locale" content="es_ES" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${safeImageUrl}" />
  
  <!-- Básicos -->
  <meta name="description" content="${safeDescription}" />
  <link rel="canonical" href="${safeUrl}" />
</head>
<body style="background:#111;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="text-align:center;padding:2rem;">
    <p style="font-size:1.2rem;">Redirigiendo...</p>
    <p style="opacity:0.7;font-size:0.9rem;">Si no eres redirigido automáticamente, <a href="${safeUrl}" style="color:#ef4444;">haz clic aquí</a>.</p>
  </div>
  <script>
    // Redirigir usuarios humanos al frontend SPA
    window.location.href = "${safeUrl}";
  </script>
</body>
</html>`;
}

/**
 * Lista de User-Agents de bots de redes sociales
 */
const BOT_USER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'WhatsApp',
  'LinkedInBot',
  'Slackbot',
  'TelegramBot',
  'Discordbot',
  'Pinterest',
  'Googlebot',
  'bingbot',
  'Applebot'
];

/**
 * Detecta si el request viene de un bot de redes sociales
 * @param {string} userAgent - User-Agent del request
 * @returns {boolean} true si es un bot
 */
function isSocialBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot.toLowerCase()));
}

module.exports = {
  renderOgPage,
  isSocialBot,
  escapeHtml,
  extractPlainText
};
