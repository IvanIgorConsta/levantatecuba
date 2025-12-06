// server/redactor_ia/services/cubaStrictScanner.js
const axios = require('axios');
const https = require('https');
const AiConfig = require('../../models/AiConfig');
const AiTopic = require('../../models/AiTopic');
const News = require('../../models/News');
const AiDraft = require('../../models/AiDraft');
const { logScan } = require('./statsService');
const { deduplicateByTitle, checkTitleDuplicate } = require('../utils/similarity');

// Keep-alive agent para reutilizar conexiones
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 10000
});

/**
 * Helper: Parsea RSS/XML básico sin dependencias externas
 * @param {string} xmlText - Contenido XML
 * @returns {Array} Lista de artículos parseados
 */
function parseSimpleRSS(xmlText) {
  const articles = [];
  
  // Regex para extraer items
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  const items = xmlText.match(itemRegex) || [];
  
  for (const item of items) {
    try {
      // Extraer campos básicos
      const title = item.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim();
      const link = item.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i)?.[1]?.trim();
      const description = item.match(/<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim();
      const pubDate = item.match(/<pubDate[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/pubDate>/i)?.[1]?.trim();
      const content = item.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/content:encoded>/i)?.[1]?.trim();
      
      if (title && link) {
        articles.push({
          title: cleanHTML(title),
          url: link,
          summary: cleanHTML(description || ''),
          content: cleanHTML(content || description || ''),
          publishedAt: pubDate ? new Date(pubDate) : new Date()
        });
      }
    } catch (err) {
      console.error('[CubaScanner] Error parseando item RSS:', err.message);
    }
  }
  
  return articles;
}

/**
 * Parsea WordPress REST API response
 * @param {Array|Object} data - Response de WP API
 * @returns {Array} Lista de artículos
 */
function parseWordPressAPI(data) {
  const articles = [];
  const posts = Array.isArray(data) ? data : [data];
  
  for (const post of posts) {
    try {
      if (!post || !post.title || !post.link) continue;
      
      articles.push({
        title: cleanHTML(post.title.rendered || post.title),
        url: post.link,
        summary: cleanHTML(post.excerpt?.rendered || post.excerpt || ''),
        content: cleanHTML(post.content?.rendered || post.content || ''),
        publishedAt: post.date ? new Date(post.date) : new Date()
      });
    } catch (err) {
      console.error('[CubaScanner] Error parseando post WordPress:', err.message);
    }
  }
  
  return articles;
}

/**
 * Limpia HTML básico de textos
 */
function cleanHTML(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '') // Remover tags HTML
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch con timeout y retry
 */
async function fetchWithRetry(url, options = {}, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout: 8000,
        httpsAgent,
        headers: {
          'User-Agent': 'LevántateCuba-RedactorIA/1.0 (+https://levantatecuba.com/contact)',
          'Accept': 'application/xml, application/rss+xml, text/xml, text/html, */*',
          'Accept-Encoding': 'gzip, deflate',
          ...options.headers
        },
        ...options
      });
      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = 1000 * attempt;
      console.log(`[CubaScanner] Reintento ${attempt}/${maxRetries} en ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Helper: Obtiene artículos recientes de CiberCuba
 * @param {Object} options - { hoursWindow, limit }
 * @returns {Promise<Array>} Lista de artículos
 */
async function fetchCiberCubaArticles({ hoursWindow = 48, limit = 20 }) {
  console.log('[CubaScanner] 🇨🇺 Escaneando CiberCuba...');
  
  const rssUrls = [
    'https://www.cibercuba.com/rss.xml',
    'https://www.cibercuba.com/feeds/posts/default?alt=rss'
  ];
  
  const cutoffTime = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);
  let articles = [];
  
  for (const rssUrl of rssUrls) {
    try {
      const response = await fetchWithRetry(rssUrl);
      const parsed = parseSimpleRSS(response.data);
      
      // Filtrar por fecha y agregar metadata
      const filtered = parsed
        .filter(art => art.publishedAt >= cutoffTime)
        .map(art => ({
          ...art,
          sourceId: 'cibercuba',
          sourceName: 'CiberCuba'
        }))
        .slice(0, limit);
      
      articles.push(...filtered);
      console.log(`[CubaScanner] ✅ CiberCuba: ${filtered.length} artículos recientes`);
      
      if (filtered.length > 0) {
        console.log(`[CubaScanner] ℹ️  CiberCuba: URL RSS verificada y funcional`);
        break; // Si encontramos artículos, no probar otro RSS
      }
      
    } catch (error) {
      const status = error.response?.status || 'N/A';
      console.error(`[CubaScanner] ❌ Error en CiberCuba (${rssUrl}) [HTTP ${status}]:`, error.message);
    }
  }
  
  return articles;
}

/**
 * Helper: Obtiene artículos recientes de ElToque
 * @param {Object} options - { hoursWindow, limit }
 * @returns {Promise<Array>} Lista de artículos
 */
async function fetchElToqueArticles({ hoursWindow = 48, limit = 20 }) {
  console.log('[CubaScanner] 🇨🇺 Escaneando ElToque...');
  
  const rssUrls = [
    'https://eltoque.com/feed/',
    'https://eltoque.com/feed',
    'https://eltoque.com/wp-json/wp/v2/posts?per_page=20&_embed',
    'https://www.eltoque.com/feed/',
    'https://www.eltoque.com/feed'
  ];
  
  const cutoffTime = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);
  let articles = [];
  
  for (const rssUrl of rssUrls) {
    try {
      const response = await fetchWithRetry(rssUrl);
      let parsed;
      
      // Detectar si es WordPress REST API (JSON) o RSS (XML)
      if (rssUrl.includes('wp-json')) {
        parsed = parseWordPressAPI(response.data);
      } else {
        parsed = parseSimpleRSS(response.data);
      }
      
      // Filtrar por fecha y agregar metadata
      const filtered = parsed
        .filter(art => art.publishedAt >= cutoffTime)
        .map(art => ({
          ...art,
          sourceId: 'eltoque',
          sourceName: 'ElToque'
        }))
        .slice(0, limit);
      
      articles.push(...filtered);
      console.log(`[CubaScanner] ✅ ElToque (${rssUrl}): ${filtered.length} artículos`);
      
      if (filtered.length > 0) {
        console.log(`[CubaScanner] ℹ️  ElToque: URL RSS verificada y funcional`);
        break;
      }
      
    } catch (error) {
      const status = error.response?.status || 'N/A';
      console.error(`[CubaScanner] ❌ Error en ElToque (${rssUrl}) [HTTP ${status}]:`, error.message);
    }
  }
  
  return articles;
}

/**
 * Helper: Obtiene artículos recientes de Martí Noticias
 * @param {Object} options - { hoursWindow, limit }
 * @returns {Promise<Array>} Lista de artículos
 */
async function fetchMartiNoticiasArticles({ hoursWindow = 48, limit = 20 }) {
  console.log('[CubaScanner] 🇨🇺 Escaneando Martí Noticias...');
  
  const rssUrls = [
    'https://www.martinoticias.com/api/z_uqvl-vomx-tpevipt', // Titulares (oficial)
    'https://www.martinoticias.com/api/z_bol-vomx-tpevvii',  // Cuba (oficial)
    'https://www.martinoticias.com/api/zotq_l-vomx-tpepopy', // Derechos Humanos (oficial)
    'https://www.martinoticias.com/api/zgbqil-vomx-tpe-vpp'  // Economía (oficial)
  ];
  
  const cutoffTime = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);
  let articles = [];
  
  for (const rssUrl of rssUrls) {
    try {
      const response = await fetchWithRetry(rssUrl);
      const parsed = parseSimpleRSS(response.data);
      
      // Filtrar por fecha y agregar metadata
      const filtered = parsed
        .filter(art => art.publishedAt >= cutoffTime)
        .map(art => ({
          ...art,
          sourceId: 'martinoticias',
          sourceName: 'Martí Noticias'
        }))
        .slice(0, limit);
      
      articles.push(...filtered);
      console.log(`[CubaScanner] ✅ Martí Noticias (${rssUrl}): ${filtered.length} artículos`);
      
      if (filtered.length > 0) {
        console.log(`[CubaScanner] ℹ️  Martí Noticias: URL RSS verificada y funcional`);
        break;
      }
      
    } catch (error) {
      const status = error.response?.status || 'N/A';
      console.error(`[CubaScanner] ❌ Error en Martí Noticias (${rssUrl}) [HTTP ${status}]:`, error.message);
    }
  }
  
  return articles;
}

/**
 * Normaliza artículos al formato de tema estándar (compatible con AiTopic schema)
 * @param {Array} rawArticles - Artículos sin procesar
 * @param {string} tenantId - ID del tenant
 * @returns {Array} Temas normalizados
 */
function normalizeToTopics(rawArticles, tenantId = 'levantatecuba') {
  const topics = [];
  
  for (const article of rawArticles) {
    try {
      // Crear un tema básico sin scoring complejo
      const topic = {
        tenantId,
        idTema: `cuba_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        tituloSugerido: article.title,
        resumenBreve: (article.summary || article.title).substring(0, 500), // Max 500 chars
        fuentesTop: [{
          medio: article.sourceName,
          titulo: article.title,
          url: article.url,
          fecha: article.publishedAt
        }],
        categoriaSugerida: 'General', // Se podría mejorar con clasificador
        impacto: 70, // Puntaje fijo moderado-alto para noticias cubanas
        confianza: 'Alta', // Fuentes verificadas
        detectedAt: new Date(),
        status: 'pending',
        imageUrl: null,
        metadata: {
          recencia: 85,
          consenso: 70,
          autoridad: 90,
          tendencia: 60,
          relevanciaCuba: 100, // Máxima relevancia Cuba
          novedad: 75,
          originMode: 'cuba_estricto',
          originSources: [article.sourceId]
        }
      };
      
      topics.push(topic);
    } catch (err) {
      console.error('[CubaScanner] Error normalizando artículo:', err.message);
    }
  }
  
  return topics;
}

/**
 * Función principal: Escanea fuentes cubanas en modo estricto
 * @param {Object} options - { limit, hoursWindow }
 * @returns {Promise<Object>} { ok, mode, count, topicsFound, savedTopics }
 */
async function scanCubaStrict({ limit = 20, hoursWindow = 48 }) {
  console.time('[CubaEstricto] ⏱️  Tiempo total de escaneo');
  console.log('[CubaEstricto] 🔒 Modo Cuba estricto activado');
  console.log(`[CubaEstricto] Parámetros: limit=${limit}, ventana=${hoursWindow}h`);
  
  const scanStartTime = Date.now();
  const config = await AiConfig.getSingleton();
  const tenantId = config.defaultTenant || 'levantatecuba';
  
  let savedTopics = [];
  
  try {
    // Fetchear las 3 fuentes en paralelo
    const [cibercubaArticles, eltoqueArticles, martiArticles] = await Promise.all([
      fetchCiberCubaArticles({ hoursWindow, limit: limit * 2 }),
      fetchElToqueArticles({ hoursWindow, limit: limit * 2 }),
      fetchMartiNoticiasArticles({ hoursWindow, limit: limit * 2 })
    ]);
    
    // Combinar todos los artículos
    const allArticles = [
      ...cibercubaArticles,
      ...eltoqueArticles,
      ...martiArticles
    ];
    
    console.log(`[CubaEstricto] 📊 Artículos combinados (antes de dedupe): ${allArticles.length}`);
    
    // DEDUPE: Eliminar artículos duplicados por similitud de título
    const { unique: dedupedArticles, duplicatesSkipped } = deduplicateByTitle(allArticles, {
      titleField: 'title',
      impactField: 'impacto',
      verbose: true
    });
    
    if (duplicatesSkipped > 0) {
      console.log(`[CubaEstricto] 🔍 Deduplicación: ${duplicatesSkipped} duplicados eliminados, ${dedupedArticles.length} artículos únicos`);
    }
    
    // VERIFICAR CONTRA NOTICIAS PUBLICADAS Y BORRADORES EXISTENTES (últimos 7 días)
    let publishedDupesSkipped = 0;
    let draftDupesSkipped = 0;
    let notDuplicatedWithDB = dedupedArticles;
    
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // Obtener títulos de noticias publicadas y borradores en paralelo
      const [recentNews, recentDrafts] = await Promise.all([
        News.find({ createdAt: { $gte: sevenDaysAgo } }, { titulo: 1 }).lean(),
        AiDraft.find({ createdAt: { $gte: sevenDaysAgo } }, { titulo: 1 }).lean()
      ]);
      
      const publishedTitles = recentNews.map(n => n.titulo).filter(Boolean);
      const draftTitles = recentDrafts.map(d => d.titulo).filter(Boolean);
      
      if (publishedTitles.length > 0 || draftTitles.length > 0) {
        console.log(`[CubaEstricto] 📰 Verificando contra ${publishedTitles.length} publicadas + ${draftTitles.length} borradores...`);
        
        notDuplicatedWithDB = dedupedArticles.filter(article => {
          const title = article.title || '';
          if (!title) return true;
          
          // Verificar contra publicadas (70% similitud)
          const checkPublished = checkTitleDuplicate(title, publishedTitles, 0.70);
          if (checkPublished.isDuplicate) {
            publishedDupesSkipped++;
            console.log(`[CubaEstricto] 🚫 Duplicado de publicada (${(checkPublished.similarity * 100).toFixed(0)}%): "${title.substring(0, 50)}..."`);
            return false;
          }
          
          // Verificar contra borradores (70% similitud)
          const checkDraft = checkTitleDuplicate(title, draftTitles, 0.70);
          if (checkDraft.isDuplicate) {
            draftDupesSkipped++;
            console.log(`[CubaEstricto] 🚫 Duplicado de borrador (${(checkDraft.similarity * 100).toFixed(0)}%): "${title.substring(0, 50)}..."`);
            return false;
          }
          
          return true;
        });
        
        if (publishedDupesSkipped > 0 || draftDupesSkipped > 0) {
          console.log(`[CubaEstricto] 🔍 Duplicados eliminados: ${publishedDupesSkipped} publicadas, ${draftDupesSkipped} borradores`);
        }
      }
    } catch (err) {
      console.warn(`[CubaEstricto] ⚠️ Error verificando duplicados en BD: ${err.message}`);
      // Continuar sin esta verificación
    }
    
    // Reemplazar dedupedArticles con los filtrados
    const finalArticles = notDuplicatedWithDB;
    
    if (finalArticles.length === 0) {
      console.log('[CubaEstricto] ⚠️  No se encontraron artículos recientes');
      console.timeEnd('[CubaEstricto] ⏱️  Tiempo total de escaneo');
      
      // Registrar escaneo vacío
      await logScan({
        topicsFound: 0,
        scanType: 'cuba_estricto',
        sources: { cibercuba: 0, eltoque: 0, martinoticias: 0 },
        duration: Date.now() - scanStartTime,
        status: 'success',
        tenantId
      });
      
      return { ok: true, mode: 'cuba_estricto', count: 0, topicsFound: 0, savedTopics: [] };
    }
    
    // Ordenar por publishedAt descendente (más reciente primero)
    finalArticles.sort((a, b) => b.publishedAt - a.publishedAt);
    
    // Recortar al límite
    const topArticles = finalArticles.slice(0, limit);
    
    // Normalizar a formato de tema
    const topics = normalizeToTopics(topArticles, tenantId);
    
    console.log(`[CubaEstricto] ✅ Temas generados: ${topics.length}`);
    console.log(`[CubaEstricto] 📋 Desglose por fuente:`);
    console.log(`  - CiberCuba: ${cibercubaArticles.length}`);
    console.log(`  - ElToque: ${eltoqueArticles.length}`);
    console.log(`  - Martí Noticias: ${martiArticles.length}`);
    
    // Guardar temas en base de datos
    savedTopics = await Promise.all(
      topics.map(async (topic) => {
        const aiTopic = new AiTopic(topic);
        return await aiTopic.save();
      })
    );
    
    console.log(`[CubaEstricto] 💾 ${savedTopics.length} temas guardados en base de datos`);
    
    const totalSeconds = ((Date.now() - scanStartTime) / 1000).toFixed(2);
    console.log(`[CubaEstricto] Tiempo total: ${totalSeconds}s`);
    console.timeEnd('[CubaEstricto] ⏱️  Tiempo total de escaneo');
    
    // Registrar escaneo exitoso
    await logScan({
      topicsFound: savedTopics.length,
      scanType: 'cuba_estricto',
      sources: { 
        cibercuba: cibercubaArticles.length, 
        eltoque: eltoqueArticles.length, 
        martinoticias: martiArticles.length 
      },
      duration: Date.now() - scanStartTime,
      status: 'success',
      tenantId
    });
    
    return {
      ok: true,
      mode: 'cuba_estricto',
      count: savedTopics.length,
      topicsFound: topics.length,
      savedTopics
    };
    
  } catch (error) {
    console.error('[CubaEstricto] ❌ Error fatal en escaneo:', error);
    console.timeEnd('[CubaEstricto] ⏱️  Tiempo total de escaneo');
    
    // Registrar escaneo fallido
    await logScan({
      topicsFound: savedTopics.length,
      scanType: 'cuba_estricto',
      sources: { cibercuba: 0, eltoque: 0, martinoticias: 0 },
      duration: Date.now() - scanStartTime,
      status: 'failed',
      error: error.message,
      tenantId
    });
    
    throw error;
  }
}

module.exports = {
  scanCubaStrict,
  fetchCiberCubaArticles,
  fetchElToqueArticles,
  fetchMartiNoticiasArticles
};
