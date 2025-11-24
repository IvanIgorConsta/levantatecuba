/**
 * Script de pruebas para verificar la configuración de Facebook API
 * Ejecutar con: node server/utils/test-facebook-api.js
 */

require("dotenv").config();
const fetch = require("node-fetch");
const { 
  debugToken, 
  resolvePageToken, 
  getAppMode 
} = require("../services/facebookPublisher");
const getFacebookConfig = require("./getFacebookConfig");

// Colores para la consola
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log("\n" + "=".repeat(60));
  log(title, "bright");
  console.log("=".repeat(60));
}

async function testConfiguration() {
  logSection("1. VERIFICANDO CONFIGURACIÓN");
  
  try {
    const config = getFacebookConfig();
    log("✅ Configuración cargada:", "green");
    log(`   PAGE_ID: ${config.PAGE_ID}`);
    log(`   TOKEN: ${config.TOKEN.slice(0, 10)}...${config.TOKEN.slice(-6)}`);
    log(`   VERSION: ${config.VERSION}`);
    return config;
  } catch (error) {
    log(`❌ Error de configuración: ${error.message}`, "red");
    process.exit(1);
  }
}

async function testDebugToken(token) {
  logSection("2. VERIFICANDO TOKEN");
  
  try {
    const tokenInfo = await debugToken(token);
    
    if (tokenInfo.isValid) {
      log("✅ Token válido", "green");
      log(`   Tipo: ${tokenInfo.type || "No determinado"}`);
      log(`   Es Page Token: ${tokenInfo.isLikelyPageToken ? "Sí" : "No"}`);
      
      if (tokenInfo.scopes.length > 0) {
        log(`   Scopes: ${tokenInfo.scopes.join(", ")}`);
        
        // Verificar scopes requeridos
        const requiredScopes = ["pages_manage_posts", "pages_read_engagement"];
        const hasRequired = requiredScopes.every(scope => tokenInfo.scopes.includes(scope));
        
        if (hasRequired) {
          log("   ✅ Tiene todos los permisos requeridos", "green");
        } else {
          const missing = requiredScopes.filter(scope => !tokenInfo.scopes.includes(scope));
          log(`   ⚠️ Faltan permisos: ${missing.join(", ")}`, "yellow");
        }
      } else {
        log("   ℹ️ No se pudieron determinar los scopes (usando smoke test)", "cyan");
      }
      
      if (tokenInfo.expires_at) {
        const expiryDate = new Date(tokenInfo.expires_at * 1000);
        log(`   Expira: ${expiryDate.toLocaleString()}`);
      }
    } else {
      log("❌ Token inválido", "red");
    }
    
    return tokenInfo;
  } catch (error) {
    log(`❌ Error verificando token: ${error.message}`, "red");
    return null;
  }
}

async function testPageAccess(config, pageToken) {
  logSection("3. PROBANDO ACCESO A LA PÁGINA");
  
  const token = pageToken || config.TOKEN;
  const url = `https://graph.facebook.com/${config.VERSION}/${config.PAGE_ID}?fields=name,id,access_token&access_token=${token}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok) {
      log("✅ Acceso a la página exitoso", "green");
      log(`   Nombre: ${data.name}`);
      log(`   ID: ${data.id}`);
      return true;
    } else {
      log("❌ No se puede acceder a la página", "red");
      log(`   Error: ${data.error?.message || "Desconocido"}`);
      return false;
    }
  } catch (error) {
    log(`❌ Error accediendo a la página: ${error.message}`, "red");
    return false;
  }
}

async function testResolvePageToken(config) {
  logSection("4. RESOLVIENDO PAGE TOKEN");
  
  try {
    const resolution = await resolvePageToken(config.TOKEN, config.PAGE_ID);
    
    log(`Token origen: ${resolution.tokenOrigin}`);
    log(`Token válido: ${resolution.isValid ? "Sí" : "No"}`);
    
    if (resolution.tokenOrigin === "USER") {
      log("ℹ️ Se resolvió un Page Token desde User Token", "cyan");
    } else if (resolution.tokenOrigin === "PAGE") {
      log("✅ Ya se está usando un Page Token", "green");
    }
    
    return resolution;
  } catch (error) {
    log(`❌ Error resolviendo Page Token: ${error.message}`, "red");
    return null;
  }
}

async function testPublishDryRun(config, pageToken) {
  logSection("5. SIMULACIÓN DE PUBLICACIÓN (DRY RUN)");
  
  const token = pageToken || config.TOKEN;
  const message = `Test API - ${new Date().toISOString()}`;
  
  log("ℹ️ Esta es una simulación, no se publicará realmente", "cyan");
  
  // Preparar solicitud pero no enviarla
  const url = `https://graph.facebook.com/${config.VERSION}/${config.PAGE_ID}/feed`;
  const params = new URLSearchParams({
    message: message,
    access_token: token,
    published: "false" // Crear como borrador para no publicar realmente
  });
  
  log(`URL: ${url}`);
  log(`Método: POST`);
  log(`Parámetros: message="${message.substring(0, 30)}..."`);
  
  // Verificar que podríamos publicar
  try {
    // Hacer una llamada GET para verificar permisos
    const testUrl = `https://graph.facebook.com/${config.VERSION}/${config.PAGE_ID}/feed?access_token=${token}&limit=1`;
    const response = await fetch(testUrl);
    
    if (response.ok) {
      log("✅ El token tiene permisos para leer el feed (buen indicador)", "green");
      return true;
    } else {
      const data = await response.json();
      log("⚠️ Posible problema con permisos", "yellow");
      log(`   ${data.error?.message || "Error desconocido"}`);
      return false;
    }
  } catch (error) {
    log(`❌ Error en simulación: ${error.message}`, "red");
    return false;
  }
}

async function testAppMode() {
  logSection("6. VERIFICANDO MODO DE LA APLICACIÓN");
  
  try {
    const { appMode, appId } = await getAppMode();
    
    if (appMode === "live") {
      log("✅ Aplicación en modo LIVE", "green");
    } else if (appMode === "development") {
      log("⚠️ Aplicación en modo DEVELOPMENT", "yellow");
      log("   Solo usuarios con rol en la app pueden publicar", "yellow");
    } else {
      log("ℹ️ No se pudo determinar el modo de la app", "cyan");
    }
    
    if (appId && appId !== "not_configured") {
      log(`   App ID: ${appId}`);
    }
  } catch (error) {
    log(`❌ Error verificando modo de app: ${error.message}`, "red");
  }
}

async function runAllTests() {
  console.clear();
  log("PRUEBAS DE CONFIGURACIÓN DE FACEBOOK API", "bright");
  log("Fecha: " + new Date().toLocaleString(), "cyan");
  
  try {
    // 1. Verificar configuración
    const config = await testConfiguration();
    
    // 2. Debug del token
    const tokenInfo = await testDebugToken(config.TOKEN);
    
    // 3. Probar acceso a la página
    await testPageAccess(config);
    
    // 4. Resolver Page Token
    const resolution = await testResolvePageToken(config);
    const pageToken = resolution?.token || config.TOKEN;
    
    // 5. Simulación de publicación
    await testPublishDryRun(config, pageToken);
    
    // 6. Verificar modo de la app
    await testAppMode();
    
    // Resumen final
    logSection("RESUMEN");
    
    if (tokenInfo?.isValid && resolution?.isValid) {
      log("✅ La configuración parece estar correcta", "green");
      
      if (tokenInfo.type === "USER" || resolution.tokenOrigin === "USER") {
        log("\n💡 RECOMENDACIÓN:", "yellow");
        log("   Estás usando un User Token que se convierte a Page Token automáticamente.");
        log("   Para mejor rendimiento, considera obtener y guardar directamente el Page Token.");
      }
    } else {
      log("❌ Hay problemas con la configuración", "red");
      log("\n🔧 PASOS PARA SOLUCIONAR:", "yellow");
      log("   1. Verifica que FACEBOOK_PAGE_ID sea correcto");
      log("   2. Regenera el token en Meta Business Suite");
      log("   3. Asegúrate de solicitar permisos: pages_manage_posts, pages_read_engagement");
      log("   4. Si la app está en development, añade tu usuario como tester");
    }
    
  } catch (error) {
    log(`\n❌ Error crítico: ${error.message}`, "red");
  }
  
  console.log("\n");
}

// Ejecutar las pruebas
runAllTests();
