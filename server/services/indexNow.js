/**
 * IndexNow Service
 * Notifica automáticamente a motores de búsqueda cuando se publica contenido nuevo
 * Soporta: Bing, Yandex, Seznam, Naver (Google usa sitemap pero puede beneficiarse indirectamente)
 */

const fetch = require('node-fetch');

// Clave de IndexNow (debe ser única para tu sitio)
const INDEX_NOW_KEY = 'levantatecuba2025indexkey';
const SITE_HOST = 'levantatecuba.com';

// Endpoints de IndexNow
const INDEX_NOW_ENDPOINTS = [
  'https://api.indexnow.org/indexnow',      // IndexNow principal (Bing, Yandex)
  'https://www.bing.com/indexnow',           // Bing directo
  'https://yandex.com/indexnow',             // Yandex directo
];

/**
 * Notifica a los motores de búsqueda sobre una nueva URL
 * @param {string} url - URL completa a indexar
 * @returns {Promise<{success: boolean, results: Array}>}
 */
async function notifyIndexNow(url) {
  if (!url || !url.startsWith('https://')) {
    console.warn('[IndexNow] URL inválida:', url);
    return { success: false, error: 'URL inválida' };
  }

  console.log(`[IndexNow] 📡 Notificando nueva URL: ${url}`);

  const results = [];

  for (const endpoint of INDEX_NOW_ENDPOINTS) {
    try {
      const apiUrl = `${endpoint}?url=${encodeURIComponent(url)}&key=${INDEX_NOW_KEY}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        timeout: 10000
      });

      const status = response.status;
      const success = status === 200 || status === 202;

      results.push({
        endpoint: endpoint.split('/')[2], // Extraer dominio
        status,
        success
      });

      if (success) {
        console.log(`[IndexNow] ✅ ${endpoint.split('/')[2]}: OK (${status})`);
      } else {
        console.warn(`[IndexNow] ⚠️ ${endpoint.split('/')[2]}: ${status}`);
      }

    } catch (error) {
      results.push({
        endpoint: endpoint.split('/')[2],
        status: 'error',
        success: false,
        error: error.message
      });
      console.error(`[IndexNow] ❌ ${endpoint.split('/')[2]}: ${error.message}`);
    }
  }

  const anySuccess = results.some(r => r.success);
  return { success: anySuccess, results };
}

/**
 * Notifica múltiples URLs a la vez (batch)
 * @param {string[]} urls - Array de URLs a indexar
 * @returns {Promise<{success: boolean, results: Array}>}
 */
async function notifyIndexNowBatch(urls) {
  if (!urls || !urls.length) {
    return { success: false, error: 'No hay URLs para indexar' };
  }

  console.log(`[IndexNow] 📡 Notificando ${urls.length} URLs en batch...`);

  const payload = {
    host: SITE_HOST,
    key: INDEX_NOW_KEY,
    keyLocation: `https://${SITE_HOST}/${INDEX_NOW_KEY}.txt`,
    urlList: urls.slice(0, 10000) // Máximo 10,000 URLs por batch
  };

  const results = [];

  for (const endpoint of INDEX_NOW_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        timeout: 30000
      });

      const status = response.status;
      const success = status === 200 || status === 202;

      results.push({
        endpoint: endpoint.split('/')[2],
        status,
        success,
        urlCount: urls.length
      });

      if (success) {
        console.log(`[IndexNow] ✅ ${endpoint.split('/')[2]}: ${urls.length} URLs enviadas`);
      }

    } catch (error) {
      results.push({
        endpoint: endpoint.split('/')[2],
        status: 'error',
        success: false,
        error: error.message
      });
    }
  }

  const anySuccess = results.some(r => r.success);
  return { success: anySuccess, results };
}

/**
 * Construye la URL pública de una noticia
 * @param {Object} news - Objeto noticia con slug o _id
 * @returns {string} URL completa
 */
function buildNewsUrl(news) {
  const identifier = news.slug || news._id;
  return `https://${SITE_HOST}/noticias/${identifier}`;
}

/**
 * Notifica una nueva noticia publicada
 * @param {Object} news - Objeto noticia
 */
async function notifyNewNews(news) {
  if (!news) return;
  
  const url = buildNewsUrl(news);
  return notifyIndexNow(url);
}

module.exports = {
  notifyIndexNow,
  notifyIndexNowBatch,
  notifyNewNews,
  buildNewsUrl,
  INDEX_NOW_KEY
};
