// server/scripts/create-indexes.js
// Script para crear índices MongoDB en producción
// Ejecutar: node server/scripts/create-indexes.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
const mongoose = require('mongoose');

async function createIndexes() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // ===================================
    // NEWS - Índices adicionales
    // ===================================
    console.log('📰 Creando índices de News...');
    
    await db.collection('news').createIndex(
      { status: 1, publishedToFacebook: 1, publishedAt: -1 },
      { name: 'status_publishedToFacebook_publishedAt' }
    );
    console.log('   ✅ status_publishedToFacebook_publishedAt');
    
    await db.collection('news').createIndex(
      { status: 1, facebook_status: 1 },
      { name: 'status_facebook_status' }
    );
    console.log('   ✅ status_facebook_status');
    
    await db.collection('news').createIndex(
      { destacada: 1, publishedAt: -1 },
      { name: 'destacada_publishedAt' }
    );
    console.log('   ✅ destacada_publishedAt\n');
    
    // ===================================
    // COMMENTS - Índices CRÍTICOS
    // ===================================
    console.log('💬 Creando índices CRÍTICOS de Comments...');
    
    await db.collection('comments').createIndex(
      { noticia: 1, createdAt: -1 },
      { name: 'noticia_createdAt' }
    );
    console.log('   ✅ noticia_createdAt (MÁS IMPORTANTE)');
    
    await db.collection('comments').createIndex(
      { noticia: 1, padre: 1, createdAt: -1 },
      { name: 'noticia_padre_createdAt' }
    );
    console.log('   ✅ noticia_padre_createdAt');
    
    await db.collection('comments').createIndex(
      { userId: 1, createdAt: -1 },
      { name: 'userId_createdAt' }
    );
    console.log('   ✅ userId_createdAt\n');
    
    // ===================================
    // AIDRAFTS - Índices de revisión
    // ===================================
    console.log('📝 Creando índices de AiDrafts...');
    
    await db.collection('aidrafts').createIndex(
      { reviewStatus: 1, approvedAt: -1 },
      { name: 'reviewStatus_approvedAt' }
    );
    console.log('   ✅ reviewStatus_approvedAt');
    
    await db.collection('aidrafts').createIndex(
      { publishStatus: 1, scheduledAt: 1 },
      { name: 'publishStatus_scheduledAt' }
    );
    console.log('   ✅ publishStatus_scheduledAt');
    
    await db.collection('aidrafts').createIndex(
      { status: 1, createdAt: -1 },
      { name: 'status_createdAt' }
    );
    console.log('   ✅ status_createdAt');
    
    await db.collection('aidrafts').createIndex(
      { tenantId: 1, status: 1, reviewStatus: 1 },
      { name: 'tenantId_status_reviewStatus' }
    );
    console.log('   ✅ tenantId_status_reviewStatus\n');
    
    // ===================================
    // RESUMEN
    // ===================================
    console.log('═══════════════════════════════════════════');
    console.log('✅ TODOS LOS ÍNDICES CREADOS EXITOSAMENTE');
    console.log('═══════════════════════════════════════════');
    console.log('📊 Resumen:');
    console.log('   - News: 3 índices adicionales');
    console.log('   - Comments: 3 índices CRÍTICOS (antes NO TENÍA)');
    console.log('   - AiDrafts: 4 índices de revisión');
    console.log('═══════════════════════════════════════════\n');
    
    // Listar todos los índices creados
    console.log('📋 Verificando índices...\n');
    
    const newsIndexes = await db.collection('news').indexes();
    console.log(`📰 News: ${newsIndexes.length} índices totales`);
    
    const commentsIndexes = await db.collection('comments').indexes();
    console.log(`💬 Comments: ${commentsIndexes.length} índices totales`);
    
    const draftsIndexes = await db.collection('aidrafts').indexes();
    console.log(`📝 AiDrafts: ${draftsIndexes.length} índices totales\n`);
    
    console.log('✅ Script completado. Cerrando conexión...');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR AL CREAR ÍNDICES:', error.message);
    console.error('Stack:', error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Ejecutar
createIndexes();
