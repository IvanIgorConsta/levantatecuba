const fetch = require("node-fetch");
const { getFacebookConfig } = require("../config/facebook");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

/**
 * Servicio para publicar en Facebook usando Graph API v23.0
 * Sin caché de configuración, validaciones estrictas
 * @module services/facebookPublisher
 */

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
    const logoPath = path.join(__dirname, '..', 'assets', 'logo_levantatecuba.png');
    const titulo = newsData.titulo || newsData.title || '';
    
    console.log('[FB RedCover] 🎨 Generando portada roja especial...');
    
    // Validar que el logo existe
    if (!fs.existsSync(logoPath)) {
      console.warn('[FB RedCover] ⚠️ Logo no encontrado, usando portada simple');
      // Fallback: solo aplicar marca de agua simple
      const watermark = Buffer.from(`
        <svg width="400" height="80">
          <text
            x="100%" y="90%"
            text-anchor="end"
            font-size="40"
            font-family="Arial"
            fill="rgba(255,255,255,0.35)"
          >
            LevantateCuba.com
          </text>
        </svg>
      `);
      const buffer = await sharp(imageBuffer)
        .composite([{ input: watermark, gravity: "southeast" }])
        .toBuffer();
      return { buffer, savedPath: null };
    }
    
    // Crear título completo para Facebook (sin recortes)
    const titleLayout = wrapTextForBanner(titulo, {
      maxWidth: 904,        // 1024 - 60*2 (padding horizontal)
      maxLines: 3,
      baseFontSize: 52,
      minFontSize: 34,
      fontFamily: 'Impact'
    });
    
    const { fontSize: titleFontSize, lines: titleLines } = titleLayout;
    
    if (titleLines.length > 0) {
      console.log(`[FB RedCover] 📝 Título: ${titleLines.length} línea(s), fontSize=${titleFontSize}px`);
      console.log(`[FB RedCover] 📝 Contenido: "${titleLines.join(' / ')}"}`);
    }
    
    // 1. Crear canvas con fondo rojo degradado
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
    
    // 2. Procesar imagen de la noticia (centrada, cover)
    const processedImage = await sharp(imageBuffer)
      .resize(canvasSize, canvasSize, {
        fit: 'cover',
        position: 'center'
      })
      .toBuffer();
    
    // 3. Crear overlay oscuro para la imagen (10% oscuridad)
    const imageOverlay = Buffer.from(
      `<svg width="${canvasSize}" height="${canvasSize}">
        <rect width="${canvasSize}" height="${canvasSize}" fill="rgba(0,0,0,0.1)" />
      </svg>`
    );
    
    // 4. Procesar logo manteniendo transparencia (PNG con canal alpha)
    const logoWidth = 160;
    const logoMargin = 40;
    const logoBuffer = await sharp(logoPath)
      .resize({ width: logoWidth, fit: 'inside' })
      .png() // Mantener formato PNG con transparencia
      .toBuffer();
    
    // 5. Crear banner negro translúcido inferior con título multilínea
    const bannerHeight = Math.floor(canvasSize * 0.23); // 23% del alto
    const bannerY = canvasSize - bannerHeight;
    
    // Calcular posición vertical para centrar el texto multilínea
    const lineHeight = titleFontSize * 1.15; // 115% del fontSize
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
        <rect x="0" y="${bannerY}" width="${canvasSize}" height="${bannerHeight}" fill="rgba(0,0,0,0.65)" />
        ${titleLines.length > 0 ? `
          <text
            font-size="${titleFontSize}"
            font-family="Impact, Arial Black, sans-serif"
            font-weight="900"
            fill="#FFFFFF"
            style="letter-spacing: 0.5px;"
          >${textLines}
          </text>
        ` : ''}
      </svg>`
    );
    
    // 6. Crear marca de agua discreta
    const watermark = Buffer.from(
      `<svg width="${canvasSize}" height="${canvasSize}">
        <text
          x="${canvasSize - 20}" y="${canvasSize - 20}"
          text-anchor="end"
          font-size="18"
          font-family="Arial"
          fill="rgba(255,255,255,0.25)"
        >
          LEVANTATECUBA.COM
        </text>
      </svg>`
    );
    
    // 7. Componer todas las capas
    let composite = sharp(gradient)
      .composite([
        { input: processedImage, top: 0, left: 0, blend: 'over' }, // Imagen de fondo
        { input: imageOverlay, top: 0, left: 0, blend: 'over' },   // Overlay oscuro
        { input: logoBuffer, top: logoMargin, left: logoMargin, blend: 'over' }, // Logo con transparencia
        { input: banner, top: 0, left: 0, blend: 'over' },         // Banner con título
        { input: watermark, top: 0, left: 0, blend: 'over' }       // Marca de agua
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
 * Divide un título en múltiples líneas sin recortar texto, ajustando tamaño de fuente
 * @param {string} title - Título original de la noticia
 * @param {Object} options - Opciones de layout
 * @returns {Object} {fontSize, lines} - Tamaño de fuente y array de líneas
 */
function wrapTextForBanner(title, options = {}) {
  if (!title || typeof title !== 'string') {
    return { fontSize: options.baseFontSize || 50, lines: [] };
  }
  
  const {
    maxWidth = 904,           // Ancho útil (1024 - 60*2)
    maxLines = 3,             // Máximo de líneas preferidas
    baseFontSize = 52,        // Tamaño inicial
    minFontSize = 34,         // Tamaño mínimo
    fontFamily = 'Impact'     // Fuente (Impact es más condensada)
  } = options;
  
  // 1) Convertir a MAYÚSCULAS (sin recortar)
  const text = title.trim().toUpperCase();
  
  // 2) Estimar ancho promedio por carácter según la fuente
  // Impact es condensada, usamos ratio conservador para evitar cortes
  // Añadimos margen de seguridad (0.58 en lugar de 0.55) para mayúsculas
  const charWidthRatio = fontFamily.includes('Impact') ? 0.58 : 0.65;
  
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
      
      // Si la línea de prueba excede el ancho Y ya tenemos contenido,
      // guardar la línea actual y empezar una nueva con esta palabra
      if (estimatedWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // La palabra cabe, añadirla a la línea actual
        currentLine = testLine;
      }
    }
    
    // Guardar última línea
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  };
  
  // 4) Intentar con diferentes tamaños de fuente (de mayor a menor)
  for (let fontSize = baseFontSize; fontSize >= minFontSize; fontSize -= 2) {
    const lines = splitIntoLines(fontSize);
    
    // Si cabe en maxLines o menos, aceptar este fontSize
    if (lines.length <= maxLines) {
      return { fontSize, lines };
    }
  }
  
  // 5) Si ni siquiera con fontSize mínimo cabe, usar minFontSize de todos modos
  // IMPORTANTE: Devolvemos TODAS las líneas, nunca recortamos el texto
  const lines = splitIntoLines(minFontSize);
  
  return { fontSize: minFontSize, lines };
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
 * @param {string} newsId - ID de la noticia
 * @returns {string} URL absoluta HTTPS
 */
function buildNewsPublicUrl(newsId) {
  const base = process.env.PUBLIC_ORIGIN || 'https://levantatecuba.com';
  const url = new URL(`/noticias/${newsId}`, base);
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
    // MÉTODO 3: FALLBACK CON IMAGEN GENÉRICA (último recurso)
    // ==========================================
    if (!fbPostId) {
      console.log(`[FB Publisher] Método 3: Fallback con imagen genérica`);
      
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
      
      // Leer archivo directamente (portada roja ya debe estar generada o es fallback genérico)
      let fileBuffer = await fs.promises.readFile(localFile);
      console.log(`[FB Publisher] 📎 Usando imagen de fallback genérico`);
      usedWatermark = true; // Marcador de que se usó archivo local
      
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
      console.log(`[FB Publisher] ✅ Foto publicada vía fallback genérico con portada roja. fbPostId=${fbPostId}`);
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
 * @param {string} categoria - Categoría de la noticia
 * @param {Array<string>} etiquetas - Etiquetas de la noticia
 * @returns {string} Línea de hashtags
 */
function buildHashtags(categoria, etiquetas = []) {
  const tags = ['#Cuba']; // Siempre incluir Cuba
  
  // Agregar categoría
  if (categoria) {
    const categoryTag = normalizeHashtag(categoria);
    if (categoryTag && !tags.includes(categoryTag)) {
      tags.push(categoryTag);
    }
  }
  
  // Agregar hasta 3 etiquetas adicionales
  if (Array.isArray(etiquetas) && etiquetas.length > 0) {
    const extraTags = etiquetas
      .slice(0, 3)
      .map(normalizeHashtag)
      .filter(tag => tag && !tags.includes(tag));
    
    tags.push(...extraTags);
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
  
  // Construir mensaje del comentario
  const commentMessage = `Para más detalles, lee la noticia completa en el enlace del post:\n\n${canonicalUrl}\n\n💬 ¿Qué opinas de este caso?`;
  
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
  
  // Si facebook_status es 'published' o 'sharing', no publicar
  if (news.facebook_status === 'published' || news.facebook_status === 'sharing') {
    console.warn(`[FB Publisher] ⚠️ Noticia ${news._id} tiene facebook_status=${news.facebook_status}`);
    throw new Error(`Esta noticia ya está ${news.facebook_status === 'sharing' ? 'siendo publicada' : 'publicada'} en Facebook`, {
      cause: { 
        code: news.facebook_status === 'sharing' ? 'PUBLISHING_IN_PROGRESS' : 'ALREADY_PUBLISHED', 
        httpStatus: 409 
      }
    });
  }
  
  // Construir URL pública de la noticia
  const canonicalUrl = buildNewsPublicUrl(news._id);
  
  // Construir mensaje según formato requerido
  const titulo = (news.titulo || '').trim();
  const resumen = extractSummary(titulo, news.bajada, news.contenido);
  const hashtags = buildHashtags(news.categoria, news.etiquetas);
  
  // Formato NUEVO (CON INTRO ANTES DEL LINK):
  // [RESUMEN]
  // 
  // 👉 Lee la noticia completa aquí:
  // [URL]
  // 
  // [HASHTAGS]
  
  const introLink = '👉 Lee la noticia completa aquí:';
  const parts = [];
  
  if (resumen) {
    parts.push(resumen);
  }
  
  parts.push(''); // Línea en blanco
  parts.push(introLink); // Línea introductoria fija
  parts.push(canonicalUrl);
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
  
  if (relativeImagePath && !relativeImagePath.startsWith('http')) {
    // Ruta absoluta en el filesystem del servidor
    if (relativeImagePath.startsWith('/uploads/')) {
      originalImagePath = path.join(__dirname, '..', relativeImagePath);
    } else if (relativeImagePath.startsWith('uploads/')) {
      originalImagePath = path.join(__dirname, '..', relativeImagePath);
    } else if (relativeImagePath.startsWith('/media/')) {
      // Soporte para /media/news/:id/cover.avif
      originalImagePath = path.join(process.cwd(), 'public', relativeImagePath);
      // Si es AVIF, intentar WebP como fallback local
      if (originalImagePath.endsWith('.avif')) {
        const webpPath = originalImagePath.replace(/\.avif$/i, '.webp');
        if (fs.existsSync(webpPath)) {
          originalImagePath = webpPath;
          console.log(`[FB Publisher] Usando WebP local en lugar de AVIF: ${originalImagePath}`);
        } else {
          originalImagePath = null; // AVIF no soportado, no hay WebP local
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
  
  return { fbPostId, permalink };
}

module.exports = {
  publishToFacebook,
  publishNewsToFacebook,
  buildNewsPublicUrl,
  buildAbsoluteImageUrl,
  debugToken,
  getPageTokenFromUserToken,
  getPostPermalink,
  deletePost,
  getPost,
  ERROR_MESSAGES
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