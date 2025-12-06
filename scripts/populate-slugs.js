/**
 * Script para poblar slugs en noticias existentes
 * Ejecutar una sola vez: node scripts/populate-slugs.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
const mongoose = require('mongoose');
const News = require('../server/models/News');

async function populateSlugs() {
  try {
    // Conectar a MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/levantatecuba';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');

    // Buscar noticias sin slug
    const newsWithoutSlug = await News.find({ 
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: '' }
      ]
    });

    console.log(`📰 Encontradas ${newsWithoutSlug.length} noticias sin slug`);

    let updated = 0;
    let errors = 0;

    for (const news of newsWithoutSlug) {
      try {
        // El pre-save hook generará el slug automáticamente
        await news.save();
        updated++;
        console.log(`  ✅ ${news._id}: "${news.titulo.substring(0, 50)}..." → ${news.slug}`);
      } catch (err) {
        errors++;
        console.error(`  ❌ ${news._id}: ${err.message}`);
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Actualizadas: ${updated}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log(`   📰 Total procesadas: ${newsWithoutSlug.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

populateSlugs();
