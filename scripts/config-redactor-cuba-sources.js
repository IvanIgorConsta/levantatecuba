// scripts/config-redactor-cuba-sources.js
// Script para configurar fuentes cubanas prioritarias en Redactor IA

const mongoose = require('mongoose');
require('dotenv').config();

const AiConfig = require('../server/models/AiConfig');

const CUBAN_SOURCES = [
  // Medios independientes cubanos (bypass total)
  'cibercuba.com',
  'eltoque.com',
  '14ymedio.com',
  'diariodecuba.com',
  'cubanet.org',
  'martinoticias.com',
  'adncuba.com',
  'ddcuba.com',
  'cubanosporelmundo.com',
  
  // Medios internacionales con cobertura Cuba
  'bbc.com',
  'reuters.com',
  'apnews.com',
  'elpais.com',
  'cnn.com',
  'nytimes.com',
  'miamiherald.com'
];

async function updateCubanSources() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/levantatecuba');
    console.log('✅ Conectado a MongoDB\n');
    
    const tenantId = 'levantatecuba';
    
    // Buscar configuración existente
    let config = await AiConfig.findOne({ tenantId });
    
    if (!config) {
      console.log('⚠️  No existe configuración, creando nueva...');
      config = new AiConfig({ tenantId });
    }
    
    console.log('📋 Configuración actual:');
    console.log('  - Fuentes actuales:', config.trustedSources?.length || 0);
    console.log('  - Modo Cuba estricto:', config.strictCuba ? 'ON' : 'OFF');
    console.log('  - Max temas/scan:', config.maxTopicsPerScan || 8);
    console.log('  - Ventana frescura:', config.freshnessWindowHours || 48, 'horas\n');
    
    // Actualizar configuración
    config.trustedSources = CUBAN_SOURCES;
    config.enforceSourceAllowlist = true;
    config.strictCuba = true;
    config.maxTopicsPerScan = 20; // Aumentar límite
    config.freshnessWindowHours = 24; // Reducir a 24h para más frescura
    config.perSourceCap = 5; // Máximo 5 artículos por fuente
    config.newsApiEnabled = true;
    
    await config.save();
    
    console.log('✅ Configuración actualizada exitosamente!\n');
    console.log('📋 Nueva configuración:');
    console.log('  - Fuentes confiables:', config.trustedSources.length);
    console.log('  - Modo Cuba estricto: ON ✅');
    console.log('  - Max temas/scan: 20 ✅');
    console.log('  - Ventana frescura: 24 horas ✅');
    console.log('  - Cap por fuente: 5 artículos ✅');
    console.log('  - NewsAPI: HABILITADO ✅\n');
    
    console.log('🔥 Fuentes configuradas:');
    console.log('\n📰 MEDIOS INDEPENDIENTES CUBANOS (bypass total):');
    [
      'cibercuba.com',
      'eltoque.com',
      '14ymedio.com',
      'diariodecuba.com',
      'cubanet.org',
      'martinoticias.com',
      'adncuba.com'
    ].forEach(source => console.log(`  ✅ ${source}`));
    
    console.log('\n🌍 MEDIOS INTERNACIONALES (con filtro keywords):');
    [
      'bbc.com',
      'reuters.com',
      'apnews.com',
      'elpais.com',
      'cnn.com'
    ].forEach(source => console.log(`  ✅ ${source}`));
    
    console.log('\n🎯 Próximo escaneo esperará:');
    console.log('  - 80-120 artículos recopilados');
    console.log('  - 60-90 artículos tras filtro Cuba');
    console.log('  - 15-20 temas finales');
    console.log('  - 90% de CiberCuba + ElToque');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
    process.exit(0);
  }
}

updateCubanSources();
