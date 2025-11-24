// server/redactor_ia/services/crawler.js
const axios = require('axios');
const https = require('https');
const AiConfig = require('../../models/AiConfig');
const AiTopic = require('../../models/AiTopic');
const { calculateImpactScore } = require('../utils/impactScore');
const { logScan } = require('./statsService');
const { 
  strictCubaFilter, 
  getCubaStrictQuery,
  isCubaHardMatch
} = require('../utils/cubaFilters');
const {
  FRESHNESS,
  freshnessScore,
  hostOf,
  canonicalUrl
} = require('../config/freshness');

// Control de concurrencia: Map por tenant para evitar escaneos simultáneos
const scanningByTenant = new Map();

// Keep-alive agent para reutilizar conexiones
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 10000,
  scheduling: 'lifo'
});

// Mapa de URLs RSS conocidas para evitar descubrimiento costoso
const KNOWN_RSS_FEEDS = {
  'techcrunch.com': '/feed/',
  'theverge.com': '/rss/index.xml',
  'wired.com': '/feed/rss',
  'arstechnica.com': '/rss-feeds/index.xml',
  'engadget.com': '/rss.xml',
  'theregister.com': '/headlines.atom',
  'semafor.com': '/rss.xml',
  'axios.com': '/feeds/feed.rss',
  'theguardian.com': '/rss',
  'bbc.com': '/news/rss.xml',
  'reuters.com': '/tools/rss',
  'apnews.com': '/rss',
  'nytimes.com': '/svc/collections/v1/publish/https://www.nytimes.com/section/technology/rss.xml',
  'elpais.com': '/rss/',
  'bloomberg.com': '/feed/podcast/businessweek.xml',
  'coindesk.com': '/arc/outboundfeeds/rss/',
  'cointelegraph.com': '/rss',
  'cnet.com': '/rss/news/',
  'xataka.com': '/index.xml',
  'hipertextual.com': '/feed'
};

// Cache negativa de RSS (dominios sin RSS conocido)
const RSS_MISS_CACHE = new Map(); // key: domain, value: timestamp
const RSS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

// Dominios hispanos para detección inteligente de idioma
const HISPANIC_DOMAINS = new Set([
  'elpais.com', 'xataka.com', 'hipertextual.com', 'genbeta.com',
  'elconfidencial.com', 'elmundo.es', 'abc.es', 'lavanguardia.com',
  'martinoticias.com', 'adncuba.com', 'diariodecuba.com'
]);

/**
 * Helpers de parseo seguro
 */
const toInt = (v, def) => Number.isFinite(+v) ? +v : def;
const toBool = (v, def) => (typeof v === 'boolean') ? v : (v === 'true' ? true : (v === 'false' ? false : def));

/**
 * Normaliza lista de dominios/URLs a hostnames puros para NewsAPI
 * Convierte rutas, esquemas, subdominios a hostname simple
 * Ejemplo: 'https://nytimes.com/section/technology' → 'nytimes.com'
 * @param {Array<string>} input - Lista de dominios/URLs potencialmente con rutas
 * @returns {Array<string>} Lista de hostnames únicos válidos
 */
function normalizeHosts(input) {
  const out = new Set();
  for (const raw of (input || [])) {
    if (!raw) continue;
    let s = String(raw).trim();
    if (!s) continue;
    
    // Remover esquema (http://, https://)
    s = s.replace(/^https?:\/\//i, '');
    
    // Tomar solo la parte del hostname (antes del primer /)
    const host = s.split('/')[0].toLowerCase();
    
    // Validar que sea un hostname válido (solo letras, números, guiones y puntos)
    if (/^[a-z0-9.-]+$/.test(host) && host.includes('.')) {
      out.add(host);
    }
  }
  return [...out];
}

/**
 * Divide array en chunks de tamaño específico
 * @param {Array} array - Array a dividir
 * @param {number} size - Tamaño de cada chunk
 * @returns {Array<Array>} Array de chunks
 */
function batchArray(array, size) {
  const batches = [];
  for (let i = 0; i < array.length; i += size) {
    batches.push(array.slice(i, i + size));
  }
  return batches;
}

/**
 * Retry exponencial para llamadas HTTP
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // No reintentar en errores 4xx (excepto 429)
      if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`[Crawler] Reintento ${attempt}/${maxRetries} en ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Escanea fuentes y genera lista de temas (SCAN_ONLY)
 * No genera texto ni imágenes, solo la lista de temas con métricas
 */
async function scanSources() {
  console.time('[Crawler] ⏱️  Tiempo total de escaneo');
  console.log('[Crawler] Iniciando escaneo de fuentes...');
  const scanStartTime = Date.now();
  
  const config = await AiConfig.getSingleton();
  const tenantKey = config.defaultTenant || 'levantatecuba';
  
  // Verificar si ya hay un escaneo en curso para este tenant
  if (scanningByTenant.get(tenantKey)) {
    const error = new Error('Ya hay un escaneo en curso. Por favor espera a que termine.');
    error.code = 'SCAN_IN_PROGRESS';
    error.statusCode = 429;
    throw error;
  }
  
  // Marcar como escaneando
  scanningByTenant.set(tenantKey, true);
  console.log(`[Crawler] 🔒 Candado de escaneo activado para tenant: ${tenantKey}`);
  
  // Parseo seguro de configuración
  const maxTopicsPerScan = Math.max(1, Math.min(20, toInt(config.maxTopicsPerScan, 8)));
  const minSourcesForHighConfidence = Math.max(1, toInt(config.minSourcesForHighConfidence, 3));
  const strictCuba = toBool(config.strictCuba, false);
  const useNewsAPI = toBool(config.newsApiEnabled, true);
  const strictAllowlist = toBool(config.enforceSourceAllowlist, false);
  const allowlist = Array.isArray(config.trustedSources) ? config.trustedSources : [];
  
  // Dominios oficiales a excluir SIEMPRE
  const OFFICIAL_BLACKLIST = new Set([
    'granma.cu','trabajadores.cu','cubadebate.cu','prensa-latina.cu','prensalatina.cu',
    'acn.cu','ain.cu','jrebelde.cu','radiohc.cu'
  ]);
  
  // Normalizar allowlist: convertir rutas/URLs a hostnames puros
  const allowlistNormalized = normalizeHosts(allowlist);
  
  // Versión depurada del allowlist (sin blacklist oficial)
  const allowlistClean = allowlistNormalized.filter(d => !OFFICIAL_BLACKLIST.has(d));
  
  console.log(`[Crawler] Allowlist normalizado: ${allowlist.length} entradas → ${allowlistNormalized.length} hosts únicos → ${allowlistClean.length} después de blacklist`);
  
  // Debug: mostrar sample si hay diferencia significativa
  if (allowlist.length !== allowlistNormalized.length) {
    console.log('[Crawler] Sample allowlist original:', allowlist.slice(0, 5));
    console.log('[Crawler] Sample allowlist normalizado:', allowlistClean.slice(0, 5));
  }
  
  // Dominios por categoría para clasificación temprana
  const TECH_DOMAINS = new Set([
    'techcrunch.com','theverge.com','wired.com','xataka.com','hipertextual.com',
    'androidauthority.com','9to5google.com','engadget.com','arstechnica.com','producthunt.com'
  ]);
  
  const TREND_DOMAINS = new Set([
    'mashable.com','variety.com','polygon.com','ign.com','gamerant.com',
    'buzzfeed.com','people.com','hollywoodreporter.com','rollingstone.com','cosmopolitan.com'
  ]);
  
  // Log de configuración para debug
  console.info('[SCAN CONFIG]', {
    maxTopicsPerScan,
    minSourcesForHighConfidence,
    strictCuba,
    useNewsAPI,
    strictAllowlist,
    allowlistCount: allowlist.length,
    allowlistCleanCount: allowlistClean.length,
    blacklistedCount: allowlist.length - allowlistClean.length
  });
  
  // Marcar como escaneando
  await AiConfig.findOneAndUpdate(
    { singleton: true },
    { isScanning: true }
  );
  
  let savedTopics = [];
  let scanStatus = 'success';
  let scanError = null;
  
  try {
    const allArticles = [];
    let usedNewsAPI = false;
    let usedRSS = false;
    
    // 1. Escanear NewsAPI si está habilitado
    if (useNewsAPI && config.newsApiKey) {
      const newsApiArticles = await scanNewsAPI(config, maxTopicsPerScan, strictCuba, strictAllowlist, allowlistClean);
      allArticles.push(...newsApiArticles);
      usedNewsAPI = newsApiArticles.length > 0;
      
      // FALLBACK: Si strictCuba está activo y NewsAPI devolvió 0, usar RSS de medios cubanos
      if (strictCuba && newsApiArticles.length === 0) {
        console.warn('[Crawler] NewsAPI devolvió 0 resultados. Activando fallback RSS de medios cubanos...');
        const cubanRSS = await scanCubanRSSFallback();
        allArticles.push(...cubanRSS);
        console.log(`[Crawler] Fallback RSS: ${cubanRSS.length} artículos obtenidos`);
      }
    }
    
    // 2. Escanear RSS whitelisteadas configuradas
    const rssArticles = await scanRSSFeeds(config);
    allArticles.push(...rssArticles);
    usedRSS = rssArticles.length > 0;
    
    // TELEMETRÍA: Conteo antes de filtros
    const rawCount = allArticles.length;
    console.log(`[Crawler] Total artículos recopilados: ${rawCount}`);
    
    // 3. Enriquecer artículos con hostname y clasificación temprana
    const enrichedArticles = allArticles.map(article => {
      let hostname = '';
      try {
        hostname = article.url ? new URL(article.url).hostname.replace(/^www\./, '') : '';
      } catch (e) {
        hostname = article.source?.name || '';
      }
      
      // Filtrar blacklist de medios oficiales
      if (OFFICIAL_BLACKLIST.has(hostname)) {
        return null; // Marcar para filtrar
      }
      
      const enriched = { ...article, hostname };
      
      // Clasificación temprana por dominio
      if (!enriched.categoriaSugerida) {
        if (TECH_DOMAINS.has(hostname)) enriched.categoriaSugerida = 'Tecnología';
        else if (TREND_DOMAINS.has(hostname)) enriched.categoriaSugerida = 'Tendencia';
      }
      
      return enriched;
    }).filter(Boolean); // Eliminar artículos blacklisteados
    
    // 4. Aplicar filtro estricto de Cuba si está habilitado (BYPASS para Tech/Tendencia/Internacional)
    let filteredArticles = enrichedArticles;
    if (strictCuba) {
      // Habilitar debug si variable de entorno o si hay muy pocos resultados
      const enableDebug = process.env.DEBUG_CUBA_FILTER === 'true';
      
      // Función que determina si aplicar filtro Cuba estricto
      const shouldApplyCubaStrict = (article) => {
        // BYPASS: Si hostname es Tech/Trend, NO filtrar
        const hostname = (() => {
          try {
            const url = article.url || article.link;
            return url ? new URL(url).hostname.toLowerCase() : '';
          } catch (e) {
            return '';
          }
        })();
        
        // Lista de dominios tech/trend que NO deben filtrarse por Cuba
        const TECH_TREND_BYPASS = [
          'techcrunch.com', 'theverge.com', 'wired.com', 'arstechnica.com',
          'engadget.com', 'cnet.com', 'thenextweb.com', 'venturebeat.com',
          'axios.com', 'semafor.com'
        ];
        
        if (TECH_TREND_BYPASS.some(d => hostname.includes(d))) {
          return true; // Bypass: mantener Tech/Trend/Internacional
        }
        // Aplicar filtro estricto solo a contenido cubano
        return strictCubaFilter([article], enableDebug).length > 0;
      };
      
      const rawCount = enrichedArticles.length;
      let bypassCount = 0;
      
      filteredArticles = enrichedArticles.filter(article => {
        const techBypass = shouldApplyCubaStrict(article);
        if (techBypass && !isCubaHardMatch(article)) bypassCount++;
        return techBypass;
      });
      
      console.log(`[Crawler] Modo Cuba estricto: ${filteredArticles.length} artículos después de filtro (bypass Tech/Trend/Int: ${bypassCount}, descartados: ${rawCount - filteredArticles.length})`);
      
      if (filteredArticles.length === 0 && rawCount > 0) {
        console.warn('[Crawler] ⚠️  strictCuba=ON → 0 resultados tras filtro.');
        console.info('[Crawler Debug] Sample raw titles (primeros 5):');
        enrichedArticles.slice(0, 5).forEach((art, idx) => {
          console.info(`  ${idx + 1}. "${art.title}"`);
        });
        console.info('[Crawler Debug] Configuración de filtro Cuba estricto:');
        console.info('  - BYPASS total (siempre incluidos): cibercuba.com, eltoque.com, 14ymedio.com, diariodecuba.com, martinoticias.com, adncuba.com, cubanet.org');
        console.info('  - EXIGEN keywords: prensa-latina.cu, oncubamagazine.com, radiohc.cu');
        console.info('  - EXCLUIDOS (blacklist): cubadebate.cu');
        console.info('  - Otros dominios: exigen keywords de Cuba en texto/URL/NER');
        console.info('  - Para debug detallado: establecer DEBUG_CUBA_FILTER=true en .env');
      } else if (filteredArticles.length > 0) {
        console.info(`[Crawler] ✅ strictCuba activo: ${filteredArticles.length} artículos válidos de Cuba encontrados`);
        
        // Log de balance por fuente (auditoría de pluralidad)
        const sourceCount = {};
        filteredArticles.forEach(art => {
          const hostname = (() => {
            try {
              const url = art.url || art.link;
              return url ? new URL(url).hostname.replace(/^www\./, '') : 'unknown';
            } catch (e) {
              return 'unknown';
            }
          })();
          sourceCount[hostname] = (sourceCount[hostname] || 0) + 1;
        });
        
        // Ordenar por cantidad descendente
        const sortedSources = Object.entries(sourceCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10); // Top 10 fuentes
        
        console.info('[Crawler] Top fuentes en resultado final:');
        sortedSources.forEach(([host, count]) => {
          console.info(`  - ${host}: ${count} artículos`);
        });
      }
    }
    
    // 5. FRESHNESS PIPELINE: Deduplicación, filtro temporal y cap por fuente
    const windowHours = config.freshnessWindowHours || FRESHNESS.WINDOW_HOURS_DEFAULT;
    const perSourceCap = config.perSourceCap || FRESHNESS.PER_SOURCE_CAP;
    
    // 5.1 Deduplicar por URL canónica
    const seenUrls = new Set();
    const dedupedArticles = filteredArticles.filter(article => {
      const canonical = canonicalUrl(article.url || article.link || '');
      if (!canonical || seenUrls.has(canonical)) {
        return false;
      }
      seenUrls.add(canonical);
      return true;
    });
    
    // 5.2 Freshness gate: Solo artículos dentro de la ventana temporal
    const now = Date.now();
    const windowMs = windowHours * 60 * 60 * 1000;
    const freshArticles = dedupedArticles.filter(article => {
      const pubDate = article.publishedAt ? new Date(article.publishedAt) : null;
      if (!pubDate || isNaN(pubDate.getTime())) {
        return false; // Descartar sin fecha
      }
      const age = now - pubDate.getTime();
      return age >= 0 && age <= windowMs;
    });
    
    // 5.3 Agrupar por host y limitar a N más recientes por fuente
    const byHost = {};
    freshArticles.forEach(article => {
      const host = hostOf(article.url || article.link) || 'unknown';
      if (!byHost[host]) byHost[host] = [];
      byHost[host].push(article);
    });
    
    const cappedArticles = [];
    Object.entries(byHost).forEach(([host, articles]) => {
      // Ordenar por fecha descendente y tomar top N
      const sorted = articles.sort((a, b) => {
        const dateA = new Date(a.publishedAt || 0).getTime();
        const dateB = new Date(b.publishedAt || 0).getTime();
        return dateB - dateA;
      });
      cappedArticles.push(...sorted.slice(0, perSourceCap));
    });
    
    // 5.4 Calcular freshness score para cada artículo
    cappedArticles.forEach(article => {
      const pubDate = new Date(article.publishedAt);
      article._freshnessScore = freshnessScore(pubDate);
    });
    
    // Logs de métricas de freshness
    console.info(`[Freshness] Pipeline aplicado:`, {
      windowHours,
      perSourceCap,
      totalIn: filteredArticles.length,
      afterDedup: dedupedArticles.length,
      afterWindow: freshArticles.length,
      afterCap: cappedArticles.length
    });
    
    const perHostCount = {};
    cappedArticles.forEach(a => {
      const host = hostOf(a.url || a.link) || 'unknown';
      perHostCount[host] = (perHostCount[host] || 0) + 1;
    });
    console.info('[Freshness] Artículos por host (post-cap):', perHostCount);
    
    // 6. Agrupar artículos similares en temas
    const topics = groupIntoTopics(cappedArticles, config);
    
    // 7. Calcular impacto y confianza para cada tema
    const topicsWithScores = topics.map(topic => {
      const { impacto, confianza, metadata } = calculateImpactScore(
        topic,
        config.impactWeights
      );
      
      // Calcular freshness promedio de los artículos del tema
      const avgFreshness = topic.fuentesTop && topic.fuentesTop.length > 0
        ? topic.fuentesTop.reduce((sum, art) => sum + (art._freshnessScore || 0), 0) / topic.fuentesTop.length
        : 0;
      
      // Score final combina impacto con freshness
      // freshness actúa como multiplicador (0-1)
      const finalScore = impacto * (0.5 + 0.5 * avgFreshness); // freshness puede reducir hasta 50%
      
      return {
        ...topic,
        impacto,
        confianza,
        metadata,
        _freshnessAvg: avgFreshness,
        _finalScore: finalScore
      };
    });
    
    // 8. Selección final de temas
    let topTopics;
    
    if (strictCuba) {
      // MODO CUBA ESTRICTO: NO aplicar cuotas por categoría
      // Ordenar por freshness+impacto y tomar los mejores
      topTopics = topicsWithScores
        .sort((a, b) => {
          // Prioridad 1: Freshness (más reciente primero)
          const freshnessA = a._freshnessAvg || 0;
          const freshnessB = b._freshnessAvg || 0;
          if (Math.abs(freshnessA - freshnessB) > 0.1) {
            return freshnessB - freshnessA; // Más fresco gana
          }
          // Prioridad 2: Impacto
          return b._finalScore - a._finalScore;
        })
        .slice(0, maxTopicsPerScan);
      
      console.log(`[Crawler] Modo Cuba estricto: ${topTopics.length} temas seleccionados por freshness+impacto (sin cuotas de categoría)`);
    } else {
      // MODO NORMAL: Aplicar cuotas por categoría (Tech/Tendencia prioritarios)
      const TARGET = { 
        'Tendencia': 6,      // Mayor cuota para contenido viral
        'Tecnología': 6,     // Mayor cuota para innovación tech
        'Internacional': 3,  // Reducido para dar más espacio a Tech/Tendencia
        'General': 0,        // Solo si no hay otras categorías disponibles
        'Socio político': 0, // No priorizar
        'Economía': 0,       // No priorizar
        'Política': 0        // No priorizar (salvo que sea viral)
      };
      
      const bucket = {};
      for (const t of topicsWithScores) {
        const c = t.categoriaSugerida || 'General';
        (bucket[c] ||= []).push(t);
      }
      
      // Componer lista final priorizando cuotas
      const picked = [];
      
      // 1) Tendencia/Tech/Internacional según cuotas
      for (const [cat, need] of Object.entries(TARGET)) {
        if (!need) continue;
        const arr = (bucket[cat] || []).sort((a,b) => b._finalScore - a._finalScore);
        picked.push(...arr.slice(0, need));
      }
      
      // 2) Completar con resto de puntaje alto
      if (picked.length < maxTopicsPerScan) {
        const remaining = topicsWithScores
          .filter(t => !picked.includes(t))
          .sort((a,b) => b._finalScore - a._finalScore)
          .slice(0, maxTopicsPerScan - picked.length);
        picked.push(...remaining);
      }
      
      topTopics = picked.slice(0, maxTopicsPerScan);
      console.log(`[Crawler] Modo normal: ${topTopics.length} temas seleccionados con cuotas por categoría`);
    }
    
    console.log(`[Crawler] Ranking: ${topTopics.length} temas seleccionados (de ${topicsWithScores.length} candidatos)`);
    
    // TELEMETRÍA: Log final del pipeline
    console.info(`[Crawler] Pipeline completo: strictCuba=${strictCuba} | raw=${rawCount} | afterFilter=${filteredArticles.length} | topics=${topTopics.length}`);
    
    // 7. Guardar en base de datos
    const tenantId = config.defaultTenant || 'levantatecuba';
    savedTopics = await Promise.all(
      topTopics.map(async (topic) => {
        const aiTopic = new AiTopic({
          tenantId,
          tituloSugerido: topic.tituloSugerido,
          resumenBreve: topic.resumenBreve,
          impacto: topic.impacto,
          confianza: topic.confianza,
          fuentesTop: topic.fuentesTop.slice(0, 3), // Solo top 3
          categoriaSugerida: topic.categoriaSugerida,
          imageUrl: topic.imageUrl || null,
          metadata: topic.metadata,
          status: 'pending'
        });
        
        return await aiTopic.save();
      })
    );
    
    console.log(`[Crawler] Escaneo completado: ${savedTopics.length} temas guardados`);
    const totalSeconds = ((Date.now() - scanStartTime) / 1000).toFixed(2);
    console.log(`[Crawler] Tiempo total: ${totalSeconds}s`);
    console.timeEnd('[Crawler] ⏱️  Tiempo total de escaneo');
    
    // Registrar escaneo en logs
    await logScan({
      topicsFound: savedTopics.length,
      scanType: 'scheduled', // TODO: diferenciar manual vs scheduled
      sources: {
        newsapi: usedNewsAPI,
        rss: usedRSS
      },
      duration: Date.now() - scanStartTime,
      status: 'success',
      tenantId
    });
    
    return savedTopics;
    
  } catch (error) {
    console.error('[Crawler] Error en escaneo:', error);
    scanStatus = 'failed';
    scanError = error.message;
    
    // Registrar escaneo fallido
    await logScan({
      topicsFound: savedTopics.length,
      scanType: 'scheduled',
      sources: { newsapi: false, rss: false },
      duration: Date.now() - scanStartTime,
      status: 'failed',
      error: error.message,
      tenantId: config.defaultTenant || 'levantatecuba'
    });
    
    throw error;
  } finally {
    // SIEMPRE liberar el candado de concurrencia
    scanningByTenant.set(tenantKey, false);
    console.log(`[Crawler] 🔓 Candado de escaneo liberado para tenant: ${tenantKey}`);
    
    // Desmarcar como escaneando en config
    await AiConfig.findOneAndUpdate(
      { singleton: true },
      { isScanning: false }
    );
  }
}

/**
 * Escanea NewsAPI con retry exponencial
 * @param {Object} config - Configuración
 * @param {number} maxTopicsPerScan - Máximo de temas por escaneo
 * @param {boolean} strictCuba - Si está en modo Cuba estricto
 * @param {boolean} strictAllowlist - Si enforceSourceAllowlist está activo
 * @param {Array} allowlist - Lista de dominios confiables
 */
async function scanNewsAPI(config, maxTopicsPerScan, strictCuba, strictAllowlist, allowlist) {
  try {
    // Verificar API key
    if (!config.newsApiKey || config.newsApiKey === '') {
      console.error('[Crawler] ⚠️  NEWS_API_KEY no configurada. Omitiendo NewsAPI.');
      return [];
    }
    
    const url = 'https://newsapi.org/v2/everything';
    
    // Normalizar allowlist a hostnames puros (crítico para evitar 400)
    const normalizedDomains = normalizeHosts(allowlist);
    
    // Idiomas inteligentes: detectar si hay dominios hispanos
    let languages = [];
    const hasHispanicDomains = normalizedDomains.some(d => HISPANIC_DOMAINS.has(d));
    
    if (!strictCuba) {
      // Tech global: prioritizar inglés
      languages.push('en');
      if (hasHispanicDomains) {
        languages.push('es');
        console.log('[Crawler] 🌐 Dominios hispanos detectados: añadiendo "es"');
      }
    } else {
      // Cuba estricto: solo español
      languages.push('es');
    }
    
    console.log(`[Crawler] Languages effective: ${languages.join(', ')} (${languages.length} idioma(s))`);
    
    // Construir query según modo Cuba
    let queryParams;
    let domainsToUse = [];
    
    if (strictCuba) {
      // MODO CUBA ESTRICTO: usar domains para pre-filtrar + ventana temporal amplia
      const qCubaStrict = getCubaStrictQuery();
      
      // Dominios prioritarios (solo los que funcionan y están bien indexados en NewsAPI)
      const PRIORITY_DOMAINS = [
        // Internacionales (bien indexados)
        'bbc.com', 'reuters.com', 'apnews.com', 'elpais.com',
        // Independientes cubanos (funcionan en NewsAPI)
        'diariodecuba.com', 'martinoticias.com', 'adncuba.com'
      ];
      
      domainsToUse = PRIORITY_DOMAINS;
      
      // Ventana de tiempo configurable (usa FRESHNESS)
      const windowHours = config.freshnessWindowHours || FRESHNESS.WINDOW_HOURS_DEFAULT;
      const now = new Date();
      const fromDate = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
      
      queryParams = {
        q: qCubaStrict,
        sortBy: 'publishedAt',
        pageSize: 100,
        from: fromDate.toISOString().split('T')[0], // Formato: YYYY-MM-DD
        to: now.toISOString().split('T')[0],          // Hasta hoy
        apiKey: config.newsApiKey
      };
      
      console.log(`[Crawler] NewsAPI query: modo CUBA ESTRICTO`);
      console.log(`  - Query: "${qCubaStrict}"`);
      console.log(`  - Domains: ${domainsToUse.length} dominios (bien indexados)`);
      console.log(`  - Window: últimas ${windowHours}h (${fromDate.toISOString()} → ${now.toISOString()})`);
    } else {
      // MODO NORMAL: usar allowlist si está disponible, o query genérico tech
      if (strictAllowlist && normalizedDomains.length > 0) {
        domainsToUse = normalizedDomains;
        // Query genérico para tech/noticias globales
        queryParams = {
          q: '(technology OR AI OR crypto OR cybersecurity OR politics) -sports',
          sortBy: 'publishedAt',
          pageSize: 100,
          apiKey: config.newsApiKey
        };
        console.log(`[Crawler] NewsAPI query: modo ALLOWLIST (${domainsToUse.length} dominios)`);
      } else {
        // Keywords genéricos de Cuba
        const keywords = config.cubaKeywords?.length > 0 ? config.cubaKeywords.join(' OR ') : 'Cuba';
        queryParams = {
          q: keywords,
          sortBy: 'publishedAt',
          pageSize: Math.min(maxTopicsPerScan * 2, 50),
          apiKey: config.newsApiKey
        };
        console.log(`[Crawler] NewsAPI query: modo KEYWORDS (${keywords})`);
      }
    }
    let allArticles = [];
    
    // Segmentar dominios en batches optimizados (12 max para evitar URLs largas)
    const domainBatches = domainsToUse.length > 0 ? batchArray(domainsToUse, 12) : [[]];
    
    const totalRequests = domainBatches.length * languages.length;
    console.log(`[Crawler] Ejecutando ${domainBatches.length} batch(es) × ${languages.length} idioma(s) = ${totalRequests} requests`);
    console.time('[Crawler] ⏱️  NewsAPI + RSS fallback');
    
    for (const batchDomains of domainBatches) {
      for (const lang of languages) {
        const langParams = { ...queryParams, language: lang };
        
        // Añadir domains solo si hay batch
        if (batchDomains.length > 0) {
          langParams.domains = batchDomains.join(',');
        }
        
        // Log de debugging
        const debugParams = { ...langParams };
        if (debugParams.apiKey) {
          debugParams.apiKey = `***${debugParams.apiKey.slice(-4)}`;
        }
        console.log(`[Crawler] NewsAPI request (${lang}, ${batchDomains.length} domains):`, JSON.stringify(debugParams, null, 2));
        
        try {
          const response = await retryWithBackoff(async () => {
            return await axios.get(url, {
              params: langParams,
              timeout: 8000, // Timeout reducido a 8s
              httpsAgent,
              headers: {
                'User-Agent': 'LevántateCuba-RedactorIA/1.0 (+https://levantatecuba.com/contact)',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate'
              }
            });
          }, 1, 1000); // Solo 1 reintento para acelerar
        
          // Diagnóstico completo de respuesta
          console.log(`[Crawler] NewsAPI (${lang}) HTTP status: ${response.status}`);
          
          if (!response.data) {
            console.error(`[Crawler] NewsAPI (${lang}) devolvió respuesta vacía`);
            continue;
          }
          
          // Debug: mostrar respuesta completa si hay problemas
          if (response.data?.status === 'error') {
            console.error(`[Crawler] NewsAPI (${lang}) error:`, response.data);
            console.error(`[Crawler] Code:`, response.data.code, '| Message:', response.data.message);
            continue;
          }
        
          if (response.data?.articles !== undefined) {
            const totalResults = response.data.totalResults || 0;
            const articlesReceived = response.data.articles?.length || 0;
            
            console.log(`[Crawler] ✅ NewsAPI OK (${lang}, batch ${domainBatches.indexOf(batchDomains) + 1}/${domainBatches.length}): ${articlesReceived} artículos (total disponible: ${totalResults})`);
            
            if (totalResults === 0) {
              console.warn(`[Crawler] ⚠️  NewsAPI (${lang}) devolvió totalResults=0`);
            }
            
            const articles = response.data.articles.map(article => ({
              title: article.title,
              description: article.description,
              content: article.content || article.description,
              url: article.url,
              source: article.source,
              publishedAt: article.publishedAt,
              urlToImage: article.urlToImage
            }));
            
            allArticles.push(...articles);
          }
        } catch (error) {
          // Manejo de error 400/timeout: log y activar fallback RSS
          if (error.response?.status === 400) {
            console.error(`[Crawler] ❌ NewsAPI 400 Bad Request (${lang}, batch ${domainBatches.indexOf(batchDomains) + 1}/${domainBatches.length})`);
            console.error('[Crawler] URL query sin apiKey:', url + '?' + new URLSearchParams({
              ...langParams,
              apiKey: '***'
            }).toString());
            console.error('[Crawler] Domains en este batch:', batchDomains.slice(0, 10).join(', '), batchDomains.length > 10 ? `... (${batchDomains.length} total)` : '');
            console.error('[Crawler] Error message:', error.response?.data?.message || error.message);
            
            // Fallback RSS para estos dominios
            if (batchDomains.length > 0) {
              console.log(`[Crawler] 🔄 Activando fallback RSS → ${batchDomains.slice(0, 3).join(', ')}${batchDomains.length > 3 ? ` +${batchDomains.length - 3} más` : ''}`);
              try {
                const rssFallback = await scanRSSFallbackFast(batchDomains, { lang });
                allArticles.push(...rssFallback);
                console.log(`[Crawler] ✅ Fallback RSS: ${rssFallback.length} artículos recuperados`);
              } catch (rssError) {
                console.error('[Crawler] Fallback RSS también falló:', rssError.message);
              }
            }
          } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            console.warn(`[Crawler] ⏱️  NewsAPI timeout (${lang}, batch ${domainBatches.indexOf(batchDomains) + 1}) → RSS fallback`);
            if (batchDomains.length > 0) {
              try {
                const rssFallback = await scanRSSFallbackFast(batchDomains, { lang });
                allArticles.push(...rssFallback);
              } catch (rssError) {
                console.error('[Crawler] Fallback RSS falló:', rssError.message);
              }
            }
          } else {
            console.error(`[Crawler] Error en NewsAPI (${lang}):`, error.message);
          }
        }
      }
    }
    
    console.timeEnd('[Crawler] ⏱️  NewsAPI + RSS fallback');
    console.log(`[Crawler] NewsAPI total combinado: ${allArticles.length} artículos de ${domainBatches.length} batch(es) × ${languages.length} idioma(s)`);
    
    if (allArticles.length > 0) {
      // Los dominios ya fueron pre-filtrados en la query, no aplicar post-filtrado
      console.log(`[Crawler] ✅ Retornando ${allArticles.length} artículos (pre-filtrados por domains en query)`);
      return allArticles;
    }
    
    return [];
  } catch (error) {
    console.error('[Crawler] Error en NewsAPI:', error.message);
    return [];
  }
}

/**
 * Retry con backoff exponencial
 */
async function withRetry(fn, attempts = 3, delay = 800) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Fallback RSS optimizado con mapa de URLs conocidas
 * Usa KNOWN_RSS_FEEDS primero, luego discovery limitado
 * @param {Array<string>} domains - Lista de hostnames
 * @param {Object} options - Opciones { lang: 'es'|'en' }
 * @returns {Promise<Array>} Artículos de RSS encontrados
 */
async function scanRSSFallbackFast(domains, options = {}) {
  const articles = [];
  const UA = 'LevántateCuba-RedactorIA/1.0 (+https://levantatecuba.com/contact)';
  
  // URLs RSS comunes a probar (fallback si no está en mapa)
  const RSS_PATHS = ['/rss', '/feed', '/rss.xml', '/feed.xml'];
  
  // Limitar a 10 dominios para no saturar
  const domainsToTry = domains.slice(0, 10);
  
  for (const domain of domainsToTry) {
    // Verificar cache negativa
    const missTimestamp = RSS_MISS_CACHE.get(domain);
    if (missTimestamp && (Date.now() - missTimestamp) < RSS_CACHE_TTL) {
      continue; // Skip: sabemos que no tiene RSS
    }
    
    let foundFeed = false;
    let pathsToTry = [];
    
    // 1. Intentar URL conocida primero (sin discovery)
    if (KNOWN_RSS_FEEDS[domain]) {
      pathsToTry.push(KNOWN_RSS_FEEDS[domain]);
    } else {
      // 2. Discovery limitado solo si no está en mapa
      pathsToTry = RSS_PATHS;
    }
    
    for (const path of pathsToTry) {
      if (foundFeed) break;
      
      const feedUrl = `https://${domain}${path}`;
      
      try {
        const response = await axios.get(feedUrl, {
          timeout: 5000, // Timeout reducido a 5s
          httpsAgent,
          headers: {
            'User-Agent': UA,
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            'Accept-Encoding': 'gzip, deflate'
          },
          maxRedirects: 2,
          responseType: 'text',
          validateStatus: (status) => status === 200
        });
        
        if (!response.data || response.data.length < 100) continue;
        
        // Parser XML básico
        const xmlData = response.data;
        const itemMatches = xmlData.match(/<item[^>]*>([\s\S]*?)<\/item>/gi) || 
                           xmlData.match(/<entry[^>]*>([\s\S]*?)<\/entry>/gi) || [];
        
        if (itemMatches.length === 0) continue;
        
        itemMatches.slice(0, 5).forEach(itemXml => { // Max 5 artículos por feed
          try {
            const title = (itemXml.match(/<title[^>]*><!\[CDATA\[([^\]]+)\]\]><\/title>/) ||
                          itemXml.match(/<title[^>]*>([^<]+)<\/title>/))?.[1]?.trim();
            
            const link = (itemXml.match(/<link[^>]*><!\[CDATA\[([^\]]+)\]\]><\/link>/) ||
                         itemXml.match(/<link[^>]*>([^<]+)<\/link>/) ||
                         itemXml.match(/<link[^>]*href=["']([^"']+)["']/))?.[1]?.trim();
            
            const description = (itemXml.match(/<description[^>]*><!\[CDATA\[([^\]]+)\]\]><\/description>/) ||
                               itemXml.match(/<description[^>]*>([^<]+)<\/description>/) ||
                               itemXml.match(/<summary[^>]*>([^<]+)<\/summary>/))?.[1]?.trim();
            
            const pubDate = (itemXml.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/) ||
                            itemXml.match(/<published[^>]*>([^<]+)<\/published>/) ||
                            itemXml.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/))?.[1]?.trim();
            
            if (title && link) {
              articles.push({
                title: title.replace(/<!\[CDATA\[|\]\]>|<[^>]+>/g, '').trim(),
                description: description?.replace(/<!\[CDATA\[|\]\]>|<[^>]+>/g, '').substring(0, 500) || '',
                content: description?.replace(/<!\[CDATA\[|\]\]>|<[^>]+>/g, '') || '',
                url: link,
                source: { name: domain },
                publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                urlToImage: null
              });
            }
          } catch (err) {
            // Ignorar items mal formados
          }
        });
        
        if (itemMatches.length > 0) {
          foundFeed = true;
          // Actualizar mapa de feeds conocidos si era discovery
          if (!KNOWN_RSS_FEEDS[domain]) {
            KNOWN_RSS_FEEDS[domain] = path;
          }
        }
        
      } catch (error) {
        // Silenciar errores (probaremos la siguiente URL)
      }
    }
    
    if (!foundFeed) {
      // Añadir a cache negativa
      RSS_MISS_CACHE.set(domain, Date.now());
    }
  }
  
  return articles;
}

/**
 * Fallback RSS de medios cubanos prioritarios (cuando NewsAPI devuelve 0)
 * Con headers correctos, retry y manejo de encoding
 * @returns {Promise<Array>} Artículos de RSS cubanos
 */
async function scanCubanRSSFallback() {
  const CUBAN_FEEDS = [
    // Medios independientes y opositores (FUNCIONANDO)
    { url: 'https://www.martinoticias.com/api/epiqq', name: 'Martí Noticias' },
    { url: 'https://adncuba.com/rss.xml', name: 'ADN Cuba' },
    { url: 'https://www.diariodecuba.com/rss.xml', name: 'Diario de Cuba' },
    { url: 'https://www.cubanosporelmundo.com/feed/', name: 'Cubanos por el Mundo' }
    // EXCLUIDOS oficiales (blacklist): Trabajadores, Prensa Latina, Granma, Cubadebate
    // EXCLUIDOS por fallar (404 o 0 items):
    // - CiberCuba: 0 items
    // - 14yMedio: 404
    // - OnCuba: 0 items
  ];
  
  const articles = [];
  const UA = 'LevántateCubaBot/1.0 (+https://levantatecuba.com)';
  
  for (const feed of CUBAN_FEEDS) {
    try {
      console.log(`[RSS Fallback] Intentando: ${feed.name}`);
      
      // Fetch con retry y headers correctos
      const response = await withRetry(async () => {
        return await axios.get(feed.url, {
          timeout: 15000,
          headers: {
            'User-Agent': UA,
            'Accept': 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive'
          },
          maxRedirects: 5,
          responseType: 'text' // Importante para manejar encoding
        });
      }, 3, 1000);
      
      if (!response.data) {
        console.warn(`[RSS Fallback] ${feed.name}: respuesta vacía`);
        continue;
      }
      
      // Parser básico XML/RSS (sin dependencias externas)
      const xmlData = response.data;
      const itemMatches = xmlData.match(/<item[^>]*>([\s\S]*?)<\/item>/gi) || [];
      
      itemMatches.forEach(itemXml => {
        try {
          const title = (itemXml.match(/<title[^>]*><!\[CDATA\[([^\]]+)\]\]><\/title>/) ||
                        itemXml.match(/<title[^>]*>([^<]+)<\/title>/))?.[1]?.trim();
          
          const link = (itemXml.match(/<link[^>]*><!\[CDATA\[([^\]]+)\]\]><\/link>/) ||
                       itemXml.match(/<link[^>]*>([^<]+)<\/link>/))?.[1]?.trim();
          
          const description = (itemXml.match(/<description[^>]*><!\[CDATA\[([^\]]+)\]\]><\/description>/) ||
                             itemXml.match(/<description[^>]*>([^<]+)<\/description>/))?.[1]?.trim();
          
          const pubDate = (itemXml.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/) ||
                          itemXml.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/))?.[1]?.trim();
          
          if (title && link) {
            articles.push({
              title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
              description: description?.replace(/<!\[CDATA\[|\]\]>/g, '').substring(0, 500) || '',
              content: description?.replace(/<!\[CDATA\[|\]\]>/g, '') || '',
              url: link,
              source: { name: feed.name },
              publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
              urlToImage: null
            });
          }
        } catch (err) {
          // Ignorar items mal formados
        }
      });
      
      console.log(`[RSS Fallback] ${feed.name}: ${itemMatches.length} items extraídos`);
      
    } catch (error) {
      console.warn(`[RSS Fallback] Error en ${feed.name}:`, error.message);
    }
  }
  
  console.info(`[RSS Fallback] Total de artículos obtenidos: ${articles.length}`);
  if (articles.length === 0) {
    console.warn('[RSS Fallback] ⚠️  No se pudo obtener ningún artículo. Verifica:');
    console.warn('  1. Conectividad de red del servidor (firewall/DNS)');
    console.warn('  2. Ejecuta: curl https://www.cubadebate.cu/feed/ desde el host');
    console.warn('  3. Certificados SSL actualizados (ca-certificates)');
  }
  
  return articles;
}

/**
 * Escanea feeds RSS configurados
 */
async function scanRSSFeeds(config) {
  const articles = [];
  
  for (const feed of config.rssWhitelist || []) {
    if (!feed.enabled) continue;
    
    // Si enforceSourceAllowlist está activo, verificar que el feed esté en trustedSources
    if (config.enforceSourceAllowlist && config.trustedSources?.length > 0) {
      try {
        const hostname = new URL(feed.url).hostname.replace('www.', '');
        const isAllowed = config.trustedSources.some(domain => 
          hostname === domain || hostname.endsWith(`.${domain}`)
        );
        if (!isAllowed) {
          console.log(`[Crawler] Modo estricto: RSS ${feed.nombre} ignorado (no está en trustedSources)`);
          continue;
        }
      } catch (e) {
        console.error(`[Crawler] URL inválida en RSS ${feed.nombre}`);
        continue;
      }
    }
    
    try {
      // Aquí se podría usar un parser RSS como 'rss-parser'
      // Por ahora, placeholder
      console.log(`[Crawler] RSS: ${feed.nombre} (implementar parser)`);
    } catch (error) {
      console.error(`[Crawler] Error en RSS ${feed.nombre}:`, error.message);
    }
  }
  
  return articles;
}

/**
 * Agrupa artículos similares en temas
 */
function groupIntoTopics(articles, config) {
  if (articles.length === 0) return [];
  
  const topics = [];
  const used = new Set();
  
  articles.forEach((article, index) => {
    if (used.has(index)) return;
    
    // Buscar artículos similares
    const similar = [article];
    used.add(index);
    
    for (let j = index + 1; j < articles.length; j++) {
      if (used.has(j)) continue;
      
      if (areSimilar(article, articles[j])) {
        similar.push(articles[j]);
        used.add(j);
      }
    }
    
    // Crear tema
    if (similar.length > 0) {
      topics.push(createTopic(similar));
    }
  });
  
  return topics;
}

/**
 * Determina si dos artículos son similares
 */
function areSimilar(a1, a2) {
  const title1 = (a1.title || '').toLowerCase();
  const title2 = (a2.title || '').toLowerCase();
  
  // Extraer palabras clave significativas (>4 caracteres)
  const words1 = title1.split(/\s+/).filter(w => w.length > 4);
  const words2 = title2.split(/\s+/).filter(w => w.length > 4);
  
  // Contar palabras en común
  let commonWords = 0;
  words1.forEach(w => {
    if (words2.includes(w)) commonWords++;
  });
  
  // Si >50% de palabras en común, son similares
  const similarity = commonWords / Math.max(words1.length, words2.length);
  return similarity > 0.5;
}

/**
 * Crea un tema a partir de artículos agrupados
 */
function createTopic(articles) {
  // Usar el título del artículo más reciente como sugerido
  const sorted = articles.sort((a, b) => 
    new Date(b.publishedAt) - new Date(a.publishedAt)
  );
  
  const mainArticle = sorted[0];
  
  // Crear resumen combinando descripciones
  const descriptions = articles
    .map(a => a.description)
    .filter(d => d && d.length > 20);
  
  const resumenBreve = descriptions[0]?.substring(0, 400) || 
    mainArticle.title || 
    'Sin descripción disponible';
  
  // Categoría sugerida basada en keywords
  const categoriaSugerida = suggestCategory(mainArticle);
  
  // Extraer URL de imagen (prioridad: urlToImage > primer artículo con imagen)
  let imageUrl = mainArticle.urlToImage || null;
  if (!imageUrl) {
    for (const art of articles) {
      if (art.urlToImage) {
        imageUrl = art.urlToImage;
        break;
      }
    }
  }
  
  return {
    tituloSugerido: mainArticle.title,
    resumenBreve,
    categoriaSugerida,
    imageUrl, // URL de imagen original
    sources: articles, // Para cálculo de impacto
    fuentesTop: articles.slice(0, 5).map(a => ({
      medio: a.source?.name || 'Desconocido',
      titulo: a.title,
      url: a.url,
      fecha: new Date(a.publishedAt)
    }))
  };
}

/**
 * Sugiere categoría basada en contenido
 * Prioriza Tecnología y Tendencia sobre Política
 */
function suggestCategory(article) {
  const text = `${article.title} ${article.description || ''}`.toLowerCase();
  
  // Keywords por categoría con PESOS diferenciados (Tendencia/Tech tienen mayor peso)
  const categoryKeywords = {
    // ALTA PRIORIDAD: Tendencias virales y tecnológicas (peso x2)
    'Tendencia': {
      weight: 2.0,
      keywords: [
        'viral', 'trending', 'tiktok', 'instagram', 'youtube', 'meme', 'challenge',
        'influencer', 'youtuber', 'streamer', 'celebridad', 'escándalo', 'polémica',
        'millones de vistas', 'rompe internet', 'fenómeno', 'boom', 'explosión',
        'outage', 'caída masiva', 'netflix', 'spotify', 'gaming', 'videojuego',
        'trailer', 'lanzamiento', 'filtrado', 'leak', 'buzz', 'controversia'
      ]
    },
    'Tecnología': {
      weight: 2.0,
      keywords: [
        'tecnología', 'tech', 'ia', 'inteligencia artificial', 'chatgpt', 'openai',
        'bitcoin', 'cripto', 'criptomoneda', 'blockchain', 'ethereum', 'web3',
        'iphone', 'android', 'apple', 'google', 'microsoft', 'tesla', 'meta',
        'hack', 'ciberseguridad', 'breach', 'vulnerabilidad', 'ransomware',
        'startup', 'app', 'software', 'hardware', 'cloud', 'digital'
      ]
    },
    // MEDIA PRIORIDAD: Categorías tradicionales (peso x1)
    'Internacional': {
      weight: 1.0,
      keywords: ['eeuu', 'internacional', 'onu', 'diplomacia', 'relaciones', 'mundial', 'global']
    },
    'Economía': {
      weight: 1.0,
      keywords: ['economía', 'dólar', 'comercio', 'empresa', 'inversión', 'crisis económica', 'mercado', 'bolsa']
    },
    'Socio político': {
      weight: 1.0,
      keywords: ['protestas', 'disidentes', 'derechos humanos', 'represión', 'libertad', 'activismo']
    },
    // BAJA PRIORIDAD: Política (peso x0.7)
    'Política': {
      weight: 0.7,
      keywords: ['gobierno', 'presidente', 'política', 'elecciones', 'partido', 'ministro', 'congreso']
    }
  };
  
  let bestCategory = 'General';
  let maxScore = 0;
  
  Object.entries(categoryKeywords).forEach(([category, config]) => {
    const keywords = config.keywords;
    const weight = config.weight;
    
    // Contar matches y aplicar peso
    const matches = keywords.reduce((sum, kw) => 
      sum + (text.includes(kw) ? 1 : 0), 0
    );
    const weightedScore = matches * weight;
    
    if (weightedScore > maxScore) {
      maxScore = weightedScore;
      bestCategory = category;
    }
  });
  
  return bestCategory;
}

/**
 * Actualiza estadísticas para sugerencias
 */
async function updateStatistics(config, topicsCount) {
  const stats = config.statistics || {};
  
  // Calcular promedio móvil simple
  const avgTopics = stats.avgTopicsPerScan 
    ? (stats.avgTopicsPerScan * 0.7 + topicsCount * 0.3)
    : topicsCount;
  
  await AiConfig.findOneAndUpdate(
    { singleton: true },
    { 
      'statistics.avgTopicsPerScan': Math.round(avgTopics),
      'statistics.lastOptimizationSuggestion': new Date()
    }
  );
}

module.exports = {
  scanSources,
  scanNewsAPI,
  groupIntoTopics
};
