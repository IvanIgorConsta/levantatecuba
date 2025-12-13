/**
 * Rutas API para generación de imágenes con IA
 * Endpoints: POST /images, POST /images/accept
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const { generateForNews, generatePairsTemporales, acceptCandidate, acceptTemporal, attachTemporales } = require("../services/aiImageService");
const News = require("../models/News");

const router = express.Router();

// Rate limiting específico para IA (10 requests por minuto por IP)
const aiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 requests por ventana
  message: {
    error: "Demasiadas solicitudes de IA. Intenta nuevamente en un minuto."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar rate limit a todas las rutas de IA
router.use(aiRateLimit);

// Middleware para verificar que IA está habilitada y configurada correctamente
function checkAIEnabled(req, res, next) {
  const aiEnabled = process.env.AI_IMAGE_ENABLE === 'true';
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  
  // Verificar si IA está habilitada
  if (!aiEnabled) {
    return res.status(503).json({
      error: "Generación de imágenes con IA temporalmente deshabilitada",
      code: "AI_DISABLED"
    });
  }
  
  // Verificar si existe la API key
  if (!hasApiKey) {
    console.error("[AI] ❌ OPENAI_API_KEY missing");
    return res.status(503).json({
      error: "OPENAI_API_KEY missing. Cargue .env en el proceso del servidor.",
      code: "API_KEY_MISSING"
    });
  }
  
  next();
}

// Función auxiliar para mapear errores a respuestas HTTP apropiadas
function mapErrorToResponse(error) {
  console.error("[AI] Error details:", {
    message: error.message,
    name: error.name,
    code: error.code,
    path: error.path,
    openaiError: error.openaiError,
    responseStatus: error.response?.status,
    responseData: error.response?.data
  });

  // Timeout de IA
  if (error.name === 'AbortError') {
    return {
      status: 504,
      body: {
        error: "AI provider timeout",
        message: error.message,
        code: "AI_TIMEOUT"
      }
    };
  }

  // Error específico de verificación de organización
  if (error.status === 403 && error.code === "ORG_NOT_VERIFIED") {
    return {
      status: 403,
      body: {
        message: "Tu organización debe estar verificada para usar gpt-image-1 en OpenAI.",
        code: "ORG_NOT_VERIFIED"
      }
    };
  }

  // Errores de OpenAI
  if (error.openaiError && error.response) {
    const status = error.response.status;
    const data = error.response.data || {};
    
    // Error específico de límite de billing alcanzado
    if (status === 429 && (error.message || data.error?.message || '').includes('billing')) {
      return {
        status: 429,
        body: {
          message: "Se alcanzó el límite de facturación de OpenAI",
          code: "billing_hard_limit_reached"
        }
      };
    }
    
    // Error específico de parámetro response_format no soportado
    if (status === 400 && (error.message || data.error?.message || '').includes("Unknown parameter: 'response_format'")) {
      return {
        status: 400,
        body: {
          message: "Parámetro no soportado por el proveedor: 'response_format'. Eliminado. Intenta nuevamente."
        }
      };
    }
    
    // Error específico de valor de quality inválido
    if (status === 400 && (error.message || data.error?.message || '').includes("Invalid value: 'standard'")) {
      return {
        status: 400,
        body: {
          message: "Parámetro no soportado por el proveedor: quality='standard'. Se ha normalizado a 'auto'. Intenta nuevamente."
        }
      };
    }
    
    return {
      status: status,
      body: {
        error: data.error?.message || error.message,
        type: data.error?.type,
        code: data.error?.code || `OPENAI_${status}`,
        provider: "OpenAI"
      }
    };
  }

  // Errores de filesystem (permisos, espacio, etc.)
  if (error.code && ['EACCES', 'ENOENT', 'ENOSPC', 'EMFILE', 'ENOTDIR'].includes(error.code)) {
    return {
      status: 500,
      body: {
        error: error.message,
        code: error.code,
        path: error.path,
        type: "FILESYSTEM_ERROR"
      }
    };
  }

  // Errores de validación/parámetros
  if (error.message.includes('inválido') || error.message.includes('invalid') || 
      error.message.includes('requerido') || error.message.includes('required')) {
    return {
      status: 400,
      body: {
        error: error.message,
        code: "INVALID_REQUEST"
      }
    };
  }

  // Error genérico
  return {
    status: 500,
    body: {
      error: error.message || "Error interno del servidor",
      code: "INTERNAL_ERROR"
    }
  };
}

// Middleware de validación para generación
function validateGenerateRequest(req, res, next) {
  const { newsId, tempId, title, content, style, n, size, role, square, variation } = req.body;
  
  // Validar newsId o tempId (mutuamente excluyentes)
  if (!newsId && !tempId) {
    return res.status(400).json({
      error: "Se requiere 'newsId' o 'tempId'"
    });
  }
  
  if (newsId && tempId) {
    return res.status(400).json({
      error: "Los campos 'newsId' y 'tempId' son mutuamente excluyentes"
    });
  }
  
  // Validar formato de tempId si se proporciona
  if (tempId && !/^[a-z0-9-]{8,}$/i.test(tempId)) {
    return res.status(400).json({
      error: "El formato de 'tempId' es inválido"
    });
  }
  
  // Validar campos requeridos
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({
      error: "El campo 'title' es requerido y debe ser un string no vacío"
    });
  }
  
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({
      error: "El campo 'content' es requerido y debe ser un string no vacío"
    });
  }
  
  // Validar estilo
  const validStyles = ["realista", "ilustracion", "infografia"];
  if (!style || !validStyles.includes(style)) {
    return res.status(400).json({
      error: `El campo 'style' debe ser uno de: ${validStyles.join(", ")}`
    });
  }
  
  // Validar size (nuevo parámetro)
  const validSizes = [512, 768, 1024, 1536];
  let imageSize = size ? parseInt(size) : 1024;
  if (!validSizes.includes(imageSize)) {
    imageSize = 1024; // Default
  }
  
  // Validar role (nuevo parámetro)
  const validRoles = ["main", "optional"];
  let imageRole = role || "main";
  if (!validRoles.includes(imageRole)) {
    imageRole = "main";
  }
  
  // Validar y ajustar número de variantes
  const defaultVariants = parseInt(process.env.AI_IMAGE_DEFAULT_VARIANTS) || 4;
  const maxVariants = parseInt(process.env.AI_IMAGE_MAX_VARIANTS) || 6;
  
  let variants = n || 1; // Default a 1 para el nuevo flujo
  
  if (typeof variants !== 'number' || variants < 1) {
    variants = 1;
  }
  
  if (variants > maxVariants) {
    variants = maxVariants;
  }
  
  // Guardar valores validados en req para uso posterior
  req.validatedData = {
    newsId: newsId || null,
    tempId: tempId || null,
    title: title.trim(),
    content: content.trim(),
    style,
    n: variants,
    size: imageSize,
    role: imageRole,
    square: square === true, // Forzar generación cuadrada
    variation: variation || null // Para forzar variación adicional
  };
  
  next();
}

// Middleware de validación para aceptación
function validateAcceptRequest(req, res, next) {
  const { newsId, tempId, role, url } = req.body;
  
  // Validar newsId o tempId (mutuamente excluyentes)
  if (!newsId && !tempId) {
    return res.status(400).json({
      error: "Se requiere 'newsId' o 'tempId'"
    });
  }
  
  if (newsId && tempId) {
    return res.status(400).json({
      error: "Los campos 'newsId' y 'tempId' son mutuamente excluyentes"
    });
  }
  
  // Validar formato de tempId si se proporciona
  if (tempId && !/^[a-z0-9-]{8,}$/i.test(tempId)) {
    return res.status(400).json({
      error: "El formato de 'tempId' es inválido"
    });
  }
  
  // Validar role
  const validRoles = ["cover", "secondary"];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({
      error: `El campo 'role' debe ser uno de: ${validRoles.join(", ")}`
    });
  }
  
  // Validar URL según el modo
  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      error: "El campo 'url' es requerido"
    });
  }
  
  const expectedPrefix = newsId 
    ? `/uploads/tmp/ai/${newsId}/`
    : `/uploads/tmp/ai/scratch/${tempId}/`;
    
  if (!url.startsWith(expectedPrefix)) {
    return res.status(400).json({
      error: `El campo 'url' debe empezar con ${expectedPrefix}`
    });
  }
  
  req.validatedData = {
    newsId: newsId ? newsId.trim() : null,
    tempId: tempId ? tempId.trim() : null,
    role,
    url: url.trim()
  };
  
  next();
}

// Middleware de validación para attach
function validateAttachRequest(req, res, next) {
  const { newsId, tempId, coverUrl, secondaryUrl } = req.body;
  
  // Validar que se proporcionen los IDs requeridos
  if (!newsId || typeof newsId !== 'string' || newsId.trim().length === 0) {
    return res.status(400).json({
      error: "El campo 'newsId' es requerido"
    });
  }
  
  if (!tempId || typeof tempId !== 'string' || tempId.trim().length === 0) {
    return res.status(400).json({
      error: "El campo 'tempId' es requerido"
    });
  }
  
  // Validar formato de tempId
  if (!/^[a-z0-9-]{8,}$/i.test(tempId)) {
    return res.status(400).json({
      error: "El formato de 'tempId' es inválido"
    });
  }
  
  // Validar que se proporcione al menos una URL
  if (!coverUrl && !secondaryUrl) {
    return res.status(400).json({
      error: "Se requiere al menos 'coverUrl' o 'secondaryUrl'"
    });
  }
  
  // Validar formato de URLs si se proporcionan
  const expectedPrefix = `/uploads/tmp/ai/scratch/${tempId}/`;
  
  if (coverUrl) {
    if (typeof coverUrl !== 'string' || !coverUrl.startsWith(expectedPrefix)) {
      return res.status(400).json({
        error: `El campo 'coverUrl' debe empezar con ${expectedPrefix}`
      });
    }
  }
  
  if (secondaryUrl) {
    if (typeof secondaryUrl !== 'string' || !secondaryUrl.startsWith(expectedPrefix)) {
      return res.status(400).json({
        error: `El campo 'secondaryUrl' debe empezar con ${expectedPrefix}`
      });
    }
  }
  
  req.validatedData = {
    newsId: newsId.trim(),
    tempId: tempId.trim(),
    coverUrl: coverUrl ? coverUrl.trim() : null,
    secondaryUrl: secondaryUrl ? secondaryUrl.trim() : null
  };
  
  next();
}

/**
 * POST /api/ai/images
 * Genera imágenes con IA para una noticia
 */
router.post("/images", checkAIEnabled, validateGenerateRequest, async (req, res) => {
  try {
    console.log(`[AI] Nueva solicitud de generación: ${req.validatedData.title.substring(0, 50)}...`);
    
          const { newsId, tempId, title, content, style, n, size, role, square, variation } = req.validatedData;
    
    // Detectar nuevo flujo (con size/role) vs flujo legacy (sin ellos)
    const isNewFlow = req.body.hasOwnProperty('size') || req.body.hasOwnProperty('role');
    
    // Nuevo flujo: generación individual con tamaño específico
    if (isNewFlow) {
      const { generateSingleImage } = require("../services/aiImageService");
      
      const result = await generateSingleImage({
        newsId,
        tempId,
        title,
        content,
        style,
        size,
        role,
        square,
        n,
        variation
      });
      
      console.log(`[AI] ✅ Generación individual completada: ${result.images.length} imágenes`);
      
      return res.json({
        images: result.images,
        meta: result.meta
      });
    }
    
    // Flujo legacy: generación de pares (retrocompatibilidad)
    // Modo persistente (newsId)
    if (newsId) {
      // Buscar noticia si se proporciona ID
      const news = await News.findById(newsId);
      if (!news) {
        return res.status(404).json({
          error: "Noticia no encontrada"
        });
      }
      
      // Usar función legacy para compatibilidad
      const result = await generateForNews({
        news,
        title,
        content,
        style,
        n
      });
      
      console.log(`[AI] ✅ Generación persistente completada: ${result.pairs.length} pares`);
      
      return res.json({
        pairs: result.pairs,
        meta: result.meta
      });
    }
    
    // Modo temporal (tempId)
    if (tempId) {
      const result = await generatePairsTemporales({
        newsId: null,
        tempId,
        title,
        content,
        style,
        n
      });
      
      console.log(`[AI] ✅ Generación temporal completada: ${result.pairs.length} pares`);
      
      return res.json({
        pairs: result.pairs,
        meta: result.meta
      });
    }
    
    // No debería llegar aquí debido a la validación
    return res.status(400).json({
      error: "Se requiere newsId o tempId"
    });
    
  } catch (error) {
    const { status, body } = mapErrorToResponse(error);
    return res.status(status).json(body);
  }
});

/**
 * POST /api/ai/images/accept
 * Acepta una imagen candidata y la mueve a ubicación final
 */
router.post("/images/accept", checkAIEnabled, validateAcceptRequest, async (req, res) => {
  try {
    const { newsId, tempId, role, url } = req.validatedData;
    
    console.log(`[AI] Aceptando imagen: ${role} para ${newsId ? `noticia ${newsId}` : `temp ${tempId}`}`);
    
    // Modo persistente (newsId)
    if (newsId) {
      // Verificar que la noticia existe
      const news = await News.findById(newsId);
      if (!news) {
        return res.status(404).json({
          error: "Noticia no encontrada"
        });
      }
    }
    
    // Usar función unificada que maneja ambos modos
    const result = await acceptTemporal({
      newsId,
      tempId,
      role,
      url
    });
    
    console.log(`[AI] ✅ Imagen aceptada: ${result.finalUrl || result.tempUrl}`);
    
    res.json(result);
    
  } catch (error) {
    const { status, body } = mapErrorToResponse(error);
    return res.status(status).json(body);
  }
});

/**
 * POST /api/ai/images/attach
 * Adjunta imágenes temporales a una noticia recién creada
 */
router.post("/images/attach", checkAIEnabled, validateAttachRequest, async (req, res) => {
  try {
    const { newsId, tempId, coverUrl, secondaryUrl } = req.validatedData;
    
    console.log(`[AI] Adjuntando temporales de ${tempId} a noticia ${newsId}`);
    
    // Verificar que la noticia existe
    const news = await News.findById(newsId);
    if (!news) {
      return res.status(404).json({
        error: "Noticia no encontrada"
      });
    }
    
    // Adjuntar imágenes temporales
    const result = await attachTemporales({
      newsId,
      tempId,
      coverUrl,
      secondaryUrl
    });
    
    console.log(`[AI] ✅ Imágenes adjuntadas exitosamente`);
    
    res.json(result);
    
  } catch (error) {
    const { status, body } = mapErrorToResponse(error);
    return res.status(status).json(body);
  }
});

// Endpoint de estado (para debugging)
router.get("/status", (req, res) => {
  const aiEnabled = process.env.AI_IMAGE_ENABLE === 'true';
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  
  res.json({
    enabled: aiEnabled,
    hasApiKey,
    model: process.env.OPENAI_IMAGE_MODEL || "dall-e-3",
    defaultVariants: parseInt(process.env.AI_IMAGE_DEFAULT_VARIANTS) || 4,
    maxVariants: parseInt(process.env.AI_IMAGE_MAX_VARIANTS) || 6,
    timeout: parseInt(process.env.AI_IMAGE_TIMEOUT_MS) || 120000
  });
});

/**
 * POST /api/ai/generate-cover
 * Genera portada simple usando el flujo directo (solo título)
 * Mismo mecanismo que Redactor IA
 */
router.post("/generate-cover", checkAIEnabled, async (req, res) => {
  try {
    const { newsId, title } = req.body;
    
    if (!newsId || !title?.trim()) {
      return res.status(400).json({
        error: "Se requiere newsId y título"
      });
    }
    
    console.log(`[AI:SimpleCover] Generando portada para noticia ${newsId}`);
    console.log(`[AI:SimpleCover] Título: "${title.substring(0, 80)}..."`);
    
    // Verificar que la noticia existe
    const news = await News.findById(newsId);
    if (!news) {
      return res.status(404).json({
        error: "Noticia no encontrada"
      });
    }
    
    // Usar el mismo flujo de Redactor IA
    const { generateWithProvider } = require('../redactor_ia/services/imageProvider');
    const { buildNeoRenaissancePrompt } = require('../redactor_ia/services/promptTemplates');
    const crypto = require('crypto');
    const { saveBase64Png } = require('../services/imageProcessor');
    
    // Construir prompt directo (solo título)
    const { prompt } = buildNeoRenaissancePrompt(title.trim());
    
    console.log(`[AI:SimpleCover] Prompt: "${prompt}"`);
    
    // Generar imagen con el proveedor configurado
    const provider = process.env.IMG_DEFAULT_PROVIDER || 'dall-e-3';
    const result = await generateWithProvider({
      provider,
      mode: 'synthesize_from_context',
      draftId: newsId,
      prompt,
      title: title.trim(),
      summary: '',
      category: news.categoria || '',
      _imageContext: {
        theme: 'direct',
        mode: 'direct_title',
        style: 'editorial',
        locale: 'es-CU'
      }
    });
    
    if (!result.ok) {
      throw new Error(result.error || 'Error generando imagen');
    }
    
    // Guardar imagen
    let coverUrl;
    if (result.url) {
      coverUrl = result.url;
    } else if (result.b64) {
      const nameHash = crypto.createHash('sha1').update(`${newsId}-${Date.now()}`).digest('hex');
      const filename = `cover_${nameHash}.png`;
      const { publicUrl } = await saveBase64Png(result.b64, filename);
      coverUrl = publicUrl;
    } else {
      throw new Error('No se recibió imagen del proveedor');
    }
    
    // Actualizar noticia con la nueva portada
    news.imagen = coverUrl;
    news._cover = coverUrl;
    news._coverHash = crypto.createHash('sha1').update(coverUrl).digest('hex').substring(0, 8);
    await news.save();
    
    console.log(`[AI:SimpleCover] ✅ Portada generada: ${coverUrl}`);
    
    res.json({
      ok: true,
      coverUrl,
      provider: result.provider,
      newsId
    });
    
  } catch (error) {
    console.error('[AI:SimpleCover] Error:', error.message);
    const { status, body } = mapErrorToResponse(error);
    return res.status(status).json(body);
  }
});

/**
 * POST /api/ai/generate-cover-preview
 * Genera portada para preview (sin guardar en DB)
 * Para uso antes de crear la noticia
 */
router.post("/generate-cover-preview", checkAIEnabled, async (req, res) => {
  try {
    const { title, content } = req.body;
    
    if (!title?.trim()) {
      return res.status(400).json({
        error: "Se requiere título para generar la imagen"
      });
    }
    
    console.log(`[AI:CoverPreview] Generando portada preview`);
    console.log(`[AI:CoverPreview] Título: "${title.substring(0, 80)}..."`);
    
    const { generateWithProvider } = require('../redactor_ia/services/imageProvider');
    const { buildNeoRenaissancePrompt } = require('../redactor_ia/services/promptTemplates');
    const crypto = require('crypto');
    const path = require('path');
    const fs = require('fs');
    
    // Construir prompt directo (solo título)
    const { prompt } = buildNeoRenaissancePrompt(title.trim());
    
    console.log(`[AI:CoverPreview] Prompt: "${prompt}"`);
    
    // Generar imagen con el proveedor configurado
    const provider = process.env.IMG_DEFAULT_PROVIDER || 'dall-e-3';
    const tempId = `preview-${Date.now()}`;
    
    const result = await generateWithProvider({
      provider,
      mode: 'synthesize_from_context',
      draftId: tempId,
      prompt,
      title: title.trim(),
      summary: content?.substring(0, 500) || '',
      category: '',
      _imageContext: {
        theme: 'direct',
        mode: 'direct_title',
        style: 'editorial',
        locale: 'es-CU'
      }
    });
    
    if (!result.ok) {
      throw new Error(result.error || 'Error generando imagen');
    }
    
    // Guardar imagen en carpeta temporal
    let coverUrl;
    if (result.url) {
      coverUrl = result.url;
    } else if (result.b64) {
      const nameHash = crypto.createHash('sha1').update(`preview-${Date.now()}`).digest('hex');
      const filename = `preview_${nameHash}.png`;
      const dir = './public/media/previews';
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const buffer = Buffer.from(result.b64, 'base64');
      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, buffer);
      coverUrl = `/media/previews/${filename}`;
    } else {
      throw new Error('No se recibió imagen del proveedor');
    }
    
    console.log(`[AI:CoverPreview] ✅ Portada preview generada: ${coverUrl}`);
    
    res.json({
      ok: true,
      coverUrl,
      provider: result.provider
    });
    
  } catch (error) {
    console.error('[AI:CoverPreview] Error:', error.message);
    const { status, body } = mapErrorToResponse(error);
    return res.status(status).json(body);
  }
});

module.exports = router;
