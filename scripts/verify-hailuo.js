#!/usr/bin/env node
// scripts/verify-hailuo.js - Verificación rápida de integración Hailuo

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('\n🔍 Verificación de integración Hailuo (MiniMax)\n');
console.log('═══════════════════════════════════════════════════\n');

let errors = 0;
let warnings = 0;

// 1. Verificar variables de entorno
console.log('1️⃣  Variables de entorno:');
if (process.env.MINIMAX_API_KEY) {
  console.log('   ✅ MINIMAX_API_KEY configurada');
} else {
  console.log('   ❌ MINIMAX_API_KEY no configurada');
  errors++;
}

const baseUrl = process.env.MINIMAX_IMAGE_BASE_URL || 'https://api.minimax.io';
console.log(`   ℹ️  MINIMAX_IMAGE_BASE_URL: ${baseUrl}`);

// 2. Verificar modelo AiConfig.js
console.log('\n2️⃣  Modelo AiConfig.js:');
const aiConfigPath = path.join(__dirname, '..', 'server', 'models', 'AiConfig.js');
try {
  const aiConfigContent = fs.readFileSync(aiConfigPath, 'utf8');
  
  if (aiConfigContent.includes("'hailuo'") && aiConfigContent.includes("enum:")) {
    console.log('   ✅ Proveedor "hailuo" registrado en enum');
  } else {
    console.log('   ❌ Proveedor "hailuo" NO encontrado en enum');
    errors++;
  }
} catch (error) {
  console.log('   ❌ Error leyendo AiConfig.js:', error.message);
  errors++;
}

// 3. Verificar función providerHailuo()
console.log('\n3️⃣  Función providerHailuo():');
const imageProviderPath = path.join(__dirname, '..', 'server', 'redactor_ia', 'services', 'imageProvider.js');
try {
  const imageProviderContent = fs.readFileSync(imageProviderPath, 'utf8');
  
  if (imageProviderContent.includes('async function providerHailuo')) {
    console.log('   ✅ Función providerHailuo() definida');
  } else {
    console.log('   ❌ Función providerHailuo() NO encontrada');
    errors++;
  }
  
  // Verificar parámetros correctos de API
  if (imageProviderContent.includes('aspect_ratio:') && 
      imageProviderContent.includes('response_format:') &&
      imageProviderContent.includes('prompt_optimizer:')) {
    console.log('   ✅ Parámetros de API correctos (aspect_ratio, response_format, prompt_optimizer)');
  } else {
    console.log('   ⚠️  Parámetros de API podrían estar desactualizados');
    warnings++;
  }
  
  // Verificar case 'hailuo' en switch
  if (imageProviderContent.includes("case 'hailuo':")) {
    console.log('   ✅ Case "hailuo" registrado en generateWithProvider()');
  } else {
    console.log('   ❌ Case "hailuo" NO encontrado en switch');
    errors++;
  }
  
  // Verificar export
  if (imageProviderContent.includes('providerHailuo')) {
    console.log('   ✅ Función exportada en module.exports');
  } else {
    console.log('   ⚠️  providerHailuo podría no estar exportada');
    warnings++;
  }
} catch (error) {
  console.log('   ❌ Error leyendo imageProvider.js:', error.message);
  errors++;
}

// 4. Verificar statsService.js (costos)
console.log('\n4️⃣  Costos en statsService.js:');
const statsServicePath = path.join(__dirname, '..', 'server', 'redactor_ia', 'services', 'statsService.js');
try {
  const statsServiceContent = fs.readFileSync(statsServicePath, 'utf8');
  
  if (statsServiceContent.includes("'hailuo':") && statsServiceContent.includes('0.03')) {
    console.log('   ✅ Costo configurado: $0.03');
  } else {
    console.log('   ⚠️  Costo no configurado o diferente');
    warnings++;
  }
} catch (error) {
  console.log('   ⚠️  No se pudo verificar costos:', error.message);
  warnings++;
}

// 5. Verificar frontend ConfiguracionIA.jsx
console.log('\n5️⃣  Frontend ConfiguracionIA.jsx:');
const configPath = path.join(__dirname, '..', 'src', 'admin_dashboard', 'redactor_ia', 'ConfiguracionIA.jsx');
try {
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  if (configContent.includes('value="hailuo"') && configContent.includes('Hailuo (MiniMax)')) {
    console.log('   ✅ Opción "Hailuo (MiniMax)" disponible en select');
  } else {
    console.log('   ❌ Opción de Hailuo NO encontrada en frontend');
    errors++;
  }
} catch (error) {
  console.log('   ⚠️  No se pudo verificar frontend:', error.message);
  warnings++;
}

// 6. Verificar test
console.log('\n6️⃣  Test de integración:');
const testPath = path.join(__dirname, '..', 'server', 'redactor_ia', 'test-hailuo.js');
if (fs.existsSync(testPath)) {
  console.log('   ✅ Test disponible en: server/redactor_ia/test-hailuo.js');
  console.log('   💡 Ejecutar: cd server/redactor_ia && node test-hailuo.js');
} else {
  console.log('   ⚠️  Test no encontrado (opcional)');
  warnings++;
}

// 7. Verificar documentación
console.log('\n7️⃣  Documentación:');
const docsPath = path.join(__dirname, '..', 'docs', 'HAILUO_MINIMAX_INTEGRATION.md');
if (fs.existsSync(docsPath)) {
  console.log('   ✅ Documentación disponible en: docs/HAILUO_MINIMAX_INTEGRATION.md');
} else {
  console.log('   ⚠️  Documentación no encontrada (opcional)');
  warnings++;
}

// Resumen final
console.log('\n═══════════════════════════════════════════════════\n');
console.log('📊 RESUMEN DE VERIFICACIÓN:\n');

if (errors === 0 && warnings === 0) {
  console.log('   ✅ PERFECTO - Integración completa y sin problemas');
} else if (errors === 0) {
  console.log(`   ⚠️  ${warnings} advertencia(s) encontrada(s) (no críticas)`);
} else {
  console.log(`   ❌ ${errors} error(es) crítico(s) encontrado(s)`);
  console.log(`   ⚠️  ${warnings} advertencia(s) adicional(es)`);
}

console.log('\n💡 SIGUIENTES PASOS:\n');
if (errors > 0) {
  console.log('   1. Corregir errores críticos listados arriba');
  console.log('   2. Re-ejecutar este script de verificación');
  console.log('   3. Ejecutar test de integración cuando esté todo OK\n');
} else if (!process.env.MINIMAX_API_KEY) {
  console.log('   1. Configurar MINIMAX_API_KEY en .env');
  console.log('   2. Ejecutar test: cd server/redactor_ia && node test-hailuo.js');
  console.log('   3. Activar en Admin Dashboard → Redactor IA → Configuración\n');
} else {
  console.log('   1. Ejecutar test: cd server/redactor_ia && node test-hailuo.js');
  console.log('   2. Activar en Admin Dashboard → Redactor IA → Configuración');
  console.log('   3. Generar borrador con imagen para verificar en producción\n');
}

console.log('═══════════════════════════════════════════════════\n');

// Exit code
process.exit(errors > 0 ? 1 : 0);
