// scripts/validate-image-config.js
/**
 * Script de validación de configuración de imágenes IA
 * Verifica que los flags estén correctamente configurados
 * 
 * Uso: node scripts/validate-image-config.js
 */

require('dotenv').config();

const { IMG, logConfig } = require('../server/config/image');

console.log('\n🔍 Validando configuración de sistema de imágenes...\n');

// Mostrar configuración actual
logConfig();

console.log('\n📋 Análisis de configuración:\n');

// Detectar modo activo
let modeDescription = '';
let modeIcon = '';

if (IMG.PROMPT_MODE === 'raw' || IMG.DISABLE_AUTO_CONTEXT) {
  modeDescription = 'MODO RAW - Prompt passthrough sin modificaciones';
  modeIcon = '🚀';
} else if (IMG.PROMPT_MODE === 'minimal') {
  modeDescription = 'MODO MINIMAL - Enriquecimiento mínimo';
  modeIcon = '⚡';
} else {
  modeDescription = 'MODO AUGMENTED - Pipeline completo con validaciones';
  modeIcon = '🛡️';
}

console.log(`${modeIcon} ${modeDescription}\n`);

// Validaciones
const checks = [];

// Check 1: Consistencia modo raw
if (IMG.PROMPT_MODE === 'raw') {
  if (!IMG.DISABLE_AUTO_CONTEXT) {
    checks.push({
      status: 'warning',
      message: 'IMG_PROMPT_MODE=raw pero IMG_DISABLE_AUTO_CONTEXT=false. Considera activarlo para bypass completo.'
    });
  } else {
    checks.push({
      status: 'ok',
      message: 'Modo raw correctamente configurado con auto-context desactivado.'
    });
  }
}

// Check 2: Anti-texto
if (IMG.DISABLE_ANTI_TEXT && !IMG.FORCE_PROVIDER) {
  checks.push({
    status: 'info',
    message: 'Anti-texto desactivado. DALL-E 3 seguirá bloqueando texto legible a nivel de proveedor.'
  });
}

// Check 3: Proveedor forzado
if (IMG.FORCE_PROVIDER) {
  checks.push({
    status: 'info',
    message: `Proveedor forzado: ${IMG.FORCE_PROVIDER}. Toda lógica interna de selección será ignorada.`
  });
}

// Check 4: Modo producción vs desarrollo
const isProduction = IMG.PROMPT_MODE === 'augmented' && 
                      !IMG.DISABLE_PERSON_DETECTOR && 
                      !IMG.DISABLE_QA_RULES;

if (isProduction) {
  checks.push({
    status: 'ok',
    message: '✅ Configuración de PRODUCCIÓN detectada (todas las validaciones activas).'
  });
} else {
  checks.push({
    status: 'warning',
    message: '⚠️ Configuración de DESARROLLO/TESTING detectada. No recomendado para producción.'
  });
}

// Check 5: Variables faltantes críticas
const criticalVars = ['OPENAI_API_KEY'];
const missingVars = criticalVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  checks.push({
    status: 'error',
    message: `❌ Variables críticas faltantes: ${missingVars.join(', ')}`
  });
}

// Mostrar resultados
console.log('🔬 Resultados de validación:\n');

checks.forEach(check => {
  const icons = {
    ok: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️'
  };
  
  console.log(`${icons[check.status]} ${check.message}`);
});

console.log('\n');

// Recomendaciones según configuración
console.log('💡 Recomendaciones:\n');

if (IMG.PROMPT_MODE === 'raw') {
  console.log('• MODO RAW activo: Los prompts pasarán sin modificaciones al proveedor.');
  console.log('• Asegúrate de no incluir nombres de figuras públicas en los prompts.');
  console.log('• Si necesitas texto en imágenes, considera IMG_FORCE_PROVIDER=stable-diffusion.');
}

if (!IMG.DISABLE_PERSON_DETECTOR && IMG.PROMPT_MODE !== 'raw') {
  console.log('• PersonDetector activo: Detectará figuras públicas y aplicará modo likeness.');
}

if (!IMG.DISABLE_EDITORIAL_MODE && IMG.PROMPT_MODE !== 'raw') {
  console.log('• Editorial Mode activo: Buscará imágenes reales vía Bing (requiere BING_IMAGE_SEARCH_API_KEY).');
}

if (IMG.DISABLE_AUTO_NEGATIVE && IMG.DISABLE_ANTI_TEXT) {
  console.log('• ⚠️ Sin negativos ni anti-texto: DALL-E puede generar imágenes con texto/logos.');
}

console.log('\n📊 Resumen:\n');
console.log(`Modo: ${IMG.PROMPT_MODE.toUpperCase()}`);
console.log(`Proveedor: ${IMG.FORCE_PROVIDER || IMG.DEFAULT_PROVIDER}`);
console.log(`Filtros activos: ${Object.keys(IMG).filter(k => k.startsWith('DISABLE') && !IMG[k]).length}/6`);
console.log(`Estado: ${missingVars.length === 0 ? '✅ Listo para usar' : '❌ Configuración incompleta'}`);

console.log('\n');

// Exit code
process.exit(missingVars.length > 0 ? 1 : 0);
