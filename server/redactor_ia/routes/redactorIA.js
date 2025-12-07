// server/redactor_ia/routes/redactorIA.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const verifyToken = require('../../middleware/verifyToken');
const verifyRole = require('../../middleware/verifyRole');
const AiTopic = require('../../models/AiTopic');
const AiDraft = require('../../models/AiDraft');
const AiConfig = require('../../models/AiConfig');
const AiCategoryFeedback = require('../../models/AiCategoryFeedback');
const News = require('../../models/News');
const { scanSources } = require('../services/crawler');
const { scanCubaStrict } = require('../services/cubaStrictScanner');
const { generateDrafts, generateImageForDraft } = require('../services/redactor');
const { publishDraftToNews } = require('../services/publishDraftHelper');
const { restartScheduler, getSchedulerStatus } = require('../utils/scheduler');
const { generateDraftFromUrl } = require('../services/urlDraftGenerator');
const { saveBase64Png } = require('../services/mediaStore');
const { processNewsImage } = require('../../services/imageProcessor');
const { getUsageStats } = require('../services/statsService');
const { generateRevision, applyRevision, getRevisionStatus } = require('../services/reviewService');
const crypto = require('crypto');
const categories = require('../config/categories');
const { imageGenerationQueue, getAllQueueStats } = require('../../utils/operationQueue');
const { notifyNewNews } = require('../../services/indexNow');

// Rate limiting para operaciones costosas
const scanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // 5 escaneos por minuto
  message: { error: 'Demasiadas solicitudes de escaneo. Intenta en 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false
});

const generateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20, // 20 generaciones por minuto
  message: { error: 'Demasiadas solicitudes de generación. Intenta en 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter específico para imágenes (más restrictivo)
const imageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 6, // 6 imágenes por minuto máximo
  message: { error: 'Demasiadas solicitudes de generación de imágenes. Espera un momento.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware para extraer tenantId
const extractTenant = async (req, res, next) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (tenantId) {
      req.tenantId = tenantId;
    } else {
      const config = await AiConfig.getSingleton();
      req.tenantId = config.defaultTenant || 'levantatecuba';
    }
    next();
  } catch (error) {
    req.tenantId = 'levantatecuba';
    next();
  }
};

// Middleware: solo admins y editores + tenant
const requireEditor = [verifyToken, extractTenant, (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'editor') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}];

// ==================== SCAN ====================

/**
 * POST /api/redactor-ia/scan
 * Ejecuta escaneo manual de fuentes (SCAN_ONLY)
 * Si strictCuba está activado, usa escaneo Cuba estricto (CiberCuba, ElToque, Martí Noticias)
 */
router.post('/scan', scanLimiter, requireEditor, async (req, res) => {
  try {
    const config = await AiConfig.getSingleton();
    
    if (config.isScanning) {
      return res.status(429).json({ 
        ok: false,
        code: 'SCAN_IN_PROGRESS',
        message: 'Ya hay un escaneo en curso',
        isScanning: true 
      });
    }
    
    // Marcar como escaneando
    await AiConfig.findOneAndUpdate(
      { singleton: true },
      { isScanning: true }
    );
    
    // Decidir flujo de escaneo basado en configuración
    const strictCuba = config.strictCuba || false;
    const maxTopicsPerScan = config.maxTopicsPerScan || 20;
    
    if (strictCuba) {
      // FLUJO CUBA ESTRICTO: Escaneo directo de fuentes cubanas
      console.log('[API] 🔒 Iniciando escaneo Cuba estricto...');
      
      scanCubaStrict({ 
        limit: maxTopicsPerScan,
        hoursWindow: 48 
      })
        .then(result => {
          console.log(`[API] ✅ Escaneo Cuba estricto completado: ${result.count} temas guardados`);
          console.log(`[API] 📋 Fuentes: CiberCuba, ElToque, Martí Noticias`);
        })
        .catch(err => {
          console.error('[API] ❌ Error en escaneo Cuba estricto:', err);
        })
        .finally(async () => {
          // Desmarcar como escaneando
          await AiConfig.findOneAndUpdate(
            { singleton: true },
            { isScanning: false }
          );
        });
      
      res.json({ 
        ok: true,
        message: 'Escaneo Cuba estricto iniciado',
        mode: 'cuba_estricto',
        isScanning: true,
        sources: ['CiberCuba', 'ElToque', 'Martí Noticias']
      });
      
    } else {
      // FLUJO NORMAL: Escaneo global con NewsAPI + RSS
      console.log('[API] 🌐 Iniciando escaneo global...');
      
      scanSources()
        .then(result => {
          console.log('[API] ✅ Escaneo global completado:', result.length || result.topicsFound || 0, 'temas');
        })
        .catch(err => {
          console.error('[API] ❌ Error en escaneo global:', err);
        })
        .finally(async () => {
          // Desmarcar como escaneando
          await AiConfig.findOneAndUpdate(
            { singleton: true },
            { isScanning: false }
          );
        });
      
      res.json({ 
        ok: true,
        message: 'Escaneo global iniciado',
        mode: 'global',
        isScanning: true 
      });
    }
    
  } catch (error) {
    console.error('[API] Error iniciando escaneo:', error);
    
    // Asegurar desmarcar isScanning en caso de error
    await AiConfig.findOneAndUpdate(
      { singleton: true },
      { isScanning: false }
    );
    
    // Manejo específico de errores con códigos
    const statusCode = error.statusCode || 500;
    const errorCode = error.code || 'SCAN_ERROR';
    
    res.status(statusCode).json({ 
      ok: false,
      code: errorCode,
      message: error.message || 'Error al iniciar escaneo' 
    });
  }
});

/**
 * GET /api/redactor-ia/scan/status
 * Obtiene estado del escaneo actual
 */
router.get('/scan/status', requireEditor, async (req, res) => {
  try {
    const status = await getSchedulerStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estado' });
  }
});

/**
 * GET /api/redactor-ia/queue/status
 * Obtiene estado de las colas de operaciones pesadas
 */
router.get('/queue/status', requireEditor, async (req, res) => {
  try {
    const stats = getAllQueueStats();
    res.json({
      success: true,
      queues: stats,
      serverMemory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estado de colas' });
  }
});

// ==================== TOPICS ====================

/**
 * GET /api/redactor-ia/topics
 * Lista temas detectados (Cola de temas)
 * Query params: status, minImpact, confianza, categoria, desde, hasta
 */
router.get('/topics', requireEditor, async (req, res) => {
  try {
    const {
      status = 'pending',
      minImpact,
      confianza,
      categoria,
      desde,
      hasta,
      page = 1,
      limit = 20
    } = req.query;
    
    const query = { 
      tenantId: req.tenantId,
      status: { $ne: 'archived' } // Excluir archivados por defecto
    };
    
    // Filtros
    if (status && status !== 'pending') query.status = status;
    if (minImpact) query.impacto = { $gte: parseInt(minImpact) };
    if (confianza) query.confianza = confianza;
    if (categoria && categoria !== 'Todas') query.categoriaSugerida = categoria;
    
    // Rango temporal
    if (desde || hasta) {
      query.detectedAt = {};
      if (desde) query.detectedAt.$gte = new Date(desde);
      if (hasta) query.detectedAt.$lte = new Date(hasta);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [topics, total] = await Promise.all([
      AiTopic.find(query)
        .sort({ impacto: -1, detectedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('selectedBy', 'nombre email'),
      AiTopic.countDocuments(query)
    ]);
    
    res.json({
      topics,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
    
  } catch (error) {
    console.error('[API] Error obteniendo temas:', error);
    res.status(500).json({ error: 'Error al obtener temas' });
  }
});

/**
 * GET /api/redactor-ia/topics/:id
 * Obtiene detalle de un tema
 */
router.get('/topics/:id', requireEditor, async (req, res) => {
  try {
    const topic = await AiTopic.findOne({ idTema: req.params.id })
      .populate('selectedBy', 'nombre email');
    
    if (!topic) {
      return res.status(404).json({ error: 'Tema no encontrado' });
    }
    
    res.json(topic);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tema' });
  }
});

/**
 * DELETE /api/redactor-ia/topics/:id
 * Archiva un tema (soft delete)
 */
router.delete('/topics/:id', requireEditor, async (req, res) => {
  try {
    const topic = await AiTopic.findOneAndUpdate(
      { idTema: req.params.id },
      { 
        status: 'archived',
        archivedAt: new Date()
      },
      { new: true }
    );
    
    if (!topic) {
      return res.status(404).json({ error: 'Tema no encontrado' });
    }
    
    res.json({ message: 'Tema archivado', topic });
  } catch (error) {
    res.status(500).json({ error: 'Error al archivar tema' });
  }
});

/**
 * DELETE /api/redactor-ia/topics/queue
 * Archiva todos los temas de la cola (soft delete masivo)
 * Query params: mode, olderThan
 */
router.delete('/topics/queue', requireEditor, async (req, res) => {
  try {
    const { mode, olderThan } = req.query;
    
    const query = { 
      tenantId: req.tenantId,
      status: { $ne: 'archived' }
    };
    
    if (mode) query.mode = mode;
    if (olderThan) query.createdAt = { $lte: new Date(olderThan) };
    
    const now = new Date();
    const result = await AiTopic.updateMany(
      query,
      { 
        $set: { 
          status: 'archived',
          archivedAt: now 
        } 
      }
    );
    
    console.log(`[RedactorIA] Cola limpiada: ${result.modifiedCount} temas archivados`);
    
    res.json({ 
      ok: true, 
      matched: result.matchedCount || result.n || 0,
      modified: result.modifiedCount || result.nModified || 0
    });
  } catch (error) {
    console.error('[RedactorIA] Error limpiando cola:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * DELETE /api/redactor-ia/topics
 * Archiva temas seleccionados (soft delete por IDs)
 * Body: { ids: [] }
 */
router.delete('/topics', requireEditor, async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ ok: false, error: 'Array de IDs requerido' });
    }
    
    const now = new Date();
    const result = await AiTopic.updateMany(
      { 
        idTema: { $in: ids },
        tenantId: req.tenantId
      },
      { 
        $set: { 
          status: 'archived',
          archivedAt: now 
        } 
      }
    );
    
    console.log(`[RedactorIA] Temas seleccionados archivados: ${result.modifiedCount}`);
    
    res.json({ 
      ok: true,
      modified: result.modifiedCount || result.nModified || 0
    });
  } catch (error) {
    console.error('[RedactorIA] Error archivando seleccionados:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== GENERATE ====================

/** @feature: Formato "Lectura Viva" para artículos largos — Oct 2025 **/
/**
 * POST /api/redactor-ia/generate
 * Genera borradores a partir de temas seleccionados (GENERATE_ON_SELECTION)
 * Body: { topicIds: [], mode: 'factual'|'opinion', formatStyle?: 'standard'|'lectura_viva' }
 */
router.post('/generate', generateLimiter, requireEditor, async (req, res) => {
  try {
    const { topicIds, mode = 'factual', formatStyle = 'standard' } = req.body;
    
    if (!topicIds || !Array.isArray(topicIds) || topicIds.length === 0) {
      return res.status(400).json({ 
        ok: false, 
        code: 'INVALID_INPUT',
        error: 'Se requiere array de topicIds' 
      });
    }
    
    if (!['factual', 'opinion'].includes(mode)) {
      return res.status(400).json({ 
        ok: false,
        code: 'INVALID_MODE',
        error: 'Modo inválido (factual|opinion)' 
      });
    }
    
    if (!['standard', 'lectura_viva'].includes(formatStyle)) {
      return res.status(400).json({ 
        ok: false,
        code: 'INVALID_FORMAT',
        error: 'Formato inválido (standard|lectura_viva)' 
      });
    }
    
    // Generar borradores (esto verifica el lock inmediatamente)
    // Si hay lock, lanza error antes de comenzar el trabajo
    const drafts = await generateDrafts(topicIds, req.user, mode, formatStyle);
    
    console.log(`[API] ${drafts.length} borradores generados por ${req.user.email} (formato: ${formatStyle})`);
    
    res.json({ 
      ok: true,
      message: `${drafts.length} borrador${drafts.length > 1 ? 'es' : ''} generado${drafts.length > 1 ? 's' : ''} exitosamente`,
      count: drafts.length,
      topicIds,
      mode,
      formatStyle
    });
    
  } catch (error) {
    console.error('[API] Error iniciando generación:', error);
    
    // Manejo específico de errores con códigos
    const statusCode = error.statusCode || 500;
    const errorCode = error.code || 'GENERATION_ERROR';
    
    res.status(statusCode).json({ 
      ok: false,
      code: errorCode,
      message: error.message || 'Error al iniciar generación' 
    });
  }
});

// ==================== DRAFTS ====================

/**
 * GET /api/redactor-ia/drafts
 * Lista borradores generados (Borradores IA)
 * Query params: status, mode, categoria, reviewStatus, desde, hasta
 */
router.get('/drafts', requireEditor, async (req, res) => {
  try {
    const {
      status = 'draft',
      mode,
      categoria,
      reviewStatus,
      desde,
      hasta,
      mine,
      page = 1,
      limit = 20
    } = req.query;
    
    // Estado fijo: solo borradores (no publicados/archivados)
    const query = { 
      tenantId: req.tenantId,
      status: 'draft'
    };
    
    // Normalizar MODE: lowercase, soportar 'all'/'todos'
    const normalizedMode = (mode || 'all').toLowerCase().trim();
    if (normalizedMode !== 'all' && normalizedMode !== 'todos' && normalizedMode !== '') {
      query.mode = normalizedMode; // 'factual' o 'opinion'
    }
    
    // Normalizar REVIEW: lowercase, soportar 'all'/'todos'
    const normalizedReview = (reviewStatus || 'all').toLowerCase().trim();
    if (normalizedReview !== 'all' && normalizedReview !== 'todos' && normalizedReview !== '') {
      query.reviewStatus = normalizedReview; // 'pending', 'approved', etc.
    }
    
    // Normalizar CATEGORIA: case-insensitive, soportar 'all'/'todas'
    const normalizedCat = (categoria || '').trim();
    if (normalizedCat && 
        normalizedCat.toLowerCase() !== 'all' && 
        normalizedCat.toLowerCase() !== 'todas' &&
        normalizedCat !== '') {
      query.categoria = normalizedCat;
    }
    
    // Filtro opcional por autor (solo si mine=true)
    if (mine === 'true' && req.user?._id) {
      query.generatedBy = req.user._id;
    }
    
    // Rango temporal
    if (desde || hasta) {
      query.createdAt = {};
      if (desde) query.createdAt.$gte = new Date(desde);
      if (hasta) query.createdAt.$lte = new Date(hasta);
    }
    
    // Paginación: asegurar valores enteros válidos
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const skip = (pageNum - 1) * limitNum;
    
    // Orden: recién actualizados primero (para que aparezcan tras generar imagen)
    const sort = { updatedAt: -1, _id: -1 };
    
    // Log detallado para debugging
    console.log(`[DraftsList] query=${JSON.stringify(query)} page=${pageNum} limit=${limitNum} mode=${normalizedMode} review=${normalizedReview}`);
    
    // Ejecutar queries en paralelo con timeout
    const [drafts, total] = await Promise.all([
      AiDraft.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('generatedBy', 'nombre email')
        .populate('reviewedBy', 'nombre email')
        .lean() // Mejora performance
        .maxTimeMS(10000), // Timeout 10s
      AiDraft.countDocuments(query).maxTimeMS(5000) // Timeout 5s
    ]);
    
    // Calcular withCovers de forma segura (no bloqueante)
    const withCovers = drafts.filter(d => d.coverUrl || d.coverImageUrl).length;
    
    // Log de resultados
    console.log(`[DraftsList] count=${drafts.length}/${total} withCovers=${withCovers} page=${pageNum} limit=${limitNum}`);
    
    // SIEMPRE devolver respuesta consistente (incluso con 0 resultados)
    const response = {
      drafts: drafts || [],
      total: total || 0,
      page: pageNum,
      limit: limitNum,
      pages: total > 0 ? Math.ceil(total / limitNum) : 0,
      withCovers
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('[API] Error obteniendo borradores:', error);
    console.error('[API] Error stack:', error.stack);
    
    // SIEMPRE devolver respuesta (nunca dejar colgado al cliente)
    res.status(500).json({ 
      error: 'Error al obtener borradores',
      drafts: [],
      total: 0,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
      pages: 0,
      withCovers: 0
    });
  }
});

/**
 * GET /api/redactor-ia/drafts/:id
 * Obtiene detalle de un borrador
 */
router.get('/drafts/:id', requireEditor, async (req, res) => {
  try {
    const draft = await AiDraft.findById(req.params.id)
      .populate('generatedBy', 'nombre email')
      .populate('reviewedBy', 'nombre email')
      .populate('publishedAs');
    
    if (!draft) {
      return res.status(404).json({ error: 'Borrador no encontrado' });
    }
    
    res.json(draft);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener borrador' });
  }
});

/**
 * PATCH /api/redactor-ia/drafts/:id
 * Actualiza un borrador (edición manual)
 */
router.patch('/drafts/:id', requireEditor, async (req, res) => {
  try {
    const allowedFields = [
      'titulo', 'bajada', 'categoria', 'etiquetas',
      'contenidoMarkdown', 'contenidoHTML', 'status'
    ];
    
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    const draft = await AiDraft.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!draft) {
      return res.status(404).json({ error: 'Borrador no encontrado' });
    }
    
    res.json({ message: 'Borrador actualizado', draft });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar borrador' });
  }
});

/**
 * POST /api/redactor-ia/drafts/:id/generate-image
 * Genera imagen para un borrador usando la MISMA configuración que generación automática
 * Body: 
 *   - {} (vacío) = usa config automática con contexto completo
 *   - { mode: 'custom_prompt', prompt: 'text' } = usa prompt manual del usuario
 * 
 * PROTECCIÓN: Rate limit + cola de operaciones para evitar sobrecarga
 */
router.post('/drafts/:id/generate-image', imageLimiter, requireEditor, async (req, res) => {
  const draftId = req.params.id;
  
  try {
    // Normalizar userId: extraer solo ObjectId, nunca objeto completo
    const mongoose = require('mongoose');
    const userIdRaw = req.user?.id || req.user?._id || req.auth?.sub || null;
    const userId = (userIdRaw && mongoose.isValidObjectId(userIdRaw)) ? userIdRaw : null;
    
    const { mode, prompt } = req.body;
    
    // Verificar si hay muchas operaciones en cola
    const pendingOps = imageGenerationQueue.getPendingCount();
    if (pendingOps >= 5) {
      console.warn(`[API:Image] ⚠️ Cola saturada (${pendingOps} pendientes). Rechazando petición.`);
      return res.status(503).json({
        success: false,
        ok: false,
        error: 'El servidor está procesando muchas imágenes. Intenta en unos segundos.',
        queueStatus: { pending: pendingOps }
      });
    }
    
    console.log(`[API:Manual] Generando imagen (cola: ${pendingOps} pendientes). Usuario: ${req.user?.email || 'unknown'}, mode: ${mode || 'auto'}`);
    
    // Si es modo custom_prompt, usar el prompt del usuario
    let customPrompt = null;
    if (mode === 'custom_prompt' && prompt && typeof prompt === 'string') {
      customPrompt = prompt.trim();
      console.log(`[API:Manual] Usando prompt manual: "${customPrompt.substring(0, 100)}..."`);
    }
    
    // Encolar la operación de generación de imagen
    const draft = await imageGenerationQueue.enqueue(
      async () => {
        return await generateImageForDraft(
          draftId,
          null,  // providerOverride = null → usa config automática
          false, // force = false
          customPrompt ? 'custom_prompt' : 'auto', // mode
          userId, // Pasar solo ObjectId válido o null
          customPrompt ? { customPrompt } : {} // Pasar prompt manual si existe
        );
      },
      { timeout: 120000 } // 2 minutos máximo por imagen
    );
    
    // Devolver draft con populates para el frontend
    const populated = await AiDraft.findById(draft._id)
      .populate('generatedBy', 'nombre email')
      .populate('reviewedBy', 'nombre email');
    
    /** @fix Claude 4.5 – Corrección flujo de imágenes procesadas Redactor IA (2025-10) */
    res.json({ 
      success: true,
      ok: true, 
      message: populated.imageKind === 'ai' ? 'Imagen generada con IA' : 'Cover procesado localmente',
      imageUrl: populated.coverUrl || populated.coverImageUrl || '',
      cover: populated.coverUrl || populated.coverImageUrl || '',
      coverHash: populated.coverHash || '',
      coverKind: populated.imageKind || 'processed',
      imageKind: populated.imageKind || 'processed',
      provider: populated.aiMetadata?.imageProvider || 'internal',
      usedSource: false, // Siempre procesada localmente, nunca hotlink
      hash: populated.coverHash || '',
      draftId: String(populated._id),
      draft: populated 
    });
  } catch (error) {
    console.error('[API] Error generando imagen:', error);
    console.error('[API] Error stack:', error.stack);
    
    // Determinar mensaje de error más específico
    let errorMessage = error.message || 'Error al generar imagen';
    let statusCode = 500;
    
    // Detectar errores específicos
    if (error.code === 'HAILUO_NO_IMAGE_URL' || error.code === 'NO_IMAGE_URL') {
      errorMessage = error.message; // Usar mensaje específico del error
      statusCode = 422; // Unprocessable Entity - el proveedor rechazó el contenido
    } else if (error.message?.includes('429') || error.status === 429) {
      errorMessage = 'Límite de tasa excedido. Intenta de nuevo en unos momentos.';
      statusCode = 429;
    } else if (error.message?.includes('allowlist') || error.message?.includes('bloqueado')) {
      errorMessage = 'Dominio de fuente bloqueado por política de allowlist.';
      statusCode = 403;
    } else if (error.message?.includes('locale is not defined')) {
      errorMessage = 'Error de configuración interna (locale). Contacta soporte.';
    } else if (error.message?.includes('timeout') || error.message?.includes('excedió')) {
      errorMessage = 'La generación tardó demasiado. Intenta de nuevo.';
      statusCode = 504;
    }
    
    res.status(statusCode).json({ 
      success: false, 
      ok: false, 
      error: errorMessage,
      reason: error.message,
      provider: 'unknown',
      draftId: draftId
    });
  }
});

/**
 * POST /api/redactor-ia/drafts/:id/capture-cover-from-source
 * Captura la imagen principal desde el sitio web original de la noticia
 * Extrae og:image u otra imagen destacada y la procesa localmente
 * 
 * PROTECCIÓN: Rate limit + cola de operaciones para evitar sobrecarga
 */
router.post('/drafts/:id/capture-cover-from-source', imageLimiter, requireEditor, async (req, res) => {
  try {
    const draft = await AiDraft.findById(req.params.id);
    if (!draft) {
      return res.status(404).json({ 
        success: false, 
        ok: false, 
        error: 'Borrador no encontrado' 
      });
    }

    // Obtener URL de la noticia original desde las fuentes
    const fuentes = draft.fuentes || [];
    if (!fuentes.length || !fuentes[0].url) {
      return res.status(400).json({ 
        success: false, 
        ok: false, 
        error: 'No hay URL de fuente disponible para capturar imagen' 
      });
    }

    const sourceUrl = fuentes[0].url;
    console.log(`[API:Capture] Capturando imagen desde: ${sourceUrl}`);

    // Usar el mismo flujo que providerInternal en imageProvider.js
    const { generateWithProvider } = require('../services/imageProvider');
    
    const result = await generateWithProvider({
      provider: 'internal',
      mode: 'extract',
      draftId: draft._id,
      draft: draft,
      topic: null
    });

    // 🐛 FIX: Verificar que realmente capturó la imagen (no placeholder ni fallback a IA)
    if (!result.ok || result.kind !== 'processed') {
      const errorMsg = result.error || 
        (result.kind === 'placeholder' ? 'No se encontró imagen válida en el sitio de la noticia' : 'No se pudo capturar la imagen desde el sitio');
      
      console.error(`[API:Capture] ❌ Captura fallida: ${errorMsg}`);
      
      return res.status(422).json({ 
        success: false, 
        ok: false, 
        error: errorMsg,
        provider: 'internal',
        kind: result.kind || 'unknown'
      });
    }

    // Actualizar el borrador con la nueva portada
    draft.coverUrl = result.coverUrl || result.url;
    draft.coverFallbackUrl = result.coverFallbackUrl || '';
    draft.coverHash = result.coverHash || '';
    draft.imageKind = result.kind || 'processed';
    
    // Guardar URLs originales para regeneración si se pierde la imagen
    draft.originalImageUrl = result.originalImageUrl || null;
    draft.originalImageSource = result.originalImageSource || sourceUrl;
    
    if (!draft.aiMetadata) {
      draft.aiMetadata = {};
    }
    draft.aiMetadata.imageProvider = 'internal';
    draft.aiMetadata.capturedFromSource = true;
    draft.aiMetadata.sourceUrl = sourceUrl;

    await draft.save();

    // Devolver draft actualizado con populates
    const populated = await AiDraft.findById(draft._id)
      .populate('generatedBy', 'nombre email')
      .populate('reviewedBy', 'nombre email');

    console.log(`[API:Capture] ✅ Imagen capturada exitosamente desde: ${sourceUrl}`);
    console.log(`[API:Capture] kind=${result.kind} coverUrl=${populated.coverUrl}`);

    res.json({ 
      success: true,
      ok: true, 
      message: 'Imagen capturada exitosamente',
      imageUrl: populated.coverUrl || '',
      cover: populated.coverUrl || '',
      coverHash: populated.coverHash || '',
      imageKind: populated.imageKind || 'processed',
      provider: 'internal',
      hash: populated.coverHash || '',
      draftId: String(populated._id),
      draft: populated 
    });
  } catch (error) {
    console.error('[API:Capture] Error capturando imagen:', error.message);
    console.error('[API:Capture] Error code:', error.code);
    
    // Determinar código de estado y mensaje apropiado
    let statusCode = 500;
    let errorMessage = error.message || 'Error al capturar imagen desde el sitio';
    
    // Errores user-facing del extractor de imágenes
    if (error.userFacing || 
        error.code === 'EXTRACT_FAILED' || 
        error.code === 'NO_SOURCE_URL' || 
        error.code === 'NO_VALID_IMAGE_FOUND' || 
        error.code === 'LOW_QUALITY_IMAGE') {
      statusCode = 422;
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({ 
      success: false, 
      ok: false, 
      error: errorMessage,
      code: error.code || 'UNKNOWN_ERROR',
      draftId: req.params.id
    });
  }
});

/**
 * PUT /api/redactor-ia/drafts/:id/review
 * Aprueba o solicita cambios en un borrador (flujo de revisión editorial)
 * Al aprobar, crea automáticamente una noticia en News con la portada persistida
 */
router.put('/drafts/:id/review', requireEditor, async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    // Validar status
    if (!['approved', 'changes_requested', 'changes_in_progress', 'changes_completed', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ ok: false, error: 'Estado de revisión inválido' });
    }
    
    const draft = await AiDraft.findById(req.params.id);
    if (!draft) {
      return res.status(404).json({ ok: false, error: 'Borrador no encontrado' });
    }
    
    // Actualizar campos de revisión
    draft.reviewStatus = status;
    draft.reviewedBy = req.user?._id || null;
    draft.reviewedAt = new Date();
    
    // Registrar fecha de aprobación específica
    if (status === 'approved' && !draft.approvedAt) {
      draft.approvedAt = new Date();
      // Guardar versión aprobada para futuras comparaciones
      draft.lastApprovedContent = draft.contenidoHTML || draft.contenidoMarkdown || '';
      // Limpiar lista de cambios solicitados
      draft.changesRequested = [];
    }
    
    if (typeof notes === 'string') {
      draft.reviewNotes = notes;
    }
    
    let createdNews = null;
    
    // Si se aprueba, crear/actualizar noticia
    if (status === 'approved') {
      try {
        // 1. Asegurar que la portada esté persistida
        let coverUrl = draft.coverImageUrl || '';
        
        // Si no hay coverUrl pero sí imagen generada, intentar persistir
        if (!coverUrl && draft.generatedImages?.principal) {
          const imgUrl = draft.generatedImages.principal;
          
          // Si es data URL (base64), persistir ahora
          if (imgUrl.startsWith('data:image/')) {
            const base64 = imgUrl.split(',')[1];
            const nameHash = crypto.createHash('sha1').update(`${draft._id}-${Date.now()}`).digest('hex');
            const filename = `draft_${nameHash}.png`;
            const saved = await saveBase64Png(base64, filename);
            coverUrl = saved.publicUrl;
            draft.coverImageUrl = coverUrl;
            draft.generatedImagesPersisted = draft.generatedImagesPersisted || {};
            draft.generatedImagesPersisted.principal = true;
            console.log(`[API] Imagen persistida al aprobar: ${coverUrl}`);
          } else {
            // Ya es URL permanente
            coverUrl = imgUrl;
          }
        }
        
        // 2. Obtener nombre del autor
        let autorNombre = 'Redactor IA';
        if (draft.generatedBy) {
          const User = require('../../models/User');
          const user = await User.findById(draft.generatedBy);
          if (user) {
            autorNombre = user.nombre || user.email || 'Redactor IA';
          }
        }
        
        // 3. Crear o actualizar noticia
        if (draft.publishedAs) {
          // Actualizar noticia existente
          createdNews = await News.findByIdAndUpdate(
            draft.publishedAs,
            {
              titulo: draft.titulo,
              bajada: draft.bajada || '',
              contenido: draft.contenidoHTML || draft.contenidoMarkdown || '',
              categoria: draft.categoria || 'General',
              etiquetas: draft.etiquetas || [],
              imagen: coverUrl || '',
              autor: autorNombre,
              publishedAt: new Date(),
              mode: draft.mode || 'factual',
              aiMetadata: {
                categoryConfidence: draft.aiMetadata?.categoryConfidence || null,
                originalityScore: draft.aiMetadata?.originalityScore || null,
                contentOrigin: draft.aiMetadata?.contentOrigin || null,
                model: draft.aiMetadata?.model || '',
                generatedFrom: draft._id.toString(),
              },
            },
            { new: true }
          );
          console.log(`[API] Noticia actualizada: ${createdNews._id}`);
        } else {
          // Crear nueva noticia
          console.log('[API:Aprobar] Creando noticia con datos:', {
            titulo: draft.titulo?.substring(0, 50),
            categoria: draft.categoria,
            autor: autorNombre,
            imagen: coverUrl?.substring(0, 50),
            mode: draft.mode
          });
          
          createdNews = await News.create({
            titulo: draft.titulo,
            bajada: draft.bajada || '',
            contenido: draft.contenidoHTML || draft.contenidoMarkdown || '',
            imagen: coverUrl || '',
            categoria: draft.categoria || 'General',
            etiquetas: draft.etiquetas || [],
            autor: autorNombre,
            fecha: new Date(), // Campo legacy para compatibilidad
            publishedAt: new Date(),
            status: 'published',
            mode: draft.mode || 'factual',
            aiMetadata: {
              categoryConfidence: draft.aiMetadata?.categoryConfidence || null,
              originalityScore: draft.aiMetadata?.originalityScore || null,
              contentOrigin: draft.aiMetadata?.contentOrigin || null,
              model: draft.aiMetadata?.model || '',
              generatedFrom: draft._id.toString(),
            },
            imageOriginal: draft.sourceImageUrl || null,
            imageProcessed: false
          });
          
          console.log('[API:Aprobar] ✅ Noticia creada exitosamente:', createdNews._id);
          
          // 📡 Notificar a motores de búsqueda (IndexNow)
          notifyNewNews(createdNews).catch(err => 
            console.warn('[IndexNow] Error al notificar:', err.message)
          );
          
          // Procesar imagen real en background si hay URL
          if (draft.sourceImageUrl) {
            processNewsImage(createdNews._id.toString(), draft.sourceImageUrl)
              .then(result => {
                if (result.processed) {
                  News.findByIdAndUpdate(createdNews._id, {
                    imageProcessed: true,
                    processedAt: new Date()
                  }).catch(err => console.error('[API] Error actualizando imageProcessed:', err));
                }
              })
              .catch(err => console.error('[API] Error procesando imagen:', err));
          }
          
          draft.publishedAs = createdNews._id;
          console.log(`[API] Noticia creada: ${createdNews._id}`);
        }
        
        draft.publishedAt = new Date();
        draft.status = 'published';
        
      } catch (newsError) {
        console.error('[API:Aprobar] ❌ Error creando/actualizando noticia:', newsError.message);
        console.error('[API:Aprobar] Stack:', newsError.stack);
        // Reportar error pero continuar con la aprobación del borrador
        // La noticia no se creó pero el borrador queda aprobado
      }
    }
    
    await draft.save();
    
    // Devolver con populates
    const populated = await AiDraft.findById(draft._id)
      .populate('generatedBy', 'nombre email role')
      .populate('reviewedBy', 'nombre email role')
      .populate('publishedAs');
    
    const messages = {
      approved: createdNews 
        ? `Borrador aprobado y noticia publicada (ID: ${createdNews._id})` 
        : 'Borrador aprobado (⚠️ la noticia no se pudo crear)',
      changes_requested: 'Cambios solicitados',
      pending: 'Borrador devuelto a pendiente'
    };
    
    console.log(`[API:Review] Respuesta: status=${status}, newsCreated=${!!createdNews}`);
    
    res.json({ 
      ok: true, 
      message: messages[status] || 'Revisión actualizada',
      draft: populated,
      news: createdNews || undefined,
      newsCreated: !!createdNews // Flag explícito para el frontend
    });
  } catch (error) {
    console.error('[API] Error en revisión:', error);
    res.status(500).json({ ok: false, error: error.message || 'Error al procesar revisión' });
  }
});

/**
 * PUT /api/redactor-ia/drafts/:id/request-changes
 * Solicita cambios específicos en un borrador
 * Body: { items: string[], append?: boolean } - Lista de cambios solicitados
 */
router.put('/drafts/:id/request-changes', requireEditor, async (req, res) => {
  try {
    const { items, append = false } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: 'Se requiere array de cambios solicitados' });
    }
    
    const draft = await AiDraft.findById(req.params.id);
    if (!draft) {
      return res.status(404).json({ ok: false, error: 'Borrador no encontrado' });
    }
    
    // Guardar snapshot del contenido actual antes de solicitar cambios
    if (draft.contenidoHTML || draft.contenidoMarkdown) {
      draft.previousContent = draft.contenidoHTML || draft.contenidoMarkdown || '';
    }
    
    // Actualizar estado y lista de cambios
    draft.reviewStatus = 'changes_requested';
    
    // Si append=true, agregar a la lista existente (historial)
    if (append && Array.isArray(draft.changesRequested) && draft.changesRequested.length > 0) {
      draft.changesRequested = [...draft.changesRequested, ...items];
    } else {
      draft.changesRequested = items;
    }
    
    draft.reviewedBy = req.user?._id || null;
    draft.reviewedAt = new Date();
    
    await draft.save();
    
    const populated = await AiDraft.findById(draft._id)
      .populate('generatedBy', 'nombre email role')
      .populate('reviewedBy', 'nombre email role');
    
    res.json({
      ok: true,
      message: append ? 'Nuevos cambios agregados al historial' : 'Cambios solicitados registrados',
      draft: populated
    });
  } catch (error) {
    console.error('[API] Error solicitando cambios:', error);
    res.status(500).json({ ok: false, error: error.message || 'Error al solicitar cambios' });
  }
});

/**
 * PUT /api/redactor-ia/drafts/:id/status
 * Actualiza el estado de revisión de un borrador
 * Body: { reviewStatus: 'changes_in_progress' | 'changes_completed' | 'approved' | 'rejected' | 'pending' }
 */
router.put('/drafts/:id/status', requireEditor, async (req, res) => {
  try {
    const { reviewStatus } = req.body;
    
    const validStatuses = ['pending', 'changes_requested', 'changes_in_progress', 'changes_completed', 'approved', 'rejected'];
    if (!validStatuses.includes(reviewStatus)) {
      return res.status(400).json({ ok: false, error: 'Estado inválido' });
    }
    
    const draft = await AiDraft.findById(req.params.id);
    if (!draft) {
      return res.status(404).json({ ok: false, error: 'Borrador no encontrado' });
    }
    
    draft.reviewStatus = reviewStatus;
    await draft.save();
    
    const populated = await AiDraft.findById(draft._id)
      .populate('generatedBy', 'nombre email role')
      .populate('reviewedBy', 'nombre email role');
    
    res.json({
      ok: true,
      message: `Estado actualizado a: ${reviewStatus}`,
      draft: populated
    });
  } catch (error) {
    console.error('[API] Error actualizando estado:', error);
    res.status(500).json({ ok: false, error: error.message || 'Error al actualizar estado' });
  }
});

/**
 * GET /api/redactor-ia/drafts/:id/diff
 * Genera un diff visual entre versiones del contenido
 * Query: baseline=approved|previous|current (default: approved)
 */
router.get('/drafts/:id/diff', requireEditor, async (req, res) => {
  try {
    let { baseline = 'approved' } = req.query;
    const { createTwoFilesPatch } = require('diff');
    
    // Headers no-cache para evitar 304
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    const draft = await AiDraft.findById(req.params.id);
    if (!draft) {
      return res.status(404).json({ ok: false, error: 'Borrador no encontrado' });
    }
    
    const currentContent = (draft.contenidoHTML || draft.contenidoMarkdown || '').replace(/\r\n/g, '\n');
    let baselineContent = '';
    let baselineUsed = baseline;
    
    // Si pide current, comparar con review.proposed
    if (baseline === 'current' && draft.review?.proposed) {
      baselineContent = currentContent;
      const proposedContent = draft.review.proposed.replace(/\r\n/g, '\n');
      
      const patch = createTwoFilesPatch(
        'actual',
        'revisión IA',
        baselineContent,
        proposedContent,
        '',
        '',
        { context: 3 }
      );
      
      console.log(`[Diff] draft=${req.params.id} baseline=current source=${baselineContent.length} proposed=${proposedContent.length}`);
      
      return res.json({
        ok: true,
        patch,
        baseline: 'current',
        baselineUsed: 'current',
        hasBaseline: true,
        hasChanges: baselineContent !== proposedContent
      });
    }
    
    // Determinar baseline (approved o previous)
    if (baseline === 'approved' && draft.lastApprovedContent) {
      baselineContent = draft.lastApprovedContent.replace(/\r\n/g, '\n');
    } else if (baseline === 'approved' && !draft.lastApprovedContent) {
      // Fallback: si no hay approved, usar current
      baselineContent = currentContent;
      baselineUsed = 'current';
    } else if (baseline === 'previous' && draft.previousContent) {
      baselineContent = draft.previousContent.replace(/\r\n/g, '\n');
    } else if (!draft.lastApprovedContent && !draft.previousContent) {
      console.log(`[Diff] draft=${req.params.id} baseline=${baseline} NO_BASELINE`);
      return res.json({ 
        ok: true, 
        patch: '', 
        message: 'No hay versión base para comparar',
        hasBaseline: false,
        baselineUsed: 'none'
      });
    }
    
    // Generar diff unificado
    const patch = createTwoFilesPatch(
      'versión anterior',
      'versión actual',
      baselineContent,
      currentContent,
      '',
      '',
      { context: 3 }
    );
    
    console.log(`[Diff] draft=${req.params.id} baselineUsed=${baselineUsed} source=${baselineContent.length} current=${currentContent.length}`);
    
    res.json({
      ok: true,
      patch,
      baseline,
      baselineUsed,
      hasBaseline: true,
      hasChanges: baselineContent !== currentContent
    });
  } catch (error) {
    console.error('[API] Error generando diff:', error);
    res.status(500).json({ ok: false, error: error.message || 'Error al generar diff' });
  }
});

/**
 * POST /api/redactor-ia/drafts/:id/generate-changes
 * Genera propuesta de cambios aplicando instrucciones de reviewNote al contenido base
 * Body: { baseHtml: string, reviewNote: string, requestText?: string }
 */
router.post('/drafts/:id/generate-changes', requireEditor, async (req, res) => {
  try {
    const { baseHtml, reviewNote, requestText } = req.body;
    
    const draft = await AiDraft.findById(req.params.id);
    if (!draft) {
      return res.status(404).json({ ok: false, error: 'Borrador no encontrado' });
    }
    
    // Obtener instrucciones: prioridad requestText > reviewNote > draft.review.requestText
    const userRequest = requestText?.trim() || reviewNote?.trim() || 
                       (draft.changesRequested && draft.changesRequested.length > 0 
                         ? draft.changesRequested[draft.changesRequested.length - 1] 
                         : '');
    
    if (!userRequest) {
      return res.status(400).json({ 
        ok: false, 
        error: 'requestText o reviewNote es requerido. Especifica los cambios que deseas aplicar.' 
      });
    }
    
    // Base HTML: usar lo que viene en el body o el contenido actual del draft
    const currentContent = baseHtml?.trim() || draft.contenidoHTML || draft.contenidoMarkdown || '';
    
    if (!currentContent) {
      return res.status(400).json({ ok: false, error: 'baseHtml es requerido o el draft no tiene contenido' });
    }
    
    // Llamar a servicio de IA para generar propuesta
    const { generateChangesProposal } = require('../services/redactor');
    
    try {
      const proposedHtml = await generateChangesProposal(currentContent, userRequest);
      
      // Normalizar textos para comparación (quitar espacios, saltos de línea extras, etc.)
      const normalize = (html) => {
        return html
          .replace(/<[^>]+>/g, '') // Remover tags HTML
          .replace(/\s+/g, ' ')     // Colapsar whitespace
          .trim()
          .toLowerCase();
      };
      
      const normalizedCurrent = normalize(currentContent);
      const normalizedProposed = normalize(proposedHtml);
      
      // Detección de no-op: resultado idéntico o casi idéntico
      if (normalizedCurrent === normalizedProposed) {
        console.log(`[Redactor] generate-changes: no-op detected for draft ${req.params.id}`);
        return res.status(200).json({
          status: 'nochange',
          ok: false,
          message: 'La IA devolvió un resultado idéntico al actual. Ajusta la solicitud (sé más específico) o vuelve a intentar.',
          proposed: proposedHtml
        });
      }
      
      res.json({
        status: 'completed',
        ok: true,
        proposedHtml,
        message: 'Propuesta generada exitosamente'
      });
    } catch (aiError) {
      console.error('[API] Error generando propuesta con IA:', aiError);
      res.status(500).json({ 
        status: 'failed',
        ok: false, 
        error: 'Error al generar propuesta con IA',
        details: aiError.message 
      });
    }
  } catch (error) {
    console.error('[API] Error en generate-changes:', error);
    res.status(500).json({ 
      status: 'failed',
      ok: false, 
      error: error.message || 'Error al generar cambios' 
    });
  }
});

/**
 * PUT /api/redactor-ia/drafts/:id/apply-proposed
 * Aplica la propuesta generada al borrador persistiendo el contenido
 * Body: { contentHtml: string }
 */
router.put('/drafts/:id/apply-proposed', requireEditor, async (req, res) => {
  try {
    const { contentHtml } = req.body;
    
    if (!contentHtml || !contentHtml.trim()) {
      return res.status(400).json({ ok: false, error: 'contentHtml es requerido' });
    }
    
    const draft = await AiDraft.findById(req.params.id);
    if (!draft) {
      return res.status(404).json({ ok: false, error: 'Borrador no encontrado' });
    }
    
    // Guardar snapshot anterior si no existe
    if (!draft.previousContent && draft.contenidoHTML) {
      draft.previousContent = draft.contenidoHTML;
    }
    
    // Aplicar cambios
    draft.contenidoHTML = contentHtml;
    draft.reviewStatus = 'changes_completed';
    draft.updatedAt = new Date();
    
    await draft.save();
    
    // Devolver con populates
    const populated = await AiDraft.findById(draft._id)
      .populate('generatedBy', 'nombre email role')
      .populate('reviewedBy', 'nombre email role');
    
    res.json({
      ok: true,
      message: 'Cambios aplicados correctamente',
      draft: populated
    });
  } catch (error) {
    console.error('[API] Error aplicando propuesta:', error);
    res.status(500).json({ ok: false, error: error.message || 'Error al aplicar cambios' });
  }
});

/**
 * POST /api/redactor-ia/drafts/:id/publish
 * Publica un borrador aprobado como noticia
 * Body: { scheduleAt?: string(ISO), categoryOverride?: string, tagsOverride?: string[] }
 */
router.post('/drafts/:id/publish', requireEditor, async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduleAt, categoryOverride, tagsOverride } = req.body || {};

    const draft = await AiDraft.findById(id);
    if (!draft) {
      return res.status(404).json({ ok: false, error: 'Borrador no encontrado' });
    }

    // Solo publicar aprobados
    if (draft.reviewStatus !== 'approved') {
      return res.status(400).json({ 
        ok: false, 
        error: 'El borrador debe estar aprobado antes de publicar' 
      });
    }

    // Idempotencia: si ya tiene publishedAs (newsId), traer la noticia existente
    if (draft.publishedAs) {
      const existing = await News.findById(draft.publishedAs);
      if (existing) {
        return res.json({ 
          ok: true, 
          alreadyPublished: true, 
          news: existing, 
          draft 
        });
      }
    }

    // Validaciones mínimas
    if (!draft.titulo || draft.titulo.trim().length < 10) {
      return res.status(400).json({ 
        ok: false, 
        error: 'El borrador debe tener un título válido (≥10 caracteres)' 
      });
    }

    // Determinar autor del borrador (siempre usuario real, nunca genérico)
    let autorNombre = 'Redactor IA';
    if (req.user) {
      // Prioridad: alias público > nombre completo > nickname > name > email
      if (req.user.aliasPublico?.trim()) {
        autorNombre = req.user.aliasPublico.trim();
      } else if (req.user.firstName && req.user.lastName) {
        autorNombre = `${req.user.firstName} ${req.user.lastName}`.trim();
      } else if (req.user.nickname?.trim()) {
        autorNombre = req.user.nickname.trim();
      } else if (req.user.name?.trim()) {
        autorNombre = req.user.name.trim();
      } else if (req.user.email) {
        autorNombre = req.user.email.split('@')[0];
      }
    }

    // Usar función helper compartida con el scheduler
    const publishDate = scheduleAt ? new Date(scheduleAt) : new Date();
    const scheduleStatus = scheduleAt && new Date(scheduleAt) > new Date() ? 'en_cola' : 'published';
    
    const result = await publishDraftToNews(draft, {
      publishDate,
      categoryOverride,
      tagsOverride,
      autorNombre,
      scheduleStatus
    });

    console.log(`[RedactorIA] Borrador ${id} publicado como noticia ${result.news._id}`);

    // Devolver borrador poblado
    const populated = await AiDraft.findById(result.draft._id)
      .populate('generatedBy', 'nombre email role')
      .populate('reviewedBy', 'nombre email role')
      .populate('publishedAs');

    res.json({ 
      ok: true, 
      news: result.news, 
      draft: populated,
      alreadyPublished: result.alreadyPublished,
      message: scheduleAt ? 'Noticia programada correctamente' : 'Noticia publicada correctamente'
    });
  } catch (error) {
    console.error('[RedactorIA] Error publicando borrador:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * DELETE /api/redactor-ia/drafts/:id
 * Rechaza/elimina un borrador
 */
router.delete('/drafts/:id', requireEditor, async (req, res) => {
  try {
    const draft = await AiDraft.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true }
    );
    
    if (!draft) {
      return res.status(404).json({ error: 'Borrador no encontrado' });
    }
    
    res.json({ message: 'Borrador rechazado', draft });
  } catch (error) {
    res.status(500).json({ error: 'Error al rechazar borrador' });
  }
});

/**
 * POST /api/redactor-ia/category-feedback
 * Guarda feedback de corrección manual de categoría para aprendizaje del sistema
 */
router.post('/category-feedback', requireEditor, async (req, res) => {
  try {
    const { draftId, title, summary, originalCategory, chosenCategory, originalConfidence, tags, wasLowConfidence } = req.body;
    
    if (!title || !chosenCategory) {
      return res.status(400).json({ error: 'Faltan campos requeridos: title, chosenCategory' });
    }
    
    // Validar que la categoría elegida sea válida
    if (!categories.allowed.includes(chosenCategory)) {
      return res.status(400).json({ error: 'Categoría no válida', allowed: categories.allowed });
    }
    
    const feedback = await AiCategoryFeedback.createFeedback({
      draftId,
      title,
      summary: summary || '',
      originalCategory: originalCategory || 'General',
      chosenCategory,
      originalConfidence: originalConfidence || 0.5,
      createdBy: req.user._id,
      tags: tags || [],
      contentLength: (title + summary).length,
      wasLowConfidence: wasLowConfidence || false
    });
    
    console.log(`[API] Feedback de categoría guardado: ${originalCategory} → ${chosenCategory}`);
    
    res.json({ 
      ok: true, 
      message: 'Feedback guardado',
      feedback 
    });
  } catch (error) {
    console.error('[API] Error guardando feedback:', error);
    res.status(500).json({ error: 'Error al guardar feedback' });
  }
});

// ==================== CONFIG ====================

/**
 * GET /api/redactor-ia/config
 * Obtiene configuración actual
 */
router.get('/config', requireEditor, async (req, res) => {
  try {
    const config = await AiConfig.getSingleton();
    
    // Ocultar API keys sensibles
    const safeConfig = config.toObject();
    if (safeConfig.newsApiKey) {
      safeConfig.newsApiKey = '***' + safeConfig.newsApiKey.slice(-4);
    }
    
    // Limpiar allowlist de medios oficiales (UI debe ver lo que realmente se usa)
    const officialBlacklist = new Set([
      'granma.cu','trabajadores.cu','cubadebate.cu','prensa-latina.cu','prensalatina.cu',
      'acn.cu','ain.cu','jrebelde.cu','radiohc.cu'
    ]);
    const allowlistClean = Array.isArray(safeConfig.trustedSources)
      ? safeConfig.trustedSources.filter(d => !officialBlacklist.has(String(d).toLowerCase()))
      : [];
    safeConfig.trustedSources = allowlistClean;
    
    res.json(safeConfig);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

/**
 * PATCH /api/redactor-ia/config
 * Actualiza configuración (solo admin)
 */
router.patch('/config', verifyToken, verifyRole(['admin']), async (req, res) => {
  try {
    const allowedFields = [
      'scanFrequency',
      'autoGenerateImages',
      'autoCaptureImageFromSourceOnCreate', // Captura automática de imágenes del sitio
      'maxTopicsPerScan',
      'minSourcesForHighConfidence',
      'suggestOptimalFrequency',
      'rssWhitelist',
      'newsApiEnabled',
      'cubaKeywords',
      'strictCuba',
      'aiModel',
      'imageProvider',
      'impactWeights',
      'trustedSources',
      'enforceSourceAllowlist',
      'defaultTenant',
      'freshnessWindowHours',  // Ventana de tiempo para frescura
      'perSourceCap',          // Máximo de artículos por fuente
      'autoScheduleEnabled',   // Activar programación automática
      'autoScheduleInterval',  // Minutos entre publicaciones
      'autoScheduleStartHour', // Hora inicio franja horaria
      'autoScheduleEndHour',   // Hora fin franja horaria
      'facebookScheduler',     // Configuración de Facebook
      'debugGeneration'        // Debug: logging detallado de generación
    ];
    
    // Parseo seguro de valores
    const toInt = (v, def) => Number.isFinite(+v) ? +v : def;
    const toBool = (v, def) => (typeof v === 'boolean') ? v : (v === 'true' ? true : (v === 'false' ? false : def));
    
    // Obtener configuración actual para mutua exclusión
    const currentConfig = await AiConfig.getSingleton();
    
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        let value = req.body[field];
        
        // Parseo especial para campos numéricos y booleanos
        if (field === 'maxTopicsPerScan') {
          value = Math.max(1, Math.min(20, toInt(value, 8)));
        } else if (field === 'minSourcesForHighConfidence') {
          value = Math.max(1, Math.min(10, toInt(value, 3)));
        } else if (field === 'freshnessWindowHours') {
          value = Math.max(12, Math.min(168, toInt(value, 48))); // 12h - 7 días
        } else if (field === 'perSourceCap') {
          value = Math.max(1, Math.min(10, toInt(value, 5))); // 1-10 artículos
        } else if (field === 'autoScheduleInterval') {
          value = Math.max(5, Math.min(120, toInt(value, 10))); // 5-120 minutos
        } else if (field === 'autoScheduleStartHour' || field === 'autoScheduleEndHour') {
          value = Math.max(0, Math.min(23, toInt(value, field === 'autoScheduleStartHour' ? 7 : 23))); // 0-23
        } else if (['autoGenerateImages', 'autoCaptureImageFromSourceOnCreate', 'newsApiEnabled', 'strictCuba', 'enforceSourceAllowlist', 'suggestOptimalFrequency', 'autoScheduleEnabled', 'debugGeneration'].includes(field)) {
          value = toBool(value, false);
        }
        
        // Limpiar allowlist de medios oficiales antes de persistir
        if (field === 'trustedSources' && Array.isArray(value)) {
          const officialBlacklist = new Set([
            'granma.cu','trabajadores.cu','cubadebate.cu','prensa-latina.cu','prensalatina.cu',
            'acn.cu','ain.cu','jrebelde.ju','radiohc.cu'
          ]);
          const incoming = value.map(d => String(d).toLowerCase().trim());
          const dedup = [...new Set(incoming)].filter(d => d && !officialBlacklist.has(d));
          value = dedup;
          console.log(`[CONFIG] Allowlist limpiado: ${incoming.length} → ${dedup.length} (removidos: ${incoming.length - dedup.length})`);
        }
        
        updates[field] = value;
      }
    });
    
    // Lógica de exclusión mutua: solo un modo de imagen automática puede estar activo
    // Solo aplicar si realmente vienen cambios en estos campos
    // Preferencia: autoCaptureImageFromSourceOnCreate > autoGenerateImages
    const hasAutoCaptureInBody = req.body.autoCaptureImageFromSourceOnCreate !== undefined;
    const hasAutoGenerateInBody = req.body.autoGenerateImages !== undefined;
    
    if (hasAutoCaptureInBody || hasAutoGenerateInBody) {
      // Determinar valores finales (lo que viene en body o lo que ya está en BD)
      const finalAutoCapture = hasAutoCaptureInBody 
        ? toBool(req.body.autoCaptureImageFromSourceOnCreate, false)
        : currentConfig.autoCaptureImageFromSourceOnCreate || false;
      const finalAutoGenerate = hasAutoGenerateInBody
        ? toBool(req.body.autoGenerateImages, false)
        : currentConfig.autoGenerateImages || false;
      
      // Aplicar mutua exclusión solo si ambos intentan estar en true
      if (finalAutoCapture && finalAutoGenerate) {
        console.log('[CONFIG] ⚠️  Ambos modos de imagen automática activados. Priorizando captura del sitio.');
        updates.autoCaptureImageFromSourceOnCreate = true;
        updates.autoGenerateImages = false;
      } else if (finalAutoCapture && hasAutoCaptureInBody) {
        // Si se activa captura explícitamente, desactivar generación IA
        updates.autoCaptureImageFromSourceOnCreate = true;
        updates.autoGenerateImages = false;
      } else if (finalAutoGenerate && hasAutoGenerateInBody) {
        // Si se activa generación IA explícitamente, desactivar captura
        updates.autoGenerateImages = true;
        updates.autoCaptureImageFromSourceOnCreate = false;
      }
      // Si ambos son false, dejar que se guarden ambos en false (no forzar nada)
    }
    
    updates.updatedBy = req.user._id;
    
    console.log('[RedactorConfig] PATCH /config received');
    console.log('[RedactorConfig] Campos actualizados:', {
      scanFrequency: updates.scanFrequency,
      maxTopicsPerScan: updates.maxTopicsPerScan,
      strictCuba: updates.strictCuba,
      newsApiEnabled: updates.newsApiEnabled,
      enforceSourceAllowlist: updates.enforceSourceAllowlist,
      freshnessWindowHours: updates.freshnessWindowHours,
      perSourceCap: updates.perSourceCap,
      autoGenerateImages: updates.autoGenerateImages,
      autoCaptureImageFromSourceOnCreate: updates.autoCaptureImageFromSourceOnCreate,
      aiModel: updates.aiModel,
      imageProvider: updates.imageProvider
    });
    
    const config = await AiConfig.findOneAndUpdate(
      { singleton: true },
      updates,
      { new: true, runValidators: true }
    );
    
    // Si cambió la frecuencia, reiniciar scheduler
    if (req.body.scanFrequency) {
      await restartScheduler();
    }
    
    console.log('[RedactorConfig] ✅ Configuración guardada en MongoDB');
    console.log('[RedactorConfig] Config ID:', config._id);
    
    res.json({ 
      message: 'Configuración actualizada exitosamente', 
      config,
      updated: Object.keys(updates).filter(k => k !== 'updatedBy')
    });
  } catch (error) {
    console.error('[API] Error actualizando configuración:', error);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

/**
 * GET /api/redactor-ia/config/suggest-frequency
 * Obtiene sugerencia de frecuencia óptima
 */
router.get('/config/suggest-frequency', requireEditor, async (req, res) => {
  try {
    const config = await AiConfig.getSingleton();
    const suggested = config.calculateOptimalFrequency();
    
    res.json({
      current: config.scanFrequency,
      suggested,
      shouldChange: suggested !== config.scanFrequency,
      statistics: config.statistics
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al calcular sugerencia' });
  }
});

// ==================== STATS ====================

/**
 * GET /api/redactor-ia/stats
 * Obtiene estadísticas generales con métricas en tiempo real
 * Query params: from, to (fechas ISO para rango personalizado)
 */
router.get('/stats', requireEditor, async (req, res) => {
  try {
    const { from, to } = req.query;
    const tenantFilter = { tenantId: req.tenantId };
    
    // Obtener estadísticas de uso (con agregaciones en tiempo real)
    const usageStats = await getUsageStats({
      from,
      to,
      tenantId: req.tenantId
    });
    
    const [
      totalTopics,
      pendingTopics,
      totalDrafts,
      draftsByStatus,
      recentTopics,
      categoryFeedbackStats,
      categoryAccuracy
    ] = await Promise.all([
      AiTopic.countDocuments(tenantFilter),
      AiTopic.countDocuments({ ...tenantFilter, status: 'pending' }),
      AiDraft.countDocuments(tenantFilter),
      AiDraft.aggregate([
        { $match: tenantFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      AiTopic.find({ ...tenantFilter, status: 'pending' })
        .sort({ detectedAt: -1 })
        .limit(5)
        .select('tituloSugerido impacto confianza detectedAt'),
      // Stats de feedback de categorías (últimos 30 días)
      AiCategoryFeedback.getStats(30),
      // Calcular precisión: drafts sin corrección / total drafts
      AiDraft.countDocuments(tenantFilter)
        .then(async (total) => {
          const corrections = await AiCategoryFeedback.countDocuments({});
          const accuracy = total > 0 ? ((total - corrections) / total) * 100 : 0;
          return { total, corrections, accuracy: Math.round(accuracy * 10) / 10 };
        })
    ]);
    
    res.json({
      // Métricas de uso (nuevas - en tiempo real)
      usage: {
        avgTopicsPerScan: usageStats.avgTopicsPerScan,
        approvedDrafts: usageStats.approvedDrafts,
        avgCost: usageStats.avgCost,
        totalCost: usageStats.totalCost,
        totalScans: usageStats.totalScans,
        approvalRate: usageStats.approvalRate,
        costsByType: usageStats.costsByType,
        range: usageStats.range
      },
      
      // Métricas existentes
      topics: {
        total: totalTopics,
        pending: pendingTopics
      },
      drafts: {
        total: totalDrafts,
        byStatus: draftsByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      },
      categories: {
        feedbackStats: categoryFeedbackStats,
        accuracy: categoryAccuracy,
        allowedCategories: categories.allowed
      },
      recentTopics
    });
  } catch (error) {
    console.error('[API] Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// ==================== DIAGNOSTICS (dev only) ====================

/**
 * GET /api/redactor-ia/diagnostics
 * Estadísticas de rendimiento (últimas 24h)
 */
router.get('/diagnostics', verifyToken, verifyRole(['admin']), async (req, res) => {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [recentDrafts, recentTopics] = await Promise.all([
      AiDraft.find({ generatedAt: { $gte: yesterday } })
        .select('aiMetadata generatedAt'),
      AiTopic.find({ detectedAt: { $gte: yesterday } })
        .select('impacto confianza detectedAt')
    ]);
    
    const totalTokens = recentDrafts.reduce((sum, d) => sum + (d.aiMetadata?.tokensUsed || 0), 0);
    const avgGenerationTime = recentDrafts.length > 0
      ? recentDrafts.reduce((sum, d) => sum + (d.aiMetadata?.generationTime || 0), 0) / recentDrafts.length
      : 0;
    
    const confidenceDistribution = {
      Alta: recentTopics.filter(t => t.confianza === 'Alta').length,
      Media: recentTopics.filter(t => t.confianza === 'Media').length,
      Baja: recentTopics.filter(t => t.confianza === 'Baja').length
    };
    
    res.json({
      period: '24h',
      draftsGenerated: recentDrafts.length,
      topicsDetected: recentTopics.length,
      totalTokens,
      avgGenerationTimeMs: Math.round(avgGenerationTime),
      confidenceDistribution,
      estimatedCost: {
        tokens: totalTokens,
        usd: (totalTokens * 0.003 / 1000).toFixed(4) // Estimación aproximada
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener diagnósticos' });
  }
});

/**
 * GET /api/redactor-ia/diagnostics/crawler
 * Diagnóstico completo del crawler NewsAPI (Fase 2)
 */
router.get('/diagnostics/crawler', verifyToken, verifyRole(['admin']), async (req, res) => {
  try {
    const axios = require('axios');
    const config = await AiConfig.getSingleton();
    
    const diagnosis = {
      timestamp: new Date().toISOString(),
      phase: 'PHASE_2_RUNTIME_VERIFICATION',
      
      // 1. Verificar config en BD
      configInDB: {
        newsApiEnabled: config.newsApiEnabled,
        hasApiKey: !!config.newsApiKey,
        apiKeyLength: config.newsApiKey?.length || 0,
        apiKeyLast4: config.newsApiKey ? `***${config.newsApiKey.slice(-4)}` : 'NONE',
        enforceSourceAllowlist: config.enforceSourceAllowlist,
        cubaKeywordsCount: config.cubaKeywords?.length || 0,
        maxTopicsPerScan: config.maxTopicsPerScan,
        scanFrequency: config.scanFrequency
      },
      
      // 2. Verificar variables de entorno
      envVariables: {
        hasNewsApiKeyInEnv: !!process.env.NEWS_API_KEY,
        envKeyLength: process.env.NEWS_API_KEY?.length || 0,
        envKeyLast4: process.env.NEWS_API_KEY ? `***${process.env.NEWS_API_KEY.slice(-4)}` : 'NONE',
        keysMatch: config.newsApiKey === process.env.NEWS_API_KEY
      },
      
      newsApiTests: []
    };
    
    // 3. Test #1: Llamada con query simple y filtro temporal
    if (config.newsApiKey) {
      try {
        const fromDate = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72h atrás
        const test1Response = await axios.get('https://newsapi.org/v2/everything', {
          params: {
            q: 'Cuba',
            language: 'es',
            from: fromDate.toISOString().split('T')[0],
            sortBy: 'publishedAt',
            pageSize: 20,
            apiKey: config.newsApiKey
          },
          timeout: 10000
        });
        
        diagnosis.newsApiTests.push({
          test: 'TEST_1_SIMPLE_QUERY_WITH_DATES',
          status: 'SUCCESS',
          query: 'Cuba',
          language: 'es',
          from: fromDate.toISOString().split('T')[0],
          totalResults: test1Response.data.totalResults,
          articlesReturned: test1Response.data.articles?.length || 0,
          sampleTitles: test1Response.data.articles?.slice(0, 3).map(a => a.title) || []
        });
      } catch (error) {
        diagnosis.newsApiTests.push({
          test: 'TEST_1_SIMPLE_QUERY_WITH_DATES',
          status: 'FAILED',
          httpStatus: error.response?.status,
          errorCode: error.response?.data?.code,
          errorMessage: error.response?.data?.message || error.message,
          suggestion: getErrorSuggestion(error.response?.status)
        });
      }
      
      // 4. Test #2: Llamada sin filtro temporal (como en código actual)
      try {
        const keywords = config.cubaKeywords.slice(0, 3).join(' OR '); // Solo primeros 3
        const test2Response = await axios.get('https://newsapi.org/v2/everything', {
          params: {
            q: keywords,
            language: 'es',
            sortBy: 'publishedAt',
            pageSize: 50,
            apiKey: config.newsApiKey
          },
          timeout: 10000
        });
        
        diagnosis.newsApiTests.push({
          test: 'TEST_2_NO_DATE_FILTER',
          status: 'SUCCESS',
          query: keywords,
          totalResults: test2Response.data.totalResults,
          articlesReturned: test2Response.data.articles?.length || 0,
          warning: test2Response.data.totalResults === 0 ? 'NO_RESULTS_WITHOUT_DATE_FILTER' : null
        });
      } catch (error) {
        diagnosis.newsApiTests.push({
          test: 'TEST_2_NO_DATE_FILTER',
          status: 'FAILED',
          httpStatus: error.response?.status,
          errorMessage: error.response?.data?.message || error.message
        });
      }
      
      // 5. Test #3: Llamada con query completa (todos los keywords)
      try {
        const fromDate = new Date(Date.now() - 72 * 60 * 60 * 1000);
        const fullKeywords = config.cubaKeywords.join(' OR ');
        const test3Response = await axios.get('https://newsapi.org/v2/everything', {
          params: {
            q: fullKeywords,
            language: 'es',
            from: fromDate.toISOString().split('T')[0],
            sortBy: 'publishedAt',
            pageSize: 50,
            apiKey: config.newsApiKey
          },
          timeout: 10000
        });
        
        diagnosis.newsApiTests.push({
          test: 'TEST_3_FULL_KEYWORDS_WITH_DATES',
          status: 'SUCCESS',
          queryLength: fullKeywords.length,
          totalResults: test3Response.data.totalResults,
          articlesReturned: test3Response.data.articles?.length || 0
        });
      } catch (error) {
        diagnosis.newsApiTests.push({
          test: 'TEST_3_FULL_KEYWORDS_WITH_DATES',
          status: 'FAILED',
          httpStatus: error.response?.status,
          errorMessage: error.response?.data?.message || error.message,
          warning: 'QUERY_MAY_BE_TOO_LONG'
        });
      }
    } else {
      diagnosis.newsApiTests.push({
        test: 'ALL_TESTS_SKIPPED',
        reason: 'NO_API_KEY_IN_CONFIG'
      });
    }
    
    // 6. Recomendaciones
    diagnosis.recommendations = [];
    
    if (!config.newsApiKey) {
      diagnosis.recommendations.push({
        priority: 'CRITICAL',
        issue: 'API Key no está en la configuración de BD',
        fix: 'Ejecutar: AiConfig.findOneAndUpdate({singleton:true}, {newsApiKey: process.env.NEWS_API_KEY})'
      });
    }
    
    if (!diagnosis.envVariables.keysMatch && config.newsApiKey) {
      diagnosis.recommendations.push({
        priority: 'WARNING',
        issue: 'API Key en BD no coincide con .env',
        fix: 'Sincronizar manualmente o reiniciar servidor'
      });
    }
    
    const successfulTest = diagnosis.newsApiTests.find(t => t.status === 'SUCCESS' && t.totalResults > 0);
    if (successfulTest) {
      diagnosis.recommendations.push({
        priority: 'INFO',
        message: `✅ NewsAPI funciona correctamente. Test "${successfulTest.test}" retornó ${successfulTest.totalResults} resultados.`,
        action: 'APLICAR_FIX_3_AÑADIR_FILTRO_TEMPORAL'
      });
    }
    
    res.json(diagnosis);
    
  } catch (error) {
    console.error('[Diagnostics] Error:', error);
    res.status(500).json({ 
      error: 'Error en diagnóstico',
      message: error.message,
      stack: error.stack
    });
  }
});

function getErrorSuggestion(status) {
  const suggestions = {
    401: 'API Key inválida o expirada. Verificar NEWS_API_KEY en .env',
    403: 'Acceso denegado. Verificar permisos de la API Key',
    429: 'Rate limit excedido (100 requests/día en plan gratuito). Esperar 24h o upgrade',
    426: 'Upgrade Required. NewsAPI requiere plan de pago para esta operación',
    500: 'Error del servidor de NewsAPI. Reintentar más tarde'
  };
  return suggestions[status] || 'Error desconocido';
}

// ==================== REVISION/CAMBIOS ====================

/**
 * POST /api/redactor-ia/drafts/:id/request-changes
 * Solicita revisión asistida por IA de un borrador
 */
router.post('/drafts/:id/request-changes', requireEditor, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user?._id || req.user?.id;

    if (!notes || notes.trim().length === 0) {
      return res.status(400).json({ error: 'Las notas de revisión son requeridas' });
    }

    // Obtener configuración del modelo
    const config = await AiConfig.getSingleton();
    const model = config.generation?.modelText || 'gpt-4o-mini';

    // Actualizar estado a pending antes de generar
    const draft = await AiDraft.findById(id);
    if (draft) {
      draft.review = {
        ...draft.review,
        status: 'pending',
        requestedNotes: notes,
        requestedBy: userId,
        requestedAt: new Date()
      };
      await draft.save();
    }

    // Generar revisión de forma asíncrona
    generateRevision({ draftId: id, notes, model, userId })
      .then(result => {
        if (!result.ok) {
          console.log('[API] Revisión completada con status:', result.status);
        } else {
          console.log('[API] Revisión completada para draft:', id);
        }
      })
      .catch(err => {
        console.error('[API] Error en revisión asíncrona:', err);
      });

    res.json({
      ok: true,
      message: 'Revisión iniciada',
      jobId: id, // Usar el ID del draft como jobId para simplificar polling
      status: 'pending'
    });

  } catch (error) {
    console.error('[API] Error iniciando revisión:', error);
    res.status(500).json({ error: 'Error al iniciar revisión' });
  }
});

/**
 * GET /api/redactor-ia/drafts/:id/revision
 * Obtiene el estado de una revisión
 */
router.get('/drafts/:id/revision', requireEditor, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Headers no-cache para evitar 304
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    const status = await getRevisionStatus(id);

    res.json(status);

  } catch (error) {
    console.error('[API] Error obteniendo estado de revisión:', error);
    res.status(500).json({ 
      status: 'error',
      errorMsg: 'Error al obtener estado de revisión'
    });
  }
});

/**
 * POST /api/redactor-ia/drafts/:id/apply-revision
 * Aplica la revisión propuesta al borrador
 */
router.post('/drafts/:id/apply-revision', requireEditor, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    const result = await applyRevision({ draftId: id, userId });

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      ok: true,
      message: 'Revisión aplicada correctamente',
      draft: result.draft
    });

  } catch (error) {
    console.error('[API] Error aplicando revisión:', error);
    res.status(500).json({ error: 'Error al aplicar revisión' });
  }
});

// ==================== PROGRAMACIÓN DE PUBLICACIONES ====================

/**
 * POST /api/redactor-ia/programar/:id
 * Programa un borrador para publicación automática
 * Body: { scheduledAt: Date }
 */
router.post('/programar/:id', requireEditor, async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledAt } = req.body;
    
    if (!scheduledAt) {
      return res.status(400).json({ error: 'La fecha de programación es requerida' });
    }
    
    const date = new Date(scheduledAt);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Fecha inválida' });
    }
    
    // Validar que la fecha sea futura
    if (date <= new Date()) {
      return res.status(400).json({ error: 'La fecha debe ser futura' });
    }
    
    const draft = await AiDraft.findById(id);
    if (!draft) {
      return res.status(404).json({ error: 'Borrador no encontrado' });
    }
    
    // Verificar que esté pendiente y no publicado
    if (draft.publishStatus === 'publicado' || draft.publishedAs) {
      return res.status(400).json({ error: 'El borrador ya está publicado' });
    }
    
    // Inicializar publishStatus si no existe (retrocompatibilidad)
    if (!draft.publishStatus) {
      draft.publishStatus = 'pendiente';
    }
    
    // Actualizar programación
    draft.scheduledAt = date;
    draft.publishStatus = 'programado';
    await draft.save();
    
    console.log(`[API] Borrador ${id} programado para: ${date.toLocaleString()}`);
    
    res.json({
      ok: true,
      message: `Borrador programado para ${date.toLocaleString('es-ES')}`,
      draft
    });
    
  } catch (error) {
    console.error('[API] Error programando borrador:', error);
    res.status(500).json({ error: 'Error al programar borrador' });
  }
});

/**
 * POST /api/redactor-ia/auto-schedule
 * Distribuye automáticamente fechas de publicación a todos los borradores pendientes
 * según la configuración de intervalo y franja horaria
 */
router.post('/auto-schedule', requireEditor, async (req, res) => {
  try {
    const config = await AiConfig.getSingleton();
    
    if (!config.autoScheduleEnabled) {
      return res.status(400).json({ 
        error: 'La programación automática está desactivada',
        hint: 'Actívala en la configuración primero'
      });
    }
    
    // Buscar borradores pendientes sin programar
    // Retrocompatible: incluye borradores sin publishStatus definido
    const pendingDrafts = await AiDraft.find({
      scheduledAt: null,
      publishedAs: null,
      reviewStatus: 'pending', // Solo borradores pendientes de revisión
      $or: [
        { publishStatus: 'pendiente' },
        { publishStatus: { $exists: false } } // Compatibilidad con borradores antiguos
      ]
    })
    .sort({ createdAt: 1 }) // Más antiguos primero
    .limit(50); // Limitar a 50 borradores
    
    if (pendingDrafts.length === 0) {
      return res.json({
        ok: true,
        message: 'No hay borradores pendientes para programar',
        scheduled: 0
      });
    }
    
    const {
      autoScheduleInterval, // minutos entre publicaciones
      autoScheduleStartHour, // hora inicio (ej: 7)
      autoScheduleEndHour // hora fin (ej: 23)
    } = config;
    
    // ═══════════════════════════════════════════════════════════════
    // USAR ZONA HORARIA DE CUBA (America/Havana)
    // ═══════════════════════════════════════════════════════════════
    const now = new Date();
    const intervalMs = autoScheduleInterval * 60 * 1000;
    
    // Obtener la hora actual en Cuba
    const cubaFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Havana',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const cubaParts = cubaFormatter.formatToParts(now);
    const cubaHour = parseInt(cubaParts.find(p => p.type === 'hour').value);
    const cubaMinute = parseInt(cubaParts.find(p => p.type === 'minute').value);
    
    console.log(`[AutoSchedule] Hora Cuba: ${cubaHour}:${cubaMinute.toString().padStart(2, '0')}`);
    console.log(`[AutoSchedule] Franja: ${autoScheduleStartHour}:00 - ${autoScheduleEndHour}:00`);
    
    // Calcular offset de Cuba respecto a UTC
    const cubaOffset = -5 * 60; // Cuba es UTC-5 (horario estándar)
    
    // Crear fechas de inicio y fin de la franja en hora de Cuba (convertidas a UTC)
    const startToday = new Date(now);
    startToday.setUTCHours(autoScheduleStartHour - cubaOffset / 60, 0, 0, 0);
    
    const endToday = new Date(now);
    endToday.setUTCHours(autoScheduleEndHour - cubaOffset / 60, 0, 0, 0);
    
    // Ajustar si el día cambió por el offset
    const cubaDateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Havana',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const cubaDateStr = cubaDateFormatter.format(now);
    
    // Calcular el primer slot de publicación basado en hora de Cuba
    let currentSlot;
    
    if (cubaHour < autoScheduleStartHour) {
      // 1) Estamos antes de la franja en Cuba → usar inicio de hoy (hora Cuba)
      currentSlot = new Date(now);
      currentSlot.setUTCHours(autoScheduleStartHour + 5, 0, 0, 0); // +5 para convertir Cuba a UTC
      console.log(`[AutoSchedule] Antes de franja, programando desde: ${autoScheduleStartHour}:00 Cuba`);
    } else if (cubaHour >= autoScheduleStartHour && cubaHour < autoScheduleEndHour) {
      // 2) Estamos dentro de la franja → empezar desde ahora + intervalo
      currentSlot = new Date(now.getTime() + intervalMs);
      currentSlot.setSeconds(0, 0);
      console.log(`[AutoSchedule] Dentro de franja, primer slot en ${autoScheduleInterval} minutos`);
    } else {
      // 3) Estamos después de la franja → saltar al inicio del día siguiente
      currentSlot = new Date(now);
      currentSlot.setDate(currentSlot.getDate() + 1);
      currentSlot.setUTCHours(autoScheduleStartHour + 5, 0, 0, 0); // +5 para convertir Cuba a UTC
      console.log(`[AutoSchedule] Después de franja, programando para mañana ${autoScheduleStartHour}:00 Cuba`);
    }
    
    const scheduledDrafts = [];
    
    for (const draft of pendingDrafts) {
      // Asignar fecha al borrador
      draft.scheduledAt = new Date(currentSlot);
      draft.publishStatus = 'programado';
      await draft.save();
      
      scheduledDrafts.push({
        id: draft._id,
        titulo: draft.titulo,
        scheduledAt: draft.scheduledAt
      });
      
      // Calcular siguiente slot
      let nextSlot = new Date(currentSlot.getTime() + intervalMs);
      
      // Obtener hora de Cuba del siguiente slot
      const nextSlotCubaParts = cubaFormatter.formatToParts(nextSlot);
      const nextSlotCubaHour = parseInt(nextSlotCubaParts.find(p => p.type === 'hour').value);
      
      // Si nos salimos de la franja (hora Cuba >= hora fin), saltar al día siguiente
      if (nextSlotCubaHour >= autoScheduleEndHour) {
        // Saltar al inicio de la franja del día siguiente
        nextSlot.setDate(nextSlot.getDate() + 1);
        nextSlot.setUTCHours(autoScheduleStartHour + 5, 0, 0, 0); // +5 para Cuba a UTC
      }
      
      currentSlot = nextSlot;
    }
    
    console.log(`[API] ${scheduledDrafts.length} borradores programados automáticamente`);
    
    res.json({
      ok: true,
      message: `${scheduledDrafts.length} borradores programados exitosamente`,
      scheduled: scheduledDrafts.length,
      drafts: scheduledDrafts
    });
    
  } catch (error) {
    console.error('[API] Error en auto-programación:', error);
    res.status(500).json({ error: 'Error al programar borradores automáticamente' });
  }
});

// ==================== GENERAR DESDE URL ====================

/**
 * POST /api/redactor-ia/generar-desde-url
 * Genera un borrador (solo texto) a partir de una URL
 * Body: { url: string }
 * Retorna: { titulo, categoria, bajada, contenidoHtml, etiquetas }
 */
router.post('/generar-desde-url', generateLimiter, requireEditor, async (req, res) => {
  try {
    const { url } = req.body;
    
    // Validar URL
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'La URL es requerida' });
    }
    
    const urlNormalized = url.trim();
    
    // Validar formato de URL
    try {
      new URL(urlNormalized.startsWith('http') ? urlNormalized : 'https://' + urlNormalized);
    } catch {
      return res.status(400).json({ error: 'URL inválida' });
    }
    
    // NOTA: No validamos contra allowlist aquí porque:
    // - Solo admins/editores autenticados pueden acceder (requireEditor)
    // - Permite flexibilidad para generar desde cualquier fuente
    // - El allowlist sigue aplicándose al escaneo automático del Redactor IA
    
    console.log(`[API] Generando borrador desde URL (sin validación de allowlist): ${urlNormalized}`);
    
    // Generar borrador (solo texto, sin imágenes)
    const draft = await generateDraftFromUrl(urlNormalized);
    
    res.json({
      ok: true,
      ...draft
    });
    
  } catch (error) {
    console.error('[API] Error generando desde URL:', error);
    res.status(500).json({ 
      error: 'Error al generar borrador',
      message: error.message 
    });
  }
});

// ==================== FACEBOOK AUTO PUBLISHER ====================

/**
 * GET /api/redactor-ia/facebook/scheduler-info
 * Obtiene info básica del scheduler de Facebook para mostrar en UI
 */
router.get('/facebook/scheduler-info', requireEditor, async (req, res) => {
  try {
    const { getFacebookScheduleSummary } = require('../services/facebookAutoPublisher');
    const summary = await getFacebookScheduleSummary();
    
    res.json({
      ok: true,
      enabled: summary.enabled,
      intervalMinutes: summary.intervalMinutes,
      startHour: summary.startHour,
      endHour: summary.endHour,
      candidatesCount: summary.candidatesCount,
      publishedToday: summary.publishedToday,
      isWithinTimeWindow: summary.isWithinTimeWindow
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/redactor-ia/facebook/recalculate-schedule
 * Obtiene un resumen del estado actual de la programación automática en Facebook
 */
router.post('/facebook/recalculate-schedule', requireEditor, async (req, res) => {
  try {
    const { getFacebookScheduleSummary } = require('../services/facebookAutoPublisher');
    
    console.log('[API:Facebook] Solicitando resumen de programación automática');
    
    const summary = await getFacebookScheduleSummary();
    
    console.log('[API:Facebook] Resumen generado:', {
      enabled: summary.enabled,
      candidatesCount: summary.candidatesCount,
      publishedToday: summary.publishedToday,
      isWithinTimeWindow: summary.isWithinTimeWindow
    });
    
    res.json({
      ok: true,
      summary,
      message: summary.enabled 
        ? `Sistema activo. ${summary.candidatesCount} candidatos disponibles, ${summary.publishedToday} publicados hoy.`
        : 'Sistema de programación automática desactivado.'
    });
    
  } catch (error) {
    console.error('[API:Facebook] Error al obtener resumen:', error);
    res.status(500).json({ 
      error: 'Error al obtener resumen de programación',
      message: error.message 
    });
  }
});

/**
 * GET /api/redactor-ia/facebook/debug-candidates
 * Endpoint de diagnóstico para comparar candidatos del scheduler vs backend
 * Muestra qué noticias están marcadas en UI pero no son candidatos reales y viceversa
 */
router.get('/facebook/debug-candidates', requireEditor, async (req, res) => {
  try {
    const { getFacebookScheduleSummary, isNewsAFacebookCandidate } = require('../services/facebookAutoPublisher');
    const News = require('../../models/News');
    
    console.log('[FB DEBUG] 🔍 Iniciando diagnóstico de candidatos...');
    
    // 1. Obtener candidatos reales según scheduler (con filtros de frescura)
    const summary = await getFacebookScheduleSummary();
    const schedulerCount = summary.candidatesCount;
    
    console.log('[FB DEBUG] Scheduler dice:', schedulerCount, 'candidatos');
    
    // 2. Obtener TODAS las noticias published (base)
    const allPublished = await News.find({ 
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
    })
    .select('_id titulo status publishedToFacebook facebook_status publishedAt categoria isEvergreen')
    .lean();
    
    console.log('[FB DEBUG] Noticias base (published, no en FB):', allPublished.length);
    
    // 3. Filtrar con isNewsAFacebookCandidate (incluye frescura)
    const realCandidates = allPublished.filter(news => isNewsAFacebookCandidate(news));
    const realCandidatesIds = new Set(realCandidates.map(n => n._id.toString()));
    
    console.log('[FB DEBUG] Candidatos reales (con frescura):', realCandidates.length);
    
    // 4. Noticias que NO son candidatos (por frescura)
    const notCandidates = allPublished.filter(news => !isNewsAFacebookCandidate(news));
    
    console.log('[FB DEBUG] NO candidatos (por frescura):', notCandidates.length);
    
    // 5. Comparación detallada
    const comparison = {
      schedulerCount,
      realCandidatesCount: realCandidates.length,
      notCandidatesCount: notCandidates.length,
      basePublishedCount: allPublished.length,
      match: schedulerCount === realCandidates.length,
      realCandidates: realCandidates.map(n => ({
        _id: n._id,
        titulo: n.titulo.substring(0, 60),
        categoria: n.categoria,
        publishedAt: n.publishedAt,
        ageInDays: Math.floor((Date.now() - new Date(n.publishedAt)) / (1000 * 60 * 60 * 24)),
        isEvergreen: n.isEvergreen || false
      })),
      notCandidates: notCandidates.map(n => {
        const ageInDays = Math.floor((Date.now() - new Date(n.publishedAt)) / (1000 * 60 * 60 * 24));
        let reason = 'Unknown';
        
        if (!n.publishedAt) {
          reason = 'Sin fecha de publicación';
        } else if (n.isEvergreen) {
          reason = 'Evergreen pero otro problema';
        } else if (n.categoria === 'Cuba' && ageInDays > 7) {
          reason = `Cuba: ${ageInDays} días (máx 7)`;
        } else if (n.categoria === 'Tendencia' && ageInDays > 7) {
          reason = `Tendencia: ${ageInDays} días (máx 7)`;
        } else if (n.categoria === 'Tecnología' && ageInDays > 7) {
          reason = `Tecnología: ${ageInDays} días (máx 7)`;
        } else if (ageInDays > 5) {
          reason = `${n.categoria || 'Otra'}: ${ageInDays} días (máx 5)`;
        }
        
        return {
          _id: n._id,
          titulo: n.titulo.substring(0, 60),
          categoria: n.categoria,
          publishedAt: n.publishedAt,
          ageInDays,
          isEvergreen: n.isEvergreen || false,
          reason
        };
      })
    };
    
    // 6. Logs para consola
    console.log('[FB DEBUG] ============================================');
    console.log('[FB DEBUG] RESUMEN:');
    console.log('[FB DEBUG] - Scheduler count:', schedulerCount);
    console.log('[FB DEBUG] - Real candidates:', realCandidates.length);
    console.log('[FB DEBUG] - Match:', comparison.match ? '✅ SÍ' : '❌ NO');
    console.log('[FB DEBUG] ============================================');
    
    if (notCandidates.length > 0) {
      console.log('[FB DEBUG] Noticias EXCLUIDAS por frescura:');
      notCandidates.slice(0, 5).forEach(n => {
        const age = Math.floor((Date.now() - new Date(n.publishedAt)) / (1000 * 60 * 60 * 24));
        console.log(`[FB DEBUG]   - ${n.titulo.substring(0, 50)} (${n.categoria}, ${age}d)`);
      });
      if (notCandidates.length > 5) {
        console.log(`[FB DEBUG]   ... y ${notCandidates.length - 5} más`);
      }
    }
    
    res.json({
      ok: true,
      comparison,
      message: comparison.match 
        ? '✅ Los números coinciden perfectamente'
        : `⚠️ Discrepancia: scheduler=${schedulerCount}, backend=${realCandidates.length}`
    });
    
  } catch (error) {
    console.error('[FB DEBUG] ❌ Error en diagnóstico:', error);
    res.status(500).json({ 
      error: 'Error en diagnóstico',
      message: error.message 
    });
  }
});

module.exports = router;
