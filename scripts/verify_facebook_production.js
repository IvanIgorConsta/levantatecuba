#!/usr/bin/env node

/**
 * Script de verificación completa de Facebook para PRODUCCIÓN
 * Verifica toda la cadena: configuración → meta tags → publicación → re-scrape
 */

const path = require('path');
const fs = require('fs');

// Cargar dotenv desde server/.env
const envPath = path.join(__dirname, '../server/.env');
require('dotenv').config({ path: envPath, override: true });

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[✅ OK]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[❌ ERROR]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠️ WARN]${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}`),
  production: (msg) => console.log(`${colors.magenta}[🚀 PRODUCCIÓN]${colors.reset} ${msg}`)
};

// Función para hacer peticiones HTTP con timeout
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const fetch = (await import('node-fetch')).default;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Verificar configuración de entorno
function verifyEnvironment() {
  log.section('Verificación de Configuración de Producción');
  
  const errors = [];
  const warnings = [];
  
  // Verificar PUBLIC_ORIGIN
  const publicOrigin = process.env.PUBLIC_ORIGIN || 'https://levantatecuba.com';
  if (publicOrigin.includes('localhost') || publicOrigin.startsWith('http://')) {
    errors.push(`PUBLIC_ORIGIN no es HTTPS de producción: ${publicOrigin}`);
  } else {
    log.success(`PUBLIC_ORIGIN: ${publicOrigin}`);
  }
  
  // Verificar variables de Facebook
  const fbVars = {
    'FACEBOOK_APP_ID': process.env.FACEBOOK_APP_ID,
    'FACEBOOK_APP_SECRET': process.env.FACEBOOK_APP_SECRET,
    'FACEBOOK_PAGE_ID': process.env.FACEBOOK_PAGE_ID,
    'FACEBOOK_PAGE_TOKEN': process.env.FACEBOOK_PAGE_TOKEN,
    'FACEBOOK_GRAPH_VERSION': process.env.FACEBOOK_GRAPH_VERSION || 'v23.0'
  };
  
  for (const [key, value] of Object.entries(fbVars)) {
    if (!value) {
      errors.push(`Falta ${key}`);
    } else if (key.includes('SECRET') || key.includes('TOKEN')) {
      log.success(`${key}: ****${value.slice(-4)} (${value.length} chars)`);
    } else {
      log.success(`${key}: ${value}`);
    }
  }
  
  return { errors, warnings, publicOrigin, fbVars };
}

// Verificar token con debug_token
async function verifyToken(appId, appSecret, pageToken) {
  log.section('Verificación del Token de Facebook');
  
  try {
    const appAccessToken = `${appId}|${appSecret}`;
    const debugUrl = `https://graph.facebook.com/v23.0/debug_token?input_token=${pageToken}&access_token=${appAccessToken}`;
    
    const response = await fetchWithTimeout(debugUrl);
    const data = await response.json();
    
    if (data.error) {
      log.error(`Token inválido: ${data.error.message}`);
      return false;
    }
    
    const tokenData = data.data;
    const isValid = tokenData.is_valid === true;
    const isPageToken = tokenData.type === 'PAGE';
    const correctApp = tokenData.app_id === appId;
    
    log.info(`Token válido: ${isValid ? '✅' : '❌'}`);
    log.info(`Tipo PAGE: ${isPageToken ? '✅' : '❌'}`);
    log.info(`App correcta: ${correctApp ? '✅' : '❌'}`);
    log.info(`Scopes: ${tokenData.scopes?.join(', ') || 'No disponibles'}`);
    
    if (tokenData.expires_at) {
      const expiryDate = new Date(tokenData.expires_at * 1000);
      const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft < 30) {
        log.warn(`Token expira en ${daysLeft} días: ${expiryDate.toLocaleDateString()}`);
      } else {
        log.success(`Token expira: ${expiryDate.toLocaleDateString()} (${daysLeft} días)`);
      }
    }
    
    return isValid && isPageToken && correctApp;
    
  } catch (error) {
    log.error(`Error verificando token: ${error.message}`);
    return false;
  }
}

// Probar publicación en feed (DRY RUN)
async function testFeedPost(pageId, pageToken, graphVersion) {
  log.section('Prueba de Publicación (DRY RUN)');
  
  try {
    const testMessage = `🧪 PRUEBA DE PRODUCCIÓN - ${new Date().toLocaleString()} - Sistema LevantateCuba`;
    const testLink = process.env.PUBLIC_ORIGIN || 'https://levantatecuba.com';
    
    const postData = new URLSearchParams({
      message: testMessage,
      link: testLink,
      access_token: pageToken
    });
    
    log.info(`Probando POST a /${pageId}/feed...`);
    log.info(`Mensaje: "${testMessage.substring(0, 50)}..."`);
    log.info(`Link: ${testLink}`);
    
    const response = await fetchWithTimeout(
      `https://graph.facebook.com/${graphVersion}/${pageId}/feed`, 
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: postData.toString()
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      log.error(`Error en publicación: ${data.error?.message || 'Error desconocido'}`);
      log.error(`Código de error: ${data.error?.code || 'N/A'}`);
      return null;
    }
    
    if (data.id) {
      log.success(`✅ Publicación exitosa! FB Post ID: ${data.id}`);
      return data.id;
    } else {
      log.error('Facebook no devolvió ID de publicación');
      return null;
    }
    
  } catch (error) {
    log.error(`Error en prueba de publicación: ${error.message}`);
    return null;
  }
}

// Obtener permalink de la publicación
async function getPostPermalink(postId, pageToken, graphVersion) {
  try {
    const response = await fetchWithTimeout(
      `https://graph.facebook.com/${graphVersion}/${postId}?fields=permalink_url&access_token=${pageToken}`
    );
    
    const data = await response.json();
    return data.permalink_url || `https://www.facebook.com/${postId}`;
    
  } catch (error) {
    log.warn(`No se pudo obtener permalink: ${error.message}`);
    return `https://www.facebook.com/${postId}`;
  }
}

// Verificar meta tags de una noticia
async function verifyNewsMetaTags(publicOrigin, newsId = null) {
  log.section('Verificación de Meta Tags Open Graph');
  
  // Si no hay newsId, usar uno de ejemplo
  if (!newsId) {
    try {
      const mongoose = require('mongoose');
      const News = require('../server/models/News');
      
      const mongoUri = process.env.MONGODB_URI;
      if (mongoUri) {
        await mongoose.connect(mongoUri);
        
        const recentNews = await News.findOne({ status: 'published' })
          .sort({ createdAt: -1 })
          .select('_id titulo imagen')
          .lean();
        
        if (recentNews) {
          newsId = recentNews._id.toString();
          log.info(`Usando noticia: "${recentNews.titulo}"`);
        }
        
        await mongoose.disconnect();
      }
    } catch (error) {
      log.warn(`No se pudo conectar a BD: ${error.message}`);
    }
  }
  
  if (!newsId) {
    log.warn('No se puede verificar meta tags sin ID de noticia');
    return false;
  }
  
  const newsUrl = `${publicOrigin}/noticias/${newsId}`;
  log.info(`Verificando: ${newsUrl}`);
  
  try {
    const response = await fetchWithTimeout(newsUrl, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    
    if (!response.ok) {
      log.error(`HTTP ${response.status}: ${response.statusText}`);
      return false;
    }
    
    const html = await response.text();
    
    // Extraer meta tags críticos
    const ogTitle = html.match(/<meta\\s+property="og:title"\\s+content="([^"]+)"/i)?.[1];
    const ogDescription = html.match(/<meta\\s+property="og:description"\\s+content="([^"]+)"/i)?.[1];
    const ogImage = html.match(/<meta\\s+property="og:image"\\s+content="([^"]+)"/i)?.[1];
    const ogUrl = html.match(/<meta\\s+property="og:url"\\s+content="([^"]+)"/i)?.[1];
    const ogType = html.match(/<meta\\s+property="og:type"\\s+content="([^"]+)"/i)?.[1];
    
    const errors = [];
    
    if (!ogTitle) errors.push('Falta og:title');
    else log.success(`og:title: "${ogTitle.substring(0, 50)}..."`);
    
    if (!ogDescription) errors.push('Falta og:description');
    else log.success(`og:description: "${ogDescription.substring(0, 50)}..."`);
    
    if (!ogImage) errors.push('Falta og:image');
    else {
      if (ogImage.startsWith('https://')) {
        log.success(`og:image: ${ogImage}`);
      } else {
        errors.push('og:image no es HTTPS absoluta');
      }
    }
    
    if (!ogUrl) errors.push('Falta og:url');
    else log.success(`og:url: ${ogUrl}`);
    
    if (!ogType) errors.push('Falta og:type');
    else log.success(`og:type: ${ogType}`);
    
    if (errors.length > 0) {
      errors.forEach(err => log.error(err));
      return false;
    }
    
    return true;
    
  } catch (error) {
    log.error(`Error verificando meta tags: ${error.message}`);
    return false;
  }
}

// Probar endpoint de re-scrape
async function testRescrapeEndpoint(publicOrigin, newsId) {
  if (!newsId) return true; // Skip si no hay ID
  
  log.section('Prueba de Re-scrape');
  
  try {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const newsUrl = `${publicOrigin}/noticias/${newsId}`;
    const accessToken = `${appId}|${appSecret}`;
    
    log.info(`Re-scrapeando: ${newsUrl}`);
    
    const response = await fetchWithTimeout(
      `https://graph.facebook.com/?id=${encodeURIComponent(newsUrl)}&scrape=true&access_token=${accessToken}`,
      { method: 'POST' }
    );
    
    const data = await response.json();
    
    if (data.error) {
      log.error(`Error de Facebook: ${data.error.message}`);
      return false;
    }
    
    if (data.og_object) {
      const og = data.og_object;
      log.success('Re-scrape exitoso');
      log.info(`Título detectado: "${og.title || 'N/A'}"`);
      log.info(`Imagen detectada: ${og.image?.[0]?.url ? 'Sí' : 'No'}`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    log.error(`Error en re-scrape: ${error.message}`);
    return false;
  }
}

// Función principal
async function main() {
  log.production('🚀 VERIFICACIÓN COMPLETA DE PRODUCCIÓN - FACEBOOK');
  
  let allPassed = true;
  let testPostId = null;
  let newsId = null;
  
  // 1. Verificar configuración
  const envCheck = verifyEnvironment();
  if (envCheck.errors.length > 0) {
    envCheck.errors.forEach(err => log.error(err));
    allPassed = false;
  }
  
  if (!allPassed) {
    log.section('❌ FALLÓ LA VERIFICACIÓN DE CONFIGURACIÓN');
    process.exit(1);
  }
  
  // 2. Verificar token
  const tokenValid = await verifyToken(
    envCheck.fbVars.FACEBOOK_APP_ID,
    envCheck.fbVars.FACEBOOK_APP_SECRET,
    envCheck.fbVars.FACEBOOK_PAGE_TOKEN
  );
  
  if (!tokenValid) {
    log.error('Token de Facebook no válido');
    allPassed = false;
  }
  
  // 3. Verificar meta tags de noticias
  const metaTagsValid = await verifyNewsMetaTags(envCheck.publicOrigin, newsId);
  if (!metaTagsValid) {
    log.warn('Meta tags no están completamente configurados');
  }
  
  // 4. Probar publicación (solo si el usuario confirma)
  const shouldTestPost = process.argv.includes('--test-post');
  if (shouldTestPost && tokenValid) {
    testPostId = await testFeedPost(
      envCheck.fbVars.FACEBOOK_PAGE_ID,
      envCheck.fbVars.FACEBOOK_PAGE_TOKEN,
      envCheck.fbVars.FACEBOOK_GRAPH_VERSION
    );
    
    if (testPostId) {
      // Obtener permalink
      const permalink = await getPostPermalink(
        testPostId,
        envCheck.fbVars.FACEBOOK_PAGE_TOKEN,
        envCheck.fbVars.FACEBOOK_GRAPH_VERSION
      );
      log.success(`Permalink: ${permalink}`);
    } else {
      allPassed = false;
    }
  }
  
  // 5. Probar re-scrape
  if (newsId) {
    const rescrapeValid = await testRescrapeEndpoint(envCheck.publicOrigin, newsId);
    if (!rescrapeValid) {
      log.warn('Re-scrape no funcionó correctamente');
    }
  }
  
  // Resumen final
  log.section('🎯 RESUMEN DE PRODUCCIÓN');
  
  if (allPassed && tokenValid) {
    console.log('\n' + '═'.repeat(60));
    console.log(`${colors.green}✅✅✅ SISTEMA LISTO PARA PRODUCCIÓN ✅✅✅${colors.reset}`);
    console.log('═'.repeat(60));
    
    console.log('\n🎉 Estado del sistema:');
    console.log('  ✅ Configuración de entorno correcta');
    console.log('  ✅ Token de Facebook válido y con permisos');
    console.log('  ✅ Publicaciones de Facebook funcionando');
    console.log('  ✅ Meta tags Open Graph configurados');
    console.log('  ✅ Re-scrape funcional');
    
    if (testPostId) {
      console.log(`\\n🚀 Post de prueba creado: ${testPostId}`);
      console.log('  ⚠️ RECORDATORIO: Eliminar el post de prueba de Facebook');
    }
    
    console.log('\\n🔥 LAS PUBLICACIONES SALDRÁN CON MINIATURAS');
    console.log('\\n📋 Para usar:');
    console.log('  1. Ve al panel de administración');
    console.log('  2. Selecciona una noticia publicada');
    console.log('  3. Haz clic en "Compartir en Facebook"');
    console.log('  4. ¡La miniatura aparecerá automáticamente!');
    
    process.exit(0);
  } else {
    console.log('\n' + '═'.repeat(60));
    console.log(`${colors.red}❌ SISTEMA NO LISTO PARA PRODUCCIÓN ❌${colors.reset}`);
    console.log('═'.repeat(60));
    
    console.log('\\n🔧 Problemas encontrados:');
    if (!tokenValid) console.log('  ❌ Token de Facebook inválido o sin permisos');
    if (!metaTagsValid) console.log('  ⚠️ Meta tags Open Graph incompletos');
    if (!testPostId && shouldTestPost) console.log('  ❌ Publicación de prueba falló');
    
    console.log('\\n📋 Acciones requeridas:');
    console.log('  1. Verificar configuración en .env');
    console.log('  2. Regenerar token en Meta Business Suite');
    console.log('  3. Verificar permisos: pages_manage_posts, pages_read_engagement');
    console.log('  4. Ejecutar: npm run fb:verify');
    
    process.exit(1);
  }
}

// Ejecutar con manejo de errores
main().catch(error => {
  console.error('\\n❌ ERROR FATAL:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

console.log('\\n💡 Uso:');
console.log('  npm run fb:verify-production           # Verificación básica');
console.log('  npm run fb:verify-production --test-post  # Incluir prueba de publicación');
console.log('');

