// server/scripts/migrate-add-manual-frequency.js
// Migración: Agregar soporte para frecuencia 'manual' en AiConfig
// Ejecutar solo si es necesario: node server/scripts/migrate-add-manual-frequency.js

const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/levantatecuba');
    console.log('✅ Conectado a MongoDB');

    const AiConfig = mongoose.model('AiConfig');
    
    // Obtener configuración actual
    const config = await AiConfig.findOne({ singleton: true });
    
    if (!config) {
      console.log('⚠️  No hay configuración existente. Se creará una nueva al iniciar el servidor.');
      return;
    }
    
    console.log(`📋 Configuración actual: scanFrequency = "${config.scanFrequency}"`);
    
    // Verificar si el valor actual es válido
    const validFrequencies = ['manual', '2h', '3h', '4h', '6h', '12h', '24h'];
    
    if (!validFrequencies.includes(config.scanFrequency)) {
      console.log(`⚠️  Frecuencia inválida detectada: "${config.scanFrequency}"`);
      console.log('🔧 Corrigiendo a "3h" (default)...');
      
      config.scanFrequency = '3h';
      await config.save();
      
      console.log('✅ Frecuencia corregida');
    } else {
      console.log('✅ Frecuencia válida, no se requieren cambios');
    }
    
    console.log('\n✅ Migración completada');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
}

// Ejecutar migración
migrate();
