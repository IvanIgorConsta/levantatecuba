/**
 * 🇨🇺🇺🇸 Flag Overlay Service
 * 
 * Solución definitiva para banderas correctas en imágenes generadas por IA.
 * 
 * PROBLEMA: Los generadores (DALL-E, Flux) fallan consistentemente con banderas:
 * - Proporciones incorrectas
 * - Estrellas mal dibujadas
 * - Colores equivocados
 * - Texto "HSIV" o similares
 * - Activación de safety filters
 * 
 * SOLUCIÓN: 
 * 1. La IA genera escenas SIN banderas (negatives: "flag, flags")
 * 2. Superponemos server-side SVGs oficiales con sharp
 * 3. Overlay sutil (blur + opacity) para estética editorial
 * 
 * RESULTADO: Banderas siempre correctas, cero bloqueos, control total.
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

const FLAG_DIR = path.join(__dirname, '..', '..', 'assets', 'flags');

/**
 * Mapeo de códigos de país a archivos SVG
 */
const FLAG_MAP = {
  CU: 'cuba.svg',
  US: 'usa.svg',
  USA: 'usa.svg', // alias
  CUBA: 'cuba.svg' // alias
};

/**
 * Obtiene la ruta completa de un archivo SVG de bandera
 * @param {string} code - Código de país (CU, US, etc.)
 * @returns {string|null} - Ruta al archivo SVG o null si no existe
 */
function flagPath(code) {
  const filename = FLAG_MAP[code.toUpperCase()];
  return filename ? path.join(FLAG_DIR, filename) : null;
}

/**
 * Verifica si un archivo SVG existe
 * @param {string} svgPath - Ruta al archivo
 * @returns {Promise<boolean>}
 */
async function flagExists(svgPath) {
  try {
    await fs.access(svgPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Superpone 1 o 2 banderas correctamente renderizadas sobre una imagen.
 * 
 * @param {Buffer} baseImage - Imagen generada por la IA (AVIF/JPEG/PNG buffer)
 * @param {Array<string>} flags - Códigos de país ['CU', 'US', etc.]
 * @param {Object} options - Opciones de composición
 * @param {number} [options.opacity=0.22] - Opacidad de las banderas (0-1)
 * @param {number} [options.blur=18] - Desenfoque para efecto sutil
 * @param {'top'|'center'|'bottom'} [options.position='top'] - Posición de la franja
 * @param {number} [options.height=0.35] - Altura de la franja como fracción del total (0-1)
 * @returns {Promise<Buffer>} - Buffer AVIF final con overlay
 */
async function overlayFlags(baseImage, flags = [], options = {}) {
  // Si no hay banderas, retornar imagen original
  if (!flags || !flags.length) {
    return baseImage;
  }

  const {
    opacity = 0.22,     // Sutil por defecto
    blur = 18,          // Desenfoque para evitar "pegote"
    position = 'top',   // Posición de la franja
    height = 0.35       // Altura de la franja (35% por defecto)
  } = options;

  try {
    // Preparar imagen base con canal alpha
    const base = sharp(baseImage).ensureAlpha();
    const { width, height: imgHeight } = await base.metadata();

    // Calcular dimensiones de la franja
    const bandHeight = Math.round(imgHeight * height);
    
    // Calcular posición Y según configuración
    let y;
    switch (position) {
      case 'bottom':
        y = imgHeight - bandHeight;
        break;
      case 'center':
        y = Math.round((imgHeight - bandHeight) / 2);
        break;
      case 'top':
      default:
        y = 0;
    }

    // Preparar composites para cada bandera
    const composites = [];
    const validFlags = [];

    // Filtrar banderas válidas
    for (const flag of flags) {
      const svgFile = flagPath(flag);
      if (svgFile && await flagExists(svgFile)) {
        validFlags.push({ code: flag, path: svgFile });
      } else {
        console.warn(`⚠️  Bandera no encontrada: ${flag} (${svgFile})`);
      }
    }

    if (!validFlags.length) {
      console.warn('⚠️  No se encontraron banderas válidas, retornando imagen original');
      return baseImage;
    }

    // Calcular ancho de cada slot
    const slotWidth = Math.floor(width / validFlags.length);

    // Procesar cada bandera
    for (let i = 0; i < validFlags.length; i++) {
      const { code, path: svgFile } = validFlags[i];

      try {
        // Redimensionar SVG al slot correspondiente
        const flagBuf = await sharp(svgFile)
          .resize({ 
            width: slotWidth, 
            height: bandHeight, 
            fit: 'cover',
            position: 'center'
          })
          .toBuffer();

        // Aplicar blur + ajustar opacidad
        const processed = await sharp(flagBuf)
          .blur(Math.max(0, blur))
          .toBuffer();

        // Añadir al array de composites
        composites.push({
          input: processed,
          top: y,
          left: i * slotWidth,
          blend: 'over'
        });

        console.log(`✅ Bandera ${code} preparada para overlay (slot ${i + 1}/${validFlags.length})`);
      } catch (err) {
        console.error(`❌ Error procesando bandera ${code}:`, err.message);
      }
    }

    if (!composites.length) {
      console.warn('⚠️  No se pudieron procesar las banderas, retornando imagen original');
      return baseImage;
    }

    // Componer imagen final con todas las banderas
    let composed = base.composite(composites);

    // Si se especificó opacity < 1, aplicar una capa semi-transparente adicional
    if (opacity < 1) {
      // Crear buffer transparente del tamaño de la franja
      const overlayMask = await sharp({
        create: {
          width: width,
          height: bandHeight,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 - opacity }
        }
      })
      .png()
      .toBuffer();

      composed = composed.composite([{
        input: overlayMask,
        top: y,
        left: 0,
        blend: 'dest-in'
      }]);
    }

    // Exportar a AVIF con calidad optimizada
    const finalBuffer = await composed
      .toFormat('avif', { 
        quality: 62, 
        effort: 4,
        chromaSubsampling: '4:2:0'
      })
      .toBuffer();

    console.log(`🎨 Overlay completado: ${validFlags.length} bandera(s) superpuestas`);
    return finalBuffer;

  } catch (error) {
    console.error('❌ Error en overlayFlags:', error);
    console.warn('⚠️  Retornando imagen original sin overlay');
    return baseImage;
  }
}

/**
 * Detecta códigos de países mencionados en un título
 * @param {string} title - Título de la noticia
 * @returns {Array<string>} - Array de códigos únicos ['CU', 'US', etc.]
 */
function detectFlagsFromTitle(title) {
  if (!title) return [];

  const flags = [];
  const normalized = title.toLowerCase();

  // Detección de Estados Unidos
  if (
    normalized.includes('estados unidos') ||
    normalized.includes('eeuu') ||
    normalized.includes('ee.uu') ||
    normalized.includes('usa') ||
    normalized.includes('washington') ||
    normalized.includes('estadounidense') ||
    normalized.includes('norteamerica') ||
    normalized.includes('norteamericano')
  ) {
    flags.push('US');
  }

  // Detección de Cuba
  if (
    normalized.includes('cuba') ||
    normalized.includes('cubano') ||
    normalized.includes('cubana') ||
    normalized.includes('la habana') ||
    normalized.includes('habana')
  ) {
    flags.push('CU');
  }

  // Eliminar duplicados y limitar a 2 banderas máximo
  const unique = [...new Set(flags)].slice(0, 2);
  
  if (unique.length) {
    console.log(`🔍 Banderas detectadas en título: ${unique.join(', ')}`);
  }

  return unique;
}

module.exports = { 
  overlayFlags,
  detectFlagsFromTitle,
  flagPath,
  FLAG_MAP
};
