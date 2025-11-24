// scripts/create-test-draft.js
/**
 * Crea un borrador de prueba para verificar el flujo
 * Ejecutar con: node scripts/create-test-draft.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AiDraft = require('../server/models/AiDraft');

async function createTestDraft() {
  try {
    console.log('🔍 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado\n');

    const testDraft = {
      tenantId: 'levantatecuba',
      topicId: 'test-' + Date.now(),
      titulo: 'Borrador de prueba - Sistema funciona correctamente',
      bajada: 'Este es un borrador de prueba para verificar que el sistema de listado funciona correctamente.',
      categoria: 'Tecnología',
      etiquetas: ['test', 'verificación', 'desarrollo'],
      contenidoMarkdown: '## Contenido de prueba\n\nEste borrador se creó automáticamente para verificar el funcionamiento del sistema.\n\nSi lo ves en el panel de Borradores IA, significa que todo está funcionando correctamente.',
      contenidoHTML: '<h2>Contenido de prueba</h2><p>Este borrador se creó automáticamente para verificar el funcionamiento del sistema.</p><p>Si lo ves en el panel de Borradores IA, significa que todo está funcionando correctamente.</p>',
      mode: 'factual',
      status: 'draft',
      reviewStatus: 'pending',
      generationType: 'manual',
      generatedBy: null, // Null = creado por sistema
      aiMetadata: {
        model: 'test-script',
        confidence: 100,
        originalityScore: 0.8,
        contentOrigin: 'source_derived',
        categoryConfidence: 0.9,
        categoryLowConfidence: false
      }
    };

    const created = await AiDraft.create(testDraft);
    
    console.log('✅ Borrador de prueba creado exitosamente:\n');
    console.log(`   ID: ${created._id}`);
    console.log(`   Título: ${created.titulo}`);
    console.log(`   Status: ${created.status}`);
    console.log(`   TenantId: ${created.tenantId}`);
    console.log(`   ReviewStatus: ${created.reviewStatus}`);
    console.log(`   Creado: ${created.createdAt}\n`);
    console.log('🎯 Este borrador debería aparecer en /admin/redactor-ia pestaña "Borradores"\n');

    await mongoose.disconnect();
    console.log('👋 Desconectado de MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createTestDraft();
