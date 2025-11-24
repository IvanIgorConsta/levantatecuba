/**
 * Servicio de procesamiento de imágenes reales para noticias
 * Descarga, optimiza y sirve imágenes con estilo unificado
 */

const sharp = require('sharp');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * Extrae URL de imagen desde artículo (OpenGraph, NewsAPI, etc.)
 * @param {Object} article - Artículo/noticia fuente
 * @returns {string|null} URL de imagen o null
 */
function extractImageUrl(article) {
  // Prioridad: og:image > twitter:image > newsAPI.urlToImage > primer <img>
  if (article.ogImage) return article.ogImage;
  if (article.twitterImage) return article.twitterImage;
  if (article.urlToImage) return article.urlToImage;
  if (article.imageUrl) return article.imageUrl;
  
  // Si tiene HTML, buscar primer img
  if (article.content || article.description) {
    const imgMatch = (article.content || article.description).match(/<img[^>]+src="([^">]+)"/);
    if (imgMatch) return imgMatch[1];
  }
  
  return null;
}

/**
 * Descarga imagen desde URL con headers apropiados
 * @param {string} url - URL de la imagen
 * @param {number} timeoutMs - Timeout en milisegundos
 * @returns {Promise<Buffer>} Buffer de la imagen
 */
async function downloadImage(url, timeoutMs = 10000) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*'
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400
    });
    
    return Buffer.from(response.data);
  } catch (error) {
    console.error('[ImageProcessor] Error descargando imagen:', error.message);
    throw new Error(`Download failed: ${error.message}`);
  }
}

/**
 * Procesa imagen con estilo unificado
 * @param {Buffer} buffer - Buffer de imagen original
 * @param {Object} options - Opciones de procesamiento
 * @returns {Promise<{webp: Buffer, avif: Buffer}>} Imágenes procesadas
 */
async function processImage(buffer, options = {}) {
  const {
    width = 1280,
    height = 720,
    quality = 82,
    avifQuality = 58,
    saturation = 1.08,
    contrast = 1.05,
    sharpen = 1.2
  } = options;
  
  try {
    // Pipeline de procesamiento
    const processed = sharp(buffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'attention', // Detecta áreas importantes
        withoutEnlargement: false
      })
      // Ajustes de color y contraste
      .modulate({
        saturation: saturation, // +8%
        brightness: 1.0
      })
      .linear(contrast, -(128 * contrast) + 128) // Contraste +5%
      .sharpen(sharpen); // Sharpen leve
    
    // Generar WebP y AVIF en paralelo
    const [webp, avif] = await Promise.all([
      processed.clone().webp({ quality }).toBuffer(),
      processed.clone().avif({ quality: avifQuality }).toBuffer()
    ]);
    
    return { webp, avif };
    
  } catch (error) {
    console.error('[ImageProcessor] Error procesando imagen:', error.message);
    throw new Error(`Processing failed: ${error.message}`);
  }
}

/**
 * Crea directorio si no existe
 * @param {string} dirPath - Ruta del directorio
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Genera placeholder con gradient cuando no hay imagen
 * @param {number} width - Ancho
 * @param {number} height - Alto
 * @returns {Promise<Buffer>} Buffer WebP del placeholder
 */
async function generatePlaceholder(width = 1280, height = 720) {
  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 24, g: 24, b: 27 } // zinc-900
    }
  })
  .composite([{
    input: Buffer.from(`
      <svg width="${width}" height="${height}">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(39,39,42);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgb(24,24,27);stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#grad)" />
      </svg>
    `),
    top: 0,
    left: 0
  }])
  .webp({ quality: 85 })
  .toBuffer();
}

/**
 * Procesa y guarda imagen de noticia
 * @param {string} newsId - ID de la noticia
 * @param {string} imageUrl - URL de imagen original
 * @returns {Promise<{success: boolean, processed: boolean}>}
 */
async function processNewsImage(newsId, imageUrl) {
  try {
    if (!imageUrl) {
      console.log(`[ImageProcessor] No hay URL de imagen para noticia ${newsId}`);
      return { success: false, processed: false };
    }
    
    // Crear directorio de destino
    const mediaDir = path.join(process.cwd(), 'public', 'media', 'news', newsId);
    await ensureDirectory(mediaDir);
    
    // Descargar imagen
    console.log(`[ImageProcessor] Descargando: ${imageUrl}`);
    const originalBuffer = await downloadImage(imageUrl);
    
    // Procesar imagen
    console.log(`[ImageProcessor] Procesando imagen para ${newsId}`);
    const { webp, avif } = await processImage(originalBuffer);
    
    // Guardar archivos
    await Promise.all([
      fs.writeFile(path.join(mediaDir, 'cover.webp'), webp),
      fs.writeFile(path.join(mediaDir, 'cover.avif'), avif)
    ]);
    
    console.log(`[ImageProcessor] ✅ Imagen procesada y guardada para ${newsId}`);
    
    return { success: true, processed: true };
    
  } catch (error) {
    console.error(`[ImageProcessor] ❌ Error procesando imagen para ${newsId}:`, error.message);
    
    // Generar placeholder si falla
    try {
      const mediaDir = path.join(process.cwd(), 'public', 'media', 'news', newsId);
      await ensureDirectory(mediaDir);
      
      const placeholder = await generatePlaceholder();
      await fs.writeFile(path.join(mediaDir, 'cover.webp'), placeholder);
      
      console.log(`[ImageProcessor] ⚠️ Placeholder generado para ${newsId}`);
    } catch (placeholderError) {
      console.error(`[ImageProcessor] Error generando placeholder:`, placeholderError.message);
    }
    
    return { success: false, processed: false };
  }
}

/**
 * Genera ETag para cache
 * @param {string} filePath - Ruta del archivo
 * @returns {Promise<string>} ETag
 */
async function generateETag(filePath) {
  const stats = await fs.stat(filePath);
  const hash = crypto.createHash('md5')
    .update(`${stats.size}-${stats.mtime.getTime()}`)
    .digest('hex');
  return `"${hash}"`;
}

module.exports = {
  extractImageUrl,
  downloadImage,
  processImage,
  processNewsImage,
  generatePlaceholder,
  generateETag,
  ensureDirectory
};
