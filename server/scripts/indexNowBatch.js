#!/usr/bin/env node
/**
 * Script de indexación masiva con IndexNow
 * Ejecutar: node server/scripts/indexNowBatch.js
 * 
 * Este script notifica a Bing/Yandex sobre todas las noticias publicadas
 * en las últimas 24-48 horas (o todas si se pasa --all)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const News = require('../models/News');
const { notifyIndexNowBatch, buildNewsUrl } = require('../services/indexNow');

// Configuración
const BATCH_SIZE = 100; // URLs por batch (máximo recomendado)
const DELAY_BETWEEN_BATCHES = 2000; // 2 segundos entre batches

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function indexAllNews(options = {}) {
  const { all = false, days = 2 } = options;
  
  console.log('🔄 Conectando a MongoDB...');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    
    // Query: todas las noticias publicadas o solo las recientes
    const query = { status: 'published' };
    
    if (!all) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      query.createdAt = { $gte: cutoffDate };
    }
    
    const noticias = await News.find(query)
      .select('slug _id titulo createdAt')
      .sort({ createdAt: -1 })
      .lean();
    
    if (noticias.length === 0) {
      console.log('ℹ️ No hay noticias nuevas para indexar');
      return { success: true, indexed: 0 };
    }
    
    console.log(`📰 Encontradas ${noticias.length} noticias para indexar`);
    
    // Construir URLs
    const urls = noticias.map(n => buildNewsUrl(n));
    
    // Agregar páginas estáticas importantes
    const staticUrls = [
      'https://levantatecuba.com/',
      'https://levantatecuba.com/noticias',
      'https://levantatecuba.com/denuncias',
      'https://levantatecuba.com/about',
      'https://levantatecuba.com/tienda'
    ];
    
    const allUrls = [...staticUrls, ...urls];
    console.log(`📡 Total URLs a indexar: ${allUrls.length}`);
    
    // Enviar en batches
    let totalSuccess = 0;
    let totalFailed = 0;
    
    for (let i = 0; i < allUrls.length; i += BATCH_SIZE) {
      const batch = allUrls.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allUrls.length / BATCH_SIZE);
      
      console.log(`\n📤 Batch ${batchNum}/${totalBatches} (${batch.length} URLs)...`);
      
      const result = await notifyIndexNowBatch(batch);
      
      if (result.success) {
        totalSuccess += batch.length;
        console.log(`✅ Batch ${batchNum} enviado correctamente`);
      } else {
        totalFailed += batch.length;
        console.log(`❌ Batch ${batchNum} falló`);
      }
      
      // Mostrar resultados por endpoint
      if (result.results) {
        result.results.forEach(r => {
          const icon = r.success ? '✓' : '✗';
          console.log(`   ${icon} ${r.endpoint}: ${r.status}`);
        });
      }
      
      // Esperar entre batches
      if (i + BATCH_SIZE < allUrls.length) {
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 RESUMEN:`);
    console.log(`   ✅ Exitosas: ${totalSuccess}`);
    console.log(`   ❌ Fallidas: ${totalFailed}`);
    console.log(`   📰 Noticias: ${noticias.length}`);
    console.log('='.repeat(50));
    
    return { 
      success: true, 
      indexed: totalSuccess, 
      failed: totalFailed,
      total: allUrls.length 
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    all: args.includes('--all'),
    days: 2
  };
  
  // Parsear --days=N
  const daysArg = args.find(a => a.startsWith('--days='));
  if (daysArg) {
    options.days = parseInt(daysArg.split('=')[1]) || 2;
  }
  
  console.log('🚀 IndexNow Batch Indexer');
  console.log('========================');
  console.log(`Modo: ${options.all ? 'TODAS las noticias' : `Últimos ${options.days} días`}`);
  console.log('');
  
  indexAllNews(options)
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Error fatal:', err);
      process.exit(1);
    });
}

module.exports = { indexAllNews };
