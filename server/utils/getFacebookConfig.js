/**
 * Utilidad para obtener y validar la configuración de Facebook
 * @module getFacebookConfig
 */

/**
 * Obtiene y valida la configuración de Facebook desde las variables de entorno
 * Maneja nombres legacy y realiza validaciones estrictas
 * @returns {{PAGE_ID: string, TOKEN: string, VERSION: string, APP_ID: string, APP_SECRET: string}}
 * @throws {Error} Si la configuración es inválida
 */
function getFacebookConfig() {
  // === VALIDACIÓN DE APP_ID ===
  const rawAppId = process.env.FACEBOOK_APP_ID || "";
  const APP_ID = rawAppId.trim().replace(/^['"]|['"]$/g, "");
  
  if (!APP_ID) {
    console.error("[FB Config] ❌ FACEBOOK_APP_ID no configurado");
    throw new Error("CONFIG_MISSING: FACEBOOK_APP_ID es obligatorio");
  }
  
  // Validar que sea numérico y de 13-20 dígitos
  const appIdDigits = APP_ID.replace(/\D/g, '');
  if (!/^\d{13,20}$/.test(appIdDigits)) {
    console.error(`[FB Config] ❌ FACEBOOK_APP_ID inválido: "${APP_ID}" (${appIdDigits.length} dígitos)`);
    throw new Error(`CONFIG_ERROR: FACEBOOK_APP_ID debe ser numérico (13–20 dígitos). Actual: ${appIdDigits.length} dígitos`);
  }
  
  // === VALIDACIÓN DE APP_SECRET ===
  const rawAppSecret = process.env.FACEBOOK_APP_SECRET || "";
  const APP_SECRET = rawAppSecret.trim().replace(/^['"]|['"]$/g, "");
  
  if (!APP_SECRET) {
    console.error("[FB Config] ❌ FACEBOOK_APP_SECRET no configurado");
    throw new Error("CONFIG_MISSING: FACEBOOK_APP_SECRET es obligatorio");
  }
  
  // === VALIDACIÓN DE VERSION (con soporte legacy) ===
  let VERSION = process.env.FACEBOOK_GRAPH_VERSION || process.env.FB_GRAPH_VERSION || "v23.0";
  VERSION = VERSION.trim().replace(/^['"]|['"]$/g, "");
  
  // Detectar si se usa el nombre legacy
  if (!process.env.FACEBOOK_GRAPH_VERSION && process.env.FB_GRAPH_VERSION) {
    console.warn("[FB Config] ⚠️ Usando FB_GRAPH_VERSION (legacy). Actualiza a FACEBOOK_GRAPH_VERSION");
  }
  
  if (!VERSION.match(/^v\d+\.\d+$/)) {
    console.warn(`[FB Config] ⚠️ Versión no válida: ${VERSION}, usando v23.0`);
    VERSION = "v23.0";
  }
  
  // === VALIDACIÓN DE PAGE_ID ===
  const rawId = process.env.FACEBOOK_PAGE_ID || "";
  const PAGE_ID = rawId.trim().replace(/^['"]|['"]$/g, "");
  
  if (!/^\d+$/.test(PAGE_ID)) {
    console.error("[FB Config] ❌ FACEBOOK_PAGE_ID inválido o ausente");
    throw new Error("CONFIG_ERROR: FACEBOOK_PAGE_ID debe ser un ID numérico válido");
  }
  
  // === VALIDACIÓN DE TOKEN ===
  const rawToken = process.env.FACEBOOK_PAGE_TOKEN || "";
  let TOKEN = rawToken.trim().replace(/^['"]|['"]$/g, "");
  TOKEN = TOKEN.replace(/[\r\n\t ]/g, "");
  
  if (!TOKEN) {
    console.error("[FB Config] ❌ FACEBOOK_PAGE_TOKEN ausente");
    throw new Error("CONFIG_ERROR: FACEBOOK_PAGE_TOKEN es obligatorio");
  }
  
  // Advertencia de seguridad si el token parece expuesto
  if (TOKEN.length < 100) {
    console.warn("[FB Config] ⚠️ TOKEN parece truncado o inválido");
  }
  
  // === RESUMEN DE CONFIGURACIÓN ===
  console.log("\n[FB Config] === RESUMEN DE CONFIGURACIÓN ===");
  console.log(`[FB Config] APP_ID: ✅ ${APP_ID} (${appIdDigits.length} dígitos)`);
  console.log(`[FB Config] APP_SECRET: ${APP_SECRET ? '✅' : '❌'} ***${APP_SECRET.slice(-6)}`);
  console.log(`[FB Config] VERSION: ${VERSION}`);
  console.log(`[FB Config] PAGE_ID: ${PAGE_ID}`);
  console.log(`[FB Config] TOKEN: ***${TOKEN.slice(-6)} (longitud: ${TOKEN.length})`);
  console.log("[FB Config] ================================\n");
  
  // Advertencia de seguridad
  if (process.env.NODE_ENV === 'production') {
    console.warn("[FB Config] ⚠️ SEGURIDAD: En producción, considera resolver PAGE_TOKEN dinámicamente en lugar de almacenarlo en .env");
  }
  
  return { 
    PAGE_ID, 
    TOKEN, 
    VERSION,
    APP_ID,
    APP_SECRET
  };
}

module.exports = getFacebookConfig;