const path = require("path");
const fs = require("fs");
const RateSnapshot = require("../models/RateSnapshot");
const News = require("../models/News");

// Cache para el HTML base
let baseHTML = null;

/**
 * Función para obtener la URL pública base
 */
function getPublicOrigin(req) {
  // Primero intentar desde la variable de entorno
  if (process.env.PUBLIC_ORIGIN) {
    return process.env.PUBLIC_ORIGIN;
  }
  
  // Si no existe, usar fallback a producción
  return 'https://levantatecuba.com';
}

/**
 * Función para construir URL absoluta de imagen
 * CRÍTICO: Siempre devuelve HTTPS absoluta para Facebook
 */
function buildAbsoluteImageUrl(imagePath, publicOrigin) {
  // Si no hay imagen, devolver imagen por defecto
  if (!imagePath || imagePath === '') {
    return `${publicOrigin}/img/og-default.jpg`;
  }
  
  // Si ya es absoluta con HTTPS, usarla tal cual
  if (imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Si ya es absoluta con HTTP, convertir a HTTPS
  if (imagePath.startsWith('http://')) {
    return imagePath.replace('http://', 'https://');
  }
  
  // Para rutas relativas que empiezan con /uploads/
  if (imagePath.startsWith('/uploads/')) {
    return `${publicOrigin}${imagePath}`;
  }
  
  // Para rutas relativas sin slash inicial
  if (!imagePath.startsWith('/')) {
    return `${publicOrigin}/${imagePath}`;
  }
  
  // Para cualquier otra ruta relativa
  return `${publicOrigin}${imagePath}`;
}

/**
 * Función para cargar el HTML base del frontend
 */
function loadBaseHTML() {
  if (baseHTML) return baseHTML;
  
  try {
    // En producción, el HTML está en dist/
    let htmlPath = path.join(__dirname, '../../dist/index.html');
    
    // En desarrollo, usar el HTML de la raíz
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.join(__dirname, '../../index.html');
    }
    
    if (!fs.existsSync(htmlPath)) {
      console.warn('⚠️ No se encontró archivo HTML base para meta-tags');
      return null;
    }
    
    baseHTML = fs.readFileSync(htmlPath, 'utf8');
    return baseHTML;
  } catch (error) {
    console.error('❌ Error cargando HTML base:', error);
    return null;
  }
}

/**
 * Función para generar meta-tags para noticias
 * MEJORADO: Garantiza siempre una imagen válida
 */
async function generateNewsMetaTags(req, newsId) {
  try {
    const publicOrigin = getPublicOrigin(req);
    
    // Buscar la noticia
    const news = await News.findById(newsId);
    
    if (!news) {
      return null; // Devolver null si no se encuentra la noticia
    }
    
    // Construir URL de la página
    const pageUrl = `${publicOrigin}/noticias/${newsId}`;
    
    // CRÍTICO: Construir URL absoluta de imagen con múltiples fallbacks
    let imageUrl;
    let imageSource = 'default';
    
    // Prioridad 1: imagen principal
    if (news.imagen && news.imagen !== '') {
      imageUrl = buildAbsoluteImageUrl(news.imagen, publicOrigin);
      imageSource = 'news.imagen (principal)';
    }
    // Prioridad 2: imagen secundaria
    else if (news.imagenSecundaria && news.imagenSecundaria !== '') {
      imageUrl = buildAbsoluteImageUrl(news.imagenSecundaria, publicOrigin);
      imageSource = 'news.imagenSecundaria';
    }
    // Prioridad 3: imagen opcional
    else if (news.imagenOpcional && news.imagenOpcional !== '') {
      imageUrl = buildAbsoluteImageUrl(news.imagenOpcional, publicOrigin);
      imageSource = 'news.imagenOpcional';
    }
    // Prioridad 4: primera imagen del array imagenes
    else if (news.imagenes && news.imagenes.length > 0 && news.imagenes[0] !== '') {
      imageUrl = buildAbsoluteImageUrl(news.imagenes[0], publicOrigin);
      imageSource = 'news.imagenes[0]';
    }
    // Prioridad 5: imagen por defecto
    else {
      imageUrl = `${publicOrigin}/img/og-default.jpg`;
      imageSource = 'fallback (og-default.jpg)';
    }
    
    // Validación adicional: asegurar que es HTTPS
    if (!imageUrl.startsWith('https://')) {
      console.warn(`⚠️ Imagen no es HTTPS: ${imageUrl}, usando fallback`);
      imageUrl = `${publicOrigin}/img/og-default.jpg`;
    }
    
    // Preparar descripción - PRIORIZAR bajada (resumen del redactor IA)
    let description = '';
    
    // Opción 1: Usar bajada si existe (resumen generado por redactor IA)
    if (news.bajada && news.bajada.trim()) {
      description = news.bajada.trim();
    }
    // Opción 2: Generar resumen desde el contenido
    else if (news.contenido && news.contenido !== '') {
      description = news.contenido
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ') // Eliminar estilos
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ') // Eliminar scripts
        .replace(/<[^>]*>/g, ' ') // Eliminar tags HTML
        .replace(/&[^;]+;/g, ' ') // Eliminar entidades HTML
        .replace(/\s+/g, ' ') // Normalizar espacios
        .trim();
      
      // Buscar primer párrafo significativo (>50 chars)
      const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 50);
      if (sentences.length > 0) {
        description = sentences[0].trim();
      } else {
        description = description.substring(0, 180);
      }
    }
    
    // Si no hay descripción, usar una por defecto
    if (!description || description.length < 20) {
      description = 'Lee las últimas noticias sobre Cuba en LevántateCuba';
    }
    
    // Truncar a 180 caracteres sin cortar palabras
    if (description.length > 180) {
      const truncated = description.substring(0, 180);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 144) { // Solo si no cortamos más del 20%
        description = truncated.substring(0, lastSpace).trim() + '…';
      } else {
        description = truncated.trim() + '…';
      }
    }
    
    // CRÍTICO: Asegurar que la descripción NO comience con el título
    const titleClean = (news.titulo || '').toLowerCase().trim();
    const descClean = description.toLowerCase().trim();
    if (descClean.startsWith(titleClean.substring(0, 30))) {
      // Si la descripción comienza con el título, buscar siguiente oración
      const sentences = news.contenido
        ? news.contenido
            .replace(/<[^>]*>/g, ' ')
            .replace(/&[^;]+;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(/[.!?]+/)
            .filter(s => s.trim().length > 50)
        : [];
      
      if (sentences.length > 1) {
        description = sentences[1].trim();
        if (description.length > 180) {
          description = description.substring(0, 177).trim() + '…';
        }
      } else {
        description = `Lee esta noticia sobre ${news.categoria || 'Cuba'} en LevántateCuba`;
      }
    }
    
    // Sanitizar título para evitar problemas con comillas
    const title = (news.titulo || 'Noticia de LevantateCuba')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Sanitizar descripción
    description = description
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    console.log(`[MetaTags] 🏷️  Meta tags generados para noticia ${newsId}:`);
    console.log(`[MetaTags]    Título: "${title.substring(0, 50)}..."`);
    console.log(`[MetaTags]    Imagen: ${imageUrl}`);
    console.log(`[MetaTags]    Fuente imagen: ${imageSource}`);
    console.log(`[MetaTags]    URL: ${pageUrl}`);
    console.log(`[MetaTags]    Descripción: "${description.substring(0, 60)}..."`);
    
    // Preparar tags (máximo 3 para Open Graph)
    const tags = (news.etiquetas || []).slice(0, 3);
    
    return {
      title,
      description,
      url: pageUrl,
      image: imageUrl,
      imageWidth: 1200,
      imageHeight: 630,
      type: 'article',
      author: news.autor || 'LevantateCuba',
      publishedTime: news.publishedAt ? new Date(news.publishedAt).toISOString() : 
                      (news.fecha ? new Date(news.fecha).toISOString() : new Date().toISOString()),
      section: news.categoria || 'General',
      tags: tags,
      siteName: 'LevantateCuba'
    };
  } catch (error) {
    console.error('❌ Error generando meta-tags para noticia:', error);
    
    // Fallback con valores por defecto
    const publicOrigin = getPublicOrigin(req);
    return {
      title: 'LevantateCuba - Noticias',
      description: 'Portal de noticias e información sobre Cuba',
      url: `${publicOrigin}/noticias/${newsId}`,
      image: `${publicOrigin}/img/og-default.jpg`,
      imageWidth: 1200,
      imageHeight: 630,
      type: 'article',
      siteName: 'LevantateCuba'
    };
  }
}

/**
 * Función para generar meta-tags específicos para /tasas
 */
async function generateTasasMetaTags(req) {
  try {
    const publicOrigin = getPublicOrigin(req);
    
    // Obtener último snapshot para el cache bust
    const latestSnapshot = await RateSnapshot.findOne()
      .sort({ fetchedAt: -1 });
    
    const cacheParam = latestSnapshot?.updatedAt 
      ? `?v=${latestSnapshot.updatedAt.getTime()}`
      : `?v=${Date.now()}`;
    
    const imageUrl = `${publicOrigin}/og/tasas.png${cacheParam}`;
    const pageUrl = `${publicOrigin}/tasas`;
    
    // Preparar descripción dinámica basada en datos
    let description = "Venta y compra en CUP. Zelle, USD, EUR y más. Actualizado automáticamente por LevántateCuba.";
    
    if (latestSnapshot?.tasas?.length > 0) {
      const zelleRate = latestSnapshot.tasas.find(t => 
        t.moneda.toLowerCase().includes('zelle')
      );
      const usdRate = latestSnapshot.tasas.find(t => 
        t.moneda.toLowerCase().includes('usd') && !t.moneda.toLowerCase().includes('zelle')
      );
      
      if (zelleRate || usdRate) {
        const rate = zelleRate || usdRate;
        const rateValue = rate.cup ? rate.cup.match(/[\d.,]+/) : null;
        if (rateValue) {
          description = `Zelle/USD: ${rateValue[0]} CUP. Tasas del mercado informal actualizadas. ${description}`;
        }
      }
    }
    
    const title = latestSnapshot?.fetchedAt
      ? `Tasa del mercado informal en Cuba — Zelle, USD, EUR (actualizado ${new Date(latestSnapshot.fetchedAt).toLocaleDateString('es-ES')})`
      : "Tasa del mercado informal en Cuba — Zelle, USD, EUR (actualizado hoy)";
    
    return {
      title,
      description,
      url: pageUrl,
      image: imageUrl,
      imageWidth: 1200,
      imageHeight: 630,
      siteName: 'LevantateCuba'
    };
  } catch (error) {
    console.error('❌ Error generando meta-tags para tasas:', error);
    
    // Fallback con datos estáticos
    const publicOrigin = getPublicOrigin(req);
    return {
      title: "Tasa del mercado informal en Cuba — Zelle, USD, EUR",
      description: "Venta y compra en CUP. Zelle, USD, EUR y más. Actualizado automáticamente por LevántateCuba.",
      url: `${publicOrigin}/tasas`,
      image: `${publicOrigin}/og/tasas.png`,
      imageWidth: 1200,
      imageHeight: 630,
      siteName: 'LevantateCuba'
    };
  }
}

/**
 * Función para reemplazar meta-tags en el HTML
 * MEJORADO: Más robusto y completo
 */
function injectMetaTags(html, metaTags) {
  // Reemplazar o agregar meta-tags específicos
  let modifiedHTML = html;
  
  // Meta tags básicos
  modifiedHTML = modifiedHTML.replace(
    /<title>.*?<\/title>/i,
    `<title>${metaTags.title}</title>`
  );
  
  // Reemplazar o agregar description
  const descriptionRegex = /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i;
  if (descriptionRegex.test(modifiedHTML)) {
    modifiedHTML = modifiedHTML.replace(
      descriptionRegex,
      `<meta name="description" content="${metaTags.description}">`
    );
  } else {
    modifiedHTML = modifiedHTML.replace(
      /<meta name="viewport"[^>]*>/i,
      `$&\n    <meta name="description" content="${metaTags.description}">`
    );
  }
  
  // Open Graph tags - MÁS COMPLETO
  const ogType = metaTags.type || 'website';
  let ogTags = `
    <!-- Open Graph / Facebook -->
    <meta property="og:title" content="${metaTags.title}">
    <meta property="og:description" content="${metaTags.description}">
    <meta property="og:url" content="${metaTags.url}">
    <meta property="og:image" content="${metaTags.image}">
    <meta property="og:image:secure_url" content="${metaTags.image}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="${metaTags.imageWidth}">
    <meta property="og:image:height" content="${metaTags.imageHeight}">
    <meta property="og:type" content="${ogType}">
    <meta property="og:site_name" content="${metaTags.siteName || 'LevantateCuba'}">
    <meta property="og:locale" content="es_ES">`;
  
  // Agregar tags adicionales para artículos
  if (ogType === 'article') {
    if (metaTags.author) {
      ogTags += `
    <meta property="article:author" content="${metaTags.author}">`;
    }
    if (metaTags.publishedTime) {
      ogTags += `
    <meta property="article:published_time" content="${metaTags.publishedTime}">`;
    }
    if (metaTags.section) {
      ogTags += `
    <meta property="article:section" content="${metaTags.section}">`;
    }
    // Añadir hasta 3 tags
    if (metaTags.tags && Array.isArray(metaTags.tags)) {
      metaTags.tags.forEach(tag => {
        if (tag && tag.trim()) {
          ogTags += `
    <meta property="article:tag" content="${tag.trim()}">`;
        }
      });
    }
  }
  
  // Twitter Card tags - MÁS COMPLETO
  const twitterTags = `
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${metaTags.title}">
    <meta name="twitter:description" content="${metaTags.description}">
    <meta name="twitter:image" content="${metaTags.image}">
    <meta name="twitter:site" content="@levantatecuba">`;
  
  // Tags adicionales para SEO
  const additionalTags = `
    <!-- Additional Meta Tags -->
    <link rel="canonical" href="${metaTags.url}">
    <meta property="fb:app_id" content="${process.env.FACEBOOK_APP_ID || ''}">`;
  
  // Remover meta-tags OG/Twitter existentes
  modifiedHTML = modifiedHTML.replace(
    /<meta\s+(property="og:|name="twitter:)[^>]*>/gi, 
    ''
  );
  
  // Insertar nuevos meta-tags antes del cierre de </head>
  modifiedHTML = modifiedHTML.replace(
    /<\/head>/i,
    `${ogTags}\n${twitterTags}\n${additionalTags}\n  </head>`
  );
  
  return modifiedHTML;
}

/**
 * Middleware para inyección de meta-tags
 */
async function injectMetaTagsMiddleware(req, res, next) {
  // Detectar rutas objetivo
  const isTasasRoute = req.path === '/tasas' || req.path === '/tasas/';
  const newsMatch = req.path.match(/^\/noticias\/([a-fA-F0-9]{24})\/?$/);
  const isNewsRoute = !!newsMatch;
  
  // Solo procesar rutas específicas del frontend
  const isTargetRoute = isTasasRoute || isNewsRoute;
  
  // Solo procesar requests GET
  if (!isTargetRoute || req.method !== 'GET') {
    return next();
  }
  
  // Solo procesar requests HTML (no API, assets, etc.) o crawlers
  const acceptsHTML = req.headers.accept && req.headers.accept.includes('text/html');
  const userAgent = req.headers['user-agent'] || '';
  const isCrawler = /facebookexternalhit|Facebot|LinkedInBot|WhatsApp|Twitterbot|Googlebot|bingbot/i.test(userAgent);
  
  // IMPORTANTE: Siempre procesar para crawlers, incluso si no piden HTML
  if (!acceptsHTML && !isCrawler) {
    return next();
  }
  
  try {
    console.log(`[MetaTags] 🏷️  Inyectando meta-tags para: ${req.path}`);
    console.log(`[MetaTags]    User-Agent: ${userAgent.substring(0, 70)}...`);
    console.log(`[MetaTags]    Es crawler: ${isCrawler ? 'SÍ ✅' : 'NO'}`);
    
    const baseHTMLContent = loadBaseHTML();
    if (!baseHTMLContent) {
      console.warn('⚠️ No se pudo cargar HTML base, continuando sin meta-tags');
      return next();
    }
    
    let metaTags;
    
    // Generar meta-tags específicos según la ruta
    if (isTasasRoute) {
      metaTags = await generateTasasMetaTags(req);
    } else if (isNewsRoute) {
      const newsId = newsMatch[1];
      metaTags = await generateNewsMetaTags(req, newsId);
      
      // Si no se encuentra la noticia, continuar sin meta-tags
      if (!metaTags) {
        console.warn(`⚠️ Noticia ${newsId} no encontrada para meta-tags`);
        return next();
      }
    } else {
      return next(); // No debería llegar aquí, pero por seguridad
    }
    
    // Inyectar meta-tags en el HTML
    const modifiedHTML = injectMetaTags(baseHTMLContent, metaTags);
    
    // Enviar respuesta modificada
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300' // Cache por 5 minutos
    });
    
    res.send(modifiedHTML);
    
    console.log(`[MetaTags] ✅ Meta-tags inyectados exitosamente para ${req.path}`);
    console.log(`[MetaTags]    og:image = ${metaTags.image}`);
    console.log(`[MetaTags]    og:url = ${metaTags.url}`);
    if (isNewsRoute) {
      console.log(`[MetaTags]    🎯 Cover de noticia confirmado (no imagen genérica)`);
    }
    
  } catch (error) {
    console.error('❌ Error en inyección de meta-tags:', error);
    // Continuar con el flujo normal si hay error
    next();
  }
}

module.exports = {
  injectMetaTagsMiddleware,
  buildAbsoluteImageUrl,
  generateNewsMetaTags
};

/**
 * ================================================================================
 * INSTRUCCIONES DE VERIFICACIÓN - METADATOS OPEN GRAPH PARA FACEBOOK
 * ================================================================================
 * 
 * Este middleware inyecta meta-tags Open Graph dinámicos para mejorar cómo se 
 * comparten las noticias en redes sociales (Facebook, Twitter, LinkedIn, etc.)
 * 
 * PASOS PARA VERIFICAR:
 * 
 * 1. Deploy o levantar el servidor en producción
 * 
 * 2. Asegurar que PUBLIC_BASE_URL está configurado en .env:
 *    PUBLIC_BASE_URL=https://levantatecuba.com
 *    (Si no existe, el sistema usa PUBLIC_ORIGIN como fallback)
 * 
 * 3. Copiar la URL de una noticia pública, por ejemplo:
 *    https://levantatecuba.com/noticias/673123abc456def789012345
 * 
 * 4. Entrar en el Facebook Sharing Debugger:
 *    https://developers.facebook.com/tools/debug/
 * 
 * 5. Pegar la URL y pulsar "Scrape Again"
 * 
 * 6. Verificar que:
 *    ✅ El título (og:title) aparece SOLO UNA VEZ
 *    ✅ La descripción (og:description) es el resumen, SIN REPETIR el título
 *    ✅ La imagen (og:image) es la correcta y se muestra en el preview
 *    ✅ La fecha (article:published_time) aparece en "Article properties"
 *    ✅ La categoría (article:section) aparece en "Article properties"
 *    ✅ Los tags (article:tag) aparecen en "Article properties" (hasta 3)
 *    ✅ El tipo (og:type) es "article"
 *    ✅ La URL (og:url) es la correcta
 * 
 * 7. Para verificar en Twitter:
 *    https://cards-dev.twitter.com/validator
 * 
 * 8. Para verificar en LinkedIn:
 *    https://www.linkedin.com/post-inspector/
 * 
 * NOTAS IMPORTANTES:
 * 
 * - Este middleware detecta crawlers por user-agent (facebookexternalhit, etc.)
 * - Solo se activa para rutas: /noticias/:id y /tasas
 * - Prioriza el campo "bajada" (resumen del redactor IA) para og:description
 * - Si no hay bajada, genera resumen automático del contenido
 * - Garantiza que la descripción NUNCA comience repitiendo el título
 * - Todas las URLs de imágenes son convertidas a HTTPS absolutas
 * - Tiene fallback a imagen por defecto si no hay imagen en la noticia
 * - Cache de 5 minutos (Cache-Control: public, max-age=300)
 * 
 * PROBLEMAS COMUNES:
 * 
 * - Si Facebook muestra caché antiguo, usar "Scrape Again" varias veces
 * - Facebook puede tardar hasta 24h en actualizar la caché en algunos casos
 * - Asegurar que la imagen es accesible públicamente (no requiere auth)
 * - Verificar que PUBLIC_BASE_URL usa HTTPS, no HTTP
 * - Si la descripción aún repite el título, verificar el campo "bajada" en BD
 * 
 * LOGS ESPERADOS EN CONSOLA:
 * 
 * 🏷️ Inyectando meta-tags para: /noticias/673123abc456def789012345
 *    User-Agent: facebookexternalhit/1.1...
 *    Es crawler: SÍ
 * 🏷️ Meta tags generados para noticia 673123abc456def789012345:
 *    Título: "Título de la noticia..."
 *    Imagen: https://levantatecuba.com/uploads/news/imagen.jpg
 *    URL: https://levantatecuba.com/noticias/673123abc456def789012345
 * ✅ Meta-tags inyectados exitosamente para /noticias/673123abc456def789012345
 *    og:image = https://levantatecuba.com/uploads/news/imagen.jpg
 * 
 * ================================================================================
 */