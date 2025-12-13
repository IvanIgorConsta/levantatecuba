// server/redactor_ia/services/imageProvider.js
/** @audit GPT5: QA RedactorIA v2025-10
 * Reforzado del pipeline de imágenes:
 * - Prioriza imagen de fuente real (proveedor internal) antes de IA cuando sea posible.
 * - Prompts: normal → explícito → forzado exterior, con listas NEGATIVAS por evento.
 * - QA heurístico de contexto exterior y trazabilidad de logs.
 * - Rechazo de miniaturas en proveedor interno.
 */
/** @fix Claude 4.5 – Corrección flujo de imágenes procesadas Redactor IA (2025-10)
 * 
 * CAMBIOS APLICADOS:
 * 1. Prioridad de imagen procesada local:
 *    - generateWithProvider() intenta providerInternal PRIMERO si hay fuentes
 *    - Solo usa IA si providerInternal falla o no hay fuentes disponibles
 *    - Retorna estructura completa: {ok, url, coverUrl, coverFallbackUrl, coverHash, provider, kind}
 * 
 * 2. Contrato de respuesta estandarizado:
 *    - provider: 'internal' | 'dall-e-3' | 'dall-e-2'
 *    - kind: 'processed' | 'ai' | 'placeholder'
 *    - usedSource: false (siempre procesada localmente, nunca hotlink)
 *    - imageUrl, hash, coverUrl con rutas completas
 * 
 * 3. Validación y logging mejorado:
 *    - Logs claros: [ImageProvider] result=ok provider=internal kind=processed
 *    - [StatsService] Costo imagen: $0.00 (internal)
 *    - [ImageProvider:Internal] Cover persistido en BD: /media/news/:id/cover.avif
 *    - Rechazo de miniaturas (<600x400 o <20KB)
 *    - Rechazo por antigüedad (>5 años)
 * 
 * 4. Costos corregidos:
 *    - internal: $0.00
 *    - dall-e-3: $0.04
 *    - dall-e-2: $0.02
 * 
 * 5. Frontend actualizado:
 *    - Prioridad: coverUrl > generatedImages.principal > placeholder
 *    - Badge: '✓ Procesada' (verde) para imageKind === 'processed'
 *    - Cache-busting con ?v=<hash>
 *    - Picture tag con AVIF/WebP + fallback JPG
 * 
 * 6. Modelo de datos:
 *    - FuenteSchema incluye imageUrl para acceso a imagen original
 *    - aiMetadata.imageProvider guarda proveedor real
 *    - generatedBy se mantiene como ObjectId (usuario) o null
 *    - Warning de validación suprimido para procesos automáticos
 */
/**
 * ═══════════════════════════════════════════════════════════════════
 * 🚫 SISTEMA ANTI-TEXTO GLOBAL ACTIVO
 * ═══════════════════════════════════════════════════════════════════
 * 
 * TODAS las imágenes generadas con IA incluyen automáticamente reglas
 * para prevenir la aparición de texto, letras, logotipos o palabras.
 * 
 * Esto garantiza:
 * ✅ Ilustraciones limpias sin tipografía
 * ✅ Fotografías editoriales profesionales sin texto inventado
 * ✅ Cero riesgo de texto incorrecto o ilegible en imágenes
 * 
 * Las reglas NO_TEXT_RULES se aplican automáticamente a:
 * - sanitizeImagePrompt() - Primer nivel de prompts
 * - createNeutralPrompt() - Prompts de fallback
 * - Prompts enriquecidos con rasgos visuales
 * 
 * NO es necesario configurar nada. Es global y automático.
 * ═══════════════════════════════════════════════════════════════════
 */

const sharp = require('sharp');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const OpenAI = require('openai');
const { extractImageUrl, processImage, generatePlaceholder, ensureDirectory } = require('../../services/imageProcessor');
const { detectPrimaryPerson } = require('../utils/personDetector');
const { selectContext, getContextRules } = require('../utils/contextBuilder');
const { IMG, isRawMode, isAntiTextEnabled, isSanitizerEnabled } = require('../../config/image');
const { 
  sanitizeImagePrompt, 
  getSymbolicFallbackPrompt,
  getGenericFallbackPrompt, 
  hasSensitiveContent,
  detectVisualIntentFromTitle,
  allowFlags
} = require('../utils/sanitizeImagePrompt');
const { overlayFlags, detectFlagsFromTitle } = require('./flagOverlay');

// Deshabilitar caché de Sharp para evitar locks en Windows
sharp.cache(false);

// Palabras clave para rechazar imágenes no deseadas
const REJECT_IMAGE_KEYWORDS = [
  'spinner', 'loader', 'loading', 'placeholder', 'icon', 'logo', 'avatar',
  'badge', 'button', 'arrow', 'social', 'share', 'pixel', 'tracking',
  'ads', 'banner', 'thumbnail-small', 'favicon'
];

// Dimensiones mínimas aceptables
const MIN_IMAGE_WIDTH = 300;
const MIN_IMAGE_HEIGHT = 300;
const PREFERRED_MIN_WIDTH = 600;
const PREFERRED_MIN_HEIGHT = 400;

// Constantes
const MEDIA_ROOT = path.resolve(process.cwd(), 'public', 'media');
const TMP_ROOT = path.resolve(process.cwd(), 'tmp');
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const DOWNLOAD_TIMEOUT = 12000; // 12s
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Genera hash SHA-256 de un buffer
 */
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Elimina un path con reintentos (para evitar EBUSY en Windows)
 * @param {string} targetPath - Path a eliminar
 * @param {Object} options - { attempts: 10, delayMs: 150 }
 * @returns {Promise<boolean>} true si se eliminó, false si falló
 */
async function deletePathWithRetry(targetPath, { attempts = 10, delayMs = 150 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
      console.log(`[ImageProvider:Internal] 🧹 Temporal limpiado: ${targetPath}`);
      return true;
    } catch (error) {
      const isRetryable = error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'ENOTEMPTY';
      
      if (!isRetryable || i === attempts) {
        if (error.code === 'ENOENT') {
          // Ya no existe, considerarlo éxito
          return true;
        }
        console.warn(`[ImageProvider:Internal] ⚠️ No se pudo limpiar temporal tras ${i} intentos: ${error.message}`);
        return false;
      }
      
      // Esperar antes de reintentar
      await new Promise(resolve => setTimeout(resolve, delayMs * i));
    }
  }
  return false;
}

/**
 * Extrae URL de imagen principal desde una página web usando filtros robustos
 * @param {string} pageUrl - URL de la página fuente
 * @returns {Promise<string|null>} URL de la imagen o null
 */
async function extractPrimaryImageUrlFromPage(pageUrl) {
  console.log(`[ImageExtractor] Extrayendo imagen desde: ${pageUrl}`);
  
  try {
    const response = await axios.get(pageUrl, {
      timeout: 10000,
      maxContentLength: 5 * 1024 * 1024, // 5MB para HTML
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      maxRedirects: 3
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Paso 1: Intentar og:image (máxima prioridad)
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      const imageUrl = resolveUrl(ogImage, pageUrl);
      console.log(`[ImageExtractor] 🎯 og:image encontrada: ${imageUrl.substring(0, 120)}`);
      
      if (!isValidImageUrl(imageUrl)) {
        console.log(`[ImageExtractor] ⚠️ og:image rechazada: URL inválida`);
      } else if (shouldRejectImageUrl(imageUrl)) {
        console.log(`[ImageExtractor] ⚠️ og:image rechazada: keyword bloqueada`);
      } else {
        // Validar dimensiones descargando
        console.log(`[ImageExtractor] 🔎 Validando og:image...`);
        const validated = await validateImageDimensions(imageUrl, pageUrl);
        if (validated) {
          console.log(`[ImageExtractor] ✅ og:image validada y aceptada`);
          return imageUrl;
        }
        console.warn(`[ImageExtractor] ⚠️ og:image rechazada por dimensiones/descarga`);
      }
    }
    
    // Paso 2: Buscar todas las imágenes candidatas en el contenido
    const candidates = [];
    
    // 2.1: Imágenes en <figure> dentro de article/main/content
    $('article figure img, main figure img, .article-content figure img, .post-content figure img').each((i, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      if (src) {
        candidates.push({ src, priority: 10, source: 'figure' });
      }
    });
    
    // 2.2: Imágenes en div.media-block-wrap o similares
    $('.media-block-wrap img, .article-media img, .post-media img, .entry-content img').each((i, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      if (src) {
        candidates.push({ src, priority: 8, source: 'media-block' });
      }
    });
    
    // 2.3: Imágenes directamente en <article> con atributos de dimensión
    $('article img[width], article img[height], main img[width], main img[height]').each((i, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      const width = parseInt($(elem).attr('width')) || 0;
      const height = parseInt($(elem).attr('height')) || 0;
      if (src && width >= MIN_IMAGE_WIDTH && height >= MIN_IMAGE_HEIGHT) {
        candidates.push({ src, priority: 7, source: 'article-with-dims', width, height });
      }
    });
    
    // 2.4: Cualquier imagen grande en el contenido principal
    $('article img, main img, .article-body img, .post-body img, .entry-content img').each((i, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      if (src) {
        candidates.push({ src, priority: 5, source: 'content' });
      }
    });
    
    // 2.5: Fallback: twitter:image
    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    if (twitterImage) {
      candidates.push({ src: twitterImage, priority: 3, source: 'twitter:image' });
    }
    
    console.log(`[ImageExtractor] 🔍 Encontradas ${candidates.length} imágenes candidatas`);
    
    // Paso 3: Filtrar y validar candidatas (limitar a primeras 15 para evitar timeouts)
    const validCandidates = [];
    const candidatesToCheck = candidates.slice(0, 15);
    
    for (let i = 0; i < candidatesToCheck.length; i++) {
      const candidate = candidatesToCheck[i];
      const fullUrl = resolveUrl(candidate.src, pageUrl);
      
      // Filtro 1: URL válida y no rechazada
      if (!isValidImageUrl(fullUrl)) {
        console.log(`[ImageExtractor] ⚠️ URL inválida: ${fullUrl.substring(0, 100)}`);
        continue;
      }
      
      if (shouldRejectImageUrl(fullUrl)) {
        console.log(`[ImageExtractor] ⚠️ URL rechazada por keyword: ${fullUrl.substring(0, 100)}`);
        continue;
      }
      
      // Filtro 2: Validar dimensiones descargando
      console.log(`[ImageExtractor] 🔎 Intentando validar (${i+1}/${candidatesToCheck.length}): ${fullUrl.substring(0, 120)}`);
      const dims = await validateImageDimensions(fullUrl, pageUrl);
      if (!dims) {
        // Pequeño delay antes de siguiente validación para evitar rate limiting
        if (i < candidatesToCheck.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        continue;
      }
      
      // Si encontramos una válida, pequeño delay antes de la siguiente
      if (i < candidatesToCheck.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Calcular score: prioridad + resolución
      const resolution = dims.width * dims.height;
      const score = candidate.priority + (resolution / 100000); // Normalizar resolución
      
      validCandidates.push({
        url: fullUrl,
        width: dims.width,
        height: dims.height,
        score,
        source: candidate.source
      });
      
      console.log(`[ImageExtractor] ✓ Candidata válida: ${dims.width}x${dims.height} score=${score.toFixed(1)} source=${candidate.source}`);
    }
    
    // Paso 4: Seleccionar la mejor imagen
    if (validCandidates.length === 0) {
      console.log(`[ImageExtractor] ❌ No se encontró ninguna imagen válida en la fuente`);
      return null;
    }
    
    // Ordenar por score descendente y seleccionar la mejor
    validCandidates.sort((a, b) => b.score - a.score);
    const best = validCandidates[0];
    
    console.log(`[ImageExtractor] 🏆 Mejor imagen seleccionada: ${best.width}x${best.height} source=${best.source}`);
    console.log(`[ImageExtractor] ✅ URL final: ${best.url}`);
    
    return best.url;
    
  } catch (error) {
    console.warn(`[ImageExtractor] ❌ Error extrayendo imagen: ${error.message}`);
    return null;
  }
}

/**
 * Resuelve URL relativa contra base
 */
function resolveUrl(url, baseUrl) {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const base = new URL(baseUrl);
    if (url.startsWith('//')) {
      return base.protocol + url;
    }
    if (url.startsWith('/')) {
      return base.origin + url;
    }
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

/**
 * Valida si una URL es de imagen permitida
 * Soporta URLs con extensiones en cualquier parte del path y CDNs de imágenes
 */
function isValidImageUrl(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const fullUrl = url.toLowerCase();
    
    // Lista de extensiones válidas
    const validExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
    
    // Estrategia 1: Buscar extensión en cualquier parte del pathname
    for (const ext of validExts) {
      if (pathname.includes(`.${ext}`)) {
        return true;
      }
    }
    
    // Estrategia 2: URLs de CDNs/servicios de imágenes conocidos
    const imageServicePatterns = [
      'imagedelivery.net',     // Cloudflare Images
      '/_next/image',          // Next.js Image Optimization
      '/wp-content/uploads',   // WordPress
      '/images/',              // Directorio común
      '/media/',               // Directorio común
      'cdn.',                  // CDNs genéricos
      'cloudinary.com',        // Cloudinary
      'imgix.net',             // Imgix
    ];
    
    for (const pattern of imageServicePatterns) {
      if (fullUrl.includes(pattern)) {
        return true;
      }
    }
    
    // Estrategia 3: Query params que indican imagen
    if (parsed.searchParams.has('url') || 
        parsed.searchParams.has('image') ||
        parsed.searchParams.has('src')) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Verifica si la URL de imagen debe ser rechazada por contener palabras clave no deseadas
 */
function shouldRejectImageUrl(url) {
  const urlLower = url.toLowerCase();
  for (const keyword of REJECT_IMAGE_KEYWORDS) {
    if (urlLower.includes(keyword)) {
      console.log(`[ImageExtractor] ❌ Rechazando URL por keyword "${keyword}": ${url.substring(0, 100)}...`);
      return true;
    }
  }
  return false;
}

/**
 * Valida dimensiones de imagen descargándola y verificando metadata
 * @returns {Promise<{width: number, height: number}|null>}
 */
async function validateImageDimensions(imageUrl, referer) {
  try {
    // Descargar sólo los primeros bytes para obtener metadata
    const response = await axios.get(imageUrl, {
      timeout: 10000, // Aumentado a 10s
      maxContentLength: 1024 * 1024, // 1MB para validación (antes 500KB)
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer || imageUrl,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      maxRedirects: 5
    });
    
    const buffer = Buffer.from(response.data);
    
    // Usar sharp para obtener dimensiones sin procesar toda la imagen
    const metadata = await sharp(buffer).metadata();
    
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const size = buffer.length;
    
    console.log(`[ImageExtractor] 🔍 Validando: ${width}x${height}px, ${(size/1024).toFixed(1)}KB`);
    
    // Validar dimensiones mínimas
    if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
      console.log(`[ImageExtractor] ❌ Rechazando por tamaño: ${width}x${height} (mín: ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT})`);
      return null;
    }
    
    // Rechazar imágenes muy pequeñas en bytes (probablemente miniaturas)
    if (size < 10 * 1024) { // Reducido de 20KB a 10KB para ser menos estricto
      console.log(`[ImageExtractor] ❌ Rechazando por tamaño de archivo: ${(size/1024).toFixed(1)}KB (<10KB)`);
      return null;
    }
    
    console.log(`[ImageExtractor] ✅ Imagen válida: ${width}x${height}px, ${(size/1024).toFixed(1)}KB`);
    return { width, height, size };
    
  } catch (error) {
    // Logging más detallado
    if (error.code === 'ECONNABORTED') {
      console.log(`[ImageExtractor] ❌ Timeout descargando: ${imageUrl.substring(0, 100)}`);
    } else if (error.response?.status) {
      console.log(`[ImageExtractor] ❌ HTTP ${error.response.status} descargando: ${imageUrl.substring(0, 100)}`);
    } else {
      console.log(`[ImageExtractor] ❌ Error validando dimensiones: ${error.message}`);
    }
    return null;
  }
}

/** @fix: Generar IA encadenado (extraer→referenciar→DALL-E) — 2025-10 */
/**
 * Descarga y valida imagen de fuente para usar como referencia (no persiste)
 * @returns {Promise<{buffer: Buffer, sourceUsed: boolean, url: string}>}
 */
async function fetchSourceImageForReference(topic, draft) {
  try {
    // Extraer URL de imagen fuente
    let sourceImageUrl = null;
    if (topic?.fuentesTop?.length > 0) {
      sourceImageUrl = topic.fuentesTop[0].imageUrl || topic.fuentesTop[0].urlToImage;
    } else if (draft?.fuentes?.length > 0) {
      sourceImageUrl = draft.fuentes[0].imageUrl;
    }
    
    if (!sourceImageUrl) {
      console.log('[ImageProvider] No hay imagen de fuente disponible para referencia');
      return { buffer: null, sourceUsed: false, url: null };
    }
    
    console.log(`[ImageProvider] sourceFound=true url=${sourceImageUrl}`);
    
    // Descargar y validar
    const downloadResult = await fetchImageBuffer(sourceImageUrl, {
      timeoutMs: DOWNLOAD_TIMEOUT,
      maxBytes: MAX_IMAGE_SIZE,
      allowedContent: ALLOWED_MIME_TYPES
    });
    
    const tempBuffer = downloadResult.buffer;
    
    // Validar dimensiones mínimas (800x533 para referencia)
    const meta = await sharp(tempBuffer).metadata();
    const isValid = meta.width >= 800 && meta.height >= 533 && tempBuffer.length >= 80 * 1024;
    
    if (!isValid) {
      console.warn(`[ImageProvider] Imagen de referencia no válida (w=${meta.width} h=${meta.height}, ${(tempBuffer.length/1024).toFixed(1)}KB)`);
      return { buffer: null, sourceUsed: false, url: sourceImageUrl };
    }
    
    console.log(`[ImageProvider] validated=true saved=temp (${meta.width}x${meta.height}, ${(tempBuffer.length/1024).toFixed(1)}KB)`);
    return { buffer: tempBuffer, sourceUsed: true, url: sourceImageUrl };
    
  } catch (error) {
    console.warn(`[ImageProvider] Error obteniendo referencia: ${error.message}`);
    return { buffer: null, sourceUsed: false, url: null };
  }
}

/**
 * Descarga imagen con límites y validaciones
 */
async function fetchImageBuffer(url, { timeoutMs = DOWNLOAD_TIMEOUT, maxBytes = MAX_IMAGE_SIZE, allowedContent = ALLOWED_MIME_TYPES, referer = null } = {}) {
  console.log(`[ImageProvider] Descargando: ${url}`);
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'image/*,*/*'
    };
    
    if (referer) {
      headers['Referer'] = referer;
    }
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: timeoutMs,
      maxContentLength: maxBytes,
      maxBodyLength: maxBytes,
      headers,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400
    });
    
    const contentType = (response.headers['content-type'] || '').split(';')[0].trim();
    const lastModifiedHeader = response.headers['last-modified'];
    let lastModifiedMs = null;
    if (lastModifiedHeader) {
      const t = Date.parse(lastModifiedHeader);
      if (!isNaN(t)) lastModifiedMs = t;
    }
    
    // Validar MIME type
    if (!allowedContent.some(allowed => contentType.includes(allowed.split('/')[1]))) {
      throw new Error(`Tipo de contenido no soportado: ${contentType}`);
    }
    
    const buf = Buffer.from(response.data);
    
    // Validar tamaño
    if (buf.length > maxBytes) {
      throw new Error(`Imagen demasiado grande: ${(buf.length / 1024 / 1024).toFixed(2)}MB`);
    }
    
    // Determinar extensión por MIME type
    const extMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif'
    };
    const ext = extMap[contentType] || '.jpg';
    
    console.log(`[ImageProvider] Descargado: ${(buf.length / 1024).toFixed(1)}KB, tipo: ${contentType}`);
    
    return { buf, contentType, ext, lastModifiedMs };
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Timeout al descargar imagen');
    }
    if (error.response?.status === 403) {
      console.warn(`[ImageProvider:Internal] Fuente bloqueó descarga (403): ${url}`);
      throw new Error('Fuente bloqueó descarga (403)');
    }
    throw new Error(`Error descargando imagen: ${error.message}`);
  }
}

/**
 * NO-OP: Sin reglas anti-texto (desactivado)
 * La única validación es la del proveedor (OpenAI / DALL·E)
 */
const NO_TEXT_RULES = ''; // Desactivado

// FUNCIÓN ELIMINADA: buildImagePromptFromTitle
// Ahora se usa sanitizeImagePrompt() importada de ../utils/sanitizeImagePrompt.js
// que SIEMPRE genera el prompt desde el título con neutralización automática

/**
 * Prompt genérico neutral (para segundo reintento)
 * SIMPLIFICADO: Sin filtros propios, solo estilo cómic editorial
 * @returns {string} Prompt neutral simple
 */
function createNeutralPrompt() {
  return 'Ilustración editorial a todo color, estilo cómic / novela gráfica moderna. Escena periodística con personajes y ambiente expresivos, contornos marcados y colores vivos.';
}

/**
 * Proveedor INTERNAL - Flujo: temp → processed → persistido
 * @param {Object} params - { draftId, topic, draft, force }
 * @returns {Promise<{ok: boolean, url: string, provider: string, kind: string}>}
 */
async function providerInternal({ draftId, topic, draft, force = false }) {
  // 🐛 FIX: Convertir draftId a string para evitar "path must be string" error
  const draftIdStr = String(draftId);
  console.log(`[ImageProvider:Internal] Procesando imagen para draft ${draftIdStr}`);
  
  let tmpPath = null;
  let tmpDir = null;
  
  try {
    // 1. Buscar URL de la fuente original para extraer imagen
    let imageUrl = null;
    let sourceUrl = null;
    
    // Intentar obtener URL de la fuente del draft o topic
    const fuentes = draft?.fuentes || topic?.fuentesTop || [];
    if (fuentes.length > 0 && fuentes[0].url) {
      sourceUrl = fuentes[0].url;
      console.log(`[Redactor] Extrayendo imagen desde fuente: ${fuentes[0].medio}`);
      
      // Extraer imagen desde el HTML de la página fuente
      imageUrl = await extractPrimaryImageUrlFromPage(sourceUrl);
    }
    
    // Fallback: buscar en metadata de fuentes (método anterior)
    if (!imageUrl) {
      for (const fuente of fuentes) {
        imageUrl = extractImageUrl(fuente);
        if (imageUrl) {
          console.log(`[ImageProvider:Internal] Imagen encontrada en metadata: ${fuente.medio}`);
          break;
        }
      }
    }
    
    // Si no hay imagen, lanzar error (NO placeholder)
    if (!imageUrl) {
      console.error(`[ImageProvider:Internal] ❌ No se encontró imagen válida en la fuente`);
      const noImageError = new Error('No se encontró imagen válida en el sitio de la noticia. La página puede no tener imágenes, o solo contiene miniaturas/iconos.');
      noImageError.code = 'NO_VALID_IMAGE_FOUND';
      noImageError.userFacing = true;
      throw noImageError;
    }
    
    // 2. Crear directorio temporal específico para este draft
    tmpDir = path.join(TMP_ROOT, 'redactor_uploads', draftIdStr);
    await ensureDirectory(tmpDir);
    
    // 3. Descargar imagen a temporal con reintentos
    let downloadResult = null;
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        downloadResult = await fetchImageBuffer(imageUrl, { referer: sourceUrl });
        break;
      } catch (error) {
        console.warn(`[ImageProvider:Internal] Intento ${attempt}/${maxRetries} fallido: ${error.message}`);
        if (attempt === maxRetries) {
          throw error;
        }
        // Backoff ligero
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    const { buf, contentType, ext } = downloadResult;
    
    // 4. Guardar en temporal
    const tmpFilename = `source${ext}`;
    tmpPath = path.join(tmpDir, tmpFilename);
    
    await fs.writeFile(tmpPath, buf);
    console.log(`[ImageProvider:Internal] Imagen fuente descargada a temporal: ${tmpPath}`);
    
    // 5. Leer archivo temporal a buffer (evita locks en Windows)
    const tempBuffer = await fs.readFile(tmpPath);
    
    // 5.1 Validación final de calidad (doble check)
    try {
      const meta = await sharp(tempBuffer).metadata();
      const tooSmall = !meta.width || !meta.height || meta.width < PREFERRED_MIN_WIDTH || meta.height < PREFERRED_MIN_HEIGHT;
      const tinyBytes = tempBuffer.length < 20 * 1024; // <20KB
      if (tooSmall || tinyBytes) {
        console.error(`[ImageProvider:Internal] ❌ Rechazo final por tamaño/calidad (w=${meta.width || 0} h=${meta.height || 0}, ${(tempBuffer.length/1024).toFixed(1)}KB)`);
        const qualityError = new Error(`Imagen de baja calidad encontrada: ${meta.width}x${meta.height}px. Se requiere al menos ${PREFERRED_MIN_WIDTH}x${PREFERRED_MIN_HEIGHT}px.`);
        qualityError.code = 'LOW_QUALITY_IMAGE';
        qualityError.userFacing = true;
        throw qualityError;
      }
      console.log(`[ImageProvider:Internal] ✅ Validación de calidad: ${meta.width}x${meta.height}px, ${(tempBuffer.length/1024).toFixed(1)}KB`);
    } catch (metaErr) {
      console.error(`[ImageProvider:Internal] ❌ Validación fallida: ${metaErr.message}`);
      throw metaErr;
    }

    // 5.2 Validación de antigüedad (si header disponible)
    try {
      const MAX_IMAGE_AGE_DAYS = 365 * 5; // 5 años
      const ageInfo = downloadResult.lastModifiedMs;
      if (ageInfo) {
        const ageDays = Math.floor((Date.now() - ageInfo) / (24 * 3600 * 1000));
        console.log(`[ImageProvider:Internal] lastModified=${new Date(ageInfo).toISOString()} (~${ageDays}d ago)`);
        if (ageDays > MAX_IMAGE_AGE_DAYS) {
          throw new Error(`Imagen de fuente demasiado antigua (~${ageDays} días)`);
        }
      }
    } catch (ageErr) {
      console.warn(`[ImageProvider:Internal] Rechazo por antigüedad: ${ageErr.message}`);
      throw ageErr;
    }

    // 6. Procesar con Sharp desde buffer
    console.log(`[ImageProvider:Internal] Procesando imagen...`);
    
    // Para GIFs, extraer primer frame
    let sharpInstance = sharp(tempBuffer);
    if (contentType === 'image/gif') {
      sharpInstance = sharpInstance.animated(false);
    }
    
    const processed = sharpInstance
      .resize(1280, 720, {
        fit: 'cover',
        position: 'attention',
        withoutEnlargement: false
      })
      .modulate({
        saturation: 1.08,
        brightness: 1.0
      })
      .sharpen(1.2);
    
    // 7. Crear directorio de medios persistidos
    const mediaDir = path.join(MEDIA_ROOT, 'news', draftIdStr);
    console.log(`[ImageProvider:Internal] 📂 Guardando en: ${mediaDir}`);
    await ensureDirectory(mediaDir);
    
    // 8. Atomic write: JPG (fallback universal)
    const finalJpg = path.join(mediaDir, 'cover.jpg');
    const tmpJpg = finalJpg + '.tmp';
    
    await processed.jpeg({ quality: 82, mozjpeg: true }).toFile(tmpJpg);
    await fs.rename(tmpJpg, finalJpg);
    
    console.log(`[ImageProvider:Internal] ✅ JPG guardado: cover.jpg`);
    console.log(`[ImageProvider:Internal] result=ok provider=internal kind=processed`);
    
    // 9. Atomic write: WebP
    const finalWebp = path.join(mediaDir, 'cover.webp');
    const tmpWebp = finalWebp + '.tmp';
    
    await sharp(tempBuffer)
      .resize(1280, 720, { fit: 'cover', position: 'attention' })
      .modulate({ saturation: 1.08 })
      .sharpen(1.2)
      .webp({ quality: 82 })
      .toFile(tmpWebp);
    await fs.rename(tmpWebp, finalWebp);
    
    console.log(`[ImageProvider:Internal] ✅ WebP guardado: cover.webp`);
    
    // 10. Atomic write: AVIF (mejor compresión)
    let avifGenerated = false;
    try {
      const finalAvif = path.join(mediaDir, 'cover.avif');
      const tmpAvif = finalAvif + '.tmp';
      
      await sharp(tempBuffer)
        .resize(1280, 720, { fit: 'cover', position: 'attention' })
        .modulate({ saturation: 1.08 })
        .sharpen(1.2)
        .avif({ quality: 58 })
        .toFile(tmpAvif);
      
      await fs.rename(tmpAvif, finalAvif);
      avifGenerated = true;
      console.log(`[ImageProvider:Internal] ✅ AVIF guardado: cover.avif`);
    } catch (avifError) {
      console.warn(`[ImageProvider:Internal] No se pudo generar AVIF: ${avifError.message}`);
    }
    
    // 11. Generar hash para cache busting desde el archivo final
    let coverHash = '';
    try {
      const finalCoverPath = path.join(mediaDir, avifGenerated ? 'cover.avif' : 'cover.jpg');
      const finalBuffer = await fs.readFile(finalCoverPath);
      coverHash = sha256(finalBuffer);
      console.log(`[ImageProvider:Internal] 🔑 Hash calculado: ${coverHash.slice(0, 16)}... (${avifGenerated ? 'AVIF' : 'JPG'})`);
    } catch (hashError) {
      console.warn(`[ImageProvider:Internal] No se pudo calcular hash: ${hashError.message}`);
      // Fallback: usar el hash del buffer temporal
      coverHash = sha256(tempBuffer);
    }
    
    console.log(`[Redactor] Imagen procesada: /media/news/${draftIdStr}/cover`);
    console.log(`[ImageProvider:Internal] Cover persistido en BD: /media/news/${draftIdStr}/cover.${avifGenerated ? 'avif' : 'webp'}`);
    
    // 12. Limpiar directorio temporal de forma diferida (evita EBUSY)
    if (tmpDir) {
      setImmediate(async () => {
        await deletePathWithRetry(tmpDir, { attempts: 10, delayMs: 150 });
      });
    }
    
    return {
      ok: true,
      url: `/media/news/${draftIdStr}/cover`,
      coverUrl: `/media/news/${draftIdStr}/cover.${avifGenerated ? 'avif' : 'webp'}`,
      coverFallbackUrl: `/media/news/${draftIdStr}/cover.jpg`,
      coverHash,
      provider: 'internal',
      source: 'processed',
      kind: 'processed',
      // URLs originales para regeneración si se pierde la imagen
      originalImageUrl: imageUrl,
      originalImageSource: sourceUrl
    };
    
  } catch (error) {
    console.error(`[ImageProvider:Internal] Error: ${error.message}`);
    
    // Limpiar directorio temporal en caso de error (diferido)
    if (tmpDir) {
      setImmediate(async () => {
        await deletePathWithRetry(tmpDir, { attempts: 5, delayMs: 200 });
      });
    }
    
    // Fallback a placeholder
    return await generateInternalPlaceholder(draftIdStr);
  }
}

/**
 * Genera placeholder para proveedor internal
 */
async function generateInternalPlaceholder(draftId) {
  // 🐛 FIX: Convertir draftId a string
  const draftIdStr = String(draftId);
  try {
    const placeholderBuffer = await generatePlaceholder(1280, 720);
    
    const mediaDir = path.join(MEDIA_ROOT, 'news', draftIdStr);
    await ensureDirectory(mediaDir);
    
    const coverPath = path.join(mediaDir, 'cover.webp');
    await fs.writeFile(coverPath, placeholderBuffer);
    
    console.log(`[ImageProvider:Internal] ⚠️ Placeholder generado`);
    
    return {
      ok: true,
      url: `/media/news/${draftIdStr}/cover`,
      provider: 'internal',
      source: 'placeholder',
      kind: 'placeholder'
    };
  } catch (error) {
    console.error(`[ImageProvider:Internal] Error generando placeholder:`, error.message);
    return {
      ok: false,
      error: error.message,
      provider: 'internal'
    };
  }
}

/**
 * Extrae rasgos visuales de la imagen fuente (paleta y composición)
 */
async function extractVisualCues(imageBuffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;
    
    // Composición según proporción
    const composition = width >= height 
      ? 'wide cinematic, rule-of-thirds, subject left or center-left'
      : 'portrait editorial, centered subject';
    
    // Extraer paleta dominante (stats de imagen)
    const stats = await sharp(imageBuffer)
      .resize(100, 100, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Calcular colores promedio por canal
    const { data } = stats;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < data.length; i += 3) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const pixels = data.length / 3;
    const avgColor = {
      r: Math.round(r / pixels),
      g: Math.round(g / pixels),
      b: Math.round(b / pixels)
    };
    
    // Generar paleta heurística
    const palette = {
      primary: `#${avgColor.r.toString(16).padStart(2, '0')}${avgColor.g.toString(16).padStart(2, '0')}${avgColor.b.toString(16).padStart(2, '0')}`,
      dark: '#2a2a2a',
      light: '#f5f5f5'
    };
    
    return { composition, palette };
  } catch (error) {
    console.warn('[ImageProvider] Error extrayendo rasgos visuales:', error.message);
    return {
      composition: 'wide cinematic, balanced composition',
      palette: { primary: '#4a5568', dark: '#2a2a2a', light: '#f5f5f5' }
    };
  }
}

/**
 * Detecta entidad principal (persona o evento) y selecciona contexto visual
 * NUEVA LÓGICA: desambigua PERSON vs EVENTO, selecciona contextId inteligente
 * @param {Object} params
 * @returns {Promise<{isPerson: boolean, primaryPerson: string|null, eventType: string|null, eventName: string|null, refImageUrl: string|null, usePersonLikeness: boolean, contextId: string, contextKeywords: string[]}>}
 */
async function detectPersonAndReference({ title, summary = '', tags = [], sources = [] }) {
  console.log('[ImageProvider] Iniciando detección de entidad y contexto');
  
  // 1. Detectar entidad principal (persona o evento) con desambiguación
  const detection = detectPrimaryPerson({
    title,
    lead: summary,
    tags,
    content: '' // No usamos contenido completo para performance
  });
  
  const { isPerson, primaryPerson, eventType, eventName, confidence } = detection;
  
  if (eventType) {
    console.log(`[ImageProvider] Evento detectado: ${eventType} "${eventName || 'sin nombre'}" (confidence: ${confidence})`);
  } else if (isPerson) {
    console.log(`[ImageProvider] Persona detectada: "${primaryPerson}" (confidence: ${confidence})`);
  } else {
    console.log('[ImageProvider] No se detectó entidad específica');
  }
  
  // 2. Seleccionar contexto visual basado en contenido (incluye detección de país)
  const contextSelection = selectContext({
    title,
    summary,
    tags,
    sources,
    eventType,
    isPerson
  });
  
  const { contextId, keywords: contextKeywords, country, economicLevel } = contextSelection;
  
  // 3. Intentar obtener imagen de referencia SOLO si es persona
  let refImageUrl = null;
  let usePersonLikeness = false;
  
  if (isPerson && sources && sources.length > 0 && sources[0].url) {
    const sourceUrl = sources[0].url;
    console.log(`[ImageProvider:Likeness] Buscando imagen de referencia para "${primaryPerson}" en: ${sourceUrl}`);
    
    try {
      refImageUrl = await extractPrimaryImageUrlFromPage(sourceUrl);
      
      if (refImageUrl) {
        console.log(`[Likeness] enabled=true ref=${refImageUrl}`);
        usePersonLikeness = true;
      } else {
        console.log('[Likeness] enabled=false ref=none');
      }
    } catch (error) {
      console.warn(`[ImageProvider:Likeness] Error obteniendo referencia: ${error.message}`);
    }
  }
  
  return {
    isPerson,
    primaryPerson,
    eventType,
    eventName,
    refImageUrl,
    usePersonLikeness,
    contextId,
    contextKeywords,
    country,
    economicLevel
  };
}

// REMOVIDO: extractContext (ahora manejado por contextBuilder.js)

/** @feature: Realismo contextual cubano para imágenes IA — Oct 2025 **/
/**
 * Detecta si el contenido está relacionado con Cuba
 * @param {Object} params - { title, summary, category, tags, draft }
 * @returns {Object} { isCuban, locations, confidenceLevel }
 */
function detectCubanContext({ title = '', summary = '', category = '', tags = [], draft = null }) {
  const textToAnalyze = `${title} ${summary} ${category} ${tags.join(' ')}`.toLowerCase();
  
  // Provincias y ciudades cubanas
  const cubanLocations = [
    'cuba', 'cubano', 'cubana', 'habana', 'la habana', 'havana',
    'santiago de cuba', 'santiago', 'camagüey', 'holguín', 'holguin',
    'guantánamo', 'guantanamo', 'pinar del río', 'pinar del rio',
    'matanzas', 'villa clara', 'cienfuegos', 'sancti spíritus', 'sancti spiritus',
    'ciego de ávila', 'ciego de avila', 'las tunas', 'granma', 'artemisa',
    'mayabeque', 'isla de la juventud', 'palma soriano', 'bayamo',
    'santa clara', 'trinidad', 'varadero'
  ];
  
  const detectedLocations = [];
  let confidenceLevel = 'none'; // 'none' | 'low' | 'medium' | 'high'
  
  // Detectar ubicaciones mencionadas
  for (const location of cubanLocations) {
    if (textToAnalyze.includes(location)) {
      detectedLocations.push(location);
    }
  }
  
  // Calcular nivel de confianza
  if (detectedLocations.length >= 2) {
    confidenceLevel = 'high';
  } else if (detectedLocations.length === 1) {
    // Verificar si es Cuba específicamente
    if (detectedLocations[0].includes('cuba') || detectedLocations[0].includes('habana')) {
      confidenceLevel = 'high';
    } else {
      confidenceLevel = 'medium';
    }
  } else if (category === 'Cuba' || category === 'Socio político' || tags.some(t => t.toLowerCase().includes('cuba'))) {
    confidenceLevel = 'low';
  }
  
  return {
    isCuban: confidenceLevel !== 'none',
    locations: detectedLocations,
    confidenceLevel
  };
}

/**
 * DESACTIVADO: No enriquecer con contexto cubano
 * Evita forzar descriptores arquitectónicos/climáticos por geografía
 * @deprecated - No aplicar contexto cubano forzado
 * @param {string} basePrompt - Prompt base
 * @param {Object} cubanContext - Resultado de detectCubanContext
 * @param {string} eventType - Tipo de evento detectado
 * @returns {string} Prompt sin modificar
 */
function enrichPromptWithCubanContext(basePrompt, cubanContext, eventType = null) {
  // NO aplicar contexto cubano - evita forzar clima/arquitectura
  return basePrompt;
}

/**
 * PROVEEDOR HAILUO - MODO CUSTOM (Prompt manual sin modificaciones)
 * @param {Object} params - Parámetros mínimos
 * @returns {Promise<{ok: boolean, b64?: string, url?: string, provider: string}>}
 */
async function providerHailuoCustom({ prompt, draftId = null, _imageContext = null }) {
  const logPrefix = '[ImageProvider:Hailuo:Custom]';
  console.log(`${logPrefix} 🎨 Generando con prompt MANUAL del usuario`);
  
  const apiKey = process.env.MINIMAX_API_KEY;
  const baseUrl = process.env.MINIMAX_IMAGE_BASE_URL || 'https://api.minimax.io';
  
  if (!apiKey) {
    console.error(`${logPrefix} MINIMAX_API_KEY no configurada`);
    return {
      ok: false,
      error: 'MINIMAX_API_KEY no configurada',
      provider: 'hailuo'
    };
  }
  
  // NO hay validación de contexto en modo custom - el usuario tiene control total
  console.log(`${logPrefix} ⚡ SKIP validaciones de contexto (modo custom)`);
  console.log(`${logPrefix} 📏 prompt_length=${prompt.length} chars`);
  
  try {
    const response = await axios.post(
      `${baseUrl}/v1/image_generation`,
      {
        model: 'image-01',
        prompt: prompt, // ← Prompt del usuario TAL CUAL
        aspect_ratio: '16:9',
        response_format: 'url',
        n: 1,
        prompt_optimizer: true
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );
    
    console.log(`${logPrefix} 📡 HTTP status=${response.status}`);
    
    // ✅ VALIDACIÓN ROBUSTA: Verificar que la respuesta contiene URL válida
    // Soporta dos formatos de respuesta de Hailuo:
    // 1. response.data.data[0].url / response.data.data[0].img_url (formato antiguo)
    // 2. response.data.data.image_urls[0] (formato nuevo)
    let imageUrl = null;
    
    // Intentar extraer URL de los diferentes formatos
    if (response?.data?.data) {
      // Formato nuevo: { data: { image_urls: ["http://..."] } }
      if (response.data.data.image_urls && Array.isArray(response.data.data.image_urls) && response.data.data.image_urls[0]) {
        imageUrl = response.data.data.image_urls[0];
        console.log(`${logPrefix} 🎯 URL encontrada en image_urls[0]`);
      }
      // Formato antiguo: { data: [{ url: "http://..." }] }
      else if (Array.isArray(response.data.data) && response.data.data[0]) {
        imageUrl = response.data.data[0].url || response.data.data[0].img_url;
        if (imageUrl) {
          console.log(`${logPrefix} 🎯 URL encontrada en data[0].url`);
        }
      }
    }
    
    // Validar que la URL es válida
    const hasUrl = imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0;
    
    if (!hasUrl) {
      console.warn(`${logPrefix} ❌ Respuesta sin URL de imagen. Posible bloqueo de contenido o fallo del proveedor.`);
      console.warn(`${logPrefix} 📊 HTTP status: ${response?.status}`);
      console.warn(`${logPrefix} 📋 Response data keys: [${response?.data ? Object.keys(response.data).join(', ') : 'none'}]`);
      
      // Log detallado de la respuesta para debugging
      if (response?.data) {
        const responseStr = JSON.stringify(response.data, null, 2);
        const truncated = responseStr.length > 800 ? responseStr.substring(0, 800) + '... (truncado)' : responseStr;
        console.warn(`${logPrefix} 📦 Response.data completo:\n${truncated}`);
      }
      
      // Lanzar error controlado con código específico
      const err = new Error('El proveedor Hailuo no devolvió imagen (posible contenido bloqueado o límite excedido). Prueba con otro prompt o proveedor.');
      err.code = 'HAILUO_NO_IMAGE_URL';
      err.provider = 'hailuo';
      err.userFacing = true; // Marcar como error visible para el usuario
      err.details = response?.data?.base_resp || response?.data || null;
      err.httpStatus = response?.status || null;
      throw err;
    }
    console.log(`${logPrefix} ✅ Imagen generada exitosamente`);
    console.log(`${logPrefix} URL: ${imageUrl.substring(0, 80)}...`);
    
    // Descargar imagen y convertir a base64 para persistirla localmente
    // (evita problemas de CORS, expiración y bloqueo de dominios externos)
    try {
      console.log(`${logPrefix} 📥 Descargando imagen desde CDN de Hailuo...`);
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });
      
      const buffer = Buffer.from(imageResponse.data);
      const b64 = buffer.toString('base64');
      
      console.log(`${logPrefix} ✅ Imagen descargada y convertida a buffer (${(buffer.length / 1024).toFixed(1)}KB)`);
      
      return {
        ok: true,
        b64,
        buffer,
        mimeType: 'image/jpeg',
        provider: 'hailuo',
        kind: 'ai'
      };
    } catch (downloadError) {
      console.error(`${logPrefix} ❌ Error descargando imagen desde CDN:`, downloadError.message);
      // Fallback: devolver URL si la descarga falla
      return {
        ok: true,
        url: imageUrl,
        provider: 'hailuo',
        kind: 'ai'
      };
    }
    
  } catch (error) {
    // Si es nuestro error controlado NO_IMAGE_URL, re-lanzarlo
    if (error.code === 'NO_IMAGE_URL') {
      throw error;
    }
    
    // Otros errores (red, timeout, etc.)
    console.error(`${logPrefix} ❌ Error en llamada HTTP:`, error.message);
    return {
      ok: false,
      error: error.message || 'Error en MiniMax Image API (custom)',
      provider: 'hailuo'
    };
  }
}

/**
 * PROVEEDOR HAILUO (MINIMAX Image API) - MODO CONTEXTUAL
 * @param {Object} params - Parámetros
 * @returns {Promise<{ok: boolean, b64?: string, url?: string, provider: string}>}
 */
async function providerHailuo({ prompt, title, summary, category, draftId = null, topic = null, tags = [], sources = [], draft = null, _imageContext = null }) {
  console.log(`[ImageProvider:Hailuo] Generando con MiniMax Image API`);
  console.log(`[ImageProvider:Hailuo] 🎛️ Modo: ${IMG.PROMPT_MODE.toUpperCase()}`);
  
  const apiKey = process.env.MINIMAX_API_KEY;
  const baseUrl = process.env.MINIMAX_IMAGE_BASE_URL || 'https://api.minimax.io';
  
  if (!apiKey) {
    console.error('[ImageProvider:Hailuo] MINIMAX_API_KEY no configurada');
    return {
      ok: false,
      error: 'MINIMAX_API_KEY no configurada',
      provider: 'hailuo'
    };
  }
  
  // VALIDACIÓN STRICT_MODE: Requiere contexto mínimo o retorna placeholder
  if (IMG.STRICT_MODE) {
    const hasTitle = title && title.trim().length > 0;
    const hasCategory = category && category.trim().length > 0;
    const hasTags = tags && tags.length > 0;
    const hasSummary = summary && summary.trim().length > 0;
    const hasStrongContext = hasTitle && (hasCategory || hasTags || hasSummary);
    
    if (!hasStrongContext) {
      console.warn(`[ImageProvider:Hailuo] ⚠️ Contexto insuficiente: title=${!!hasTitle} category=${!!hasCategory} tags=${tags?.length || 0} summary=${!!hasSummary}`);
      console.log(`[ImageProvider:Hailuo] Retornando placeholder por falta de contexto mínimo`);
      
      if (draftId) {
        return await generateInternalPlaceholder(draftId);
      }
      
      return {
        ok: false,
        error: 'Contexto insuficiente para generar imagen (STRICT_MODE)',
        provider: 'hailuo',
        kind: 'placeholder'
      };
    }
    
    console.log(`[ImageProvider:Hailuo] ✅ Contexto mínimo validado: title=${!!hasTitle} category=${!!hasCategory} tags=${tags?.length || 0}`);
  }
  
  // Usar prompt contextual si está disponible, sino usar sanitizeImagePrompt
  let enhancedPrompt;
  const locale = _imageContext?.locale || 'es-CU';
  
  if (prompt && prompt.trim().length > 0) {
    enhancedPrompt = prompt.trim();
    console.log('[ImageProvider:Hailuo] ✅ Usando prompt contextual desde builder');
  } else {
    console.log('[ImageProvider:Hailuo] ⚠️ No hay prompt contextual, usando fallback sanitizeImagePrompt');
    enhancedPrompt = sanitizeImagePrompt({ title, locale });
  }
  
  console.log(`[ImageProvider:Hailuo] prompt_len=${enhancedPrompt.length}`);
  console.log(`[ImageProvider:Hailuo] prompt_preview="${enhancedPrompt.substring(0, 150)}..."`);
  
  try {
    const response = await axios.post(
      `${baseUrl}/v1/image_generation`,
      {
        model: 'image-01',
        prompt: enhancedPrompt,
        aspect_ratio: '16:9',
        response_format: 'url',
        n: 1,
        prompt_optimizer: true
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60s timeout
      }
    );
    
    // 🔍 LOGGING DETALLADO DE RESPUESTA
    console.log(`[ImageProvider:Hailuo] 📡 HTTP status=${response.status} ${response.statusText}`);
    console.log(`[ImageProvider:Hailuo] 📦 Response keys: [${Object.keys(response.data || {}).join(', ')}]`);
    
    // Log estructura básica sin imprimir datos gigantes
    if (response.data) {
      const dataKeys = Object.keys(response.data);
      console.log(`[ImageProvider:Hailuo] 📋 data keys: [${dataKeys.join(', ')}]`);
      
      // Si hay código de error de MiniMax, loguearlo
      if (response.data.code !== undefined) {
        console.log(`[ImageProvider:Hailuo] 📊 code=${response.data.code}`);
      }
      if (response.data.message || response.data.msg) {
        console.log(`[ImageProvider:Hailuo] 💬 message="${response.data.message || response.data.msg}"`);
      }
      if (response.data.base_resp) {
        console.log(`[ImageProvider:Hailuo] 📊 base_resp=${JSON.stringify(response.data.base_resp)}`);
      }
    }
    
    // 🔍 PARSEO FLEXIBLE: Intentar encontrar la imagen en múltiples ubicaciones posibles
    let imageUrl = null;
    let imageBase64 = null;
    
    // Intentar rutas comunes para URL
    const urlPaths = [
      response.data?.data?.image_urls?.[0],           // Minimax format 1: data.image_urls[0]
      response.data?.image_urls?.[0],                 // Minimax format 2: image_urls[0]
      response.data?.data?.images?.[0]?.url,          // Minimax format 3: data.images[0].url
      response.data?.images?.[0]?.url,                // Format 4: images[0].url
      response.data?.result?.images?.[0]?.url,        // Format 5: result.images[0].url
      response.data?.data?.url,                       // Format 6: data.url
      response.data?.url,                             // Format 7: url directo
      response.data?.data?.[0]?.url,                  // Format 8: data[0].url
      response.data?.data?.file_url,                  // Format 9: data.file_url
      response.data?.file_url                         // Format 10: file_url directo
    ];
    
    for (const path of urlPaths) {
      if (path && typeof path === 'string' && path.startsWith('http')) {
        imageUrl = path;
        console.log(`[ImageProvider:Hailuo] 🎯 URL encontrada en: ${path}`);
        break;
      }
    }
    
    // Si no hay URL, intentar base64
    if (!imageUrl) {
      const base64Paths = [
        response.data?.data?.image_base64,
        response.data?.image_base64,
        response.data?.data?.images?.[0]?.base64,
        response.data?.images?.[0]?.base64,
        response.data?.result?.image_base64,
        response.data?.data?.b64,
        response.data?.b64
      ];
      
      for (const path of base64Paths) {
        if (path && typeof path === 'string') {
          imageBase64 = path;
          console.log(`[ImageProvider:Hailuo] 🎯 Base64 encontrado`);
          break;
        }
      }
    }
    
    // Verificar si MiniMax devolvió un error explícito
    if (response.data?.code && response.data.code !== 0 && response.data.code !== '0') {
      const errorMsg = response.data.message || response.data.msg || 'Error desconocido';
      throw new Error(`MiniMax API error: code=${response.data.code}, message="${errorMsg}"`);
    }
    
    // Si no encontramos ni URL ni base64, error detallado
    if (!imageUrl && !imageBase64) {
      console.error(`[ImageProvider:Hailuo] ❌ No se encontró imagen en la respuesta`);
      console.error(`[ImageProvider:Hailuo] 📋 Estructura completa de response.data:`);
      console.error(JSON.stringify(response.data, null, 2).substring(0, 500)); // Primeros 500 chars
      throw new Error('No se encontró URL ni base64 de imagen en la respuesta de MiniMax. Ver logs para detalles.');
    }
    
    // Procesar según lo que encontramos
    let buffer, b64;
    
    if (imageUrl) {
      console.log(`[ImageProvider:Hailuo] ✅ Imagen generada (URL): ${imageUrl.substring(0, 80)}...`);
      
      // Descargar imagen y convertir a buffer
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });
      
      buffer = Buffer.from(imageResponse.data);
      b64 = buffer.toString('base64');
      
      console.log(`[ImageProvider:Hailuo] ✅ Imagen descargada y convertida a buffer (${(buffer.length / 1024).toFixed(1)}KB)`);
    } else if (imageBase64) {
      console.log(`[ImageProvider:Hailuo] ✅ Imagen generada (base64)`);
      
      // Limpiar base64 si tiene prefijo data:image/...
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
      b64 = cleanBase64;
      
      console.log(`[ImageProvider:Hailuo] ✅ Base64 convertido a buffer (${(buffer.length / 1024).toFixed(1)}KB)`);
    }
    
    return {
      ok: true,
      b64,
      buffer,
      mimeType: 'image/png',
      provider: 'hailuo',
      attempt: 1,
      promptLevel: 'contextual',
      kind: 'ai',
      imageMeta: {
        provider: 'hailuo',
        variant: 'minimax',
        context: _imageContext?.theme || 'general',
        contextKeywords: _imageContext?.keywords || [],
        country: _imageContext?.country || null,
        economicLevel: 'neutral'
      }
    };
    
  } catch (error) {
    // 🔍 LOGGING DETALLADO DE ERROR
    console.error(`[ImageProvider:Hailuo] ❌ Error: ${error.message}`);
    
    // Si hay respuesta HTTP, loguear detalles
    if (error.response) {
      console.error(`[ImageProvider:Hailuo] 📡 HTTP status=${error.response.status} ${error.response.statusText}`);
      console.error(`[ImageProvider:Hailuo] 📦 Response data keys: [${Object.keys(error.response.data || {}).join(', ')}]`);
      
      // Log estructura de error de MiniMax
      if (error.response.data) {
        const errorData = error.response.data;
        if (errorData.code) {
          console.error(`[ImageProvider:Hailuo] 📊 MiniMax error code=${errorData.code}`);
        }
        if (errorData.message || errorData.msg) {
          console.error(`[ImageProvider:Hailuo] 💬 MiniMax message="${errorData.message || errorData.msg}"`);
        }
        if (errorData.error) {
          console.error(`[ImageProvider:Hailuo] 💬 MiniMax error="${errorData.error}"`);
        }
        // Log completo pero limitado (primeros 300 chars)
        console.error(`[ImageProvider:Hailuo] 📋 Response data: ${JSON.stringify(errorData).substring(0, 300)}`);
      }
    } else if (error.request) {
      console.error(`[ImageProvider:Hailuo] 🚫 No se recibió respuesta del servidor (timeout o red)`);
    }
    
    // Si tenemos draftId, intentar con placeholder
    if (draftId) {
      console.log(`[ImageProvider:Hailuo] 🔄 Fallback a placeholder...`);
      return await generateInternalPlaceholder(draftId);
    }
    
    return {
      ok: false,
      error: error.message,
      provider: 'hailuo',
      errorCode: error.response?.status === 400 ? 'safety_block' : (error.response?.status || 'unknown')
    };
  }
}

/**
 * PROVEEDOR DALL·E - MODO CUSTOM (Prompt manual sin modificaciones)
 * @param {Object} params - Parámetros mínimos
 * @returns {Promise<{ok: boolean, b64?: string, provider: string}>}
 */
async function providerDallECustom({ prompt, model = 'dall-e-3', draftId = null, _imageContext = null }) {
  const logPrefix = '[ImageProvider:DALL-E:Custom]';
  console.log(`${logPrefix} 🎨 Generando con prompt MANUAL del usuario`);
  console.log(`${logPrefix} Modelo: ${model}`);
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, project: process.env.OPENAI_PROJECT_ID });
  
  // Validación mínima de modelo
  const validModels = ['dall-e-3', 'dall-e-2'];
  if (!validModels.includes(model)) {
    console.error(`${logPrefix} ❌ Modelo inválido: "${model}"`);
    return {
      ok: false,
      error: `Modelo inválido: "${model}"`,
      provider: model
    };
  }
  
  // NO hay validación de contexto en modo custom - el usuario tiene control total
  console.log(`${logPrefix} ⚡ SKIP validaciones de contexto (modo custom)`);
  console.log(`${logPrefix} 📏 prompt_length=${prompt.length} chars`);
  
  try {
    const response = await openai.images.generate({
      model: model,
      prompt: prompt, // ← Prompt del usuario TAL CUAL
      n: 1,
      size: '1792x1024',
      quality: 'standard',
      response_format: 'b64_json'
    });
    
    // ✅ VALIDACIÓN ROBUSTA: Verificar que la respuesta contiene imagen válida
    const hasImage = 
      response?.data &&
      Array.isArray(response.data) &&
      response.data[0] &&
      typeof response.data[0].b64_json === 'string' &&
      response.data[0].b64_json.trim().length > 0;
    
    if (!hasImage) {
      console.warn(`${logPrefix} ❌ Respuesta sin imagen base64. Posible error del proveedor.`, {
        data_length: response?.data?.length || 0
      });
      
      // Lanzar error controlado con código específico
      const err = new Error('OpenAI no devolvió imagen válida (posible error interno del proveedor).');
      err.code = 'NO_IMAGE_DATA';
      err.provider = model;
      throw err;
    }
    
    const image = response.data[0];
    console.log(`${logPrefix} ✅ Imagen generada exitosamente`);
    console.log(`${logPrefix} Base64 length: ${(image.b64_json.length / 1024).toFixed(1)}KB`);
    
    return {
      ok: true,
      b64: image.b64_json,
      provider: model,
      kind: 'ai'
    };
  } catch (error) {
    // Si es nuestro error controlado NO_IMAGE_DATA, re-lanzarlo
    if (error.code === 'NO_IMAGE_DATA') {
      throw error;
    }
    
    // Manejo especial de errores de contenido de OpenAI
    if (error.message && error.message.includes('content_policy')) {
      console.warn(`${logPrefix} ⚠️ Contenido bloqueado por política de OpenAI`);
      const err = new Error('OpenAI bloqueó el contenido por violar sus políticas. Prueba con una descripción más neutral.');
      err.code = 'CONTENT_POLICY_VIOLATION';
      err.provider = model;
      err.originalError = error.message;
      throw err;
    }
    
    // Otros errores (red, timeout, etc.)
    console.error(`${logPrefix} ❌ Error en llamada a OpenAI:`, error.message);
    return {
      ok: false,
      error: error.message || 'Error en DALL-E (custom)',
      provider: model
    };
  }
}

/**
 * PROVEEDOR DALL·E (OpenAI) - MODO CONTEXTUAL
 * @param {Object} params - Parámetros
 * @returns {Promise<{ok: boolean, b64?: string, url?: string, provider: string}>}
 */
async function providerDallE({ prompt, title, summary, category, model = 'dall-e-3', draftId = null, sourceImage = null, topic = null, tags = [], sources = [], draft = null, _imageContext = null }) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, project: process.env.OPENAI_PROJECT_ID });
  
  // VALIDACIÓN DE MODELO: Solo aceptar modelos válidos de OpenAI
  const validModels = ['dall-e-3', 'dall-e-2'];
  if (!validModels.includes(model)) {
    console.error(`[ImageProvider:DALL-E] ❌ Modelo inválido: "${model}". Modelos válidos: ${validModels.join(', ')}`);
    return {
      ok: false,
      error: `Modelo inválido para DALL-E: "${model}". Este proveedor solo acepta: ${validModels.join(', ')}`,
      provider: model,
      errorCode: 'invalid_model'
    };
  }
  
  console.log(`[ImageProvider:DALL-E] Generando con modelo ${model}`);
  console.log(`[ImageProvider:DALL-E] 🎛️ Modo: ${IMG.PROMPT_MODE.toUpperCase()}`);
  
  // VALIDACIÓN STRICT_MODE: Requiere contexto mínimo o retorna placeholder
  if (IMG.STRICT_MODE) {
    const hasTitle = title && title.trim().length > 0;
    const hasCategory = category && category.trim().length > 0;
    const hasTags = tags && tags.length > 0;
    const hasSummary = summary && summary.trim().length > 0;
    const hasStrongContext = hasTitle && (hasCategory || hasTags || hasSummary);
    
    if (!hasStrongContext) {
      console.warn(`[ImageProvider:STRICT] ⚠️ Contexto insuficiente: title=${!!hasTitle} category=${!!hasCategory} tags=${tags?.length || 0} summary=${!!hasSummary}`);
      console.log(`[ImageProvider:STRICT] Retornando placeholder por falta de contexto mínimo`);
      
      // Generar placeholder en lugar de imagen sin contexto
      if (draftId) {
        return await generateInternalPlaceholder(draftId);
      }
      
      return {
        ok: false,
        error: 'Contexto insuficiente para generar imagen (STRICT_MODE)',
        provider: model,
        kind: 'placeholder'
      };
    }
    
    console.log(`[ImageProvider:STRICT] ✅ Contexto mínimo validado: title=${!!hasTitle} category=${!!hasCategory} tags=${tags?.length || 0}`);
  }
  
  // ========== DETECCIÓN DESACTIVADA (sin filtros propios) ==========
  // Solo se aplica la validación del proveedor (OpenAI / DALL·E)
  const shouldDisableRaw = false; // Sin detección de contenido sensible
  
  console.log('[ImageProvider:Safety] (NO-OP) Detección de contenido sensible DESACTIVADA');
  console.log('[ImageProvider:Safety] Solo validación del proveedor (OpenAI/DALL·E) activa');
  
  // ========== MODO RAW: BYPASS COMPLETO (solo si no hay contenido sensible) ==========
  if (isRawMode() && !shouldDisableRaw) {
    console.log('[ImageProvider:DALL-E] 🚀 MODO RAW ACTIVO - Prompt passthrough sin modificaciones');
    
    // Construir prompt directo sin negativos (estilo cómic editorial simple)
    const finalRawPrompt = prompt || title || 'Editorial illustration in full color, modern comic / graphic novel style. Expressive characters and setting, bold contours and vivid colors, professional quality';
    
    console.log(`[ImageProvider:RAW] prompt_len=${finalRawPrompt.length}`);
    console.log(`[ImageProvider:RAW] (NO-OP) Sin negativos automáticos - solo validación del proveedor`);
    
    try {
      const response = await openai.images.generate({
        model,
        prompt: finalRawPrompt,
        size: model === 'dall-e-3' ? '1792x1024' : '1024x1024',
        quality: 'standard',
        n: 1,
        response_format: 'b64_json',
      });
      
      const b64 = response.data?.[0]?.b64_json;
      const revised = response.data?.[0]?.revised_prompt || '';
      
      if (!b64) {
        throw new Error('No se recibió imagen en la respuesta');
      }
      
      console.log(`[ImageProvider:RAW] ✅ Generación exitosa`);
      if (revised) {
        console.log(`[ImageProvider:RAW] revised="${revised.substring(0, 120)}..."`);
      }
      
      return {
        ok: true,
        b64,
        provider: model,
        attempt: 1,
        promptLevel: 'raw',
        kind: 'ai',
        textFree: false, // Sin filtros propios
        antiTextRules: 'disabled', // Filtros desactivados
        likenessMetadata: {
          likeness: false,
          person: null,
          event: null,
          reference: null,
          reason: 'raw_mode'
        },
        imageMeta: {
          provider: model,
          variant: 'raw',
          likeness: false,
          reference: null,
          context: 'raw',
          contextKeywords: [],
          country: null,
          economicLevel: 'neutral'
        }
      };
    } catch (error) {
      console.error(`[ImageProvider:RAW] Error: ${error.message}`);
      
      // Si es error 400 de safety, intentar con sanitizador
      if (error.status === 400 && isSanitizerEnabled()) {
        console.log('[ImageProvider:Safety] Error 400 detectado → activando sanitizador para reintento');
        // Continuar al flujo augmented con sanitización
      } else {
        return {
          ok: false,
          error: error.message,
          provider: model,
          errorCode: error.status === 400 ? 'safety_block' : 'unknown'
        };
      }
    }
  }
  
  // ========== MODO AUGMENTED: USAR CONTEXTO PRE-DECIDIDO O DETECTAR ==========
  let contextId, contextKeywords, country, economicLevel, isPerson, primaryPerson, eventType, eventName, refImageUrl, usePersonLikeness;
  
  if (_imageContext) {
    // Usar contexto pre-decidido en redactor.js con METADATA COMPLETA
    contextId = _imageContext.theme || 'general';
    contextKeywords = _imageContext.keywords || [];
    country = _imageContext.country || null;
    economicLevel = 'neutral';
    
    console.log(`[ImageProvider:DALL-E] ✅ Usando tema PRE-DECIDIDO: ${contextId} (isDisaster=${_imageContext.isDisaster})`);
    console.log(`[ImageProvider:Context] locale=${_imageContext.locale || 'es-CU'} style=${_imageContext.style || 'news_photojournalism'}`);
    console.log(`[ImageProvider:Context] category="${_imageContext.category || 'N/A'}" country=${country || 'not detected'}`);
    console.log(`[ImageProvider:Context] tags=[${(_imageContext.tags || []).slice(0, 3).join(', ')}] entities=[${(_imageContext.entities || []).slice(0, 3).join(', ')}]`);
    console.log(`[ImageProvider:Context] negativePrompt="${(_imageContext.negativePrompt || '').substring(0, 100)}..."`);
    
    // Aún necesitamos detectar persona para modo likeness
    const entityData = await detectPersonAndReference({
      title,
      summary,
      tags,
      sources
    });
    
    isPerson = entityData.isPerson;
    primaryPerson = entityData.primaryPerson;
    eventType = _imageContext.isDisaster ? 'disaster' : null; // Solo si fue marcado como desastre
    eventName = null;
    refImageUrl = entityData.refImageUrl;
    usePersonLikeness = entityData.usePersonLikeness;
    
    console.log(`[ImageProvider:DALL-E] Persona detectada: ${isPerson ? primaryPerson : 'ninguna'}, likeness=${usePersonLikeness}`);
  } else {
    // Fallback: detectar contexto (legacy, no debería usarse si se llama desde redactor.js)
    console.warn(`[ImageProvider:DALL-E] ⚠️ LEGACY MODE: No se recibió _imageContext, detectando contexto...`);
    const entityData = await detectPersonAndReference({
      title,
      summary,
      tags,
      sources
    });
    
    ({ isPerson, primaryPerson, eventType, eventName, refImageUrl, usePersonLikeness, contextId, contextKeywords, country, economicLevel } = entityData);
  }
  
  // Obtener reglas de contexto con adaptación económica
  const contextRules = getContextRules(contextId, economicLevel);
  
  let likenessMetadata = {
    likeness: false,
    person: primaryPerson || null,
    event: eventType ? `${eventType}:${eventName || 'unnamed'}` : null,
    reference: null,
    reason: null
  };
  
  // Extraer rasgos visuales de la imagen de referencia si existe
  let visualCues = null;
  let refImageBuffer = null;
  
  if (usePersonLikeness && refImageUrl) {
    try {
      console.log(`[ImageProvider:DALL-E] 📸 Descargando imagen de referencia para likeness...`);
      const response = await axios.get(refImageUrl, { 
        responseType: 'arraybuffer',
        timeout: 8000,
        maxContentLength: 5 * 1024 * 1024
      });
      refImageBuffer = Buffer.from(response.data);
      visualCues = await extractVisualCues(refImageBuffer);
      console.log(`[ImageProvider:DALL-E] Rasgos extraídos de referencia: composición="${visualCues.composition}", paleta=${visualCues.palette.primary}`);
    } catch (error) {
      console.warn('[ImageProvider:DALL-E] No se pudo procesar imagen de referencia:', error.message);
      // Continuar sin referencia visual
    }
  } else if (sourceImage) {
    // Fallback: usar sourceImage original si no hay likeness
    try {
      const imageBuffer = Buffer.isBuffer(sourceImage) ? sourceImage : await axios.get(sourceImage, { responseType: 'arraybuffer' }).then(r => Buffer.from(r.data));
      visualCues = await extractVisualCues(imageBuffer);
      console.log(`[ImageProvider:DALL-E] Rasgos extraídos: composición="${visualCues.composition}", paleta=${visualCues.palette.primary}`);
    } catch (error) {
      console.warn('[ImageProvider:DALL-E] No se pudieron extraer rasgos de fuente:', error.message);
    }
  }
  
  // ========== USAR PROMPT CONTEXTUAL SI ESTÁ DISPONIBLE ==========
  let enhancedPrompt;
  let mode = 'contextual-v2';
  
  const locale = _imageContext?.locale || 'es-CU';
  
  // Prioridad 1: Usar prompt contextual recibido desde redactor.js
  if (prompt && prompt.trim().length > 0) {
    enhancedPrompt = prompt.trim();
    mode = 'contextual-v2';
    console.log('[ImageProvider:DALL-E] ✅ Usando prompt contextual desde builder');
    console.log(`[ImageProvider:Contextual] prompt="${enhancedPrompt.substring(0, 150)}..."`);
  } else {
    // Fallback: usar sanitizeImagePrompt solo si no hay prompt contextual
    console.log('[ImageProvider:DALL-E] ⚠️ No hay prompt contextual, usando fallback sanitizeImagePrompt');
    enhancedPrompt = sanitizeImagePrompt({
      title,
      locale
    });
    mode = 'title-fallback';
    console.log(`[ImageProvider:Fallback] prompt="${enhancedPrompt.substring(0, 120)}..."`);
  }
  
  likenessMetadata = {
    likeness: false,
    person: primaryPerson || null,
    event: eventType ? `${eventType}:${eventName || 'unnamed'}` : null,
    reference: null,
    reason: mode === 'contextual-v2' ? 'contextual_builder' : 'title_fallback'
  };
  
  console.log(`[ImageProvider] promptGenerated mode=${mode}`);
  console.log(`[ImageProvider] prompt_len=${enhancedPrompt.length} retry=0`);
  console.log(`[ImageProvider] contextId=${contextId} keywords=[${contextKeywords.join(', ')}]`);
  if (country) {
    console.log(`[ImageProvider] country=${country} economicLevel=${economicLevel}`);
  }
  
  // Construir array de intentos usando el prompt contextual o fallback
  const attempts = [
    { prompt: enhancedPrompt, level: mode, retryCount: 0 }
  ];
  
  // Intento 2: Prompt genérico neutral (sin mencionar tema específico)
  const neutralPrompt = createNeutralPrompt();
  attempts.push({ prompt: neutralPrompt, level: 'generic-neutral', retryCount: 1 });
  
  // Intento 3: Fallback ultra genérico
  const fallbackPrompt = getGenericFallbackPrompt(locale);
  attempts.push({ prompt: fallbackPrompt, level: 'generic-fallback', retryCount: 2 });
  
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    
    try {
      console.log(`[ImageProvider:DALL-E] Intento ${i + 1}/${attempts.length} (${attempt.level})`);
      
      // Log del payload completo para debugging
      const payload = {
        model,
        prompt: attempt.prompt,
        size: model === 'dall-e-3' ? '1792x1024' : '1024x1024',
        quality: 'standard',
        n: 1,
        response_format: 'b64_json'
      };
      
      const effectiveLocale = _imageContext?.locale || 'es-CU';
      const effectiveStyle = _imageContext?.style || 'news_photojournalism';
      
      console.log(`[ImagePayload] model=${payload.model} size=${payload.size} locale=${effectiveLocale} style=${effectiveStyle}`);
      console.log(`[ImagePayload] provider=${payload.model} source=title_always prompt_len=${attempt.prompt.length}`);
      console.log(`[ImagePayload] prompt_preview="${attempt.prompt.substring(0, 150)}..."`);
      
      const response = await openai.images.generate(payload);
      
      const b64 = response.data?.[0]?.b64_json;
      const revised = response.data?.[0]?.revised_prompt || '';
      
      if (!b64) {
        throw new Error('No se recibió imagen en la respuesta');
      }
      
      console.log(`[ImageProvider:DALL-E] ✅ Imagen generada exitosamente`);
      console.log(`[ImageProvider] prompt_len=${attempt.prompt.length} retry=${attempt.retryCount}`);
      console.log(`[Likeness] enabled=${likenessMetadata.likeness} ref=${refImageUrl || 'none'}`);
      if (revised) {
        console.log(`[ImageProvider:QA] revised_prompt="${revised.substring(0, 160)}${revised.length > 160 ? '…' : ''}"`);
      }
      
      // ========== SIN QA GATING NI OVERLAY DE BANDERAS (desactivado) ==========
      console.log(`[ImageProvider:FlagOverlay] (NO-OP) Overlay de banderas DESACTIVADO`);
      
      let finalB64 = b64; // Imagen sin overlay
      let flagsApplied = [];
      
      return {
        ok: true,
        b64: finalB64,
        provider: model,
        attempt: i + 1,
        promptLevel: attempt.level,
        kind: 'ai', // Siempre 'ai' para imágenes generadas por IA
        textFree: false, // Sin filtros propios, solo validación del proveedor
        antiTextRules: 'disabled', // Filtros propios desactivados
        // Metadata de likeness
        likenessMetadata,
        // Metadata de imagen con variant, contexto y economía
        imageMeta: {
          provider: model,
          variant: mode, // 'likeness' | 'context'
          likeness: likenessMetadata.likeness,
          reference: likenessMetadata.reference,
          context: contextId, // ID del contexto seleccionado
          contextKeywords: contextKeywords, // Keywords que dispararon la selección
          country: country || null, // País detectado
          economicLevel: economicLevel || 'neutral', // Nivel económico aplicado
          flagsApplied: null, // Overlay de banderas desactivado
          flagOverlay: false // Overlay desactivado
        }
      };
      
    } catch (error) {
      console.warn(`[ImageProvider:DALL-E] Intento ${i + 1} fallido:`, error.message);
      
      // Si es error 400 (safety), continuar al siguiente intento
      if (error.status === 400 && i < attempts.length - 1) {
        console.log(`[ImageProvider:Safety] 400 blocked → retry=${attempt.level}`);
        console.log(`[ImageSafety] HTTP 400 safety block detected → escalating to attempt ${i + 2}`);
        continue;
      }
      
      // Si es el último intento, retornar con información completa
      if (i === attempts.length - 1) {
        console.error(`[ImageProvider:DALL-E] Todos los intentos fallaron`);
        console.error(`[ImageSafety] Final failure after ${attempts.length} attempts`);
        
        // Si tenemos draftId, intentar con proveedor internal como último recurso
        if (draftId) {
          console.log(`[ImageProvider:DALL-E] Fallback a proveedor internal...`);
          // No podemos llamar a providerInternal aquí porque necesitamos topic/draft
          // En su lugar, retornamos error y el caller manejará el fallback
        }
        
        return {
          ok: false,
          error: error.message,
          errorCode: error.status === 400 ? 'safety_block' : 'unknown',
          provider: model,
          finalAttempt: i + 1,
          titleSanitized: true,
          message: error.status === 400 
            ? 'Contenido bloqueado por sistema de seguridad. Intente regenerar la imagen.'
            : error.message
        };
      }
    }
  }
  
  return {
    ok: false,
    error: 'Todos los intentos fallaron',
    provider: model
  };
}

/**
 * Registry principal de proveedores
 * @param {Object} params - Parámetros de generación
 * @returns {Promise<{ok: boolean, url?: string, b64?: string, error?: string}>}
 */
async function generateWithProvider(params) {
  const {
    provider = 'dall-e-3',
    mode = 'auto', // 'auto' | 'extract' | 'synthesize_from_source' | 'synthesize_from_context' | 'custom_prompt'
    draftId,
    topic,
    draft,
    prompt,
    title = '',
    summary = '',
    category = '',
    _imageContext = null
  } = params;
  
  // Respetar FORCE_PROVIDER si está configurado
  const effectiveProvider = IMG.FORCE_PROVIDER || provider;
  
  if (IMG.FORCE_PROVIDER) {
    console.log(`[ImageProvider] 🔒 Proveedor FORZADO: ${IMG.FORCE_PROVIDER} (ignora lógica interna)`);
  }
  
  console.log(`[ImageProvider] Generando con proveedor: ${effectiveProvider}, mode: ${mode}`);
  
  try {
    /** @feature: MODO CUSTOM_PROMPT - Prompt manual del usuario SIN modificaciones — Nov 2025 **/
    // Modo CUSTOM: El usuario escribió un prompt manual que debe usarse TAL CUAL
    if (mode === 'custom_prompt') {
      console.log(`[ImageProvider] 🎨 mode=custom_prompt provider=${effectiveProvider}`);
      console.log(`[ImageProvider:CustomPrompt] ⚡ BYPASS total de validaciones y builders`);
      
      // Validación mínima: solo verificar que hay un prompt
      if (!prompt || prompt.trim().length === 0) {
        console.error('[ImageProvider:CustomPrompt] ❌ Error: prompt vacío en modo custom');
        return {
          ok: false,
          error: 'Prompt vacío en modo custom_prompt',
          provider: effectiveProvider
        };
      }
      
      // Recorte de longitud si es necesario (sin reescritura semántica)
      const maxLength = 4000; // Límite razonable para la mayoría de proveedores
      let finalPrompt = prompt.trim();
      if (finalPrompt.length > maxLength) {
        console.warn(`[ImageProvider:CustomPrompt] ⚠️ Prompt demasiado largo (${finalPrompt.length} chars), recortando a ${maxLength}`);
        finalPrompt = finalPrompt.substring(0, maxLength);
      }
      
      // ⭐ LOG CRÍTICO: Mostrar el prompt EXACTO que se enviará al proveedor
      console.log(`[CustomPrompt] ═══════════════════════════════════════════════════════`);
      console.log(`[CustomPrompt] 📤 FINAL prompt enviado al proveedor (${finalPrompt.length} chars):`);
      console.log(`[CustomPrompt] "${finalPrompt}"`);
      console.log(`[CustomPrompt] ═══════════════════════════════════════════════════════`);
      
      // Rutear directamente al proveedor SIN pasar por builders ni validaciones
      if (effectiveProvider === 'hailuo') {
        return await providerHailuoCustom({
          prompt: finalPrompt,
          draftId,
          _imageContext
        });
      } else if (effectiveProvider === 'dall-e-3' || effectiveProvider === 'dall-e-2') {
        return await providerDallECustom({
          prompt: finalPrompt,
          model: effectiveProvider,
          draftId,
          _imageContext
        });
      } else if (effectiveProvider === 'gemini') {
        return await providerGemini({
          prompt: finalPrompt,
          draftId,
          _imageContext
        });
      } else {
        console.warn(`[ImageProvider:CustomPrompt] Proveedor ${effectiveProvider} no soportado en modo custom, usando fallback`);
        return {
          ok: false,
          error: `Proveedor ${effectiveProvider} no soportado en modo custom_prompt`,
          provider: effectiveProvider
        };
      }
    }
    
    /** @feature: opción "Generar desde contexto" (sin referencia) — Oct 2025 **/
    // Modo 0: synthesize_from_context - generar SOLO desde contexto, sin referencia
    if (mode === 'synthesize_from_context') {
      console.log(`[ImageProvider] mode=synthesize_from_context provider=${effectiveProvider}`);
      
      // No extraer imagen, generar directamente con contexto del borrador
      const tags = draft?.etiquetas || [];
      const sources = draft?.fuentes || topic?.fuentesTop || [];
      
      console.log(`[ImageProvider] AIProviderSelected=${effectiveProvider} referenced=false`);
      
      // Rutear según el proveedor seleccionado
      if (effectiveProvider === 'hailuo') {
        return await providerHailuo({
          prompt,
          title,
          summary,
          category,
          draftId,
          topic,
          tags,
          sources,
          draft,
          _imageContext
        });
      } else if (effectiveProvider === 'dall-e-3' || effectiveProvider === 'dall-e-2') {
        const dallEResult = await providerDallE({
          prompt,
          title,
          summary,
          category,
          model: effectiveProvider,
          draftId,
          sourceImage: null, // Sin imagen de referencia
          sourceBuffer: null, // Sin buffer de referencia
          topic,
          tags,
          sources,
          draft,
          _imageContext
        });
        
        // Marcar que NO usó referencia
        if (dallEResult.ok) {
          dallEResult.usedSource = false;
          dallEResult.referenceUrl = null;
          console.log(`[ImageProvider] AIProviderSelected=${effectiveProvider} referenced=false result=ok`);
        }
        
        return dallEResult;
      } else if (effectiveProvider === 'gemini') {
        const geminiResult = await providerGemini({
          prompt,
          title,
          summary,
          category,
          draftId,
          _imageContext
        });
        
        if (geminiResult.ok) {
          geminiResult.usedSource = false;
          geminiResult.referenceUrl = null;
        }
        
        return geminiResult;
      } else {
        // Proveedor desconocido, fallback a switch principal
        console.warn(`[ImageProvider] Proveedor ${effectiveProvider} no soportado en mode=synthesize_from_context, usando switch`);
      }
    }
    
    /** @fix: Generar IA encadenado (extraer→referenciar→proveedor seleccionado) — 2025-10 */
    // Modo 1: synthesize_from_source - extraer referencia y generar con proveedor seleccionado
    if (mode === 'synthesize_from_source') {
      console.log(`[ImageProvider] trigger=generate-ia mode=synthesize_from_source provider=${effectiveProvider}`);
      
      // Paso A: Extraer imagen de fuente como referencia temporal
      const referenceResult = await fetchSourceImageForReference(topic, draft);
      
      // Paso B: Generar con proveedor seleccionado (con o sin referencia)
      const tags = draft?.etiquetas || [];
      const sources = draft?.fuentes || topic?.fuentesTop || [];
      
      console.log(`[ImageProvider] AIProviderSelected=${effectiveProvider} referenced=${referenceResult.sourceUsed}`);
      
      // Rutear según el proveedor seleccionado
      if (effectiveProvider === 'hailuo') {
        // Hailuo no usa imagen de referencia, genera solo desde prompt
        const hailuoResult = await providerHailuo({
          prompt,
          title,
          summary,
          category,
          draftId,
          topic,
          tags,
          sources,
          draft,
          _imageContext
        });
        
        if (hailuoResult.ok) {
          hailuoResult.usedSource = false; // Hailuo no usa referencia visual
          hailuoResult.referenceUrl = null;
        }
        
        return hailuoResult;
      } else if (effectiveProvider === 'dall-e-3' || effectiveProvider === 'dall-e-2') {
        const dallEResult = await providerDallE({
          prompt,
          title,
          summary,
          category,
          model: effectiveProvider,
          draftId,
          sourceImage: referenceResult.imageUrl || referenceResult.localPath,
          sourceBuffer: referenceResult.imageBuffer,
          topic,
          tags,
          sources,
          draft,
          _imageContext
        });
        
        // Añadir metadata de referencia
        if (dallEResult.ok) {
          dallEResult.usedSource = referenceResult.sourceUsed;
          dallEResult.referenceUrl = referenceResult.url;
        }
        
        return dallEResult;
      } else if (effectiveProvider === 'gemini') {
        const geminiResult = await providerGemini({
          prompt,
          title,
          summary,
          category,
          draftId,
          _imageContext
        });
        
        if (geminiResult.ok) {
          geminiResult.usedSource = false;
          geminiResult.referenceUrl = null;
        }
        
        return geminiResult;
      } else {
        // Proveedor desconocido, fallback a switch principal
        console.warn(`[ImageProvider] Proveedor ${effectiveProvider} no soportado en mode=synthesize_from_source, usando switch`);
      }
    }
    
    // Modo 2: extract - priorizar proveedor internal (imagen procesada)
    const hasSources = Boolean(topic?.fuentesTop?.length || draft?.fuentes?.length);
    if (mode === 'extract' && hasSources && draftId) {
      console.log('[ImageProvider] sourceUsed=real_image candidate → intentando proveedor internal');
      const internalRes = await providerInternal({ draftId, topic, draft, force: false });
      if (internalRes?.ok) {
        console.log('[ImageProvider] AIProviderSelected=internal result=ok');
        return internalRes;
      }
      // 🐛 FIX: En modo extract, NO hacer fallback a IA - lanzar error controlado
      console.error('[ImageProvider] Proveedor internal falló en modo extract');
      const extractError = new Error('No se pudo capturar la imagen desde el sitio de la noticia. Verifica que la URL original contenga imágenes válidas.');
      extractError.code = 'EXTRACT_FAILED';
      extractError.userFacing = true;
      throw extractError;
    }
    
    // Si mode === 'extract' pero no hay fuentes, también es error
    if (mode === 'extract' && !hasSources) {
      console.error('[ImageProvider] Modo extract solicitado pero no hay fuentes disponibles');
      const noSourceError = new Error('No hay URL de fuente disponible para capturar imagen');
      noSourceError.code = 'NO_SOURCE_URL';
      noSourceError.userFacing = true;
      throw noSourceError;
    }

    switch (effectiveProvider) {
      case 'gemini':
        console.log('[ImageProvider] AIProviderSelected=Gemini (Google AI)');
        return await providerGemini({
          prompt,
          title,
          summary,
          category,
          draftId,
          _imageContext
        });
      
      case 'hailuo':
        console.log('[ImageProvider] AIProviderSelected=Hailuo (MiniMax)');
        return await providerHailuo({
          prompt,
          title,
          summary,
          category,
          draftId,
          topic,
          tags: draft?.etiquetas || [],
          sources: draft?.fuentes || topic?.fuentesTop || [],
          draft,
          _imageContext
        });
      
      case 'dall-e-3':
      case 'dall-e-2':
        // Extraer URL de imagen fuente del topic o draft
        let sourceImageUrl = null;
        if (topic?.fuentesTop?.length > 0) {
          sourceImageUrl = topic.fuentesTop[0].imageUrl || topic.fuentesTop[0].urlToImage;
        } else if (draft?.fuentes?.length > 0) {
          sourceImageUrl = draft.fuentes[0].imageUrl;
        }
        
        // Extraer tags y sources para sistema de likeness
        const tags = draft?.etiquetas || [];
        const sources = draft?.fuentes || topic?.fuentesTop || [];
        
        console.log('[ImageProvider] AIProviderSelected=OpenAI images');
        return await providerDallE({
          prompt,
          title,
          summary,
          category,
          model: effectiveProvider,
          draftId,
          sourceImage: sourceImageUrl,
          topic,
          tags,
          sources,
          draft,
          _imageContext
        });
      
      default:
        console.warn(`[ImageProvider] Proveedor desconocido: ${effectiveProvider}, usando dall-e-3`);
        return await providerDallE({
          prompt,
          title,
          summary,
          category,
          model: 'dall-e-3',
          draftId,
          sourceImage: null,
          topic,
          draft,
          _imageContext
        });
    }
  } catch (error) {
    console.error(`[ImageProvider] Error en generación:`, error.message);
    
    // Si es un error controlado user-facing (como HAILUO_NO_IMAGE_URL), NO generar placeholder
    // Re-lanzar el error para que llegue al controlador de API y se muestre al usuario
    if (error.userFacing || error.code === 'HAILUO_NO_IMAGE_URL' || error.code === 'NO_IMAGE_URL') {
      console.warn(`[ImageProvider] ⚠️ Error user-facing detectado (${error.code}), propagando sin fallback`);
      throw error;
    }
    
    // Para otros errores técnicos (red, timeout, etc.), usar placeholder como último recurso
    console.error(`[ImageProvider] ❌ Error fatal técnico, intentando fallback a placeholder`);
    if (draftId) {
      console.log('[ImageProvider] fallbackTriggered=placeholder');
      return await generateInternalPlaceholder(draftId);
    }
    
    return {
      ok: false,
      error: error.message,
      provider: effectiveProvider
    };
  }
}

/**
 * Proveedor Gemini (Google AI Studio) - Imagen Generation
 * Usa el modelo gemini-2.0-flash-exp con responseModalities: ["image", "text"]
 * @param {Object} params - Parámetros de generación
 * @returns {Promise<{ok: boolean, b64?: string, provider: string}>}
 */
async function providerGemini({ prompt, title, summary, category, draftId = null, _imageContext = null }) {
  const logPrefix = '[ImageProvider:Gemini]';
  console.log(`${logPrefix} 🎨 Generando imagen con Google Gemini`);
  
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error(`${logPrefix} ❌ GOOGLE_AI_API_KEY no configurada`);
    return { ok: false, error: 'GOOGLE_AI_API_KEY no configurada', provider: 'gemini' };
  }
  
  try {
    // Construir prompt para Gemini
    let imagePrompt = prompt;
    if (!imagePrompt && (title || summary)) {
      imagePrompt = `Create a professional news editorial photograph for an article titled: "${title}". ${summary ? `Context: ${summary}` : ''}. Style: photojournalistic, high quality, no text or watermarks.`;
    }
    
    if (!imagePrompt) {
      return { ok: false, error: 'No se proporcionó prompt para generar imagen', provider: 'gemini' };
    }
    
    // Agregar reglas anti-texto
    imagePrompt += ' IMPORTANT: No text, no letters, no words, no watermarks, no logos in the image.';
    
    console.log(`${logPrefix} 📤 Prompt (${imagePrompt.length} chars): "${imagePrompt.substring(0, 200)}..."`);
    
    // Llamar a Gemini API con gemini-2.5-flash-image
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent`,
      {
        contents: [{
          parts: [{ text: imagePrompt }]
        }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"]
        }
      },
      {
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        timeout: 90000
      }
    );
    
    // Extraer imagen de la respuesta
    const candidates = response.data?.candidates;
    if (!candidates || candidates.length === 0) {
      console.error(`${logPrefix} ❌ No hay candidates en la respuesta`);
      console.error(`${logPrefix} Respuesta:`, JSON.stringify(response.data).substring(0, 500));
      return { ok: false, error: 'Gemini no devolvió imagen', provider: 'gemini' };
    }
    
    const parts = candidates[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
    
    if (!imagePart || !imagePart.inlineData?.data) {
      console.error(`${logPrefix} ❌ No se encontró imagen en la respuesta`);
      return { ok: false, error: 'Gemini no generó imagen', provider: 'gemini' };
    }
    
    const b64 = imagePart.inlineData.data;
    console.log(`${logPrefix} ✅ Imagen generada (${(b64.length / 1024).toFixed(1)}KB base64)`);
    
    return {
      ok: true,
      b64,
      provider: 'gemini',
      kind: 'ai'
    };
    
  } catch (error) {
    console.error(`${logPrefix} ❌ Error:`, error.response?.data || error.message);
    return {
      ok: false,
      error: error.response?.data?.error?.message || error.message,
      provider: 'gemini'
    };
  }
}

module.exports = {
  generateWithProvider,
  sanitizeImagePrompt,
  createNeutralPrompt,
  providerInternal,
  providerDallE,
  providerHailuo,
  providerGemini
};
