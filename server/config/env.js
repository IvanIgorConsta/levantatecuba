/**
 * Loader robusto de entorno sin caché para Facebook API
 * Garantiza lectura correcta de variables sin conflictos
 * @module config/env
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

/**
 * Custom error para problemas de configuración
 */
class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Detecta y convierte BOM/UTF-16 a UTF-8
 * @param {Buffer} buffer - Contenido del archivo como buffer
 * @returns {string} - Contenido en UTF-8
 */
function detectAndConvertEncoding(buffer) {
  // Detectar BOM UTF-8 (EF BB BF)
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    console.log('[Env Loader] ⚠️ BOM UTF-8 detectado, eliminando...');
    return buffer.slice(3).toString('utf8');
  }
  
  // Detectar BOM UTF-16 LE (FF FE)
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    console.log('[Env Loader] ⚠️ BOM UTF-16 LE detectado, convirtiendo a UTF-8...');
    return buffer.slice(2).toString('utf16le');
  }
  
  // Detectar BOM UTF-16 BE (FE FF)
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    console.log('[Env Loader] ⚠️ BOM UTF-16 BE detectado, convirtiendo a UTF-8...');
    // Intercambiar bytes para UTF-16 BE
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let i = 2; i < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return swapped.toString('utf16le');
  }
  
  // Sin BOM, asumir UTF-8
  return buffer.toString('utf8');
}

/**
 * Extrae solo dígitos de un string
 * @param {string} str - String a procesar
 * @returns {string} - Solo dígitos
 */
function digitsOnly(str) {
  if (!str) return '';
  return str.replace(/[^\d]/g, '');
}

/**
 * Normaliza el valor de una variable eliminando caracteres invisibles
 * @param {string} value - Valor original
 * @returns {string} - Valor normalizado
 */
function normalizeValue(value) {
  if (typeof value !== 'string') return value;
  
  return value
    .trim()                                      // Eliminar espacios al inicio/final
    .replace(/^['"]|['"]$/g, '')                // Eliminar comillas externas
    .replace(/[\r\n\t]/g, '')                   // Eliminar saltos de línea y tabs
    .replace(/[^\x20-\x7E]/g, '');              // Eliminar caracteres invisibles (solo ASCII imprimible)
}

/**
 * Parsea el contenido del archivo .env con normalización
 * @param {string} content - Contenido del archivo .env
 * @returns {Object} - Variables parseadas
 */
function parseEnvContent(content) {
  const parsed = {};
  const lines = content.split(/\r?\n/);
  
  for (const line of lines) {
    // Ignorar líneas vacías y comentarios
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Buscar formato KEY=VALUE
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    
    const [, key, rawValue] = match;
    const normalizedValue = normalizeValue(rawValue);
    
    // Log si se detectan caracteres raros
    if (rawValue !== normalizedValue && rawValue.trim() !== normalizedValue) {
      console.log(`[Env Loader] 🧹 Normalizado ${key}: "${rawValue}" → "${normalizedValue}"`);
    }
    
    parsed[key] = normalizedValue;
  }
  
  return parsed;
}

/**
 * Carga variables de entorno sin caché
 * @returns {Object} - Configuración cargada
 * @throws {ConfigError} Si hay errores de configuración
 */
function loadEnvironment() {
  console.log('\n[Env Loader] === INICIANDO CARGA DE VARIABLES ===');
  
  // Rutas de archivos .env a buscar (en orden de prioridad)
  const envPaths = [
    path.resolve(__dirname, '../.env'),      // server/.env (preferido)
    path.resolve(__dirname, '../../.env'),   // root/.env (fallback)
  ];
  
  let loadedVars = {};
  let loadedPath = null;
  
  // Buscar y cargar el primer archivo .env encontrado
  for (const envPath of envPaths) {
    try {
      if (!fs.existsSync(envPath)) {
        console.log(`[Env Loader] ⏭️ No existe: ${envPath}`);
        continue;
      }
      
      const stats = fs.statSync(envPath);
      console.log(`[Env Loader] 📂 Encontrado: ${envPath} (${stats.size} bytes)`);
      
      // Leer como buffer para detectar encoding
      const buffer = fs.readFileSync(envPath);
      const content = detectAndConvertEncoding(buffer);
      
      // Parsear contenido
      loadedVars = parseEnvContent(content);
      loadedPath = envPath;
      
      console.log(`[Env Loader] ✅ Cargado: ${envPath} (${Object.keys(loadedVars).length} variables)`);
      break; // Usar solo el primer archivo encontrado
      
    } catch (error) {
      console.error(`[Env Loader] ❌ Error leyendo ${envPath}:`, error.message);
    }
  }
  
  if (!loadedPath) {
    throw new ConfigError('No se encontró archivo .env en las rutas esperadas');
  }
  
  // Migrar variables legacy si es necesario
  if (loadedVars.FB_GRAPH_VERSION && !loadedVars.FACEBOOK_GRAPH_VERSION) {
    console.log(`[Env Loader] ⚠️ WARNING: Migrando FB_GRAPH_VERSION → FACEBOOK_GRAPH_VERSION`);
    loadedVars.FACEBOOK_GRAPH_VERSION = loadedVars.FB_GRAPH_VERSION;
  }
  
  // Aplicar variables al proceso con override
  for (const [key, value] of Object.entries(loadedVars)) {
    process.env[key] = value; // override: true por defecto
  }
  
  // Validaciones estrictas
  const errors = [];
  
  // FACEBOOK_APP_ID - debe ser numérico (13-20 dígitos)
  const appId = process.env.FACEBOOK_APP_ID || '';
  const appIdDigits = digitsOnly(appId);
  
  if (!appIdDigits) {
    errors.push('FACEBOOK_APP_ID no configurado');
  } else if (!/^\d{13,20}$/.test(appIdDigits)) {
    errors.push(`FACEBOOK_APP_ID inválido: "${appId}" (${appIdDigits.length} dígitos). Debe ser numérico (13–20 dígitos).`);
  }
  
  // FACEBOOK_APP_SECRET - no vacío
  const appSecret = process.env.FACEBOOK_APP_SECRET || '';
  if (!appSecret.trim()) {
    errors.push('FACEBOOK_APP_SECRET no configurado');
  }
  
  // FACEBOOK_PAGE_ID - solo dígitos
  const pageId = process.env.FACEBOOK_PAGE_ID || '';
  const pageIdDigits = digitsOnly(pageId);
  
  if (!pageIdDigits) {
    errors.push('FACEBOOK_PAGE_ID no configurado');
  } else if (pageId !== pageIdDigits) {
    console.log(`[Env Loader] 🧹 PAGE_ID normalizado: "${pageId}" → "${pageIdDigits}"`);
    process.env.FACEBOOK_PAGE_ID = pageIdDigits;
  }
  
  // FACEBOOK_GRAPH_VERSION - formato v\d+\.\d+ (default v23.0)
  let graphVersion = process.env.FACEBOOK_GRAPH_VERSION || 'v23.0';
  if (!/^v\d+\.\d+$/.test(graphVersion.trim())) {
    console.log(`[Env Loader] ⚠️ FACEBOOK_GRAPH_VERSION formato inválido: '${graphVersion}', usando v23.0`);
    process.env.FACEBOOK_GRAPH_VERSION = 'v23.0';
  }
  
  // Si hay errores, lanzar el primero
  if (errors.length > 0) {
    throw new ConfigError(errors[0]);
  }
  
  // Log seguro (enmascarar secretos)
  const finalAppId = digitsOnly(process.env.FACEBOOK_APP_ID);
  const finalPageId = process.env.FACEBOOK_PAGE_ID;
  const finalGraphVersion = process.env.FACEBOOK_GRAPH_VERSION;
  
  console.log(`[Config] loaded=${loadedPath} appId=****${finalAppId.slice(-5)} len=${finalAppId.length} graph=${finalGraphVersion} pageId=${finalPageId}`);
  console.log('[Env Loader] === CARGA COMPLETADA ===\n');
  
  return {
    loadedPath,
    variables: loadedVars
  };
}

/**
 * Exporta un objeto env que siempre lee de process.env (sin caché)
 */
const env = {
  get appId() {
    return process.env.FACEBOOK_APP_ID || '';
  },
  
  get appSecret() {
    return process.env.FACEBOOK_APP_SECRET || '';
  },
  
  get pageId() {
    return process.env.FACEBOOK_PAGE_ID || '';
  },
  
  get pageToken() {
    return process.env.FACEBOOK_PAGE_TOKEN || '';
  },
  
  get graphVersion() {
    return process.env.FACEBOOK_GRAPH_VERSION || 'v23.0';
  }
};

// Cargar variables al importar el módulo
try {
  loadEnvironment();
} catch (error) {
  console.error('[Env Loader] ❌ Error crítico:', error.message);
  // No lanzar error aquí para evitar crash al importar
}

// Exportar funciones y objeto env
module.exports = {
  loadEnvironment,
  normalizeValue,
  digitsOnly,
  env,
  ConfigError
};