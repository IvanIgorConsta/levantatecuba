// scripts/create-comment-indexes.js
// Script para crear índices optimizados en la colección de comentarios
// Ejecutar con: node scripts/create-comment-indexes.js

require('dotenv').config();
const mongoose = require('mongoose');

async function createIndexes() {
  try {
    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const Comment = require('../server/models/Comment');

    console.log('\n📊 Creando índices para optimización...');

    // Índice para comentarios por noticia y parentId (queries principales)
    await Comment.collection.createIndex(
      { noticia: 1, parentId: 1, createdAt: -1 },
      { name: 'noticia_parentId_createdAt' }
    );
    console.log('✅ Índice noticia_parentId_createdAt creado');

    // Índice alternativo para compatibilidad con campo 'padre'
    await Comment.collection.createIndex(
      { noticia: 1, padre: 1, createdAt: -1 },
      { name: 'noticia_padre_createdAt' }
    );
    console.log('✅ Índice noticia_padre_createdAt creado');

    // Índice para buscar comentarios por usuario
    await Comment.collection.createIndex(
      { userId: 1, createdAt: -1 },
      { name: 'userId_createdAt' }
    );
    console.log('✅ Índice userId_createdAt creado');

    // Índice para comentarios raíz (sin padre)
    await Comment.collection.createIndex(
      { noticia: 1, parentId: 1 },
      { 
        name: 'noticia_rootComments',
        partialFilterExpression: { parentId: null }
      }
    );
    console.log('✅ Índice parcial para comentarios raíz creado');

    // Índice para respuestas anidadas
    await Comment.collection.createIndex(
      { parentId: 1, createdAt: -1 },
      { 
        name: 'parentId_replies',
        partialFilterExpression: { parentId: { $ne: null } }
      }
    );
    console.log('✅ Índice parcial para respuestas creado');

    // Listar todos los índices
    console.log('\n📋 Índices actuales en la colección Comment:');
    const indexes = await Comment.collection.indexes();
    indexes.forEach((index, i) => {
      console.log(`  ${i + 1}. ${index.name}:`, Object.keys(index.key));
    });

    console.log('\n🎉 ¡Índices creados exitosamente!');
    console.log('💡 Estos índices mejorarán significativamente el rendimiento de:');
    console.log('   - Carga de comentarios por noticia');
    console.log('   - Paginación de respuestas anidadas');
    console.log('   - Consultas de comentarios por usuario');
    console.log('   - Diferenciación entre comentarios raíz y respuestas');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Desconectado de MongoDB');
    process.exit(0);
  }
}

createIndexes();

