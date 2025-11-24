// server/redactor_ia/services/urlExtractor.js
const axios = require('axios');
const https = require('https');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

// Keep-alive agent para reutilizar conexiones
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 5,
  timeout: 15000
});

const USER_AGENT = 'LevántateCuba-RedactorIA/1.0 (+https://levantatecuba.com/contact)';

/**
 * Normaliza una URL a hostname puro para validación
 * @param {string} url - URL a normalizar
 * @returns {string|null} Hostname o null si es inválido
 */
function extractHostname(url) {
  try {
    let urlStr = String(url).trim();
    
    // Añadir protocolo si falta
    if (!urlStr.match(/^https?:\/\//i)) {
      urlStr = 'https://' + urlStr;
    }
    
    const urlObj = new URL(urlStr);
    return urlObj.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Valida una URL contra el allowlist de la configuración
 * @param {string} url - URL a validar
 * @param {Array<string>} allowlist - Lista de dominios permitidos
 * @returns {boolean} true si la URL está permitida
 */
function isUrlAllowed(url, allowlist) {
  if (!allowlist || allowlist.length === 0) {
    // Si no hay allowlist, permitir cualquier dominio confiable (lista por defecto)
    const defaultTrusted = [
      'bbc.com', 'reuters.com', 'apnews.com', 'nytimes.com',
      'theguardian.com', 'washingtonpost.com', 'cnn.com',
      'elpais.com', 'techcrunch.com', 'wired.com', 'theverge.com',
      'arstechnica.com', 'axios.com', 'bloomberg.com'
    ];
    allowlist = defaultTrusted;
  }
  
  const hostname = extractHostname(url);
  if (!hostname) return false;
  
  // Normalizar allowlist
  const normalizedAllowlist = allowlist.map(domain => {
    let d = String(domain).trim().toLowerCase();
    d = d.replace(/^https?:\/\//i, '');
    d = d.split('/')[0];
    return d;
  });
  
  // Verificar si el hostname está en la lista o es subdominio
  return normalizedAllowlist.some(allowed => {
    return hostname === allowed || hostname.endsWith('.' + allowed);
  });
}

/**
 * Extrae el contenido completo de una URL usando Readability
 * @param {string} url - URL del artículo
 * @returns {Promise<Object>} Objeto con title, content, excerpt
 */
async function extractArticleContent(url) {
  console.log(`[URLExtractor] Extrayendo contenido desde: ${url}`);
  
  try {
    // Fetch HTML
    const response = await axios.get(url, {
      timeout: 15000,
      httpsAgent,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache'
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400
    });
    
    if (!response.data) {
      throw new Error('No se pudo obtener contenido de la URL');
    }
    
    // Parsear con JSDOM
    const dom = new JSDOM(response.data, { url });
    const document = dom.window.document;
    
    // Usar Readability para extraer el contenido principal
    const reader = new Readability(document);
    const article = reader.parse();
    
    if (!article || !article.textContent) {
      throw new Error('No se pudo extraer contenido legible del artículo');
    }
    
    // Limpiar y estructurar el resultado
    const title = article.title?.trim() || document.title?.trim() || 'Sin título';
    const content = article.textContent?.trim() || '';
    const excerpt = article.excerpt?.trim() || content.substring(0, 300);
    const html = article.content || '';
    
    console.log(`[URLExtractor] ✅ Extraído: ${title} (${content.length} chars)`);
    
    return {
      title,
      content,     // Texto plano completo
      excerpt,     // Resumen corto
      html,        // HTML limpio del artículo
      url,
      length: content.length
    };
    
  } catch (error) {
    console.error(`[URLExtractor] ❌ Error extrayendo contenido:`, error.message);
    throw new Error(`No se pudo extraer contenido de la URL: ${error.message}`);
  }
}

module.exports = {
  extractHostname,
  isUrlAllowed,
  extractArticleContent
};
