// server/config/image.js
/**
 * Configuración centralizada para generación de imágenes IA
 * Sistema de flags para control quirúrgico del pipeline
 * 
 * Por defecto: MODO RAW/PASSTHROUGH (todos los filtros desactivados)
 * - No PersonDetector
 * - No Editorial mode
 * - No QA rules
 * - No Anti-text forzado
 * - No Auto-context/tema
 * - No Negativos automáticos
 */

/**
 * Configuración de flags de imagen
 * Cada flag puede activarse/desactivarse vía .env
 */
const IMG = {
  // DETECCIÓN DE PERSONAS: Detecta nombres propios y aplica modo likeness
  DISABLE_PERSON_DETECTOR: process.env.IMG_DISABLE_PERSON_DETECTOR === 'true',
  
  // MODO EDITORIAL: Busca imágenes reales de personas públicas vía Bing
  DISABLE_EDITORIAL_MODE: process.env.IMG_DISABLE_EDITORIAL_MODE === 'true',
  
  // REGLAS QA: Validaciones heurísticas de contexto
  DISABLE_QA_RULES: process.env.IMG_DISABLE_QA_RULES === 'true',
  
  // ANTI-TEXTO: Inyección automática de "NO text, NO logos..."
  DISABLE_ANTI_TEXT: process.env.IMG_DISABLE_ANTI_TEXT === 'true',
  
  // AUTO-CONTEXT: ContextBuilder/ImageTheme selecciona tema automáticamente
  DISABLE_AUTO_CONTEXT: process.env.IMG_DISABLE_AUTO_CONTEXT === 'true',
  
  // AUTO-NEGATIVE: Negativos automáticos basados en contexto
  DISABLE_AUTO_NEGATIVE: process.env.IMG_DISABLE_AUTO_NEGATIVE === 'true',
  
  // MODO DE PROMPT: raw | minimal | augmented
  // - raw: prompt crudo del usuario sin modificar
  // - minimal: mínimo enriquecimiento (editorial realism)
  // - augmented: contexto completo (tema + keywords + negativos)
  PROMPT_MODE: process.env.IMG_PROMPT_MODE || 'raw',
  
  // PROVEEDOR POR DEFECTO
  DEFAULT_PROVIDER: process.env.IMG_DEFAULT_PROVIDER || 'dall-e-3',
  
  // FORZAR PROVEEDOR (ignora lógica interna)
  FORCE_PROVIDER: process.env.IMG_FORCE_PROVIDER || null,
  
  // MODO QA MINIMAL (solo anti-texto, sin negativos de contexto)
  QA_MINIMAL: process.env.IMG_THEME_QA_MINIMAL !== 'false', // Default true
  
  // EDITORIAL MODE (búsqueda de imágenes reales)
  USE_EDITORIAL_COVER: process.env.IMG_USE_EDITORIAL_COVER !== 'false', // Default true
  
  // STRICT MODE: Requiere contexto mínimo (título + 1 dato fuerte) o usa placeholder
  STRICT_MODE: process.env.IMAGE_STRICT_MODE === 'true', // Default false
  
  // DEFAULT STYLE: Estilo por defecto para noticias
  DEFAULT_STYLE: process.env.IMAGE_DEFAULT_STYLE || 'news_photojournalism',
  
  // NEGATIVE DEFAULT: Negativos por defecto (además de anti-texto)
  NEGATIVE_DEFAULT: process.env.IMAGE_NEGATIVE_DEFAULT || 'fantasy art, anime, futuristic sci-fi, cartoon style',
  
  // LOCALE: Idioma por defecto para contexto
  DEFAULT_LOCALE: process.env.IMAGE_DEFAULT_LOCALE || 'es-CU',
  
  // PIPELINE MODE: 'simple' | 'augmented'
  // - simple: contenido → prompt → proveedor → guardar (sin detectores/resolvers)
  // - augmented: pipeline completo con PersonDetector, EditorialResolver, ImageTheme, etc.
  PIPELINE_MODE: process.env.IMAGE_PIPELINE_MODE || 'augmented',
  
  // PROMPT SANITIZER: Activa sanitización de prompts con vocabulario sensible
  PROMPT_SANITIZER: process.env.IMAGE_PROMPT_SANITIZER !== 'off', // Default on
  
  // RAW MODE AUTO-DISABLE: Desactiva RAW mode si se detecta contenido sensible
  RAW_AUTO_DISABLE_ON_SENSITIVE: process.env.IMAGE_RAW_MODE !== 'force' // Default true (excepto si RAW es forzado)
};

/**
 * Verifica si el pipeline está en modo simple
 * @returns {boolean}
 */
function isSimpleMode() {
  return IMG.PIPELINE_MODE === 'simple';
}

/**
 * Verifica si el pipeline está en modo raw/passthrough
 * @returns {boolean}
 */
function isRawMode() {
  return IMG.PROMPT_MODE === 'raw' || IMG.DISABLE_AUTO_CONTEXT;
}

/**
 * Verifica si los filtros anti-texto están activos
 * @returns {boolean}
 */
function isAntiTextEnabled() {
  return !IMG.DISABLE_ANTI_TEXT;
}

/**
 * Obtiene el proveedor efectivo (forzado o por defecto)
 * @returns {string}
 */
function getEffectiveProvider() {
  return IMG.FORCE_PROVIDER || IMG.DEFAULT_PROVIDER;
}

/**
 * Verifica si el sanitizador de prompts está activo
 * @returns {boolean}
 */
function isSanitizerEnabled() {
  return IMG.PROMPT_SANITIZER;
}

/**
 * Log de estado de configuración (para debugging)
 */
function logConfig() {
  console.log('[ImageConfig] 🎛️ Configuración activa:');
  console.log(`  - Pipeline Mode: ${IMG.PIPELINE_MODE.toUpperCase()}${isSimpleMode() ? ' (SIMPLIFIED)' : ' (FULL)'}`);
  console.log(`  - PersonDetector: ${IMG.DISABLE_PERSON_DETECTOR ? '❌ DISABLED' : '✅ ENABLED'}`);
  console.log(`  - Editorial Mode: ${IMG.DISABLE_EDITORIAL_MODE ? '❌ DISABLED' : '✅ ENABLED'}`);
  console.log(`  - QA Rules: ${IMG.DISABLE_QA_RULES ? '❌ DISABLED' : '✅ ENABLED'}`);
  console.log(`  - Anti-Text: ${IMG.DISABLE_ANTI_TEXT ? '❌ DISABLED' : '✅ ENABLED'}`);
  console.log(`  - Auto Context: ${IMG.DISABLE_AUTO_CONTEXT ? '❌ DISABLED' : '✅ ENABLED'}`);
  console.log(`  - Auto Negative: ${IMG.DISABLE_AUTO_NEGATIVE ? '❌ DISABLED' : '✅ ENABLED'}`);
  console.log(`  - Prompt Mode: ${IMG.PROMPT_MODE.toUpperCase()}`);
  console.log(`  - Provider: ${getEffectiveProvider()}${IMG.FORCE_PROVIDER ? ' (FORCED)' : ''}`);
  console.log(`  - Strict Mode: ${IMG.STRICT_MODE ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log(`  - Prompt Sanitizer: ${IMG.PROMPT_SANITIZER ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log(`  - RAW Auto-Disable: ${IMG.RAW_AUTO_DISABLE_ON_SENSITIVE ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log(`  - Default Style: ${IMG.DEFAULT_STYLE}`);
  console.log(`  - Locale: ${IMG.DEFAULT_LOCALE}`);
}

module.exports = {
  IMG,
  isSimpleMode,
  isRawMode,
  isAntiTextEnabled,
  getEffectiveProvider,
  isSanitizerEnabled,
  logConfig
};
