// server/redactor_ia/services/simpleImageService.js
/**
 * Pipeline mínimo de imágenes: contenido → prompt → proveedor → guardar
 * Sin detectores, sin resolvers, sin negativos complejos, sin análisis extra.
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { Types } = require('mongoose');
const AiDraft = require('../../models/AiDraft');
const AiConfig = require('../../models/AiConfig');

// Importar solo lo necesario de imageProvider
const OpenAI = require('openai');

// Constantes
const MEDIA_ROOT = path.resolve(process.cwd(), 'public', 'media');

/**
 * Genera hash SHA-256 de un buffer
 */
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Obtiene el proveedor configurado desde AiConfig
 */
async function getSelectedImageProvider() {
  try {
    const config = await AiConfig.getSingleton();
    return config.imageProvider || process.env.IMG_DEFAULT_PROVIDER || 'dall-e-3';
  } catch (error) {
    console.warn('[ImageSimple] Error obteniendo config, usando default:', error.message);
    return process.env.IMG_DEFAULT_PROVIDER || 'dall-e-3';
  }
}

/**
 * Construye un prompt simple a partir del contenido del borrador
 * @param {Object} draft - Borrador con campos: title, lead/summary, category, tags
 * @returns {string} Prompt en español para el proveedor
 */
function buildSimplePrompt(draft) {
  const title = draft.titulo || '';
  const lead = draft.bajada || '';
  const category = draft.categoria || '';
  const tags = (draft.etiquetas || []).slice(0, 3).join(', ');
  
  // Construir prompt base
  let prompt = `Genera una fotografía periodística realista (sin texto sobreimpreso), en español, sobre: "${title}".`;
  
  // Añadir contexto si está disponible
  if (lead) {
    prompt += ` Contexto: ${lead.substring(0, 150)}.`;
  }
  
  if (category) {
    prompt += ` Categoría: ${category}.`;
  }
  
  if (tags) {
    prompt += ` Etiquetas: ${tags}.`;
  }
  
  // Estilo por defecto (foto periodística realista)
  prompt += ' Estilo: fotografía periodística profesional, realista, editorial.';
  
  return prompt;
}

/**
 * Invoca el proveedor DALL-E con fallback de 3 niveles para safety system
 * @param {string} prompt - Prompt a enviar
 * @param {string} model - Modelo a usar (dall-e-3 o dall-e-2)
 * @param {Object} fallbackOptions - Opciones para fallback (locale)
 * @returns {Promise<{ok: boolean, buffer?: Buffer, error?: string, errorCode?: string}>}
 */
async function invokeDalleProvider(prompt, model = 'dall-e-3', fallbackOptions = {}) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { sanitizeImagePrompt, getSymbolicFallbackPrompt, getGenericFallbackPrompt } = require('../utils/sanitizeImagePrompt');
  
  const locale = fallbackOptions.locale || 'es-CU';
  let lastError = null;
  let lastErrorCode = null;
  
  // Plan A: Prompt original (o sanitizado si aplica)
  const attemptsList = [
    { level: 'A', prompt, label: 'original/sanitizado' }
  ];
  
  // Detectar si necesita fallback por safety
  const addFallbacks = (error) => {
    if (error?.status === 400 || error?.code === 'content_policy_violation') {
      console.log('[ImageSafety] Error 400 detectado, agregando fallbacks');
      attemptsList.push(
        { level: 'B', prompt: getSymbolicFallbackPrompt(locale), label: 'simbólico' },
        { level: 'C', prompt: getGenericFallbackPrompt(locale), label: 'genérico' }
      );
    }
  };
  
  for (const attempt of attemptsList) {
    try {
      console.log(`[ImageSafety] retry=${attempt.level} (${attempt.label})`);
      console.log(`[ImageSimple] Invocando ${model} con prompt: "${attempt.prompt.substring(0, 100)}..."`);
      
      const response = await openai.images.generate({
        model,
        prompt: attempt.prompt,
        size: model === 'dall-e-3' ? '1792x1024' : '1024x1024',
        quality: 'standard',
        n: 1,
        response_format: 'b64_json',
      });
      
      const b64 = response.data?.[0]?.b64_json;
      
      if (!b64) {
        throw new Error('No se recibió imagen en la respuesta');
      }
      
      const buffer = Buffer.from(b64, 'base64');
      console.log(`[ImageSimple] ✅ Imagen recibida (nivel ${attempt.level}): ${(buffer.length / 1024).toFixed(1)}KB`);
      
      return { ok: true, buffer, usedLevel: attempt.level };
      
    } catch (error) {
      lastError = error;
      
      // Detectar error de safety system (400)
      if (error.status === 400 || error.code === 'content_policy_violation') {
        lastErrorCode = 'safety_block';
        console.warn(`[ImageSafety] retry=${attempt.level} reason=safety_block (${error.message})`);
        
        // Si es el primer intento, agregar fallbacks
        if (attempt.level === 'A' && attemptsList.length === 1) {
          addFallbacks(error);
        }
      } else if (error.status === 429) {
        lastErrorCode = 'rate_limit';
        console.warn(`[ImageSimple] Rate limit alcanzado, esperando...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        lastErrorCode = 'unknown';
        console.warn(`[ImageSimple] Error nivel ${attempt.level}: ${error.message}`);
      }
    }
  }
  
  return {
    ok: false,
    error: lastError?.message || 'Error desconocido al generar imagen',
    errorCode: lastErrorCode
  };
}

/**
 * Guarda una imagen en múltiples formatos (JPG, WebP, AVIF)
 * @param {Buffer} imageBuffer - Buffer de la imagen
 * @param {string} draftId - ID del borrador
 * @returns {Promise<{coverUrl, coverFallbackUrl, coverHash}>}
 */
async function saveImageToMedia(imageBuffer, draftId) {
  const mediaDir = path.join(MEDIA_ROOT, 'news', draftId);
  
  // Crear directorio si no existe
  await fs.mkdir(mediaDir, { recursive: true });
  
  // Procesar imagen
  const processed = sharp(imageBuffer)
    .resize(1280, 720, { fit: 'cover', position: 'attention' });
  
  // Guardar JPG (fallback universal)
  const jpgPath = path.join(mediaDir, 'cover.jpg');
  await processed.jpeg({ quality: 82, mozjpeg: true }).toFile(jpgPath);
  console.log(`[ImageSimple] ✅ JPG guardado: cover.jpg`);
  
  // Guardar WebP
  const webpPath = path.join(mediaDir, 'cover.webp');
  await sharp(imageBuffer)
    .resize(1280, 720, { fit: 'cover', position: 'attention' })
    .webp({ quality: 82 })
    .toFile(webpPath);
  console.log(`[ImageSimple] ✅ WebP guardado: cover.webp`);
  
  // Intentar guardar AVIF (mejor compresión)
  let avifGenerated = false;
  try {
    const avifPath = path.join(mediaDir, 'cover.avif');
    await sharp(imageBuffer)
      .resize(1280, 720, { fit: 'cover', position: 'attention' })
      .avif({ quality: 58 })
      .toFile(avifPath);
    avifGenerated = true;
    console.log(`[ImageSimple] ✅ AVIF guardado: cover.avif`);
  } catch (avifError) {
    console.warn(`[ImageSimple] No se pudo generar AVIF: ${avifError.message}`);
  }
  
  // Calcular hash del archivo final para cache busting
  const finalFormat = avifGenerated ? 'avif' : 'jpg';
  const finalPath = path.join(mediaDir, `cover.${finalFormat}`);
  const finalBuffer = await fs.readFile(finalPath);
  const coverHash = sha256(finalBuffer);
  
  console.log(`[ImageSimple] 🔑 Hash calculado: ${coverHash.slice(0, 16)}...`);
  
  return {
    coverUrl: `/media/news/${draftId}/cover.${avifGenerated ? 'avif' : 'webp'}`,
    coverFallbackUrl: `/media/news/${draftId}/cover.jpg`,
    coverHash
  };
}

/**
 * Flujo simple: contenido → prompt → proveedor → guardar
 * @param {Object} params - { draftId, provider, userId }
 * @returns {Promise<{ok: boolean, path?: string, provider?: string, error?: string}>}
 */
async function generateCoverSimple({ draftId, provider = null, userId = null }) {
  console.log(`[ImageSimple] draft=${draftId} provider=${provider || 'auto'} user=${userId || 'system'}`);
  
  let draft;
  
  try {
    // 1. Cargar borrador
    draft = await AiDraft.findById(draftId);
    if (!draft) {
      throw new Error('Borrador no encontrado');
    }
    
    // Marcar como processing
    draft.imageStatus = 'processing';
    await draft.save();
    
    // 2. Obtener proveedor (configurado o especificado)
    const selectedProvider = provider || await getSelectedImageProvider();
    console.log(`[ImageSimple] Proveedor seleccionado: ${selectedProvider}`);
    
    // ✅ Soporte para proveedores no-DALL-E (hailuo, stable-diffusion, midjourney)
    if (!['dall-e-3', 'dall-e-2'].includes(selectedProvider)) {
      console.log(`[ImageSimple] Proveedor ${selectedProvider} detectado, delegando a generateWithProvider`);
      const { generateWithProvider } = require('./imageProvider');
      
      const result = await generateWithProvider({
        provider: selectedProvider,
        prompt: '', // Se generará internamente
        title: draft.titulo || '',
        summary: draft.bajada || '',
        category: draft.categoria || '',
        draftId,
        topic: null,
        draft,
        mode: 'synthesize_from_context'
      });
      
      if (!result.ok || !result.b64) {
        draft.imageStatus = 'error';
        draft.aiMetadata = draft.aiMetadata || {};
        draft.aiMetadata.imageError = {
          code: result.errorCode || 'unknown',
          message: result.error || `Error al generar imagen con ${selectedProvider}`,
          timestamp: new Date()
        };
        await draft.save();
        
        throw new Error(result.error || `Error al generar imagen con ${selectedProvider}`);
      }
      
      // Convertir b64 a buffer
      const buffer = Buffer.from(result.b64, 'base64');
      
      // Guardar imagen
      const { coverUrl, coverFallbackUrl, coverHash } = await saveImageToMedia(buffer, draftId);
      console.log(`[ImageSimple] saved path=${coverUrl}`);
      
      // Actualizar borrador
      draft.coverUrl = coverUrl;
      draft.coverFallbackUrl = coverFallbackUrl;
      draft.coverHash = coverHash;
      draft.coverImageUrl = coverUrl;
      draft.imageKind = 'ai';
      draft.generatedImages = { principal: coverUrl };
      draft.generatedImagesPersisted = { principal: true };
      draft.imageStatus = 'ready';
      draft.aiMetadata = draft.aiMetadata || {};
      draft.aiMetadata.imageProvider = selectedProvider;
      draft.aiMetadata.generationType = userId ? 'manual' : 'auto';
      
      await draft.save();
      
      console.log(`[ImageSimple] ✅ Imagen ${selectedProvider} guardada exitosamente`);
      
      return {
        ok: true,
        draft,
        provider: selectedProvider,
        coverUrl,
        hash: coverHash
      };
    }
    
    // 3. Construir prompt (con sanitización si es necesario)
    const { sanitizeImagePrompt, hasSensitiveContent } = require('../utils/sanitizeImagePrompt');
    
    let prompt;
    const locale = 'es-CU'; // TODO: Obtener del config o draft
    
    // Verificar si necesita sanitización
    const fullText = `${draft.titulo} ${draft.bajada}`;
    if (hasSensitiveContent(fullText)) {
      console.log('[ImageSimple] Contenido sensible detectado, aplicando sanitización');
      const sanitizedPrompt = sanitizeImagePrompt({
        title: draft.titulo,
        lead: draft.bajada,
        category: draft.categoria,
        tags: draft.etiquetas,
        locale,
        isEditorial: false
      });
      
      prompt = sanitizedPrompt || buildSimplePrompt(draft);
    } else {
      prompt = buildSimplePrompt(draft);
    }
    
    console.log(`[ImageSimple] prompt="${prompt.substring(0, 120)}..."`);
    
    // 4. Invocar proveedor con opciones de fallback
    const result = await invokeDalleProvider(prompt, selectedProvider, { locale });
    
    if (!result.ok) {
      // Manejar error con estado específico
      draft.imageStatus = 'error';
      draft.aiMetadata = draft.aiMetadata || {};
      draft.aiMetadata.imageError = {
        code: result.errorCode || 'unknown',
        message: result.error || 'Error al generar imagen',
        timestamp: new Date()
      };
      await draft.save();
      
      throw new Error(result.error || 'Error al generar imagen');
    }
    
    // 5. Guardar imagen en múltiples formatos
    const { coverUrl, coverFallbackUrl, coverHash } = await saveImageToMedia(result.buffer, draftId);
    console.log(`[ImageSimple] saved path=${coverUrl}`);
    
    // 6. Actualizar borrador con imagen guardada
    draft.coverUrl = coverUrl;
    draft.coverFallbackUrl = coverFallbackUrl;
    draft.coverHash = coverHash;
    draft.coverImageUrl = coverUrl;
    draft.imageKind = 'ai';
    draft.generatedImages = { principal: coverUrl };
    draft.generatedImagesPersisted = { principal: true };
    
    // IMPORTANTE: Marcar como 'ready' SOLO después de guardar exitosamente
    draft.imageStatus = 'ready';
    
    // Actualizar metadata
    draft.aiMetadata = draft.aiMetadata || {};
    draft.aiMetadata.imageProvider = selectedProvider;
    draft.aiMetadata.generationType = userId ? 'manual' : 'auto';
    
    // Guardar nivel de fallback usado si aplica
    if (result.usedLevel) {
      draft.aiMetadata.imageFallbackLevel = result.usedLevel;
      if (result.usedLevel !== 'A') {
        console.log(`[ImageSimple] ⚠️ Se usó fallback nivel ${result.usedLevel} por safety system`);
      }
    }
    
    // Limpiar errores previos si existían
    if (draft.aiMetadata.imageError) {
      delete draft.aiMetadata.imageError;
    }
    
    // Asignar generatedBy si es manual y no tiene usuario
    if (userId && !draft.generatedBy) {
      // Defensa: normalizar userId (puede ser string, ObjectId o objeto)
      let validUserId = null;
      
      if (typeof userId === 'string' && Types.ObjectId.isValid(userId)) {
        validUserId = new Types.ObjectId(userId);
      } else if (userId instanceof Types.ObjectId) {
        validUserId = userId;
      } else if (typeof userId === 'object' && userId !== null) {
        // Si es objeto, intentar extraer _id o id
        const extracted = userId._id || userId.id;
        if (extracted && Types.ObjectId.isValid(extracted)) {
          validUserId = new Types.ObjectId(extracted);
        }
      }
      
      if (validUserId) {
        draft.generatedBy = validUserId;
        console.log(`[ImageSimple] generatedBy asignado: ${validUserId}`);
      } else {
        console.warn(`[ImageSimple] userId inválido recibido (${typeof userId}), se omite generatedBy`);
      }
    }
    
    await draft.save();
    
    console.log(`[ImageSimple] ✅ Completado exitosamente (status=ready)`);
    
    return {
      ok: true,
      path: coverUrl,
      provider: selectedProvider,
      hash: coverHash
    };
    
  } catch (error) {
    console.error(`[ImageSimple:ERROR] ${error.message}`);
    
    // Si draft existe y no se guardó imagen, marcar error
    if (draft && !draft.coverUrl) {
      try {
        draft.imageStatus = 'error';
        draft.aiMetadata = draft.aiMetadata || {};
        draft.aiMetadata.imageError = {
          code: error.code || 'generation_failed',
          message: error.message,
          timestamp: new Date()
        };
        await draft.save();
      } catch (saveError) {
        console.error(`[ImageSimple:ERROR] No se pudo guardar estado de error: ${saveError.message}`);
      }
    }
    
    return {
      ok: false,
      error: error.message,
      errorCode: error.code || 'generation_failed'
    };
  }
}

module.exports = {
  generateCoverSimple,
  getSelectedImageProvider,
  buildSimplePrompt
};
