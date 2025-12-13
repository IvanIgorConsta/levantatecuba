const fetch = require("node-fetch");
const { getFacebookConfig } = require("../config/facebook");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const News = require("../models/News");

/**
 * Servicio para publicar en Facebook usando Graph API v23.0
 * Sin caché de configuración, validaciones estrictas
 * @module services/facebookPublisher
 */

// [LC-FB-COVER] Generación de imagen (logo + franja + texto) para publicar en Facebook
/**
 * Genera portada roja especial para Facebook con logo, imagen centrada, banner y título
 * @param {Buffer} imageBuffer - Buffer de imagen original de la noticia
 * @param {Object} newsData - Datos de la noticia (título, categoría, etc.)
 * @param {string} newsId - ID de la noticia (para nombre del archivo)
 * @returns {Promise<{buffer: Buffer, savedPath: string}>} Buffer de portada generada y ruta donde se guardó
 */
async function generateFacebookRedCover(imageBuffer, newsData = {}, newsId = null) {
  try {
    const canvasSize = 1024;
    const titulo = newsData.titulo || newsData.title || '';
    
    console.log('[FB RedCover] 🎨 Generando portada especial...');
    
    // Crear título completo para Facebook (SIN recortes ni "...")
    // Padding lateral: 8% cada lado = 82px → maxWidth = 1024 - 164 = 860
    const titleLayout = wrapTextForBanner(titulo, {
      maxWidth: 860,        // 1024 - 82*2 (8% padding cada lado)
      maxLines: 4,          // Hasta 4 líneas para títulos largos
      baseFontSize: 54,     // Tamaño inicial
      minFontSize: 28,      // Mínimo más pequeño para garantizar que quepa todo
      fontFamily: 'Montserrat'  // Fuente profesional moderna
    });
    
    const { fontSize: titleFontSize, lines: titleLines } = titleLayout;
    
    if (titleLines.length > 0) {
      console.log(`[FB RedCover] 📝 Título: ${titleLines.length} línea(s), fontSize=${titleFontSize}px`);
      console.log(`[FB RedCover] 📝 Contenido: "${titleLines.join(' / ')}"}`);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 1. CALCULAR ALTURA DINÁMICA DEL BANNER SEGÚN EL TEXTO
    // ═══════════════════════════════════════════════════════════════
    const lineHeight = titleFontSize * 1.15; // 115% del fontSize
    const textHeight = titleLines.length * lineHeight;
    
    // Padding vertical dentro del banner
    const paddingTop = 30;    // Margen superior dentro del banner
    const paddingBottom = 40; // Margen inferior dentro del banner
    
    // Calcular altura del banner basada en el texto
    let bannerHeight = Math.ceil(textHeight + paddingTop + paddingBottom);
    
    // Límite máximo: 45% de la imagen (para no tapar demasiado)
    const maxBannerHeight = Math.floor(canvasSize * 0.45);
    // Límite mínimo: al menos 15% para que se vea bien
    const minBannerHeight = Math.floor(canvasSize * 0.15);
    
    // Aplicar límites
    bannerHeight = Math.max(minBannerHeight, Math.min(bannerHeight, maxBannerHeight));
    
    // Calcular posición Y del banner (desde dónde empieza)
    const bannerY = canvasSize - bannerHeight;
    
    console.log(`[FB RedCover] 📐 Banner dinámico: ${bannerHeight}px (${Math.round(bannerHeight/canvasSize*100)}% del canvas)`);
    
    // ═══════════════════════════════════════════════════════════════
    // 2. CREAR CANVAS BASE (fondo rojo degradado para toda la imagen)
    // ═══════════════════════════════════════════════════════════════
    const gradient = Buffer.from(
      `<svg width="${canvasSize}" height="${canvasSize}">
        <defs>
          <linearGradient id="redGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#FF0000;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#B30000;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${canvasSize}" height="${canvasSize}" fill="url(#redGrad)" />
      </svg>`
    );
    
    // ═══════════════════════════════════════════════════════════════
    // 3. PROCESAR IMAGEN DE FONDO (ajustada al área libre ARRIBA del banner)
    // ═══════════════════════════════════════════════════════════════
    // La imagen ocupa SOLO el espacio desde y=0 hasta y=bannerY
    // Así el banner NO tapa la parte importante de la foto
    const imageAreaHeight = bannerY; // Espacio disponible para la imagen
    
    const processedImage = await sharp(imageBuffer)
      .resize(canvasSize, imageAreaHeight, {
        fit: 'cover',
        position: 'center' // Centra la parte más importante de la imagen
      })
      .toBuffer();
    
    console.log(`[FB RedCover] 🖼️ Imagen ajustada: ${canvasSize}x${imageAreaHeight}px (área libre arriba del banner)`);
    
    // 4. Crear overlay oscuro SOLO para el área de la imagen (no el banner)
    const imageOverlay = Buffer.from(
      `<svg width="${canvasSize}" height="${imageAreaHeight}">
        <rect width="${canvasSize}" height="${imageAreaHeight}" fill="rgba(0,0,0,0.1)" />
      </svg>`
    );
    
    // ═══════════════════════════════════════════════════════════════
    // 5. CREAR BANNER NEGRO CON TEXTO CENTRADO
    // ═══════════════════════════════════════════════════════════════
    // Posición vertical del texto: centrado dentro del banner
    const totalTextHeight = titleLines.length * lineHeight;
    const textStartY = bannerY + (bannerHeight - totalTextHeight) / 2 + lineHeight * 0.8;
    
    // Generar tspan para cada línea
    const textLines = titleLines.map((line, index) => {
      const y = textStartY + (index * lineHeight);
      return `
        <tspan x="50%" y="${y}" text-anchor="middle">
          ${escapeXml(line)}
        </tspan>`;
    }).join('');
    
    const banner = Buffer.from(
      `<svg width="${canvasSize}" height="${canvasSize}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="${bannerY}" width="${canvasSize}" height="${bannerHeight}" fill="rgba(0,0,0,0.70)" />
        ${titleLines.length > 0 ? `
          <text
            font-size="${titleFontSize}"
            font-family="Montserrat, Arial Black, Helvetica Neue, sans-serif"
            font-weight="800"
            fill="#FFFFFF"
            style="letter-spacing: 0.5px; text-shadow: 2px 2px 6px rgba(0,0,0,0.7);"
          >${textLines}
          </text>
        ` : ''}
      </svg>`
    );
    
    // 6. Crear marca de agua visible en esquina derecha (posicionada encima del banner)
    const watermarkY = bannerY - 15; // 15px encima del banner
    const watermark = Buffer.from(
      `<svg width="${canvasSize}" height="${canvasSize}">
        <text
          x="${canvasSize - 20}" y="${watermarkY}"
          text-anchor="end"
          font-size="18"
          font-family="Arial, sans-serif"
          font-weight="600"
          fill="rgba(255,255,255,0.80)"
          style="text-shadow: 1px 1px 3px rgba(0,0,0,0.5);"
        >
          LEVANTATECUBA.COM
        </text>
      </svg>`
    );
    
    // ═══════════════════════════════════════════════════════════════
    // 7. COMPONER TODAS LAS CAPAS
    // ═══════════════════════════════════════════════════════════════
    // Imagen va en top:0 (ocupa solo hasta bannerY)
    // Banner va desde bannerY hasta el final (no se superponen)
    let composite = sharp(gradient)
      .composite([
        { input: processedImage, top: 0, left: 0, blend: 'over' }, // 1. Imagen (solo área superior)
        { input: imageOverlay, top: 0, left: 0, blend: 'over' },   // 2. Overlay oscuro (solo imagen)
        { input: banner, top: 0, left: 0, blend: 'over' },         // 3. Banner negro con título
        { input: watermark, top: 0, left: 0, blend: 'over' }       // 4. Marca de agua
      ])
      .jpeg({ quality: 90 });
    
    const finalBuffer = await composite.toBuffer();
    
    // 8. Guardar archivo en /public/media/facebook/
    let savedPath = null;
    if (newsId) {
      const fbDir = path.join(process.cwd(), 'public', 'media', 'facebook');
      
      // Crear directorio si no existe
      if (!fs.existsSync(fbDir)) {
        fs.mkdirSync(fbDir, { recursive: true });
        console.log('[FB RedCover] 📁 Directorio /media/facebook/ creado');
      }
      
      const filename = `${newsId}-fb-cover.jpg`;
      savedPath = path.join(fbDir, filename);
      
      await fs.promises.writeFile(savedPath, finalBuffer);
      console.log(`[FB RedCover] 💾 Portada guardada: /media/facebook/${filename}`);
    }
    
    console.log('[FB RedCover] ✅ Portada roja generada exitosamente');
    
    return { buffer: finalBuffer, savedPath };
    
  } catch (error) {
    console.error(`[FB RedCover] ❌ Error generando portada roja: ${error.message}`);
    // Fallback: devolver imagen original
    return { buffer: imageBuffer, savedPath: null };
  }
}

/**
 * [LC-FB-COVER] Divide un título en múltiples líneas SIN RECORTAR NUNCA
 * Reduce dinámicamente el tamaño de fuente hasta que TODO el texto quepa
 * @param {string} title - Título original de la noticia
 * @param {Object} options - Opciones de layout
 * @returns {Object} {fontSize, lines} - Tamaño de fuente y array de líneas
 */
function wrapTextForBanner(title, options = {}) {
  if (!title || typeof title !== 'string') {
    return { fontSize: options.baseFontSize || 54, lines: [] };
  }
  
  const {
    maxWidth = 860,           // Ancho útil con 8% padding cada lado (1024 - 164)
    maxLines = 4,             // Máximo de líneas permitidas
    baseFontSize = 54,        // Tamaño inicial grande para impacto visual
    minFontSize = 28,         // Mínimo absoluto (seguirá siendo legible)
    fontFamily = 'Montserrat' // Fuente moderna del diseño
  } = options;
  
  // 1) Convertir a MAYÚSCULAS (NUNCA recortar)
  const text = title.trim().toUpperCase();
  
  // 2) Ratio de ancho por carácter según fuente (conservador para MAYÚSCULAS)
  // Montserrat/Arial Black uppercase: ~0.68-0.72 del fontSize
  // Usamos 0.70 como valor seguro
  const charWidthRatio = fontFamily.toLowerCase().includes('montserrat') ? 0.70 : 0.72;
  
  // 3) Función para dividir texto en líneas dado un fontSize
  const splitIntoLines = (fontSize) => {
    const avgCharWidth = fontSize * charWidthRatio;
    
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      // Estimar ancho si añadimos esta palabra
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const estimatedWidth = testLine.length * avgCharWidth;
      
      // Si excede el ancho Y ya tenemos contenido, pasar a nueva línea
      if (estimatedWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    // Guardar última línea
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  };
  
  // 4) Reducir fontSize iterativamente hasta que el texto quepa en maxLines
  for (let fontSize = baseFontSize; fontSize >= minFontSize; fontSize -= 2) {
    const lines = splitIntoLines(fontSize);
    
    // Si cabe en maxLines o menos, aceptar este fontSize
    if (lines.length <= maxLines) {
      return { fontSize, lines };
    }
  }
  
  // 5) Si con minFontSize aún no cabe, seguir reduciendo hasta que quepa
  // NUNCA truncar - preferimos fuente más pequeña a perder contenido
  let fontSize = minFontSize;
  let lines = splitIntoLines(fontSize);
  
  // Reducir aún más si es necesario (hasta 18px como mínimo absoluto)
  while (lines.length > maxLines && fontSize > 18) {
    fontSize -= 2;
    lines = splitIntoLines(fontSize);
  }
  
  // Si aún no cabe con 18px, permitir más líneas (hasta 6)
  if (lines.length > maxLines) {
    console.log(`[FB Cover] ℹ️ Título muy largo: ${lines.length} líneas con fontSize=${fontSize}px`);
  }
  
  return { fontSize, lines };
}

/**
 * Escapa caracteres especiales XML para SVG
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Mapeo de errores de Facebook
 */
const ERROR_MESSAGES = {
  190: "Token inválido o expirado",
  200: "Permisos insuficientes. Se requieren: pages_manage_posts y pages_read_engagement",
  100: "Parámetro inválido",
  33: "Recurso no encontrado",
  2: "Error temporal del servicio",
  4: "Límite de solicitudes alcanzado",
  17: "Límite de publicaciones alcanzado",
  368: "Contenido bloqueado por políticas",
  10: "Sin permisos para esta página"
};

/**
 * Verifica un token usando debug_token
 * @param {string} appId 
 * @param {string} appSecret 
 * @param {string} token 
 * @returns {Promise<{isValid: boolean, profileId: string, type: string, appId: string, scopes: string[]}>}
 */
async function debugToken(appId, appSecret, token) {
  const appToken = `${appId}|${appSecret}`;
  const debugUrl = `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${appToken}`;
  
  console.log("[FB Debug] Verificando token...");
  
  try {
    const response = await fetch(debugUrl, { timeout: 10000 });
    const result = await response.json();
    
    if (result.error) {
      console.error("[FB Debug] ❌ Error:", result.error.message);
      return {
        isValid: false,
        profileId: null,
        type: "unknown",
        appId: null,
        scopes: [],
        error: result.error.message
      };
    }
    
    const data = result.data || {};
    const isValid = data.is_valid === true;
    const profileId = data.profile_id || data.user_id || null;
    const type = data.type || "unknown";
    const tokenAppId = data.app_id || null;
    const scopes = data.scopes || [];
    
    console.log("[FB Debug] Resultado:", {
      isValid,
      profileId,
      type,
      appMatch: tokenAppId === appId ? "✅" : "❌",
      scopesCount: scopes.length
    });
    
    return {
      isValid,
      profileId,
      type,
      appId: tokenAppId,
      scopes,
      expiresAt: data.expires_at || 0
    };
    
  } catch (error) {
    console.error("[FB Debug] ❌ Error de conexión:", error.message);
    return {
      isValid: false,
      profileId: null,
      type: "unknown",
      appId: null,
      scopes: [],
      error: error.message
    };
  }
}

/**
 * Obtiene PAGE_TOKEN desde USER_TOKEN
 * @param {string} userToken 
 * @param {string} targetPageId 
 * @returns {Promise<string|null>} PAGE_TOKEN o null
 */
async function getPageTokenFromUserToken(userToken, targetPageId) {
  console.log("[FB Resolver] Obteniendo PAGE_TOKEN desde USER_TOKEN...");
  
  try {
    const accountsUrl = `https://graph.facebook.com/v23.0/me/accounts?access_token=${userToken}`;
    const response = await fetch(accountsUrl, { timeout: 10000 });
    
    if (!response.ok) {
      const error = await response.json();
      console.error("[FB Resolver] ❌ Error obteniendo cuentas:", error.error?.message || "Unknown");
      return null;
    }
    
    const data = await response.json();
    const pages = data.data || [];
    
    console.log(`[FB Resolver] Páginas encontradas: ${pages.length}`);
    
    // Buscar página específica
    const targetPage = pages.find(page => page.id === targetPageId);
    
    if (!targetPage) {
      console.error(`[FB Resolver] ❌ Página ${targetPageId} no encontrada`);
      return null;
    }
    
    if (!targetPage.access_token) {
      console.error(`[FB Resolver] ❌ Página sin access_token: ${targetPage.name}`);
      return null;
    }
    
    console.log(`[FB Resolver] ✅ PAGE_TOKEN obtenido para: ${targetPage.name}`);
    return targetPage.access_token;
    
  } catch (error) {
    console.error("[FB Resolver] ❌ Error:", error.message);
    return null;
  }
}

/**
 * Construye URL pública de una noticia
 * @param {string|Object} newsOrId - ID de la noticia o objeto news completo
 * @param {string} [slug] - Slug opcional (si se pasa newsOrId como string)
 * @returns {string} URL absoluta HTTPS (usa slug si está disponible, sino ID)
 */
function buildNewsPublicUrl(newsOrId, slug = null) {
  const base = process.env.PUBLIC_ORIGIN || 'https://levantatecuba.com';
  
  // Si es un objeto news, extraer slug o _id
  let identifier;
  if (typeof newsOrId === 'object' && newsOrId !== null) {
    identifier = newsOrId.slug || newsOrId._id;
  } else {
    // Es un string (ID), usar slug si se proporcionó
    identifier = slug || newsOrId;
  }
  
  const url = new URL(`/noticias/${identifier}`, base);
  return url.toString();
}

/**
 * Convierte ruta local del sistema de archivos a URL pública
 * @param {string} localPath - Ruta local (ej: C:\Dev\levantatecuba\public\media\facebook\123.jpg)
 * @returns {string|null} URL pública (ej: https://levantatecuba.com/media/facebook/123.jpg) o null si no es ruta local
 */
function localPathToPublicUrl(localPath) {
  if (!localPath || typeof localPath !== 'string') {
    return null;
  }
  
  // Normalizar separadores de ruta para Windows/Linux
  const normalizedPath = localPath.replace(/\\/g, '/');
  
  // Buscar la carpeta 'public' en la ruta
  const publicIndex = normalizedPath.indexOf('/public/');
  
  if (publicIndex === -1) {
    console.warn(`[FB Publisher] ⚠️ Ruta local no contiene /public/: ${localPath}`);
    return null;
  }
  
  // Extraer la parte después de /public/
  const relativePath = normalizedPath.substring(publicIndex + '/public'.length);
  
  // Construir URL pública
  const baseUrl = process.env.PUBLIC_BASE_URL || process.env.PUBLIC_ORIGIN || 'https://levantatecuba.com';
  const publicUrl = `${baseUrl}${relativePath}`;
  
  return publicUrl;
}

/**
 * Construye URL absoluta de la imagen del cover
 * @param {Object} news - Objeto de noticia
 * @returns {string} URL absoluta HTTPS del cover
 */
function buildAbsoluteImageUrl(news) {
  const baseUrl = process.env.PUBLIC_ORIGIN || 'https://levantatecuba.com';
  
  // Intentar obtener imagen de varios campos posibles
  let imageUrl = news.imagen || news.cover || news.image;
  
  if (!imageUrl) {
    // Fallback a imagen genérica si no hay cover
    console.warn(`[FB Publisher] ⚠️ Noticia ${news._id} sin imagen, usando fallback`);
    return `${baseUrl}/img/og-default.jpg`;
  }
  
  // Si ya es absoluta (http/https), usarla tal cual
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Construir URL absoluta desde relativa
  if (!imageUrl.startsWith('/')) {
    imageUrl = '/' + imageUrl;
  }
  
  return `${baseUrl}${imageUrl}`;
}

/**
 * Publica contenido en Facebook como photo post
 * @param {Object} options
 * @param {string} options.message - Mensaje a publicar (caption de la foto)
 * @param {string} options.imageUrl - URL absoluta de la imagen a publicar
 * @param {string} [options.imagePath] - Ruta local alternativa si imageUrl falla
 * @param {string} [options.userToken] - User token para resolver PAGE_TOKEN
 * @returns {Promise<{fbPostId: string, permalink: string}>}
 */
async function publishToFacebook({ message, imageUrl, imagePath, userToken }) {
  console.log("\n[FB Publisher] === INICIANDO PUBLICACIÓN ===");
  
  // Obtener configuración validada (sin caché)
  let config;
  try {
    config = getFacebookConfig();
  } catch (error) {
    console.error("[FB Publisher] ❌ Error de configuración:", error.message);
    throw new Error(error.message, { 
      cause: { code: "CONFIG_ERROR", httpStatus: 500 } 
    });
  }
  
  const { appId, appSecret, graphVersion, pageId, pageToken: envPageToken } = config;
  
  // Convertir imagePath (ruta local) a URL pública si existe
  if (imagePath && typeof imagePath === 'string') {
    const publicUrl = localPathToPublicUrl(imagePath);
    if (publicUrl) {
      imageUrl = publicUrl;
      console.log(`[FB DEBUG] Ruta local convertida a URL pública: ${imagePath} -> ${publicUrl}`);
    } else {
      console.warn(`[FB DEBUG] No se pudo convertir ruta local a URL pública: ${imagePath}`);
    }
  }
  
  // Log de la imagen final que se enviará a Facebook
  console.log(`[FB DEBUG] Imagen que se enviará a Facebook: ${imageUrl || imagePath || 'NINGUNA'}`);
  
  // Log preflight con tipo de publicación
  console.log(`[FB Preflight] type=photo graph=${graphVersion} pageId=${pageId} endpoint=/photos`);
  if (imageUrl) {
    console.log(`[FB Publish] photoUrl=${imageUrl}`);
  }
  
  // Validar mensaje e imagen
  if (!message || typeof message !== "string" || !message.trim()) {
    throw new Error("El mensaje es obligatorio", { 
      cause: { code: "INVALID_MESSAGE", httpStatus: 400 } 
    });
  }
  
  if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.trim()) {
    throw new Error("La URL de la imagen es obligatoria para photo post", { 
      cause: { code: "INVALID_IMAGE_URL", httpStatus: 400 } 
    });
  }
  
  // Determinar token a usar
  let finalPageToken = userToken || envPageToken;
  
  if (!finalPageToken) {
    throw new Error("No hay token disponible (FACEBOOK_PAGE_TOKEN o userToken)", {
      cause: { code: "NO_TOKEN", httpStatus: 401 }
    });
  }
  
  // Verificar si necesitamos resolver PAGE_TOKEN desde USER_TOKEN
  const tokenInfo = await debugToken(appId, appSecret, finalPageToken);
  
  if (!tokenInfo.isValid) {
    throw new Error("Token inválido o expirado", {
      cause: { code: "INVALID_TOKEN", httpStatus: 401 }
    });
  }
  
  // Si el token es de usuario, obtener PAGE_TOKEN
  if (tokenInfo.profileId !== pageId) {
    console.log("[FB Publisher] Token es USER_TOKEN, resolviendo PAGE_TOKEN...");
    const pageToken = await getPageTokenFromUserToken(finalPageToken, pageId);
    
    if (!pageToken) {
      throw new Error("No se pudo obtener PAGE_TOKEN para la página", {
        cause: { code: "PAGE_TOKEN_ERROR", httpStatus: 403 }
      });
    }
    
    // Validar el PAGE_TOKEN obtenido
    const pageTokenInfo = await debugToken(appId, appSecret, pageToken);
    if (!pageTokenInfo.isValid || pageTokenInfo.profileId !== pageId) {
      throw new Error("PAGE_TOKEN obtenido es inválido", {
        cause: { code: "INVALID_PAGE_TOKEN", httpStatus: 401 }
      });
    }
    
    finalPageToken = pageToken;
  }
  
  // Publicar en Facebook como photo post
  const endpoint = `v23.0/${pageId}/photos`;
  const apiUrl = `https://graph.facebook.com/${endpoint}`;
  
  console.log(`[FB Publisher] Publicando foto en /${pageId}/photos...`);
  
  let fbPostId = null;
  let usedWatermark = false;
  
  try {
    // ==========================================
    // MÉTODO 1: MULTIPART CON PORTADA ROJA (prioridad si hay archivo local)
    // ==========================================
    let localFile = null;
    
    // Priorizar archivo local para generar portada roja
    if (imagePath && fs.existsSync(imagePath)) {
      localFile = imagePath;
      console.log(`[FB Publisher] Método 1: Multipart con portada roja usando archivo local: ${path.basename(localFile)}`);
    }
    
    if (localFile) {
      // Leer archivo directamente (portada roja ya debe estar generada)
      let fileBuffer = await fs.promises.readFile(localFile);
      console.log(`[FB Publisher] 📎 Usando archivo local para Facebook (portada roja pre-generada)`);
      usedWatermark = true; // Marcador de que se usó archivo local
      
      // Construir FormData correctamente para multipart
      const formData = new FormData();
      formData.append('source', fileBuffer, { filename: 'cover.jpg' });
      formData.append('caption', message.trim());
      formData.append('access_token', finalPageToken);
      
      console.log(`[FB Publisher] FormData fields: source (buffer con portada), caption (${message.length} chars), access_token`);
      
      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
        headers: formData.getHeaders(),
        timeout: 60000
      });
      
      const data = await response.json();
      
      if (response.ok && data.id) {
        fbPostId = data.id;
        console.log(`[FB Publisher] ✅ Foto publicada vía multipart con portada roja. fbPostId=${fbPostId}`);
      } else {
        const errorCode = data.error?.code || 999;
        const errorMsg = data.error?.message || "Error desconocido";
        console.error(`[FB Publisher] ❌ Error ${errorCode} en multipart: ${errorMsg}`);
      }
    }
    
    // ==========================================
    // MÉTODO 2: URL DIRECTA (solo si no hay archivo local)
    // ==========================================
    if (!fbPostId && imageUrl) {
      console.log(`[FB Publisher] Método 2: URL directa (sin marca - no hay archivo local)`);
      console.log(`[FB Publisher] URL: ${imageUrl}`);
      
      const postData = new URLSearchParams({
        url: imageUrl.trim(),
        caption: message.trim(),
        access_token: finalPageToken
      });
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: postData.toString(),
        timeout: 30000
      });
      
      const data = await response.json();
      
      if (response.ok && data.id) {
        fbPostId = data.id;
        console.log(`[FB Publisher] ✅ Foto publicada vía URL (sin marca). fbPostId=${fbPostId}`);
      } else {
        const errorCode = data.error?.code || response.status;
        console.info(`[FB Publisher] URL directa falló, intentando fallback genérico...`);
      }
    }
    
    // ==========================================
    // MÉTODO 3: DESCARGAR IMAGEN + GENERAR PORTADA ROJA
    // ==========================================
    if (!fbPostId && imageUrl) {
      console.log(`[FB Publisher] Método 3: Descargando imagen para generar portada roja...`);
      
      try {
        // Intentar descargar la imagen desde la URL
        const imageResponse = await fetch(imageUrl, { timeout: 15000 });
        
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.buffer();
          console.log(`[FB Publisher] 📥 Imagen descargada: ${Math.round(imageBuffer.length/1024)}KB`);
          
          // Generar portada roja con la imagen descargada
          const { buffer: coverBuffer } = await generateFacebookRedCover(
            imageBuffer,
            { titulo: message.split('\n')[0] || 'LevántateCuba' }, // Usar primera línea como título
            null
          );
          
          console.log(`[FB Publisher] 🎨 Portada roja generada: ${Math.round(coverBuffer.length/1024)}KB`);
          
          // Publicar con la portada generada
          const formData = new FormData();
          formData.append('source', coverBuffer, { filename: 'cover.jpg' });
          formData.append('caption', message.trim());
          formData.append('access_token', finalPageToken);
          
          const response = await fetch(apiUrl, {
            method: "POST",
            body: formData,
            headers: formData.getHeaders(),
            timeout: 60000
          });
          
          const data = await response.json();
          
          if (response.ok && data.id) {
            fbPostId = data.id;
            usedWatermark = true;
            console.log(`[FB Publisher] ✅ Foto publicada con portada roja generada. fbPostId=${fbPostId}`);
          } else {
            console.error(`[FB Publisher] ❌ Error publicando portada roja:`, data.error?.message);
          }
        }
      } catch (downloadError) {
        console.error(`[FB Publisher] ⚠️ Error descargando imagen: ${downloadError.message}`);
      }
    }
    
    // ==========================================
    // MÉTODO 4: FALLBACK CON IMAGEN GENÉRICA (último recurso)
    // ==========================================
    if (!fbPostId) {
      console.log(`[FB Publisher] Método 4: Fallback con imagen genérica`);
      
      // Buscar imagen genérica de fallback
      const fallbackOptions = [
        path.join(__dirname, '..', '..', 'public', 'img', 'og-default.jpg'),
        path.join(__dirname, '..', '..', 'public', 'bandera-bg.jpg'),
        path.join(__dirname, '..', '..', 'public', 'img', 'levantatecubaLogo.png')
      ];
      
      localFile = null;
      for (const fallbackPath of fallbackOptions) {
        if (fs.existsSync(fallbackPath)) {
          const stats = fs.statSync(fallbackPath);
          // Verificar que no esté corrupto (>1KB)
          if (stats.size > 1024) {
            localFile = fallbackPath;
            console.log(`[FB Publisher] Usando imagen genérica: ${path.basename(fallbackPath)} (${Math.round(stats.size/1024)}KB)`);
            break;
          }
        }
      }
      
      if (!localFile) {
        throw new Error("No se pudo publicar: todos los métodos fallaron y no hay imagen de fallback");
      }
      
      // Leer archivo directamente
      let fileBuffer = await fs.promises.readFile(localFile);
      console.log(`[FB Publisher] 📎 Usando imagen de fallback genérico`);
      usedWatermark = true;
      
      // Construir FormData correctamente para multipart
      const formData = new FormData();
      formData.append('source', fileBuffer, { filename: 'cover.jpg' });
      formData.append('caption', message.trim());
      formData.append('access_token', finalPageToken);
      
      console.log(`[FB Publisher] FormData fields: source (buffer), caption (${message.length} chars), access_token`);
      
      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
        headers: formData.getHeaders(),
        timeout: 60000
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const errorCode = data.error?.code || 999;
        const errorMsg = data.error?.message || "Error desconocido";
        
        console.error(`[FB Publisher] ❌ Error ${errorCode} en fallback genérico: ${errorMsg}`);
        
        // Mapear errores específicos
        let mappedCode = "FACEBOOK_UPSTREAM_ERROR";
        let httpStatus = 502;
        
        if (errorCode === 200) {
          mappedCode = "PERMISSIONS_ERROR";
          httpStatus = 403;
        } else if (errorCode === 190) {
          mappedCode = "INVALID_TOKEN";
          httpStatus = 401;
        } else if (errorCode === 100) {
          mappedCode = "INVALID_PARAMS";
          httpStatus = 400;
        }
        
        throw new Error(ERROR_MESSAGES[errorCode] || errorMsg, {
          cause: {
            code: mappedCode,
            fbCode: errorCode,
            httpStatus
          }
        });
      }
      
      if (!data.id) {
        throw new Error("Facebook no devolvió ID de publicación en fallback genérico");
      }
      
      fbPostId = data.id;
      console.log(`[FB Publisher] ✅ Foto publicada vía fallback genérico (imagen estática). fbPostId=${fbPostId}`);
    }
    
    // ==========================================
    // OBTENER PERMALINK
    // ==========================================
    const permalink = await getPostPermalink(fbPostId, finalPageToken, graphVersion);
    
    console.log(`[FB Publisher] permalink=${permalink}`);
    console.log(`[FB Publisher] Portada roja: ${usedWatermark ? '✅ GENERADA' : '❌ NO (URL directa sin archivo local)'}`);
    console.log("[FB Publisher] === PUBLICACIÓN COMPLETADA ===\n");
    
    return { fbPostId, permalink };
    
  } catch (error) {
    // Re-lanzar error con contexto
    if (!error.cause) {
      error.cause = { code: "UNKNOWN_ERROR", httpStatus: 500 };
    }
    throw error;
  }
}

/**
 * Publica una foto en Facebook Stories
 * NOTA: Stories requiere subir la foto como "unpublished" primero
 * @param {Object} options
 * @param {Buffer} options.imageBuffer - Buffer de la imagen a publicar
 * @param {string} [options.imagePath] - Ruta local de la imagen (alternativa a buffer)
 * @param {string} [options.userToken] - User token para resolver PAGE_TOKEN
 * @param {string} [options.link] - URL del link "Ver más" en la Story
 * @returns {Promise<{storyId: string, success: boolean}>}
 */
async function publishToFacebookStory({ imageBuffer, imagePath, userToken, link }) {
  console.log(`\n[FB Story] === PUBLICANDO EN STORY ===`);
  
  // Obtener configuración validada
  let config;
  try {
    config = getFacebookConfig();
  } catch (error) {
    console.error("[FB Story] ❌ Error de configuración:", error.message);
    return { success: false, error: error.message };
  }
  
  const { appId, appSecret, graphVersion, pageId, pageToken: envPageToken } = config;
  
  // Determinar token a usar
  let finalPageToken = userToken || envPageToken;
  
  if (!finalPageToken) {
    console.error("[FB Story] ❌ No hay token disponible");
    return { success: false, error: "No hay token disponible" };
  }
  
  // Verificar si necesitamos resolver PAGE_TOKEN desde USER_TOKEN
  const tokenInfo = await debugToken(appId, appSecret, finalPageToken);
  
  if (!tokenInfo.isValid) {
    console.error("[FB Story] ❌ Token inválido o expirado");
    return { success: false, error: "Token inválido" };
  }
  
  // Si el token es de usuario, obtener PAGE_TOKEN
  if (tokenInfo.profileId !== pageId) {
    console.log("[FB Story] Token es USER_TOKEN, resolviendo PAGE_TOKEN...");
    const pageToken = await getPageTokenFromUserToken(finalPageToken, pageId);
    
    if (!pageToken) {
      console.error("[FB Story] ❌ No se pudo obtener PAGE_TOKEN");
      return { success: false, error: "No se pudo obtener PAGE_TOKEN" };
    }
    
    finalPageToken = pageToken;
  }
  
  // Obtener el buffer de la imagen
  let photoBuffer = imageBuffer;
  if (!photoBuffer && imagePath) {
    try {
      photoBuffer = await fs.promises.readFile(imagePath);
      console.log(`[FB Story] 📷 Imagen cargada desde: ${imagePath} (${photoBuffer.length} bytes)`);
    } catch (err) {
      console.error(`[FB Story] ❌ No se pudo leer la imagen: ${err.message}`);
      return { success: false, error: "No se pudo leer la imagen" };
    }
  }
  
  if (!photoBuffer) {
    console.error("[FB Story] ❌ No hay imagen para publicar");
    return { success: false, error: "No hay imagen para publicar" };
  }
  
  try {
    // PASO 1: Subir foto como "unpublished" 
    console.log(`[FB Story] 📤 Subiendo foto como unpublished...`);
    
    const uploadUrl = `https://graph.facebook.com/${graphVersion}/${pageId}/photos`;
    const uploadForm = new FormData();
    uploadForm.append('source', photoBuffer, { filename: 'story.jpg', contentType: 'image/jpeg' });
    uploadForm.append('published', 'false'); // CRÍTICO: debe ser unpublished
    uploadForm.append('access_token', finalPageToken);
    
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      body: uploadForm,
      headers: uploadForm.getHeaders(),
      timeout: 60000
    });
    
    const uploadData = await uploadResponse.json();
    
    if (!uploadResponse.ok || !uploadData.id) {
      const errorMsg = uploadData.error?.message || "Error subiendo foto";
      console.error(`[FB Story] ❌ Error subiendo foto: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    const photoId = uploadData.id;
    console.log(`[FB Story] ✅ Foto subida como unpublished. photoId=${photoId}`);
    
    // PASO 2: Crear Story con la foto unpublished
    const storyUrl = `https://graph.facebook.com/${graphVersion}/${pageId}/photo_stories`;
    
    console.log(`[FB Story] 📱 Creando Story con photoId=${photoId}...`);
    
    const storyData = new URLSearchParams({
      photo_id: photoId,
      access_token: finalPageToken
    });
    
    // Agregar link "Ver más" si está disponible
    if (link) {
      storyData.append('link', link);
      console.log(`[FB Story] 🔗 Link agregado: ${link}`);
    }
    
    const storyResponse = await fetch(storyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: storyData.toString(),
      timeout: 30000
    });
    
    const storyResult = await storyResponse.json();
    
    if (storyResponse.ok && storyResult.post_id) {
      console.log(`[FB Story] ✅ Story publicada exitosamente! storyId=${storyResult.post_id}`);
      return { success: true, storyId: storyResult.post_id };
    } else {
      const errorCode = storyResult.error?.code || storyResponse.status;
      const errorMsg = storyResult.error?.message || "Error creando Story";
      
      console.error(`[FB Story] ❌ Error ${errorCode}: ${errorMsg}`);
      return { success: false, error: errorMsg, code: errorCode };
    }
    
  } catch (error) {
    console.error(`[FB Story] ❌ Error de red: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene permalink de una publicación
 * @param {string} postId - ID del post de Facebook
 * @param {string} pageToken - Token de página
 * @param {string} graphVersion - Versión de Graph API
 */
async function getPostPermalink(postId, pageToken, graphVersion = 'v23.0') {
  try {
    const url = `https://graph.facebook.com/${graphVersion}/${postId}?fields=permalink_url&access_token=${pageToken}`;
    const response = await fetch(url, { timeout: 10000 });
    
    if (response.ok) {
      const data = await response.json();
      return data.permalink_url || `https://www.facebook.com/${postId}`;
    }
  } catch (error) {
    console.warn(`[FB Publisher] Error obteniendo permalink: ${error.message}`);
  }
  
  return `https://www.facebook.com/${postId}`;
}

/**
 * Elimina una publicación de Facebook
 * @param {Object} options
 * @param {string} options.postId - ID del post a eliminar
 * @param {string} [options.userToken] - User token para resolver PAGE_TOKEN
 * @returns {Promise<{success: boolean, existed: boolean}>}
 */
async function deletePost({ postId, userToken }) {
  console.log(`\n[FB Delete] === ELIMINANDO POST ${postId} ===`);
  
  // Obtener configuración validada
  let config;
  try {
    config = getFacebookConfig();
  } catch (error) {
    console.error("[FB Delete] ❌ Error de configuración:", error.message);
    throw new Error(error.message, { 
      cause: { code: "CONFIG_ERROR", httpStatus: 500 } 
    });
  }
  
  const { appId, appSecret, pageId, pageToken: envPageToken } = config;
  
  // Determinar token a usar
  let finalPageToken = userToken || envPageToken;
  
  if (!finalPageToken) {
    throw new Error("No hay token disponible (FACEBOOK_PAGE_TOKEN o userToken)", {
      cause: { code: "NO_TOKEN", httpStatus: 401 }
    });
  }
  
  // Verificar si necesitamos resolver PAGE_TOKEN desde USER_TOKEN
  const tokenInfo = await debugToken(appId, appSecret, finalPageToken);
  
  if (!tokenInfo.isValid) {
    throw new Error("Token inválido o expirado", {
      cause: { code: "INVALID_TOKEN", httpStatus: 401 }
    });
  }
  
  // Si el token es de usuario, obtener PAGE_TOKEN
  if (tokenInfo.profileId !== pageId) {
    console.log("[FB Delete] Token es USER_TOKEN, resolviendo PAGE_TOKEN...");
    const pageToken = await getPageTokenFromUserToken(finalPageToken, pageId);
    
    if (!pageToken) {
      throw new Error("No se pudo obtener PAGE_TOKEN para la página", {
        cause: { code: "PAGE_TOKEN_ERROR", httpStatus: 403 }
      });
    }
    
    finalPageToken = pageToken;
  }
  
  // Eliminar publicación
  const apiUrl = `https://graph.facebook.com/v23.0/${postId}`;
  
  console.log(`[FB Delete] Eliminando post ${postId}...`);
  
  try {
    const response = await fetch(apiUrl, {
      method: "DELETE",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ access_token: finalPageToken }).toString(),
      timeout: 30000
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      const errorCode = data.error?.code || 999;
      const errorMsg = data.error?.message || "Error desconocido";
      
      console.error(`[FB Delete] ❌ Error ${errorCode}: ${errorMsg}`);
      
      // Si es 404, tratarlo como "ya no existe" (idempotente)
      if (errorCode === 33 || response.status === 404) {
        console.log("[FB Delete] ✅ Post ya no existe (404) - tratado como éxito");
        return { success: true, existed: false };
      }
      
      // Mapear otros errores
      let mappedCode = "FACEBOOK_UPSTREAM_ERROR";
      let httpStatus = 502;
      
      if (errorCode === 200) {
        mappedCode = "PERMISSIONS_ERROR";
        httpStatus = 403;
      } else if (errorCode === 190) {
        mappedCode = "INVALID_TOKEN";
        httpStatus = 401;
      }
      
      throw new Error(ERROR_MESSAGES[errorCode] || errorMsg, {
        cause: {
          code: mappedCode,
          fbCode: errorCode,
          httpStatus
        }
      });
    }
    
    console.log(`[FB Delete] ✅ Post eliminado exitosamente: ${postId}`);
    console.log("[FB Delete] === ELIMINACIÓN COMPLETADA ===\n");
    
    return { success: true, existed: true };
    
  } catch (error) {
    // Re-lanzar error con contexto
    if (!error.cause) {
      error.cause = { code: "UNKNOWN_ERROR", httpStatus: 500 };
    }
    throw error;
  }
}

/**
 * Obtiene información de una publicación de Facebook
 * @param {Object} options
 * @param {string} options.postId - ID del post
 * @param {string} [options.userToken] - User token para resolver PAGE_TOKEN
 * @returns {Promise<{exists: boolean, id?: string, permalink_url?: string, is_published?: boolean}>}
 */
async function getPost({ postId, userToken }) {
  console.log(`[FB Get] Verificando post ${postId}...`);
  
  // Obtener configuración validada
  let config;
  try {
    config = getFacebookConfig();
  } catch (error) {
    console.error("[FB Get] ❌ Error de configuración:", error.message);
    throw new Error(error.message, { 
      cause: { code: "CONFIG_ERROR", httpStatus: 500 } 
    });
  }
  
  const { appId, appSecret, pageId, pageToken: envPageToken } = config;
  
  // Determinar token a usar
  let finalPageToken = userToken || envPageToken;
  
  if (!finalPageToken) {
    throw new Error("No hay token disponible (FACEBOOK_PAGE_TOKEN o userToken)", {
      cause: { code: "NO_TOKEN", httpStatus: 401 }
    });
  }
  
  // Verificar si necesitamos resolver PAGE_TOKEN desde USER_TOKEN
  const tokenInfo = await debugToken(appId, appSecret, finalPageToken);
  
  if (!tokenInfo.isValid) {
    throw new Error("Token inválido o expirado", {
      cause: { code: "INVALID_TOKEN", httpStatus: 401 }
    });
  }
  
  // Si el token es de usuario, obtener PAGE_TOKEN
  if (tokenInfo.profileId !== pageId) {
    console.log("[FB Get] Token es USER_TOKEN, resolviendo PAGE_TOKEN...");
    const pageToken = await getPageTokenFromUserToken(finalPageToken, pageId);
    
    if (!pageToken) {
      throw new Error("No se pudo obtener PAGE_TOKEN para la página", {
        cause: { code: "PAGE_TOKEN_ERROR", httpStatus: 403 }
      });
    }
    
    finalPageToken = pageToken;
  }
  
  // Obtener información del post
  const apiUrl = `https://graph.facebook.com/v23.0/${postId}?fields=id,permalink_url,is_published&access_token=${finalPageToken}`;
  
  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      timeout: 10000
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[FB Get] Post ${postId} no existe (404)`);
        return { exists: false };
      }
      
      const data = await response.json();
      const errorCode = data.error?.code || 999;
      const errorMsg = data.error?.message || "Error desconocido";
      
      console.error(`[FB Get] ❌ Error ${errorCode}: ${errorMsg}`);
      
      // Si es error 33 (no encontrado), tratarlo como no existe
      if (errorCode === 33) {
        console.log(`[FB Get] Post ${postId} no existe (error 33)`);
        return { exists: false };
      }
      
      throw new Error(ERROR_MESSAGES[errorCode] || errorMsg, {
        cause: {
          code: "FACEBOOK_UPSTREAM_ERROR",
          fbCode: errorCode,
          httpStatus: 502
        }
      });
    }
    
    const data = await response.json();
    
    console.log(`[FB Get] ✅ Post encontrado: ${postId}`);
    
    return {
      exists: true,
      id: data.id,
      permalink_url: data.permalink_url,
      is_published: data.is_published !== false
    };
    
  } catch (error) {
    // Re-lanzar error con contexto
    if (!error.cause) {
      error.cause = { code: "UNKNOWN_ERROR", httpStatus: 500 };
    }
    throw error;
  }
}

/**
 * Normaliza texto para hashtag (sin espacios, tildes, PascalCase)
 * @param {string} text - Texto a normalizar
 * @returns {string} Hashtag válido
 */
function normalizeHashtag(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Eliminar caracteres especiales y normalizar
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover tildes
    .replace(/[^a-zA-Z0-9\s]/g, '') // Solo letras, números y espacios
    .trim();
  
  // Convertir a PascalCase
  const words = normalized.split(/\s+/);
  const pascalCase = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  
  return pascalCase ? `#${pascalCase}` : '';
}

/**
 * Genera hashtags desde categoría y etiquetas
 * Solo incluye #Cuba si la noticia está relacionada con Cuba
 * @param {string} categoria - Categoría de la noticia
 * @param {Array<string>} etiquetas - Etiquetas de la noticia
 * @returns {string} Línea de hashtags
 */
function buildHashtags(categoria, etiquetas = []) {
  const tags = [];
  
  // Verificar si la noticia está relacionada con Cuba
  const etiquetasLower = (etiquetas || []).map(e => (e || '').toLowerCase().trim());
  const categoriaLower = (categoria || '').toLowerCase().trim();
  const esSobreCuba = 
    categoriaLower === 'cuba' ||
    etiquetasLower.some(e => e === 'cuba' || e.includes('cuba'));
  
  // Solo agregar #Cuba si la noticia está relacionada con Cuba
  if (esSobreCuba) {
    tags.push('#Cuba');
  }
  
  // Agregar categoría
  if (categoria) {
    const categoryTag = normalizeHashtag(categoria);
    if (categoryTag && !tags.includes(categoryTag)) {
      tags.push(categoryTag);
    }
  }
  
  // Agregar etiquetas (hasta llenar 5 hashtags)
  if (Array.isArray(etiquetas) && etiquetas.length > 0) {
    const extraTags = etiquetas
      .map(normalizeHashtag)
      .filter(tag => tag && !tags.includes(tag));
    
    // Agregar hasta completar 5 hashtags
    for (const tag of extraTags) {
      if (tags.length >= 5) break;
      tags.push(tag);
    }
  }
  
  // Limitar a 5 hashtags totales
  return tags.slice(0, 5).join(' ');
}

/**
 * Extrae resumen sin duplicar el título
 * @param {string} titulo - Título de la noticia
 * @param {string} bajada - Bajada/resumen del redactor
 * @param {string} contenido - Contenido HTML de la noticia
 * @returns {string} Resumen limpio
 */
function extractSummary(titulo, bajada, contenido) {
  // Priorizar bajada
  if (bajada && typeof bajada === 'string' && bajada.trim()) {
    const cleanBajada = bajada.trim();
    
    // Verificar si la bajada NO comienza repitiendo el título
    const tituloStart = titulo.substring(0, 30).toLowerCase().trim();
    const bajadaStart = cleanBajada.substring(0, 30).toLowerCase().trim();
    
    if (!bajadaStart.startsWith(tituloStart)) {
      // Recortar a ~180 caracteres sin cortar palabras
      if (cleanBajada.length <= 180) {
        return cleanBajada;
      }
      
      const truncated = cleanBajada.substring(0, 180);
      const lastSpace = truncated.lastIndexOf(' ');
      return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
    }
  }
  
  // Fallback: extraer desde contenido
  if (contenido && typeof contenido === 'string') {
    // Eliminar HTML
    const textOnly = contenido
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!textOnly) return '';
    
    // Buscar primer párrafo que NO sea el título
    const tituloLower = titulo.toLowerCase().trim();
    const sentences = textOnly.split(/[.!?]\s+/);
    
    for (const sentence of sentences) {
      const sentenceLower = sentence.trim().toLowerCase();
      
      // Saltar si es muy corto o es el título
      if (sentenceLower.length < 30 || sentenceLower === tituloLower) {
        continue;
      }
      
      // Verificar que NO comience igual que el título
      const tituloStart = tituloLower.substring(0, 30);
      const sentenceStart = sentenceLower.substring(0, 30);
      
      if (!sentenceStart.startsWith(tituloStart)) {
        // Recortar a ~180 caracteres
        const cleanSentence = sentence.trim();
        if (cleanSentence.length <= 180) {
          return cleanSentence;
        }
        
        const truncated = cleanSentence.substring(0, 180);
        const lastSpace = truncated.lastIndexOf(' ');
        return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
      }
    }
    
    // Si todo falla, tomar primeros 180 caracteres (evitando título)
    const start = textOnly.toLowerCase().indexOf(tituloLower);
    const contentStart = start >= 0 ? start + titulo.length : 0;
    const remaining = textOnly.substring(contentStart).trim();
    
    if (remaining.length <= 180) {
      return remaining;
    }
    
    const truncated = remaining.substring(0, 180);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
  }
  
  return '';
}

/**
 * Array de 30 preguntas para rotación automática en comentarios
 * Incluye variantes neutrales, sociales, críticas y de participación
 */
const COMMENT_QUESTIONS = [
  // Neutrales
  "¿Qué opinas de este caso?",
  "¿Habías escuchado sobre esto?",
  "¿Te sorprende esta noticia?",
  "¿Qué piensas al respecto?",
  "¿Conocías esta situación?",
  "¿Qué te parece esto?",
  // Sociales
  "¿Cómo afecta esto a tu familia?",
  "¿Has vivido algo similar?",
  "¿Conoces a alguien en esta situación?",
  "¿Cómo lo viven en tu comunidad?",
  "¿Qué dicen tus vecinos sobre esto?",
  "¿Lo están comentando en tu barrio?",
  // Críticas
  "¿Crees que esto cambiará algo?",
  "¿Por qué crees que sucede esto?",
  "¿Quién debería responder por esto?",
  "¿Cuánto más puede durar esta situación?",
  "¿Ves alguna solución posible?",
  "¿Confías en que se resuelva?",
  // Participación
  "Cuéntanos tu experiencia 👇",
  "Comparte tu opinión con nosotros 👇",
  "Déjanos saber qué piensas 👇",
  "Tu opinión nos importa, comenta 👇",
  "¿Qué harías tú en esta situación?",
  "Si pudieras cambiar algo, ¿qué sería?",
  // Emocionales
  "¿Cómo te hace sentir esta noticia?",
  "¿Te indigna o te da esperanza?",
  "¿Qué sentiste al leer esto?",
  // Reflexivas
  "¿Crees que esto es justo?",
  "¿Debería ser diferente?",
  "¿Qué futuro ves para Cuba con esto?"
];

/**
 * Último índice usado para evitar repeticiones consecutivas
 */
let lastQuestionIndex = -1;

/**
 * Selecciona una pregunta aleatoria del arreglo de rotación
 * Garantiza que nunca se repita la misma pregunta consecutivamente
 * @returns {string} Pregunta seleccionada
 */
function getRandomCommentQuestion() {
  let randomIndex;
  
  // Generar índice aleatorio diferente al anterior
  do {
    randomIndex = Math.floor(Math.random() * COMMENT_QUESTIONS.length);
  } while (randomIndex === lastQuestionIndex && COMMENT_QUESTIONS.length > 1);
  
  // Guardar para la próxima vez
  lastQuestionIndex = randomIndex;
  
  return COMMENT_QUESTIONS[randomIndex];
}

/**
 * Publica un comentario automático en un post de Facebook
 * @param {Object} options
 * @param {string} options.fbPostId - ID del post de Facebook
 * @param {string} options.canonicalUrl - URL de la noticia
 * @param {string} [options.userToken] - User token para resolver PAGE_TOKEN
 * @returns {Promise<{commentId: string}>}
 */
async function publishAutoComment({ fbPostId, canonicalUrl, userToken }) {
  console.log(`[FB Comment] 💬 Publicando comentario en post ${fbPostId}...`);
  
  // Obtener configuración validada (sin caché)
  let config;
  try {
    config = getFacebookConfig();
  } catch (error) {
    console.error("[FB Comment] ❌ Error de configuración:", error.message);
    throw new Error(error.message, { 
      cause: { code: "CONFIG_ERROR", httpStatus: 500 } 
    });
  }
  
  const { appId, appSecret, pageId, pageToken: envPageToken } = config;
  
  // Determinar token a usar
  let finalPageToken = userToken || envPageToken;
  
  if (!finalPageToken) {
    throw new Error("No hay token disponible para el comentario", {
      cause: { code: "NO_TOKEN", httpStatus: 401 }
    });
  }
  
  // Verificar si necesitamos resolver PAGE_TOKEN desde USER_TOKEN
  const tokenInfo = await debugToken(appId, appSecret, finalPageToken);
  
  if (!tokenInfo.isValid) {
    throw new Error("Token inválido o expirado", {
      cause: { code: "INVALID_TOKEN", httpStatus: 401 }
    });
  }
  
  // Si el token es de usuario, obtener PAGE_TOKEN
  if (tokenInfo.profileId !== pageId) {
    console.log("[FB Comment] Token es USER_TOKEN, resolviendo PAGE_TOKEN...");
    const pageToken = await getPageTokenFromUserToken(finalPageToken, pageId);
    
    if (!pageToken) {
      throw new Error("No se pudo obtener PAGE_TOKEN para comentario", {
        cause: { code: "PAGE_TOKEN_ERROR", httpStatus: 403 }
      });
    }
    
    finalPageToken = pageToken;
  }
  
  // Seleccionar pregunta aleatoria de la rotación (30 variantes)
  const randomQuestion = getRandomCommentQuestion();
  console.log(`[FB Comment] 🎲 Pregunta seleccionada: "${randomQuestion}"`);
  
  // Construir mensaje del comentario con pregunta rotativa
  const commentMessage = `Para más detalles, lee la noticia completa en el enlace del post:\n\n${canonicalUrl}\n\n💬 ${randomQuestion}`;
  
  // Publicar comentario en Facebook
  const apiUrl = `https://graph.facebook.com/v23.0/${fbPostId}/comments`;
  
  const postData = new URLSearchParams({
    message: commentMessage,
    access_token: finalPageToken
  });
  
  console.log(`[FB Comment] Enviando comentario a /${fbPostId}/comments...`);
  
  // Intentar hasta 2 reintentos antes de fallar
  const maxRetries = 2;
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Esperar 800ms antes del reintento
        await new Promise(resolve => setTimeout(resolve, 800));
        console.log(`[FB Comment] Reintento #${attempt}...`);
      }
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: postData.toString(),
        timeout: 15000
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const errorCode = data.error?.code || 999;
        const errorMsg = data.error?.message || "Error desconocido";
        
        if (attempt === maxRetries) {
          console.error(`[FB Comment] ❌ Error ${errorCode}: ${errorMsg}`);
        }
        
        throw new Error(ERROR_MESSAGES[errorCode] || errorMsg, {
          cause: {
            code: "FACEBOOK_COMMENT_ERROR",
            fbCode: errorCode,
            httpStatus: 502
          }
        });
      }
      
      if (!data.id) {
        throw new Error("Facebook no devolvió ID de comentario");
      }
      
      const commentId = data.id;
      if (attempt > 0) {
        console.log(`[FB Comment] ✅ Comentario publicado exitosamente en reintento #${attempt}: ${commentId}`);
      } else {
        console.log(`[FB Comment] ✅ Comentario publicado correctamente: ${commentId}`);
      }
      
      return { commentId };
      
    } catch (error) {
      lastError = error;
      
      // Si no es el último intento, continuar al siguiente
      if (attempt < maxRetries) {
        continue;
      }
      
      // Último intento fallido: re-lanzar error
      if (!error.cause) {
        error.cause = { code: "UNKNOWN_ERROR", httpStatus: 500 };
      }
      throw error;
    }
  }
}

/**
 * Publica una noticia en Facebook como photo post
 * @param {Object} news - Objeto de noticia desde MongoDB
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<{fbPostId: string, permalink: string}>}
 */
async function publishNewsToFacebook(news, options = {}) {
  if (!news || !news._id) {
    throw new Error('Noticia inválida', {
      cause: { code: 'INVALID_NEWS', httpStatus: 400 }
    });
  }
  
  // ========================================
  // VERIFICACIÓN DE DUPLICADOS
  // ========================================
  // Si ya tiene facebook_post_id, ya fue publicada
  if (news.facebook_post_id) {
    console.warn(`[FB Publisher] ⚠️ Noticia ${news._id} ya publicada en Facebook (post_id: ${news.facebook_post_id})`);
    throw new Error('Esta noticia ya fue publicada en Facebook', {
      cause: { 
        code: 'ALREADY_PUBLISHED', 
        httpStatus: 409,
        existingPostId: news.facebook_post_id,
        permalink: news.facebook_permalink_url
      }
    });
  }
  
  // Si publishedToFacebook es true, también es duplicado
  if (news.publishedToFacebook === true) {
    console.warn(`[FB Publisher] ⚠️ Noticia ${news._id} marcada como publicada en Facebook`);
    throw new Error('Esta noticia ya fue publicada en Facebook', {
      cause: { 
        code: 'ALREADY_PUBLISHED', 
        httpStatus: 409 
      }
    });
  }
  
  // Si facebook_status es 'published', no publicar
  if (news.facebook_status === 'published') {
    console.warn(`[FB Publisher] ⚠️ Noticia ${news._id} ya está publicada en Facebook`);
    throw new Error('Esta noticia ya está publicada en Facebook', {
      cause: { 
        code: 'ALREADY_PUBLISHED', 
        httpStatus: 409 
      }
    });
  }
  
  // Si facebook_status es 'sharing', verificar si el lock expiró
  // EXCEPCIÓN: Si es autoPublish o manualPublish, el llamador ya puso el lock, no verificar
  if (news.facebook_status === 'sharing' && !options.autoPublish && !options.manualPublish) {
    const lockAge = news.facebook_sharing_since 
      ? (Date.now() - new Date(news.facebook_sharing_since).getTime()) / 1000 / 60 
      : 999; // Si no hay timestamp, considerar expirado
    
    // Lock tiene más de 10 minutos → expirado, liberar y continuar
    if (lockAge > 10) {
      console.warn(`[FB Publisher] ⚠️ Lock de noticia ${news._id} expirado (${lockAge.toFixed(1)} min), liberando...`);
      await News.findByIdAndUpdate(news._id, {
        facebook_status: 'error',
        facebook_last_error: 'Lock de publicación expirado (proceso anterior no completó correctamente)',
        facebook_sharing_since: null
      });
      // Continuar con el flujo de publicación (no lanzar error)
    } else {
      // Lock reciente (< 10 min) → proceso activo, rechazar
      console.warn(`[FB Publisher] ⚠️ Noticia ${news._id} tiene lock activo (${lockAge.toFixed(1)} min)`);
      throw new Error('Esta noticia ya está siendo publicada en Facebook', {
        cause: { 
          code: 'PUBLISHING_IN_PROGRESS', 
          httpStatus: 409 
        }
      });
    }
  }
  
  // Construir URL pública de la noticia (usa slug si existe, sino ID)
  const canonicalUrl = buildNewsPublicUrl(news);
  
  // Construir mensaje según formato requerido
  const titulo = (news.titulo || '').trim();
  const resumen = extractSummary(titulo, news.bajada, news.contenido);
  const hashtags = buildHashtags(news.categoria, news.etiquetas);
  
  // Formato NUEVO (SIN URL - enlace va en primer comentario):
  // [RESUMEN]
  // 
  // 👉 Para ver la noticia completa, revisa el primer comentario.
  // 
  // [HASHTAGS]
  
  const introLink = '👉 Para ver la noticia completa, revisa el primer comentario.';
  const parts = [];
  
  if (resumen) {
    parts.push(resumen);
  }
  
  parts.push(''); // Línea en blanco
  parts.push(introLink); // Frase indicando que el link está en el comentario
  parts.push(''); // Línea en blanco
  parts.push(hashtags);
  
  const message = parts.join('\n');
  
  // Construir URL absoluta del cover de la noticia
  let imageUrl = buildAbsoluteImageUrl(news);
  
  // CRÍTICO: Facebook NO acepta AVIF - convertir a WebP/JPG
  if (imageUrl.includes('.avif')) {
    console.warn(`[FB Publisher] ⚠️ Cover es AVIF (no soportado por Facebook), intentando WebP...`);
    // Intentar WebP primero
    imageUrl = imageUrl.replace(/\.avif$/i, '.webp');
  }
  
  // ========================================
  // GENERAR PORTADA ROJA PARA FACEBOOK
  // ========================================
  console.log('[FB DEBUG] 📢 Publicando noticia en Facebook:', news._id);
  
  // 1. Buscar imagen original de la noticia
  let originalImagePath = null;
  const relativeImagePath = news.imagen || news.cover || news.image;
  
  console.log(`[FB DEBUG] relativeImagePath: ${relativeImagePath}`);
  console.log(`[FB DEBUG] process.cwd(): ${process.cwd()}`);
  
  if (relativeImagePath && !relativeImagePath.startsWith('http')) {
    // Ruta absoluta en el filesystem del servidor
    if (relativeImagePath.startsWith('/uploads/')) {
      originalImagePath = path.join(__dirname, '..', relativeImagePath);
    } else if (relativeImagePath.startsWith('uploads/')) {
      originalImagePath = path.join(__dirname, '..', relativeImagePath);
    } else if (relativeImagePath.startsWith('/media/')) {
      // Soporte para /media/news/:id/cover.avif
      // Quitar el / inicial para path.join correcto
      const cleanPath = relativeImagePath.startsWith('/') ? relativeImagePath.slice(1) : relativeImagePath;
      originalImagePath = path.join(process.cwd(), 'public', cleanPath);
      console.log(`[FB DEBUG] originalImagePath construido: ${originalImagePath}`);
      console.log(`[FB DEBUG] Existe archivo: ${fs.existsSync(originalImagePath)}`);
      
      // Si es AVIF, intentar WebP o JPG como fallback local
      if (originalImagePath.endsWith('.avif')) {
        const webpPath = originalImagePath.replace(/\.avif$/i, '.webp');
        const jpgPath = originalImagePath.replace(/\.avif$/i, '.jpg');
        
        console.log(`[FB DEBUG] Buscando alternativas a AVIF...`);
        console.log(`[FB DEBUG] WebP path: ${webpPath} - existe: ${fs.existsSync(webpPath)}`);
        console.log(`[FB DEBUG] JPG path: ${jpgPath} - existe: ${fs.existsSync(jpgPath)}`);
        
        if (fs.existsSync(webpPath)) {
          originalImagePath = webpPath;
          console.log(`[FB Publisher] ✅ Usando WebP local: ${originalImagePath}`);
        } else if (fs.existsSync(jpgPath)) {
          originalImagePath = jpgPath;
          console.log(`[FB Publisher] ✅ Usando JPG local: ${originalImagePath}`);
        } else {
          console.log(`[FB DEBUG] ❌ No hay alternativa a AVIF, intentando AVIF directo`);
          // Mantener AVIF y ver si sharp puede procesarlo
        }
      }
    }
    
    // Verificar que el archivo existe
    if (originalImagePath && !fs.existsSync(originalImagePath)) {
      console.warn(`[FB Publisher] ⚠️ Archivo original no encontrado: ${originalImagePath}`);
      originalImagePath = null;
    }
  }
  
  // 2. Generar portada roja SIEMPRE (obligatorio para Facebook)
  let redCoverPath = null;
  
  if (originalImagePath) {
    try {
      console.log('[FB DEBUG] 🎨 Generando portada roja desde archivo local...');
      const imageBuffer = await fs.promises.readFile(originalImagePath);
      const result = await generateFacebookRedCover(
        imageBuffer,
        {
          titulo: news.titulo,
          title: news.titulo,
          categoria: news.categoria,
          etiquetas: news.etiquetas
        },
        news._id ? news._id.toString() : null
      );
      
      redCoverPath = result.savedPath;
      console.log('[FB DEBUG] ✅ Portada roja generada:', redCoverPath);
      
    } catch (coverError) {
      console.error('[FB DEBUG] ❌ Error generando portada roja:', coverError.message);
      // Continuar sin portada roja (usar original)
    }
  } else {
    console.warn('[FB DEBUG] ⚠️ No hay imagen local, descargando desde URL...');
    
    // Intentar descargar imagen desde URL para generar portada roja
    try {
      const response = await fetch(imageUrl, { timeout: 10000 });
      
      if (response.ok) {
        const imageBuffer = await response.buffer();
        const result = await generateFacebookRedCover(
          imageBuffer,
          {
            titulo: news.titulo,
            title: news.titulo,
            categoria: news.categoria,
            etiquetas: news.etiquetas
          },
          news._id ? news._id.toString() : null
        );
        
        redCoverPath = result.savedPath;
        console.log('[FB DEBUG] ✅ Portada roja generada desde URL:', redCoverPath);
      } else {
        console.warn('[FB DEBUG] ⚠️ No se pudo descargar imagen desde URL:', response.status);
      }
    } catch (downloadError) {
      console.error('[FB DEBUG] ❌ Error descargando imagen:', downloadError.message);
    }
  }
  
  // 3. Usar portada roja como imagen principal (obligatorio)
  const imagePath = redCoverPath || originalImagePath;
  
  if (redCoverPath) {
    console.log('[FB DEBUG] 🔥 USANDO PORTADA ROJA PARA FACEBOOK:', redCoverPath);
  } else {
    console.warn('[FB DEBUG] ⚠️ Fallback: usando imagen original (portada roja no disponible)');
  }
  
  // Log para debugging
  console.log('[FB Publisher] Caption construido:');
  console.log('--- INICIO ---');
  console.log(message);
  console.log('--- FIN ---');
  console.log(`[FB DEBUG] Imagen que se enviará a Facebook: ${imagePath || imageUrl}`);
  
  // Publicar como photo post (portada roja ya generada)
  const { fbPostId, permalink } = await publishToFacebook({
    message,
    imageUrl: imagePath ? null : imageUrl, // Solo usar URL si no hay archivo local
    imagePath, // Portada roja o fallback
    userToken: options.userToken
  });
  
  // Publicar comentario automático con el link
  try {
    await publishAutoComment({
      fbPostId,
      canonicalUrl,
      userToken: options.userToken
    });
  } catch (commentError) {
    // No fallar la publicación principal si el comentario falla
    console.error('[FB Comment] ❌ Error publicando comentario (no crítico):', commentError.message);
  }
  
  // ========================================
  // PUBLICAR EN FACEBOOK STORIES
  // ========================================
  // Subir la misma imagen (portada roja) como Story
  let storyResult = { success: false };
  try {
    // Usar la misma imagen que se usó para el post
    if (imagePath && fs.existsSync(imagePath)) {
      console.log(`[FB Publisher] 📱 Publicando en Stories con imagen: ${imagePath}`);
      storyResult = await publishToFacebookStory({
        imagePath: imagePath,
        userToken: options.userToken,
        link: canonicalUrl  // Link "Ver más" que lleva a la noticia
      });
      
      if (storyResult.success) {
        console.log(`[FB Publisher] ✅ También publicado en Stories: ${storyResult.storyId}`);
      }
    } else {
      console.log(`[FB Publisher] ⚠️ No hay imagen local para Stories (imagePath: ${imagePath})`);
    }
  } catch (storyError) {
    // No fallar la publicación principal si el Story falla
    console.error('[FB Story] ❌ Error publicando en Story (no crítico):', storyError.message);
  }
  
  return { 
    fbPostId, 
    permalink,
    storyId: storyResult.storyId || null,
    storyPublished: storyResult.success
  };
}

// ================================================================================
// [LC-FB-COVER] FUNCIÓN DE TEST - Genera portadas de prueba en disco
// ================================================================================

/**
 * Genera portadas de prueba para verificar que el texto no se corta
 * Ejecutar: node -e "require('./server/services/facebookPublisher').testFacebookCovers()"
 * @returns {Promise<void>}
 */
async function testFacebookCovers() {
  const testDir = path.join(process.cwd(), 'server', 'tmp', 'fb_covers_test');
  
  // Crear directorio de test
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // Títulos de prueba
  const testTitles = [
    {
      name: 'short',
      title: 'Cuba denuncia bloqueo de EEUU'
    },
    {
      name: 'medium',
      title: 'Ferrer asistirá a evento en Washington por el Día Internacional de los Derechos Humanos'
    },
    {
      name: 'long',
      title: 'El régimen cubano intensifica la represión contra activistas y periodistas independientes mientras la comunidad internacional exige liberación de presos políticos y respeto a los derechos humanos fundamentales'
    }
  ];
  
  // Crear imagen de prueba (roja sólida 1024x1024)
  const testImageBuffer = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 3,
      background: { r: 100, g: 50, b: 50 }
    }
  }).jpeg().toBuffer();
  
  console.log('\n[FB Cover Test] ========================================');
  console.log('[FB Cover Test] Generando portadas de prueba...');
  console.log('[FB Cover Test] ========================================\n');
  
  for (const test of testTitles) {
    try {
      const { buffer } = await generateFacebookRedCover(
        testImageBuffer,
        { titulo: test.title },
        `test-${test.name}`
      );
      
      const outputPath = path.join(testDir, `cover-${test.name}.jpg`);
      await fs.promises.writeFile(outputPath, buffer);
      
      // Obtener info del layout
      const layout = wrapTextForBanner(test.title, {
        maxWidth: 820,
        maxLines: 3,
        baseFontSize: 50,
        minFontSize: 36,
        fontFamily: 'Arial Black'
      });
      
      console.log(`[FB Cover] Test ${test.name} OK (fontSize=${layout.fontSize}, lines=${layout.lines.length})`);
      console.log(`           → ${outputPath}`);
      console.log(`           → Líneas: ${layout.lines.join(' | ')}\n`);
      
    } catch (error) {
      console.error(`[FB Cover] Test ${test.name} FAILED: ${error.message}`);
    }
  }
  
  console.log('[FB Cover Test] ========================================');
  console.log(`[FB Cover Test] Portadas guardadas en: ${testDir}`);
  console.log('[FB Cover Test] ========================================\n');
}

module.exports = {
  publishToFacebook,
  publishNewsToFacebook,
  publishToFacebookStory,
  buildNewsPublicUrl,
  buildAbsoluteImageUrl,
  debugToken,
  getPageTokenFromUserToken,
  getPostPermalink,
  deletePost,
  getPost,
  ERROR_MESSAGES,
  testFacebookCovers,
  generateFacebookRedCover
};

/**
 * ================================================================================
 * DOCUMENTACIÓN - FORMATO DE PUBLICACIÓN EN FACEBOOK
 * ================================================================================
 * 
 * Este módulo publica noticias en Facebook usando Graph API v23.0.
 * Cada publicación consta de 2 pasos:
 * 
 * 1. POST a /{pageId}/photos (photo post con caption)
 * 2. POST a /{fbPostId}/comments (comentario automático con link)
 * 
 * --------------------------------------------------------------------------------
 * PASO 1: PHOTO POST ENVIADO A /photos
 * --------------------------------------------------------------------------------
 * 
 * Formato del caption (message):
 * 
 * [RESUMEN]
 * 
 * 👉 Lee la noticia completa aquí:
 * [URL]
 * 
 * [HASHTAGS]
 * 
 * Ejemplo real:
 * 
 * Cubanos residentes en México inician acopio de alimentos y medicinas para apoyar a Cuba tras el paso del huracán Melissa, que dejó daños significativos en el Oriente de la isla.
 * 
 * 👉 Lee la noticia completa aquí:
 * https://levantatecuba.com/noticias/6910e1a4b723d7883038626f
 * 
 * #Cuba #SocioPolítico #Mexico #HuracánMelissa
 * 
 * --------------------------------------------------------------------------------
 * MÉTODOS DE PUBLICACIÓN (2 métodos limpios):
 * --------------------------------------------------------------------------------
 * 
 * MÉTODO 1: URL DIRECTA (prioridad)
 * 
 * Parámetros enviados a POST /{pageId}/photos:
 * - url: https://levantatecuba.com/uploads/ai_drafts/draft_xxx.png (cover URL pública)
 * - caption: [resumen + link + hashtags]
 * - access_token: [PAGE_TOKEN]
 * 
 * Ventajas:
 * - Más rápido (no sube binario)
 * - Menor ancho de banda
 * 
 * Si este método falla (error 324, 404, etc.), pasa automáticamente a:
 * 
 * MÉTODO 2: FALLBACK MULTIPART (archivo local)
 * 
 * Parámetros enviados a POST /{pageId}/photos:
 * - source: [stream binario del archivo]
 * - caption: [resumen + link + hashtags]
 * - access_token: [PAGE_TOKEN]
 * 
 * Orden de fallback:
 * 1. Archivo local del cover (si imagePath existe)
 * 2. Imagen genérica: public/img/og-default.jpg
 * 
 * Ventajas:
 * - 100% fiable (no depende de URL accesible)
 * - Siempre publica algo (imagen genérica como último recurso)
 * 
 * Resultado esperado:
 * - Facebook muestra la foto del cover como imagen principal del post
 * - El caption aparece debajo de la foto con el texto, enlace y hashtags
 * - Mejor engagement visual que link post (imagen más grande y prominente)
 * 
 * --------------------------------------------------------------------------------
 * PASO 2: COMENTARIO ENVIADO A /comments
 * --------------------------------------------------------------------------------
 * 
 * Formato del comentario:
 * 
 * Para más detalles, lee la noticia completa en el enlace del post:
 * 
 * [URL]
 * 
 * 💬 ¿Qué opinas de este caso?
 * 
 * Ejemplo real:
 * 
 * Para más detalles, lee la noticia completa en el enlace del post:
 * 
 * https://levantatecuba.com/noticias/6910e1a4b723d7883038626f
 * 
 * 💬 ¿Qué opinas de este caso?
 * 
 * Parámetros enviados:
 * - message: [texto anterior]
 * - access_token: [PAGE_TOKEN]
 * 
 * Endpoint: POST /v23.0/{fbPostId}/comments
 * 
 * Resultado esperado:
 * - Comentario visible debajo del post
 * - Publicado por la página (no por un usuario)
 * - Aparece inmediatamente después de publicar el post
 * 
 * --------------------------------------------------------------------------------
 * LOGS ESPERADOS (éxito con URL directa)
 * --------------------------------------------------------------------------------
 * 
 * [FB Publisher] Caption construido:
 * --- INICIO ---
 * Cubanos residentes en México inician acopio de alimentos y medicinas para apoyar a Cuba tras el paso del huracán Melissa, que dejó daños significativos en el Oriente de la isla.
 * 
 * 👉 Lee la noticia completa aquí:
 * https://levantatecuba.com/noticias/6910e1a4b723d7883038626f
 * 
 * #Cuba #SocioPolítico #Mexico #HuracánMelissa
 * --- FIN ---
 * [FB Publisher] Cover URL: https://levantatecuba.com/uploads/ai_drafts/draft_xxx.png
 * [FB Publisher] Archivo local disponible: C:\Dev\levantatecuba\server\uploads\ai_drafts\draft_xxx.png
 * [FB Publisher] === INICIANDO PUBLICACIÓN ===
 * [FB Config] { appIdLen: 15, graphVersion: 'v23.0', pageId: '724642430740421' }
 * [FB Preflight] type=photo graph=v23.0 pageId=724642430740421 endpoint=/photos
 * [FB Publish] photoUrl=https://levantatecuba.com/uploads/ai_drafts/draft_xxx.png
 * [FB Publisher] Publicando foto en /724642430740421/photos...
 * [FB Publisher] Método 1: URL directa
 * [FB Publisher] URL: https://levantatecuba.com/uploads/ai_drafts/draft_xxx.png
 * [FB Publisher] ✅ Foto publicada vía URL. fbPostId=724642430740421_122115172845002635
 * [FB Publisher] permalink=https://www.facebook.com/...
 * [FB Publisher] Método usado: URL DIRECTA
 * [FB Publisher] === PUBLICACIÓN COMPLETADA ===
 * [FB Comment] 💬 Publicando comentario en post 724642430740421_122115172845002635...
 * [FB Comment] Enviando comentario a /724642430740421_122115172845002635/comments...
 * [FB Comment] ✅ Comentario publicado correctamente: 724642430740421_122115172845002635_123456789
 * [Social Routes] ✅ Noticia 6910e1a4b723d7883038626f publicada exitosamente
 * 
 * --------------------------------------------------------------------------------
 * LOGS ESPERADOS (fallback a archivo local)
 * --------------------------------------------------------------------------------
 * 
 * [FB Publisher] Método 1: URL directa
 * [FB Publisher] URL: https://levantatecuba.com/uploads/ai_drafts/draft_xxx.png
 * [FB Publisher] ⚠️ Error 324 con URL: Invalid image format
 * [FB Publisher] Intentando fallback con archivo local...
 * [FB Publisher] Fallback: Usando cover local: C:\Dev\levantatecuba\server\uploads\ai_drafts\draft_xxx.png
 * [FB Publisher] ✅ Foto publicada vía fallback local. fbPostId=724642430740421_122115172845002635
 * [FB Publisher] permalink=https://www.facebook.com/...
 * [FB Publisher] Método usado: FALLBACK LOCAL
 * [FB Publisher] === PUBLICACIÓN COMPLETADA ===
 * [Social Routes] ✅ Noticia 6910e1a4b723d7883038626f publicada exitosamente
 * 
 * --------------------------------------------------------------------------------
 * LOGS ESPERADOS (fallback a imagen genérica)
 * --------------------------------------------------------------------------------
 * 
 * [FB Publisher] Método 1: URL directa
 * [FB Publisher] URL: https://levantatecuba.com/uploads/ai_drafts/draft_xxx.png
 * [FB Publisher] ⚠️ Error 404 con URL: Not Found
 * [FB Publisher] Intentando fallback con archivo local...
 * [FB Publisher] Fallback: Usando imagen genérica: C:\Dev\levantatecuba\public\img\og-default.jpg
 * [FB Publisher] ✅ Foto publicada vía fallback local. fbPostId=724642430740421_122115172845002635
 * [FB Publisher] permalink=https://www.facebook.com/...
 * [FB Publisher] Método usado: FALLBACK LOCAL
 * [FB Publisher] === PUBLICACIÓN COMPLETADA ===
 * [Social Routes] ✅ Noticia 6910e1a4b723d7883038626f publicada exitosamente
 * 
 * --------------------------------------------------------------------------------
 * VENTAJAS DE PHOTO POST VS LINK POST
 * --------------------------------------------------------------------------------
 * 
 * ✅ PHOTO POST (implementado):
 * - Imagen del cover siempre visible y prominente (tamaño completo)
 * - No depende del scraper de Facebook para mostrar la imagen
 * - Mayor engagement visual (imagen más grande atrae más atención)
 * - Caption con texto, enlace y hashtags debajo de la foto
 * - Control total sobre qué imagen se muestra
 * 
 * ❌ LINK POST (anterior):
 * - Imagen del preview puede ser pequeña o no mostrarse
 * - Depende del scraper de OG tags (puede fallar o demorar)
 * - Menor engagement visual
 * - Preview puede mostrar imagen incorrecta si hay problemas con OG tags
 * 
 * --------------------------------------------------------------------------------
 * MANEJO DE ERRORES
 * --------------------------------------------------------------------------------
 * 
 * - Si el comentario falla, NO se considera fallida la publicación principal
 * - El photo post ya está publicado en /photos
 * - Solo se registra el error: [FB Comment] ❌ Error publicando comentario (no crítico)
 * - La respuesta HTTP sigue siendo 200 OK con fbPostId y permalink
 * 
 * --------------------------------------------------------------------------------
 * EJEMPLO DE SALIDA FINAL EN FACEBOOK
 * --------------------------------------------------------------------------------
 * 
 * PHOTO POST CAPTION:
 * Cubanos residentes en México inician acopio de alimentos y medicinas para 
 * apoyar a Cuba tras el paso del huracán Melissa, que dejó daños significativos 
 * en el Oriente de la isla.
 * 
 * 👉 Lee la noticia completa aquí:
 * https://levantatecuba.com/noticias/6910e1a4b723d7883038626f
 * 
 * #Cuba #SocioPolítico #Mexico #HuracánMelissa
 * 
 * AUTO COMMENT:
 * Para más detalles, lee la noticia completa en el enlace del post:
 * 
 * https://levantatecuba.com/noticias/6910e1a4b723d7883038626f
 * 
 * 💬 ¿Qué opinas de este caso?
 * 
 * RESULTADO VISUAL:
 * [FOTO DEL COVER EN TAMAÑO COMPLETO]
 * Caption con resumen + enlace + hashtags
 * Comentario automático con enlace y CTA
 * 
 * ================================================================================
 */