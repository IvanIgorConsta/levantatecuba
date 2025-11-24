// test-hailuo.js - Test de integración Hailuo (MiniMax)
require('dotenv').config();
const { providerHailuo } = require('./services/imageProvider');

async function testHailuoIntegration() {
  console.log('🧪 Test de integración Hailuo (MiniMax)\n');
  
  // Verificar variables de entorno
  console.log('📋 Variables de entorno:');
  console.log(`   MINIMAX_API_KEY: ${process.env.MINIMAX_API_KEY ? '✅ Configurada' : '❌ No configurada'}`);
  console.log(`   MINIMAX_IMAGE_BASE_URL: ${process.env.MINIMAX_IMAGE_BASE_URL || 'https://api.minimax.io (default)'}\n`);
  
  if (!process.env.MINIMAX_API_KEY) {
    console.error('❌ Error: MINIMAX_API_KEY no configurada en .env');
    process.exit(1);
  }
  
  console.log('🎨 Generando imagen de prueba...\n');
  
  try {
    const result = await providerHailuo({
      prompt: 'Editorial illustration showing a newspaper editor working at a modern desk with digital screens, cinematic composition, professional journalism setting, vivid colors',
      title: 'Test de integración Hailuo',
      summary: 'Verificación de funcionamiento del proveedor Hailuo',
      category: 'Tecnología',
      draftId: 'test-' + Date.now(),
      tags: ['test', 'hailuo'],
      sources: [],
      draft: null,
      _imageContext: {
        theme: 'general',
        locale: 'es-CU',
        style: 'news_photojournalism',
        keywords: ['editorial', 'periodismo']
      }
    });
    
    if (result.ok) {
      console.log('✅ Generación exitosa\n');
      console.log('📊 Resultado:');
      console.log(`   Provider: ${result.provider}`);
      console.log(`   Kind: ${result.kind}`);
      console.log(`   Buffer size: ${result.buffer ? (result.buffer.length / 1024).toFixed(1) + 'KB' : 'N/A'}`);
      console.log(`   MIME type: ${result.mimeType}`);
      console.log(`   Attempt: ${result.attempt}`);
      console.log(`   Prompt level: ${result.promptLevel}`);
      
      if (result.imageMeta) {
        console.log('\n🏷️  Metadata:');
        console.log(`   Provider: ${result.imageMeta.provider}`);
        console.log(`   Variant: ${result.imageMeta.variant}`);
        console.log(`   Context: ${result.imageMeta.context}`);
        console.log(`   Keywords: [${result.imageMeta.contextKeywords.join(', ')}]`);
      }
      
      console.log('\n✅ TEST EXITOSO - Hailuo funcionando correctamente');
    } else {
      console.error('❌ Error en generación:', result.error);
      console.error('   Error code:', result.errorCode);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    if (error.response) {
      console.error('   HTTP status:', error.response.status);
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Ejecutar test
testHailuoIntegration()
  .then(() => {
    console.log('\n🎉 Test completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test falló:', error.message);
    process.exit(1);
  });
