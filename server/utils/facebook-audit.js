/**
 * Script de auditoría completa para Facebook API
 * Ejecutar con: node server/utils/facebook-audit.js
 * 
 * Este script realiza una auditoría exhaustiva de la configuración
 * y genera un reporte con el diagnóstico completo
 */

require("dotenv").config();
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

// Importar funciones necesarias
const getFacebookConfig = require("./getFacebookConfig");
const { 
  debugTokenStrict,
  checkUserPermissions,
  resolvePageTokenStrict,
  getAppMode
} = require("../services/facebookPublisher");

// Colores para la consola
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m"
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log("\n" + "=".repeat(70));
  log(title, "bright");
  console.log("=".repeat(70));
}

function logSubsection(title) {
  console.log("\n" + "-".repeat(50));
  log(title, "cyan");
  console.log("-".repeat(50));
}

// Almacenar resultados para el reporte
const auditResults = {
  timestamp: new Date().toISOString(),
  config: {},
  token: {},
  permissions: {},
  pageAccess: {},
  publishTest: {},
  appMode: {},
  curlCommands: [],
  checklist: {},
  errors: [],
  warnings: [],
  recommendations: []
};

// Función para generar comandos cURL
function generateCurlCommand(description, command) {
  const formatted = `# ${description}\n${command}`;
  auditResults.curlCommands.push(formatted);
  return formatted;
}

// Auditoría de configuración
async function auditConfiguration() {
  logSection("A. AUDITORÍA DE CONFIGURACIÓN (.env)");
  
  try {
    // Intentar leer .env directamente
    const envPath = path.join(process.cwd(), '.env');
    let envContent = "";
    let envVars = {};
    
    try {
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
          const match = line.match(/^([^=]+)=(.*)$/);
          if (match) {
            envVars[match[1].trim()] = match[2].trim();
          }
        });
      }
    } catch (e) {
      log("⚠️ No se pudo leer .env directamente", "yellow");
    }
    
    // Verificar APP_ID
    const currentAppId = process.env.FACEBOOK_APP_ID || envVars.FACEBOOK_APP_ID || "";
    const correctAppId = "7839888679168616";
    const incorrectAppId = "783988867916816";
    
    if (currentAppId === incorrectAppId) {
      log(`❌ FACEBOOK_APP_ID incorrecto: ${currentAppId}`, "red");
      log(`   Falta un dígito '6'. Debe ser: ${correctAppId}`, "red");
      auditResults.errors.push("FACEBOOK_APP_ID incorrecto - falta un dígito");
      auditResults.config.appIdStatus = "ERROR";
    } else if (currentAppId === correctAppId) {
      log(`✅ FACEBOOK_APP_ID correcto: ${currentAppId}`, "green");
      auditResults.config.appIdStatus = "OK";
    } else if (!currentAppId) {
      log("❌ FACEBOOK_APP_ID no encontrado", "red");
      auditResults.errors.push("FACEBOOK_APP_ID no configurado");
      auditResults.config.appIdStatus = "MISSING";
    } else {
      log(`⚠️ FACEBOOK_APP_ID inesperado: ${currentAppId}`, "yellow");
      auditResults.warnings.push(`FACEBOOK_APP_ID diferente al esperado: ${currentAppId}`);
      auditResults.config.appIdStatus = "WARNING";
    }
    
    // Verificar APP_SECRET
    const appSecret = process.env.FACEBOOK_APP_SECRET || envVars.FACEBOOK_APP_SECRET || "";
    if (appSecret) {
      log(`✅ FACEBOOK_APP_SECRET configurado: ***${appSecret.slice(-6)}`, "green");
      auditResults.config.appSecretStatus = "OK";
    } else {
      log("❌ FACEBOOK_APP_SECRET no encontrado", "red");
      auditResults.errors.push("FACEBOOK_APP_SECRET no configurado");
      auditResults.config.appSecretStatus = "MISSING";
    }
    
    // Verificar versión de Graph API
    const graphVersion = process.env.FACEBOOK_GRAPH_VERSION || "";
    const legacyVersion = process.env.FB_GRAPH_VERSION || envVars.FB_GRAPH_VERSION || "";
    
    if (graphVersion) {
      log(`✅ FACEBOOK_GRAPH_VERSION: ${graphVersion}`, "green");
      auditResults.config.graphVersionStatus = "OK";
    } else if (legacyVersion) {
      log(`⚠️ Usando FB_GRAPH_VERSION (legacy): ${legacyVersion}`, "yellow");
      log("   Actualiza el nombre a FACEBOOK_GRAPH_VERSION", "yellow");
      auditResults.warnings.push("Usando nombre legacy FB_GRAPH_VERSION");
      auditResults.config.graphVersionStatus = "LEGACY";
    } else {
      log("ℹ️ FACEBOOK_GRAPH_VERSION no configurado, usando v23.0 por defecto", "cyan");
      auditResults.config.graphVersionStatus = "DEFAULT";
    }
    
    // Verificar PAGE_ID
    const pageId = process.env.FACEBOOK_PAGE_ID || envVars.FACEBOOK_PAGE_ID || "";
    if (pageId === "724642430740421") {
      log(`✅ FACEBOOK_PAGE_ID correcto: ${pageId}`, "green");
      auditResults.config.pageIdStatus = "OK";
    } else if (pageId) {
      log(`⚠️ FACEBOOK_PAGE_ID diferente: ${pageId}`, "yellow");
      auditResults.warnings.push(`PAGE_ID diferente al esperado: ${pageId}`);
      auditResults.config.pageIdStatus = "WARNING";
    } else {
      log("❌ FACEBOOK_PAGE_ID no encontrado", "red");
      auditResults.errors.push("FACEBOOK_PAGE_ID no configurado");
      auditResults.config.pageIdStatus = "MISSING";
    }
    
    // Verificar PAGE_TOKEN
    const pageToken = process.env.FACEBOOK_PAGE_TOKEN || envVars.FACEBOOK_PAGE_TOKEN || "";
    if (pageToken) {
      log(`✅ FACEBOOK_PAGE_TOKEN configurado: ***${pageToken.slice(-6)} (longitud: ${pageToken.length})`, "green");
      auditResults.config.pageTokenStatus = "OK";
      
      // Advertencia de seguridad
      log("\n⚠️ ADVERTENCIA DE SEGURIDAD:", "yellow");
      log("   El PAGE_TOKEN está expuesto en .env - debe rotarse", "yellow");
      log("   Recomendación: usar USER_TOKEN y resolver dinámicamente", "yellow");
      auditResults.recommendations.push("Rotar PAGE_TOKEN por seguridad");
      auditResults.recommendations.push("En producción, usar USER_TOKEN y resolver PAGE_TOKEN dinámicamente");
    } else {
      log("❌ FACEBOOK_PAGE_TOKEN no encontrado", "red");
      auditResults.errors.push("FACEBOOK_PAGE_TOKEN no configurado");
      auditResults.config.pageTokenStatus = "MISSING";
    }
    
    // Intentar cargar configuración
    try {
      const config = getFacebookConfig();
      auditResults.config.loadStatus = "OK";
      return config;
    } catch (error) {
      log(`\n❌ Error cargando configuración: ${error.message}`, "red");
      auditResults.config.loadStatus = "ERROR";
      auditResults.errors.push(`Config load error: ${error.message}`);
      throw error;
    }
    
  } catch (error) {
    auditResults.config.status = "ERROR";
    throw error;
  }
}

// Preflight de tokens
async function auditToken(config) {
  logSection("B. PREFLIGHT DE TOKENS");
  
  const { TOKEN, PAGE_ID } = config;
  
  try {
    // Debug token
    logSubsection("B1. Verificando PAGE_TOKEN con debug_token");
    
    const tokenInfo = await debugTokenStrict(TOKEN, config);
    
    log(`is_valid: ${tokenInfo.isValid ? '✅ true' : '❌ false'}`, tokenInfo.isValid ? "green" : "red");
    log(`profile_id: ${tokenInfo.profileId || 'N/A'}`);
    log(`type: ${tokenInfo.type || 'unknown'}`);
    log(`app_id: ${tokenInfo.appId || 'N/A'}`);
    
    auditResults.token = {
      isValid: tokenInfo.isValid,
      profileId: tokenInfo.profileId,
      type: tokenInfo.type,
      appId: tokenInfo.appId,
      matchesPageId: tokenInfo.profileId === PAGE_ID
    };
    
    // Generar cURL para debug_token
    const debugCurl = generateCurlCommand(
      "Debug token",
      `curl -X GET "https://graph.facebook.com/${config.VERSION}/debug_token?input_token=${TOKEN.slice(0, 20)}...&access_token=${config.APP_ID}|${config.APP_SECRET.slice(0, 10)}..."`
    );
    
    if (tokenInfo.profileId === PAGE_ID) {
      log(`✅ profile_id coincide con PAGE_ID (${PAGE_ID})`, "green");
      auditResults.checklist.profileIdMatch = true;
    } else {
      log(`❌ profile_id (${tokenInfo.profileId}) NO coincide con PAGE_ID (${PAGE_ID})`, "red");
      log("   Este es un USER_TOKEN, necesita conversión a PAGE_TOKEN", "yellow");
      auditResults.warnings.push("Token es USER_TOKEN, se convertirá a PAGE_TOKEN");
      auditResults.checklist.profileIdMatch = false;
    }
    
    // Si es USER token, verificar permisos
    if (tokenInfo.isValid && tokenInfo.profileId !== PAGE_ID) {
      logSubsection("B2. Verificando permisos del USER_TOKEN");
      
      const perms = await checkUserPermissions(TOKEN, config);
      
      auditResults.permissions = {
        hasRequired: perms.hasRequiredPermissions,
        granted: Object.keys(perms.permissions).filter(p => perms.permissions[p] === "granted"),
        missing: perms.missing
      };
      
      const requiredPerms = ["pages_manage_posts", "pages_read_engagement"];
      requiredPerms.forEach(perm => {
        const status = perms.permissions[perm];
        if (status === "granted") {
          log(`✅ ${perm}: granted`, "green");
        } else {
          log(`❌ ${perm}: ${status || 'not granted'}`, "red");
        }
      });
      
      // Generar cURL para permisos
      const permsCurl = generateCurlCommand(
        "Verificar permisos",
        `curl -X GET "https://graph.facebook.com/${config.VERSION}/me/permissions?access_token=${TOKEN.slice(0, 20)}..."`
      );
      
      auditResults.checklist.hasRequiredPermissions = perms.hasRequiredPermissions;
    } else if (tokenInfo.isValid) {
      log("ℹ️ Es PAGE_TOKEN directo, no se verifican permisos de usuario", "cyan");
      auditResults.checklist.hasRequiredPermissions = true;
    }
    
    return tokenInfo;
    
  } catch (error) {
    log(`❌ Error en preflight: ${error.message}`, "red");
    auditResults.token.error = error.message;
    auditResults.errors.push(`Token preflight error: ${error.message}`);
    throw error;
  }
}

// Resolución de PAGE TOKEN
async function auditPageTokenResolution(config, tokenInfo) {
  logSection("C. RESOLUCIÓN DEL PAGE TOKEN");
  
  if (tokenInfo.profileId === config.PAGE_ID) {
    log("✅ Ya tenemos un PAGE_TOKEN válido", "green");
    auditResults.pageAccess.needsResolution = false;
    return config.TOKEN;
  }
  
  try {
    log("Resolviendo PAGE_TOKEN desde USER_TOKEN...");
    
    const resolution = await resolvePageTokenStrict(config.TOKEN, config.PAGE_ID, config);
    
    if (resolution.success) {
      log(`✅ PAGE_TOKEN obtenido exitosamente`, "green");
      log(`   Página: ${resolution.pageName}`, "cyan");
      auditResults.pageAccess.resolutionSuccess = true;
      auditResults.pageAccess.pageName = resolution.pageName;
      
      // Generar cURL para obtener accounts
      const accountsCurl = generateCurlCommand(
        "Obtener páginas del usuario",
        `curl -X GET "https://graph.facebook.com/${config.VERSION}/me/accounts?access_token=${config.TOKEN.slice(0, 20)}..."`
      );
      
      return resolution.pageToken;
    } else {
      log("❌ No se pudo resolver PAGE_TOKEN", "red");
      auditResults.pageAccess.resolutionSuccess = false;
      auditResults.errors.push("No se pudo resolver PAGE_TOKEN desde USER_TOKEN");
      return null;
    }
    
  } catch (error) {
    log(`❌ Error resolviendo PAGE_TOKEN: ${error.message}`, "red");
    auditResults.pageAccess.error = error.message;
    throw error;
  }
}

// Smoke tests
async function auditSmokeTests(config, pageToken) {
  logSection("D. SMOKE TESTS");
  
  if (!pageToken) {
    log("⚠️ No hay PAGE_TOKEN válido para hacer smoke tests", "yellow");
    return;
  }
  
  const { VERSION, PAGE_ID } = config;
  
  // Test 1: Acceso a la página
  logSubsection("D1. Test de acceso a la página");
  
  try {
    const pageUrl = `https://graph.facebook.com/${VERSION}/${PAGE_ID}?fields=name&access_token=${pageToken}`;
    const response = await fetch(pageUrl, { timeout: 10000 });
    
    if (response.ok) {
      const data = await response.json();
      log(`✅ GET /${PAGE_ID}?fields=name → 200 OK`, "green");
      log(`   Nombre: ${data.name}`, "cyan");
      auditResults.pageAccess.canRead = true;
      auditResults.checklist.pageAccessTest = true;
      
      // Generar cURL
      const pageCurl = generateCurlCommand(
        "Verificar acceso a la página",
        `curl -X GET "https://graph.facebook.com/${VERSION}/${PAGE_ID}?fields=name&access_token=${pageToken.slice(0, 20)}..."`
      );
    } else {
      const error = await response.json();
      log(`❌ GET /${PAGE_ID} → ${response.status}`, "red");
      log(`   Error: ${error.error?.message || 'Unknown'}`, "red");
      auditResults.pageAccess.canRead = false;
      auditResults.checklist.pageAccessTest = false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, "red");
    auditResults.pageAccess.canRead = false;
    auditResults.checklist.pageAccessTest = false;
  }
  
  // Test 2: Capacidad de publicación
  logSubsection("D2. Test de publicación");
  
  try {
    const feedUrl = `https://graph.facebook.com/${VERSION}/${PAGE_ID}/feed`;
    const testMessage = `Test API - ${new Date().toISOString()}`;
    
    // Primero intentar con published=false
    const params = new URLSearchParams({
      message: testMessage,
      published: "false",
      access_token: pageToken
    });
    
    log("Intentando POST con published=false...");
    
    const response = await fetch(feedUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      timeout: 10000
    });
    
    if (response.ok) {
      const data = await response.json();
      log(`✅ POST /${PAGE_ID}/feed → 200 OK`, "green");
      log(`   Post ID (no publicado): ${data.id}`, "cyan");
      auditResults.publishTest.canPublish = true;
      auditResults.checklist.publishTest = true;
      
      // Generar cURL
      const publishCurl = generateCurlCommand(
        "Test de publicación",
        `curl -X POST "https://graph.facebook.com/${VERSION}/${PAGE_ID}/feed" \\
  -d "message=Test API" \\
  -d "access_token=${pageToken.slice(0, 20)}..."`
      );
      
      // Intentar eliminar el post de prueba
      if (data.id) {
        try {
          await fetch(`https://graph.facebook.com/${VERSION}/${data.id}?access_token=${pageToken}`, {
            method: "DELETE",
            timeout: 5000
          });
          log("   Post de prueba eliminado", "cyan");
        } catch (e) {
          // Ignorar errores al eliminar
        }
      }
    } else {
      const error = await response.json();
      log(`❌ POST /${PAGE_ID}/feed → ${response.status}`, "red");
      log(`   Error: ${error.error?.message || 'Unknown'}`, "red");
      log(`   Code: ${error.error?.code}`, "red");
      auditResults.publishTest.canPublish = false;
      auditResults.publishTest.error = error.error;
      auditResults.checklist.publishTest = false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, "red");
    auditResults.publishTest.canPublish = false;
    auditResults.checklist.publishTest = false;
  }
}

// Verificar modo de la app
async function auditAppMode(config) {
  logSection("E. MODO DE LA APLICACIÓN");
  
  try {
    const appInfo = await getAppMode(config);
    
    auditResults.appMode = appInfo;
    
    if (appInfo.appMode === "live") {
      log(`✅ Aplicación en modo LIVE`, "green");
      log(`   App ID: ${appInfo.appId}`, "cyan");
    } else if (appInfo.appMode === "development") {
      log(`⚠️ Aplicación en modo DEVELOPMENT`, "yellow");
      log(`   App ID: ${appInfo.appId}`, "cyan");
      log("   IMPORTANTE: Solo usuarios con rol en la app pueden publicar", "yellow");
      auditResults.warnings.push("App en modo DEVELOPMENT - restricciones aplicadas");
    } else {
      log(`ℹ️ No se pudo determinar el modo de la app`, "cyan");
    }
    
    // Generar cURL
    const appCurl = generateCurlCommand(
      "Verificar modo de la app",
      `curl -X GET "https://graph.facebook.com/${config.VERSION}/${config.APP_ID}?fields=id,name,link"`
    );
    
  } catch (error) {
    log(`❌ Error verificando modo: ${error.message}`, "red");
    auditResults.appMode.error = error.message;
  }
}

// Generar reporte final
function generateReport() {
  logSection("REPORTE FINAL");
  
  // Checklist de aceptación
  logSubsection("Checklist de Aceptación");
  
  const checklistItems = [
    { key: "appIdCorrect", label: "APP_ID correcto (7839888679168616)", value: auditResults.config.appIdStatus === "OK" },
    { key: "graphVersionOk", label: "FACEBOOK_GRAPH_VERSION configurado", value: ["OK", "DEFAULT"].includes(auditResults.config.graphVersionStatus) },
    { key: "profileIdMatch", label: "debug_token(profile_id) == PAGE_ID", value: auditResults.checklist.profileIdMatch },
    { key: "hasRequiredPermissions", label: "Permisos pages_manage_posts y pages_read_engagement", value: auditResults.checklist.hasRequiredPermissions },
    { key: "pageAccessTest", label: "GET /{PAGE_ID}?fields=name → 200", value: auditResults.checklist.pageAccessTest },
    { key: "publishTest", label: "POST /{PAGE_ID}/feed → 200", value: auditResults.checklist.publishTest }
  ];
  
  let allPassed = true;
  checklistItems.forEach(item => {
    const icon = item.value ? "✅" : "❌";
    const color = item.value ? "green" : "red";
    log(`${icon} ${item.label}`, color);
    if (!item.value) allPassed = false;
  });
  
  // Diagnóstico y causa raíz
  logSubsection("Diagnóstico");
  
  if (allPassed) {
    log("✅ CONFIGURACIÓN CORRECTA", "green");
    log("La configuración de Facebook está lista para usar", "green");
  } else {
    log("❌ PROBLEMAS DETECTADOS", "red");
    
    // Determinar causa raíz
    if (auditResults.config.appIdStatus !== "OK") {
      log("\nCAUSA RAÍZ: FACEBOOK_APP_ID incorrecto", "red");
      log("Solución: Corregir APP_ID a 7839888679168616 en .env", "yellow");
    } else if (!auditResults.token.isValid) {
      log("\nCAUSA RAÍZ: Token inválido o expirado", "red");
      log("Solución: Regenerar token en Meta Business Suite", "yellow");
    } else if (!auditResults.checklist.hasRequiredPermissions) {
      log("\nCAUSA RAÍZ: Permisos insuficientes", "red");
      log("Solución: Re-autorizar con todos los permisos requeridos", "yellow");
    } else if (!auditResults.checklist.pageAccessTest || !auditResults.checklist.publishTest) {
      log("\nCAUSA RAÍZ: Token no tiene acceso a la página", "red");
      log("Solución: Verificar que el usuario administre la página", "yellow");
    }
  }
  
  // Errores y advertencias
  if (auditResults.errors.length > 0) {
    logSubsection("Errores Críticos");
    auditResults.errors.forEach(error => {
      log(`• ${error}`, "red");
    });
  }
  
  if (auditResults.warnings.length > 0) {
    logSubsection("Advertencias");
    auditResults.warnings.forEach(warning => {
      log(`• ${warning}`, "yellow");
    });
  }
  
  // Recomendaciones
  if (auditResults.recommendations.length > 0) {
    logSubsection("Recomendaciones de Seguridad");
    auditResults.recommendations.forEach(rec => {
      log(`• ${rec}`, "magenta");
    });
  }
  
  // Comandos cURL
  if (auditResults.curlCommands.length > 0) {
    logSubsection("Comandos cURL Utilizados");
    auditResults.curlCommands.forEach(cmd => {
      console.log(`\n${cmd}`);
    });
  }
  
  // Guardar reporte en archivo
  const reportPath = path.join(__dirname, `facebook-audit-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2));
  
  log(`\n📄 Reporte completo guardado en: ${reportPath}`, "cyan");
  
  return allPassed;
}

// Función principal
async function runAudit() {
  console.clear();
  log("AUDITORÍA COMPLETA DE FACEBOOK API", "bright");
  log("Fecha: " + new Date().toLocaleString(), "cyan");
  log("Siguiendo especificaciones del prompt maestro", "cyan");
  
  try {
    // A. Auditoría de configuración
    const config = await auditConfiguration();
    
    // B. Preflight de tokens
    const tokenInfo = await auditToken(config);
    
    if (!tokenInfo.isValid) {
      log("\n⛔ Deteniendo auditoría: Token inválido", "red");
      generateReport();
      process.exit(1);
    }
    
    // C. Resolución de PAGE TOKEN
    let pageToken = config.TOKEN;
    if (tokenInfo.profileId !== config.PAGE_ID) {
      pageToken = await auditPageTokenResolution(config, tokenInfo);
      
      if (!pageToken) {
        log("\n⛔ Deteniendo auditoría: No se pudo obtener PAGE_TOKEN", "red");
        generateReport();
        process.exit(1);
      }
    }
    
    // D. Smoke tests
    await auditSmokeTests(config, pageToken);
    
    // E. Modo de la app
    await auditAppMode(config);
    
    // Generar reporte final
    const success = generateReport();
    
    // Código de salida
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    log(`\n❌ Error crítico en auditoría: ${error.message}`, "red");
    auditResults.criticalError = error.message;
    generateReport();
    process.exit(1);
  }
}

// Ejecutar auditoría
runAudit();
