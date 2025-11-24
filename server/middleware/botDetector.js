// server/middleware/botDetector.js

/**
 * Detecta si el user-agent corresponde a un bot de redes sociales
 * o cualquier crawler que necesite meta-tags
 * 
 * @param {string} userAgent - User-Agent del request
 * @returns {boolean} true si es un bot
 */
function isBot(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') {
    return false;
  }
  
  const ua = userAgent.toLowerCase();
  
  // Lista de bots conocidos (redes sociales y crawlers)
  const botPatterns = [
    // Facebook
    'facebookexternalhit',
    'facebot',
    'facebook',
    
    // Twitter
    'twitterbot',
    'twitter',
    
    // LinkedIn
    'linkedinbot',
    'linkedin',
    
    // WhatsApp
    'whatsapp',
    
    // Telegram
    'telegrambot',
    'telegram',
    
    // Slack
    'slackbot',
    'slack',
    
    // Discord
    'discordbot',
    'discord',
    
    // Crawlers generales
    'googlebot',
    'bingbot',
    'slurp', // Yahoo
    'duckduckbot',
    'baiduspider',
    'yandexbot',
    'sogou',
    'exabot',
    'ia_archiver', // Alexa
    
    // Preview/Scraper tools
    'prerender',
    'preview',
    'headless',
    'phantom',
    'crawler',
    'spider',
    'scraper'
  ];
  
  // Verificar si el user-agent contiene algún patrón de bot
  return botPatterns.some(pattern => ua.includes(pattern));
}

/**
 * Middleware Express para detectar bots y servir HTML con meta-tags
 * Se usa antes del fallback del SPA
 */
function botDetectionMiddleware(req, res, next) {
  const userAgent = req.headers['user-agent'] || '';
  req.isBot = isBot(userAgent);
  next();
}

module.exports = { isBot, botDetectionMiddleware };
