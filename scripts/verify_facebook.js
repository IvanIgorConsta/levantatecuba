#!/usr/bin/env node

/**
 * Script de verificación integral de Facebook
 * Verifica configuración, tokens y permisos sin publicar
 */

const path = require('path');
const fs = require('fs');

// Cargar dotenv con override desde server/.env
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

// Función para ocultar secretos
function maskSecret(value, showLast = 4) {
  if (!value) return 'EMPTY';
  const str = String(value);
  if (str.length <= showLast) return '***';
  return '***' + str.slice(-showLast);
}

// Función para extraer solo dígitos
function digitsOnly(str) {
  return (str || '').replace(/\D/g, '');
}

// Función principal de verificación
async function verifyFacebook() {
  log.section('VERIFICACIÓN DE CONFIGURACIÓN DE FACEBOOK');
  
  const errors = [];
  const warnings = [];
  let config = {};
  
  try {
    // ========== PASO 1: VERIFICAR ARCHIVO .ENV ==========
    log.section('Paso 1: Verificación de archivo .env');
    
    if (!fs.existsSync(envPath)) {
      log.error(`No existe el archivo: ${envPath}`);
      log.info('Crea el archivo server/.env con las siguientes variables:');
      log.info('  FACEBOOK_APP_ID=<tu_app_id>');
      log.info('  FACEBOOK_APP_SECRET=<tu_app_secret>');
      log.info('  FACEBOOK_GRAPH_VERSION=v23.0');
      log.info('  FACEBOOK_PAGE_ID=<tu_page_id>');
      log.info('  FACEBOOK_PAGE_TOKEN=<tu_page_token>');
      process.exit(1);
    }
    
    log.success(`Archivo .env encontrado: ${envPath}`);
    
    // ========== PASO 2: VERIFICAR VARIABLES DE ENTORNO ==========
    log.section('Paso 2: Variables de entorno');
    
    // FACEBOOK_APP_ID
    const appId = digitsOnly(process.env.FACEBOOK_APP_ID || '');
    if (!appId) {
      errors.push('FACEBOOK_APP_ID no está configurado o está vacío');
    } else if (!/^\d{13,20}$/.test(appId)) {
      errors.push(`FACEBOOK_APP_ID inválido: ${appId.length} dígitos (debe ser 13-20)`);
    } else {
      log.success(`FACEBOOK_APP_ID: ${maskSecret(appId, 5)} (${appId.length} dígitos)`);
      config.appId = appId;
    }
    
    // FACEBOOK_APP_SECRET
    const appSecret = (process.env.FACEBOOK_APP_SECRET || '').trim();
    if (!appSecret) {
      errors.push('FACEBOOK_APP_SECRET no está configurado o está vacío');
    } else {
      log.success(`FACEBOOK_APP_SECRET: ${maskSecret(appSecret)} (${appSecret.length} caracteres)`);
      config.appSecret = appSecret;
    }
    
    // FACEBOOK_GRAPH_VERSION
    const graphVersion = (process.env.FACEBOOK_GRAPH_VERSION || 'v23.0').trim();
    if (!/^v\d+\.\d+$/.test(graphVersion)) {
      warnings.push(`FACEBOOK_GRAPH_VERSION formato inválido: '${graphVersion}', usando v23.0`);
      config.graphVersion = 'v23.0';
    } else {
      log.success(`FACEBOOK_GRAPH_VERSION: ${graphVersion}`);
      config.graphVersion = graphVersion;
    }
    
    // FACEBOOK_PAGE_ID
    const pageId = digitsOnly(process.env.FACEBOOK_PAGE_ID || '');
    if (!pageId) {
      errors.push('FACEBOOK_PAGE_ID no está configurado o está vacío');
    } else {
      log.success(`FACEBOOK_PAGE_ID: ${pageId}`);
      config.pageId = pageId;
    }
    
    // FACEBOOK_PAGE_TOKEN
    const pageToken = (process.env.FACEBOOK_PAGE_TOKEN || '').trim();
    if (!pageToken) {
      errors.push('FACEBOOK_PAGE_TOKEN no está configurado o está vacío');
    } else {
      log.success(`FACEBOOK_PAGE_TOKEN: ${maskSecret(pageToken, 10)} (${pageToken.length} caracteres)`);
      config.pageToken = pageToken;
    }
    
    // Si hay errores críticos, detener aquí
    if (errors.length > 0) {
      log.section('ERRORES ENCONTRADOS');
      errors.forEach(err => log.error(err));
      process.exit(1);
    }
    
    // Mostrar advertencias si las hay
    if (warnings.length > 0) {
      log.section('ADVERTENCIAS');
      warnings.forEach(warn => log.warn(warn));
    }
    
    // ========== PASO 3: DEBUG DEL TOKEN ==========
    log.section('Paso 3: Verificación del Page Token');
    
    const appAccessToken = `${config.appId}|${config.appSecret}`;
    const debugUrl = `https://graph.facebook.com/${config.graphVersion}/debug_token?` +
                     `input_token=${config.pageToken}&access_token=${appAccessToken}`;
    
    log.info('Verificando token con debug_token endpoint...');
    
    try {
      const fetch = (await import('node-fetch')).default;
      const debugResponse = await fetch(debugUrl, { 
        method: 'GET',
        timeout: 10000 
      });
      
      const debugData = await debugResponse.json();
      
      if (debugData.error) {
        log.error(`Error de API: ${debugData.error.message}`);
        log.error(`Código: ${debugData.error.code}`);
        errors.push(`Debug token falló: ${debugData.error.message}`);
      } else if (debugData.data) {
        const tokenData = debugData.data;
        
        // Validar is_valid
        if (tokenData.is_valid !== true) {
          errors.push('El token NO es válido (is_valid = false)');
        } else {
          log.success('Token válido (is_valid = true)');
        }
        
        // Validar tipo
        if (tokenData.type !== 'PAGE') {
          errors.push(`El token no es de tipo PAGE (tipo actual: ${tokenData.type})`);
        } else {
          log.success('Token es de tipo PAGE ✅');
        }
        
        // Validar app_id
        const tokenAppId = String(tokenData.app_id || '');
        if (tokenAppId !== config.appId) {
          errors.push(`app_id no coincide. Token: ${tokenAppId}, Config: ${config.appId}`);
        } else {
          log.success(`app_id coincide: ${maskSecret(tokenAppId, 5)}`);
        }
        
        // Validar profile_id
        const profileId = String(tokenData.profile_id || tokenData.user_id || '');
        if (profileId !== config.pageId) {
          errors.push(`profile_id no coincide. Token: ${profileId}, Config: ${config.pageId}`);
        } else {
          log.success(`profile_id coincide con PAGE_ID: ${profileId}`);
        }
        
        // Verificar scopes
        const scopes = tokenData.scopes || [];
        log.info(`Scopes disponibles: [${scopes.join(', ')}]`);
        
        const requiredScopes = ['pages_manage_posts', 'pages_read_engagement'];
        const missingScopes = requiredScopes.filter(s => !scopes.includes(s));
        
        if (missingScopes.length > 0) {
          errors.push(`Faltan permisos requeridos: ${missingScopes.join(', ')}`);
        } else {
          log.success('Todos los permisos requeridos están presentes ✅');
        }
        
        // Mostrar expiración
        if (tokenData.expires_at) {
          const expiryDate = new Date(tokenData.expires_at * 1000);
          if (tokenData.expires_at === 0) {
            log.success('Token no expira (permanente) ✅');
          } else if (expiryDate > new Date()) {
            log.success(`Token expira: ${expiryDate.toLocaleString()}`);
          } else {
            errors.push(`Token EXPIRADO: ${expiryDate.toLocaleString()}`);
          }
        }
      }
      
    } catch (error) {
      log.error(`Error al verificar token: ${error.message}`);
      errors.push(`No se pudo verificar el token: ${error.message}`);
    }
    
    // Si hay errores hasta aquí, detener
    if (errors.length > 0) {
      log.section('ERRORES CRÍTICOS ENCONTRADOS');
      errors.forEach(err => log.error(err));
      process.exit(1);
    }
    
    // ========== PASO 4: WHOAMI DE PÁGINA ==========
    log.section('Paso 4: Verificación de identidad de página');
    
    const meUrl = `https://graph.facebook.com/${config.graphVersion}/me?` +
                  `fields=id,name&access_token=${config.pageToken}`;
    
    log.info('Obteniendo información de la página...');
    
    try {
      const fetch = (await import('node-fetch')).default;
      const meResponse = await fetch(meUrl, {
        method: 'GET',
        timeout: 10000
      });
      
      const meData = await meResponse.json();
      
      if (meData.error) {
        log.error(`Error obteniendo /me: ${meData.error.message}`);
        errors.push(`No se pudo obtener info de página: ${meData.error.message}`);
      } else {
        log.info(`Página: "${meData.name}" (ID: ${meData.id})`);
        
        if (meData.id !== config.pageId) {
          errors.push(`ID de página no coincide. API: ${meData.id}, Config: ${config.pageId}`);
        } else {
          log.success(`ID de página coincide: ${meData.id} ✅`);
        }
      }
      
    } catch (error) {
      log.error(`Error al obtener /me: ${error.message}`);
      errors.push(`No se pudo verificar página: ${error.message}`);
    }
    
    // ========== PASO 5: LECTURA DEL FEED ==========
    log.section('Paso 5: Verificación de lectura del feed');
    
    const feedUrl = `https://graph.facebook.com/${config.graphVersion}/${config.pageId}/feed?` +
                    `limit=1&access_token=${config.pageToken}`;
    
    log.info('Verificando acceso al feed...');
    
    try {
      const fetch = (await import('node-fetch')).default;
      const feedResponse = await fetch(feedUrl, {
        method: 'GET',
        timeout: 10000
      });
      
      if (!feedResponse.ok) {
        const errorData = await feedResponse.json();
        log.error(`Error leyendo feed: ${errorData.error?.message || 'Unknown'}`);
        errors.push(`No se puede leer el feed: ${errorData.error?.message}`);
      } else {
        const feedData = await feedResponse.json();
        
        if (feedData.data && Array.isArray(feedData.data)) {
          const itemCount = feedData.data.length;
          log.success(`Feed accesible. Posts recientes: ${itemCount} ✅`);
        } else {
          log.warn('Feed accesible pero estructura inesperada');
        }
      }
      
    } catch (error) {
      log.error(`Error al leer feed: ${error.message}`);
      errors.push(`No se pudo verificar feed: ${error.message}`);
    }
    
    // ========== RESUMEN FINAL ==========
    log.section('RESUMEN DE VERIFICACIÓN');
    
    if (errors.length === 0) {
      console.log('\n' + '═'.repeat(60));
      console.log(`${colors.green}✅✅✅ FACEBOOK CONFIG LISTA PARA PUBLICAR ✅✅✅${colors.reset}`);
      console.log('═'.repeat(60));
      
      console.log('\nResumen de configuración verificada:');
      console.log(`  • App ID: ${maskSecret(config.appId, 5)}`);
      console.log(`  • Page ID: ${config.pageId}`);
      console.log(`  • Graph Version: ${config.graphVersion}`);
      console.log(`  • Token: Válido y con permisos correctos`);
      console.log(`  • Feed: Accesible para lectura/escritura`);
      console.log('\n✅ Listo para publicación real\n');
      
      process.exit(0);
    } else {
      console.log('\n' + '═'.repeat(60));
      console.log(`${colors.red}❌ VERIFICACIÓN FALLÓ - REVISAR CONFIGURACIÓN ❌${colors.reset}`);
      console.log('═'.repeat(60));
      
      console.log('\nErrores encontrados:');
      errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
      
      console.log('\nAcciones requeridas:');
      console.log('  1. Revisa que el PAGE_TOKEN sea válido y reciente');
      console.log('  2. Verifica que el token tenga permisos pages_manage_posts y pages_read_engagement');
      console.log('  3. Confirma que el PAGE_ID corresponde a la página correcta');
      console.log('  4. Asegúrate que el APP_ID y APP_SECRET son correctos');
      
      process.exit(1);
    }
    
  } catch (error) {
    log.error(`Error inesperado: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar verificación
verifyFacebook().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});

