#!/usr/bin/env node

/**
 * Script de verificación de Link Posts y Open Graph para Facebook
 * Verifica que las páginas de noticias tengan los meta tags correctos
 */

const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

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
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[✅ OK]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[❌ ERROR]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠️ WARN]${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}`)
};

// Función para extraer meta tags del HTML
function extractMetaTags(html) {
  const tags = {};
  
  // Extraer título
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  if (titleMatch) tags.title = titleMatch[1];
  
  // Extraer meta tags básicos
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  if (descMatch) tags.description = descMatch[1];
  
  // Extraer Open Graph tags
  const ogRegex = /<meta\s+property="(og:[^"]+)"\s+content="([^"]+)"/gi;
  let match;
  while ((match = ogRegex.exec(html)) !== null) {
    tags[match[1]] = match[2];
  }
  
  // Extraer Twitter Card tags
  const twitterRegex = /<meta\s+name="(twitter:[^"]+)"\s+content="([^"]+)"/gi;
  while ((match = twitterRegex.exec(html)) !== null) {
    tags[match[1]] = match[2];
  }
  
  return tags;
}

// Función para verificar una noticia de ejemplo
async function verifyNewsPage(newsId) {
  const publicOrigin = process.env.PUBLIC_ORIGIN || 'https://levantatecuba.com';
  const newsUrl = `${publicOrigin}/noticias/${newsId}`;
  
  log.section(`Verificando página de noticia: ${newsId}`);
  log.info(`URL: ${newsUrl}`);
  
  try {
    // Hacer petición GET simulando el crawler de Facebook
    const response = await fetch(newsUrl, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: 10000
    });
    
    if (!response.ok) {
      log.error(`HTTP ${response.status}: ${response.statusText}`);
      return false;
    }
    
    const html = await response.text();
    log.success(`Página cargada (${html.length} bytes)`);
    
    // Extraer meta tags
    const metaTags = extractMetaTags(html);
    
    // Verificar tags requeridos
    const errors = [];
    const warnings = [];
    
    // Verificar título
    if (!metaTags.title) {
      errors.push('Falta <title>');
    } else {
      log.success(`Título: "${metaTags.title}"`);
    }
    
    // Verificar descripción
    if (!metaTags.description) {
      warnings.push('Falta meta description');
    } else {
      log.success(`Descripción: "${metaTags.description.substring(0, 60)}..."`);
    }
    
    // Verificar Open Graph básicos
    const requiredOG = ['og:title', 'og:description', 'og:url', 'og:image', 'og:type'];
    for (const tag of requiredOG) {
      if (!metaTags[tag]) {
        errors.push(`Falta ${tag}`);
      } else {
        log.success(`${tag}: "${metaTags[tag].substring(0, 60)}${metaTags[tag].length > 60 ? '...' : ''}"`);
      }
    }
    
    // Verificar que og:url sea HTTPS absoluta
    if (metaTags['og:url']) {
      if (!metaTags['og:url'].startsWith('https://')) {
        errors.push('og:url debe ser HTTPS absoluta');
      }
    }
    
    // Verificar que og:image sea HTTPS absoluta
    if (metaTags['og:image']) {
      if (!metaTags['og:image'].startsWith('https://')) {
        errors.push('og:image debe ser HTTPS absoluta');
      } else {
        // Verificar que la imagen existe
        try {
          const imgResponse = await fetch(metaTags['og:image'], {
            method: 'HEAD',
            timeout: 5000
          });
          
          if (imgResponse.ok) {
            const contentType = imgResponse.headers.get('content-type');
            const contentLength = imgResponse.headers.get('content-length');
            log.success(`Imagen verificada: ${contentType} (${Math.round(contentLength/1024)}KB)`);
          } else {
            warnings.push(`Imagen devuelve HTTP ${imgResponse.status}`);
          }
        } catch (imgError) {
          warnings.push(`No se pudo verificar imagen: ${imgError.message}`);
        }
      }
    }
    
    // Verificar tags adicionales recomendados
    if (metaTags['og:image:width'] && metaTags['og:image:height']) {
      const width = parseInt(metaTags['og:image:width']);
      const height = parseInt(metaTags['og:image:height']);
      
      if (width < 600 || height < 315) {
        warnings.push(`Imagen muy pequeña: ${width}x${height} (mínimo recomendado 600x315)`);
      } else if (width < 1200 || height < 630) {
        log.warn(`Imagen: ${width}x${height} (óptimo sería 1200x630)`);
      } else {
        log.success(`Dimensiones de imagen: ${width}x${height} ✅`);
      }
    } else {
      warnings.push('Faltan og:image:width y og:image:height');
    }
    
    // Verificar Twitter Card
    if (!metaTags['twitter:card']) {
      warnings.push('Falta twitter:card');
    } else {
      log.success(`Twitter Card: ${metaTags['twitter:card']}`);
    }
    
    // Mostrar resumen
    if (errors.length > 0) {
      log.section('ERRORES ENCONTRADOS');
      errors.forEach(err => log.error(err));
      return false;
    }
    
    if (warnings.length > 0) {
      log.section('ADVERTENCIAS');
      warnings.forEach(warn => log.warn(warn));
    }
    
    return true;
    
  } catch (error) {
    log.error(`Error al verificar página: ${error.message}`);
    return false;
  }
}

// Función para probar el endpoint de re-scrape
async function testRescrapeEndpoint(newsId) {
  const publicOrigin = process.env.PUBLIC_ORIGIN || 'https://levantatecuba.com';
  const newsUrl = `${publicOrigin}/noticias/${newsId}`;
  
  log.section('Probando endpoint de re-scrape');
  log.info(`URL a re-scrapear: ${newsUrl}`);
  
  try {
    // Obtener configuración
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    
    if (!appId || !appSecret) {
      log.error('Faltan FACEBOOK_APP_ID o FACEBOOK_APP_SECRET en .env');
      return false;
    }
    
    // Construir app access token
    const accessToken = `${appId}|${appSecret}`;
    
    // Llamar al API de Facebook directamente
    const scrapeUrl = `https://graph.facebook.com/?id=${encodeURIComponent(newsUrl)}&scrape=true&access_token=${accessToken}`;
    
    const response = await fetch(scrapeUrl, {
      method: 'POST',
      timeout: 10000
    });
    
    const data = await response.json();
    
    if (data.error) {
      log.error(`Facebook error: ${data.error.message}`);
      return false;
    }
    
    // Mostrar información del og_object
    if (data.og_object) {
      const og = data.og_object;
      log.success('✅ Re-scrape exitoso');
      log.info(`  • ID: ${og.id || 'N/A'}`);
      log.info(`  • Type: ${og.type || 'website'}`);
      log.info(`  • Title: "${og.title || 'Sin título'}"`);
      log.info(`  • Description: "${(og.description || '').substring(0, 60)}..."`);
      
      if (og.image && og.image[0]) {
        log.info(`  • Image: ${og.image[0].url}`);
        log.info(`  • Image size: ${og.image[0].width || '?'}x${og.image[0].height || '?'}`);
      } else {
        log.warn('  • No se detectó imagen');
      }
      
      log.info(`  • Updated: ${new Date(data.updated_time * 1000).toLocaleString()}`);
      
      return true;
    } else {
      log.warn('Facebook no devolvió og_object');
      return false;
    }
    
  } catch (error) {
    log.error(`Error en re-scrape: ${error.message}`);
    return false;
  }
}

// Función principal
async function main() {
  log.section('VERIFICACIÓN DE LINK POSTS Y OPEN GRAPH');
  
  // Verificar configuración básica
  const publicOrigin = process.env.PUBLIC_ORIGIN || 'https://levantatecuba.com';
  log.info(`PUBLIC_ORIGIN: ${publicOrigin}`);
  
  // Obtener un ID de noticia de ejemplo
  let testNewsId = process.argv[2];
  
  if (!testNewsId) {
    // Si no se proporciona, intentar obtener una noticia de la BD
    try {
      const mongoose = require('mongoose');
      const News = require('../server/models/News');
      
      // Conectar a MongoDB
      const mongoUri = process.env.MONGODB_URI;
      if (mongoUri) {
        await mongoose.connect(mongoUri);
        
        // Buscar una noticia publicada reciente
        const recentNews = await News.findOne({ status: 'published' })
          .sort({ createdAt: -1 })
          .select('_id titulo')
          .lean();
        
        if (recentNews) {
          testNewsId = recentNews._id.toString();
          log.info(`Usando noticia de ejemplo: "${recentNews.titulo}"`);
        }
        
        await mongoose.disconnect();
      }
    } catch (error) {
      log.warn(`No se pudo obtener noticia de la BD: ${error.message}`);
    }
  }
  
  if (!testNewsId) {
    log.warn('No se especificó ID de noticia. Uso: npm run fb:verify-link [newsId]');
    log.info('Usando ID de ejemplo genérico para demostración');
    testNewsId = '123456789012345678901234'; // ID de ejemplo
  }
  
  // Ejecutar verificaciones
  let allPassed = true;
  
  // 1. Verificar página de noticia
  const pageValid = await verifyNewsPage(testNewsId);
  if (!pageValid) allPassed = false;
  
  // 2. Probar re-scrape
  const rescrapeValid = await testRescrapeEndpoint(testNewsId);
  if (!rescrapeValid) allPassed = false;
  
  // Resumen final
  log.section('RESUMEN DE VERIFICACIÓN');
  
  if (allPassed) {
    console.log('\n' + '═'.repeat(60));
    console.log(`${colors.green}✅✅✅ LINK POSTS Y OPEN GRAPH CONFIGURADOS CORRECTAMENTE ✅✅✅${colors.reset}`);
    console.log('═'.repeat(60));
    console.log('\n✅ Las páginas de noticias tienen meta tags Open Graph correctos');
    console.log('✅ Facebook puede detectar título, descripción e imagen');
    console.log('✅ El re-scrape funciona correctamente');
    console.log('\n🎉 Listo para publicar con miniaturas en Facebook\n');
    process.exit(0);
  } else {
    console.log('\n' + '═'.repeat(60));
    console.log(`${colors.red}❌ VERIFICACIÓN FALLÓ - REVISAR CONFIGURACIÓN ❌${colors.reset}`);
    console.log('═'.repeat(60));
    console.log('\nAcciones requeridas:');
    console.log('  1. Verificar que el middleware de meta tags esté activo');
    console.log('  2. Asegurar que las imágenes sean HTTPS absolutas');
    console.log('  3. Verificar que las noticias tengan imagen de portada');
    console.log('  4. Revisar la configuración de PUBLIC_ORIGIN');
    process.exit(1);
  }
}

// Ejecutar
main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});

