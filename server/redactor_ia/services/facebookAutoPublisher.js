// server/redactor_ia/services/facebookAutoPublisher.js

const AiConfig = require('../../models/AiConfig');
const News = require('../../models/News');
const { publishNewsToFacebook } = require('../../services/facebookPublisher');

/**
 * Servicio de programación automática de publicaciones en Facebook
 * 
 * FUNCIONAMIENTO:
 * - Busca AUTOMÁTICAMENTE todas las noticias publicadas que NO estén en Facebook
 * - Las publica en orden cronológico (más antiguas primero)
 * - Respeta intervalo configurado, franja horaria y límite diario
 * - NO requiere selección manual de noticias
 */

/**
 * Construye el filtro base para identificar candidatos de Facebook
 * 
 * IMPORTANTE: Esta función define la lógica ÚNICA de "candidato para Facebook"
 * y debe usarse tanto en:
 * - El scheduler automático de Facebook (este archivo)
 * - El panel de administración cuando se filtra por "FB pendientes"
 * 
 * Un candidato es una noticia que:
 * - Está publicada en el sitio (status === 'published')
 * - NO ha sido publicada en Facebook (publishedToFacebook === false o no existe)
 * - NO tiene estado de compartido en Facebook (facebook_status === 'not_shared' o no existe)
 * 
 * @returns {Object} Filtro MongoDB para candidatos de Facebook
 */
function buildFacebookCandidatesFilter() {
  return {
    status: 'published',
    $and: [
      {
        $or: [
          { publishedToFacebook: false },
          { publishedToFacebook: { $exists: false } }
        ]
      },
      {
        $or: [
          { facebook_status: 'not_shared' },
          { facebook_status: { $exists: false } }
        ]
      }
    ]
  };
}

/**
 * Verifica si UNA noticia específica es candidata para Facebook
 * APLICA LAS MISMAS REGLAS DE FRESCURA QUE EL SCHEDULER
 * 
 * IMPORTANTE: Esta función debe replicar EXACTAMENTE la lógica de getNextCandidate()
 * incluyendo los filtros de antigüedad por categoría.
 * 
 * @param {Object} news - Objeto noticia con sus campos
 * @returns {Boolean} true si es candidata, false si no
 */
function isNewsAFacebookCandidate(news) {
  if (!news) return false;
  
  // Debe estar publicada en el sitio
  if (news.status !== 'published') return false;
  
  // NO debe estar publicada en Facebook
  if (news.publishedToFacebook === true) return false;
  
  // El estado de Facebook debe ser 'not_shared' o no existir
  // Esto excluye: 'published', 'sharing', 'error', 'deleted'
  if (news.facebook_status && news.facebook_status !== 'not_shared') {
    return false;
  }
  
  // ========================================
  // FILTROS DE FRESCURA (IGUAL QUE SCHEDULER)
  // ========================================
  const now = new Date();
  const publishedAt = news.publishedAt ? new Date(news.publishedAt) : null;
  
  if (!publishedAt) return false; // Sin fecha de publicación
  
  const ageInMs = now - publishedAt;
  const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
  
  // Evergreen: siempre candidato (sin límite de antigüedad)
  if (news.isEvergreen === true) {
    return true;
  }
  
  const categoria = news.categoria || '';
  
  // Cuba: hasta 7 días
  if (categoria === 'Cuba') {
    return ageInDays <= 7;
  }
  
  // Tendencia: hasta 7 días
  if (categoria === 'Tendencia') {
    return ageInDays <= 7;
  }
  
  // Tecnología: hasta 7 días
  if (categoria === 'Tecnología') {
    return ageInDays <= 7;
  }
  
  // Otras categorías: hasta 5 días
  return ageInDays <= 5;
}

/**
 * Verifica si estamos dentro de la franja horaria configurada
 * @param {Number} startHour - Hora de inicio (0-23)
 * @param {Number} endHour - Hora de fin (0-23)
 * @returns {Boolean}
 */
function isWithinTimeWindow(startHour, endHour) {
  const now = new Date();
  const currentHour = now.getHours();
  
  // Si startHour === endHour, está activo 24/7
  if (startHour === endHour) {
    return true;
  }
  
  // Si la franja NO cruza medianoche (ej. 9-23)
  if (startHour < endHour) {
    return currentHour >= startHour && currentHour < endHour;
  }
  
  // Si la franja cruza medianoche (ej. 22-6)
  return currentHour >= startHour || currentHour < endHour;
}

/**
 * Cuenta cuántas publicaciones se hicieron hoy en Facebook
 * @returns {Promise<Number>}
 */
async function countTodayPublications() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const count = await News.countDocuments({
    facebookPublishedAt: { $gte: startOfDay },
    publishedToFacebook: true
  });
  
  return count;
}

/**
 * Obtiene la próxima noticia candidata para publicar en Facebook
 * ALGORITMO DE PRIORIDAD CON REGLAS DE FRESCURA:
 * 
 * 1. CUBA HOY (día actual)
 * 2. CUBA ÚLTIMAS 48H
 * 3. CUBA RECIENTES (hasta 7 días)
 * 4. TENDENCIA RECIENTES (últimos 3 días)
 * 5. TENDENCIA (hasta 7 días)
 * 6. TECNOLOGÍA (hasta 7 días)
 * 7. OTRAS CATEGORÍAS (últimos 5 días)
 * 8. EVERGREEN (sin límite de antigüedad)
 * 
 * REGLA DE FRESCURA: 
 * - Noticias "normales" no publicar con más de 7 días
 * - EXCEPCIÓN: isEvergreen=true permite publicar sin límite de antigüedad
 * 
 * @returns {Promise<Object|null>}
 */
async function getNextCandidate() {
  const now = new Date();
  
  // Calcular ventanas de tiempo
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  
  const last48Hours = new Date(now);
  last48Hours.setHours(now.getHours() - 48);
  
  const last3Days = new Date(now);
  last3Days.setDate(now.getDate() - 3);
  
  const last5Days = new Date(now);
  last5Days.setDate(now.getDate() - 5);
  
  const last7Days = new Date(now);
  last7Days.setDate(now.getDate() - 7);
  
  // Query base: usar filtro único de candidatos de Facebook
  const baseQuery = buildFacebookCandidatesFilter();
  
  // ====================
  // 1. CUBA HOY
  // ====================
  let candidate = await News.findOne({
    ...baseQuery,
    categoria: 'Cuba',
    publishedAt: { $gte: startOfToday }
  })
  .sort({ publishedAt: 1, _id: 1 }) // Más antiguas primero
  .lean();
  
  if (candidate) {
    console.log('[FacebookAutoPublisher] 🇨🇺 Candidato CUBA HOY encontrado');
    return candidate;
  }
  
  // ====================
  // 2. CUBA ÚLTIMAS 48H
  // ====================
  candidate = await News.findOne({
    ...baseQuery,
    categoria: 'Cuba',
    publishedAt: { $gte: last48Hours, $lt: startOfToday }
  })
  .sort({ publishedAt: 1, _id: 1 })
  .lean();
  
  if (candidate) {
    console.log('[FacebookAutoPublisher] 🇨🇺 Candidato CUBA 48H encontrado');
    return candidate;
  }
  
  // ====================
  // 3. CUBA RECIENTES (hasta 7 días)
  // ====================
  candidate = await News.findOne({
    ...baseQuery,
    categoria: 'Cuba',
    publishedAt: { $gte: last7Days, $lt: last48Hours }
  })
  .sort({ publishedAt: 1, _id: 1 })
  .lean();
  
  if (candidate) {
    console.log('[FacebookAutoPublisher] 🇨🇺 Candidato CUBA 7 DÍAS encontrado');
    return candidate;
  }
  
  // ====================
  // 4. TENDENCIA RECIENTES (últimos 3 días)
  // ====================
  candidate = await News.findOne({
    ...baseQuery,
    categoria: 'Tendencia',
    publishedAt: { $gte: last3Days }
  })
  .sort({ publishedAt: 1, _id: 1 })
  .lean();
  
  if (candidate) {
    console.log('[FacebookAutoPublisher] 📈 Candidato TENDENCIA 3 DÍAS encontrado');
    return candidate;
  }
  
  // ====================
  // 5. TENDENCIA (hasta 7 días)
  // ====================
  candidate = await News.findOne({
    ...baseQuery,
    categoria: 'Tendencia',
    publishedAt: { $gte: last7Days, $lt: last3Days }
  })
  .sort({ publishedAt: 1, _id: 1 })
  .lean();
  
  if (candidate) {
    console.log('[FacebookAutoPublisher] 📈 Candidato TENDENCIA 7 DÍAS encontrado');
    return candidate;
  }
  
  // ====================
  // 6. TECNOLOGÍA (hasta 7 días)
  // ====================
  candidate = await News.findOne({
    ...baseQuery,
    categoria: 'Tecnología',
    publishedAt: { $gte: last7Days }
  })
  .sort({ publishedAt: 1, _id: 1 })
  .lean();
  
  if (candidate) {
    console.log('[FacebookAutoPublisher] 💻 Candidato TECNOLOGÍA 7 DÍAS encontrado');
    return candidate;
  }
  
  // ====================
  // 7. OTRAS CATEGORÍAS (últimos 5 días)
  // ====================
  candidate = await News.findOne({
    ...baseQuery,
    categoria: { $nin: ['Cuba', 'Tendencia', 'Tecnología'] },
    publishedAt: { $gte: last5Days }
  })
  .sort({ publishedAt: 1, _id: 1 })
  .lean();
  
  if (candidate) {
    console.log('[FacebookAutoPublisher] 📰 Candidato OTRAS CATEGORÍAS 5 DÍAS encontrado');
    return candidate;
  }
  
  // ====================
  // 8. EVERGREEN (sin límite de antigüedad)
  // ====================
  candidate = await News.findOne({
    ...baseQuery,
    isEvergreen: true
  })
  .sort({ publishedAt: 1, _id: 1 })
  .lean();
  
  if (candidate) {
    console.log('[FacebookAutoPublisher] ♾️ Candidato EVERGREEN encontrado');
    return candidate;
  }
  
  // No hay candidatos disponibles
  return null;
}

/**
 * Calcula si ya pasó suficiente tiempo desde la última publicación
 * @param {Date} lastPublishedAt - Última vez que se publicó
 * @param {Number} intervalMinutes - Intervalo configurado en minutos
 * @returns {Boolean}
 */
function shouldPublishNow(lastPublishedAt, intervalMinutes) {
  if (!lastPublishedAt) {
    return true; // Primera publicación
  }
  
  const now = new Date();
  const elapsed = (now - lastPublishedAt) / 1000 / 60; // minutos transcurridos
  
  return elapsed >= intervalMinutes;
}

/**
 * Ejecuta el ciclo de publicación automática en Facebook
 * Esta función debe ser llamada periódicamente (cada 1-2 minutos) por el scheduler global
 * @returns {Promise<Object>} Resultado de la ejecución
 */
async function runFacebookAutoPublisher() {
  const logPrefix = '[FacebookAutoPublisher]';
  
  try {
    // 1. Leer configuración
    const config = await AiConfig.getSingleton();
    const fbConfig = config.facebookScheduler || {};
    
    // Si está desactivado, no hacer nada
    if (!fbConfig.enabled) {
      console.log(`${logPrefix} Programación automática desactivada, saltando.`);
      return { 
        success: false, 
        reason: 'disabled',
        message: 'Programación automática desactivada' 
      };
    }
    
    console.log(`${logPrefix} 🚀 Iniciando ciclo de publicación automática en Facebook`);
    console.log(`${logPrefix} Configuración: intervalo=${fbConfig.intervalMinutes}min, franja=${fbConfig.startHour}:00-${fbConfig.endHour}:00, maxPerDay=${fbConfig.maxPerDay}`);
    
    // 2. Verificar franja horaria
    if (!isWithinTimeWindow(fbConfig.startHour, fbConfig.endHour)) {
      const currentHour = new Date().getHours();
      console.log(`${logPrefix} ⏰ Fuera de franja horaria (actual: ${currentHour}:00, franja: ${fbConfig.startHour}:00-${fbConfig.endHour}:00)`);
      return { 
        success: false, 
        reason: 'outside_time_window',
        message: 'Fuera de la franja horaria configurada',
        currentHour,
        startHour: fbConfig.startHour,
        endHour: fbConfig.endHour
      };
    }
    
    // 3. Verificar límite diario
    if (fbConfig.maxPerDay > 0) {
      const todayCount = await countTodayPublications();
      console.log(`${logPrefix} 📊 Publicaciones hoy: ${todayCount} / ${fbConfig.maxPerDay}`);
      
      if (todayCount >= fbConfig.maxPerDay) {
        console.log(`${logPrefix} 🛑 Límite diario alcanzado (${todayCount}/${fbConfig.maxPerDay})`);
        return { 
          success: false, 
          reason: 'daily_limit_reached',
          message: 'Límite diario de publicaciones alcanzado',
          todayCount,
          maxPerDay: fbConfig.maxPerDay
        };
      }
    }
    
    // 4. Verificar intervalo de tiempo
    if (!shouldPublishNow(fbConfig.lastPublishedAt, fbConfig.intervalMinutes)) {
      const elapsed = fbConfig.lastPublishedAt 
        ? Math.floor((new Date() - fbConfig.lastPublishedAt) / 1000 / 60)
        : 0;
      console.log(`${logPrefix} ⏱️ Intervalo no alcanzado (${elapsed}/${fbConfig.intervalMinutes} min)`);
      return { 
        success: false, 
        reason: 'interval_not_reached',
        message: 'Aún no ha pasado el intervalo configurado',
        elapsedMinutes: elapsed,
        requiredMinutes: fbConfig.intervalMinutes
      };
    }
    
    // 5. Buscar candidato
    const candidate = await getNextCandidate();
    
    if (!candidate) {
      console.log(`${logPrefix} 📭 No hay candidatos disponibles`);
      return { 
        success: false, 
        reason: 'no_candidates',
        message: 'No hay noticias candidatas para publicar en Facebook'
      };
    }
    
    console.log(`${logPrefix} 📰 Candidato encontrado: "${candidate.titulo}" (ID: ${candidate._id})`);
    console.log(`${logPrefix} 📅 Publicada en sitio: ${candidate.publishedAt}`);
    
    // 6. Publicar en Facebook
    try {
      console.log(`${logPrefix} 🔄 Publicando en Facebook...`);
      
      const result = await publishNewsToFacebook(candidate, {
        autoPublish: true // Flag para indicar que es automático
      });
      
      console.log(`${logPrefix} ✅ Publicado exitosamente`);
      console.log(`${logPrefix} FB Post ID: ${result.fbPostId}`);
      console.log(`${logPrefix} Permalink: ${result.permalink}`);
      
      // 7. Marcar como publicado
      await News.findByIdAndUpdate(candidate._id, {
        publishedToFacebook: true,
        facebookPublishedAt: new Date(),
        facebook_status: 'published',
        facebook_post_id: result.fbPostId,
        facebook_permalink_url: result.permalink
      });
      
      // 8. Actualizar timestamp en configuración
      await AiConfig.findOneAndUpdate(
        { singleton: true },
        { 'facebookScheduler.lastPublishedAt': new Date() }
      );
      
      console.log(`${logPrefix} 🎉 Ciclo completado exitosamente`);
      
      return {
        success: true,
        newsId: candidate._id,
        newsTitle: candidate.titulo,
        fbPostId: result.fbPostId,
        permalink: result.permalink,
        message: 'Noticia publicada exitosamente en Facebook'
      };
      
    } catch (publishError) {
      console.error(`${logPrefix} ❌ Error al publicar en Facebook:`, publishError.message);
      
      // No marcar como publicado si falla
      // Registrar error en la noticia
      await News.findByIdAndUpdate(candidate._id, {
        facebook_last_error: publishError.message,
        $inc: { facebook_attempt_count: 1 }
      });
      
      return {
        success: false,
        reason: 'publish_error',
        message: `Error al publicar: ${publishError.message}`,
        newsId: candidate._id,
        error: publishError.message
      };
    }
    
  } catch (error) {
    console.error(`${logPrefix} ❌ Error en ciclo de publicación:`, error);
    return {
      success: false,
      reason: 'system_error',
      message: `Error del sistema: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Obtiene un resumen del estado actual de la programación automática
 * Incluye desglose por categoría según la lógica de prioridad
 * @returns {Promise<Object>}
 */
async function getFacebookScheduleSummary() {
  const config = await AiConfig.getSingleton();
  const fbConfig = config.facebookScheduler || {};
  
  const now = new Date();
  
  // Calcular ventanas de tiempo
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  
  const last48Hours = new Date(now);
  last48Hours.setHours(now.getHours() - 48);
  
  const last3Days = new Date(now);
  last3Days.setDate(now.getDate() - 3);
  
  const last5Days = new Date(now);
  last5Days.setDate(now.getDate() - 5);
  
  const last7Days = new Date(now);
  last7Days.setDate(now.getDate() - 7);
  
  // Query base: usar filtro único de candidatos de Facebook
  const baseQuery = buildFacebookCandidatesFilter();
  
  // Contar candidatos por categoría (respetando límites de frescura)
  const cubaToday = await News.countDocuments({
    ...baseQuery,
    categoria: 'Cuba',
    publishedAt: { $gte: startOfToday }
  });
  
  const cuba48h = await News.countDocuments({
    ...baseQuery,
    categoria: 'Cuba',
    publishedAt: { $gte: last48Hours, $lt: startOfToday }
  });
  
  const cuba7d = await News.countDocuments({
    ...baseQuery,
    categoria: 'Cuba',
    publishedAt: { $gte: last7Days, $lt: last48Hours }
  });
  
  const tendencia3d = await News.countDocuments({
    ...baseQuery,
    categoria: 'Tendencia',
    publishedAt: { $gte: last3Days }
  });
  
  const tendencia7d = await News.countDocuments({
    ...baseQuery,
    categoria: 'Tendencia',
    publishedAt: { $gte: last7Days, $lt: last3Days }
  });
  
  const tecnologia = await News.countDocuments({
    ...baseQuery,
    categoria: 'Tecnología',
    publishedAt: { $gte: last7Days }
  });
  
  const otrasCateg = await News.countDocuments({
    ...baseQuery,
    categoria: { $nin: ['Cuba', 'Tendencia', 'Tecnología'] },
    publishedAt: { $gte: last5Days }
  });
  
  const evergreen = await News.countDocuments({
    ...baseQuery,
    isEvergreen: true
  });
  
  const totalCandidates = cubaToday + cuba48h + cuba7d + tendencia3d + tendencia7d + tecnologia + otrasCateg + evergreen;
  
  // Contar publicados hoy
  const todayCount = await countTodayPublications();
  
  // Calcular próximo slot teórico
  let nextSlot = null;
  if (fbConfig.enabled && fbConfig.lastPublishedAt) {
    const next = new Date(fbConfig.lastPublishedAt);
    next.setMinutes(next.getMinutes() + fbConfig.intervalMinutes);
    nextSlot = next;
  }
  
  return {
    enabled: fbConfig.enabled || false,
    intervalMinutes: fbConfig.intervalMinutes || 30,
    startHour: fbConfig.startHour || 9,
    endHour: fbConfig.endHour || 23,
    maxPerDay: fbConfig.maxPerDay || 0,
    candidatesCount: totalCandidates,
    candidatesByPriority: {
      cubaToday,
      cuba48h,
      cuba7d,
      tendencia3d,
      tendencia7d,
      tecnologia,
      otrasCateg,
      evergreen
    },
    publishedToday: todayCount,
    lastPublishedAt: fbConfig.lastPublishedAt,
    nextSlotTheoretical: nextSlot,
    isWithinTimeWindow: isWithinTimeWindow(fbConfig.startHour || 9, fbConfig.endHour || 23)
  };
}

module.exports = {
  runFacebookAutoPublisher,
  getFacebookScheduleSummary,
  isWithinTimeWindow,
  countTodayPublications,
  getNextCandidate,
  buildFacebookCandidatesFilter, // Exportar para uso en otros módulos
  isNewsAFacebookCandidate // Exportar para verificar noticias individuales
};
