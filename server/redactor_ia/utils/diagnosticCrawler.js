// server/redactor_ia/utils/diagnosticCrawler.js
// Script standalone para diagnosticar crawler NewsAPI

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const AiConfig = require('../../models/AiConfig');

async function runDiagnostic() {
  console.log('🔧 FASE 2 — Diagnóstico Crawler NewsAPI\n');
  console.log('═'.repeat(60));
  
  try {
    // Conectar a MongoDB
    console.log('📡 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado\n');
    
    const config = await AiConfig.getSingleton();
    
    // 1. Verificar config en BD
    console.log('1️⃣  CONFIGURACIÓN EN BASE DE DATOS');
    console.log('═'.repeat(60));
    console.log(`   newsApiEnabled: ${config.newsApiEnabled}`);
    console.log(`   API Key presente: ${config.newsApiKey ? 'SÍ' : 'NO'}`);
    console.log(`   API Key length: ${config.newsApiKey?.length || 0}`);
    console.log(`   API Key (últimos 4): ${config.newsApiKey ? '***' + config.newsApiKey.slice(-4) : 'NONE'}`);
    console.log(`   enforceSourceAllowlist: ${config.enforceSourceAllowlist}`);
    console.log(`   cubaKeywords: ${config.cubaKeywords.length} keywords`);
    console.log(`   maxTopicsPerScan: ${config.maxTopicsPerScan}`);
    console.log(`   scanFrequency: ${config.scanFrequency}\n`);
    
    // 2. Verificar variables de entorno
    console.log('2️⃣  VARIABLES DE ENTORNO');
    console.log('═'.repeat(60));
    console.log(`   NEWS_API_KEY presente en .env: ${process.env.NEWS_API_KEY ? 'SÍ' : 'NO'}`);
    console.log(`   .env Key length: ${process.env.NEWS_API_KEY?.length || 0}`);
    console.log(`   .env Key (últimos 4): ${process.env.NEWS_API_KEY ? '***' + process.env.NEWS_API_KEY.slice(-4) : 'NONE'}`);
    console.log(`   Keys coinciden: ${config.newsApiKey === process.env.NEWS_API_KEY ? '✅ SÍ' : '❌ NO'}\n`);
    
    if (!config.newsApiKey) {
      console.log('❌ PROBLEMA CRÍTICO: No hay API Key en la configuración de BD');
      console.log('   Causa probable: El singleton se creó antes de cargar .env');
      console.log('   Fix: Ejecutar sincronización manual\n');
      
      console.log('🔧 ¿Deseas sincronizar ahora? Ejecutando...');
      await AiConfig.findOneAndUpdate(
        { singleton: true },
        { newsApiKey: process.env.NEWS_API_KEY },
        { upsert: true }
      );
      console.log('✅ API Key sincronizada desde .env a BD\n');
      
      // Recargar config
      const updatedConfig = await AiConfig.getSingleton();
      console.log(`   Nueva API Key en BD: ***${updatedConfig.newsApiKey.slice(-4)}\n`);
    }
    
    const apiKey = config.newsApiKey || process.env.NEWS_API_KEY;
    
    if (!apiKey) {
      console.log('❌ FATAL: No hay API Key disponible ni en BD ni en .env');
      console.log('   Verificar archivo .env y NEWS_API_KEY\n');
      process.exit(1);
    }
    
    // 3. Test #1: Query simple con filtro temporal
    console.log('3️⃣  TEST #1: Query simple + filtro temporal (72h)');
    console.log('═'.repeat(60));
    try {
      const fromDate = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: 'Cuba',
          language: 'es',
          from: fromDate.toISOString().split('T')[0],
          sortBy: 'publishedAt',
          pageSize: 20,
          apiKey: apiKey
        },
        timeout: 10000
      });
      
      console.log(`   ✅ SUCCESS`);
      console.log(`   Query: "Cuba"`);
      console.log(`   From: ${fromDate.toISOString().split('T')[0]}`);
      console.log(`   Total Results: ${response.data.totalResults}`);
      console.log(`   Articles Returned: ${response.data.articles?.length || 0}`);
      
      if (response.data.articles?.length > 0) {
        console.log(`\n   📰 Muestra de títulos:`);
        response.data.articles.slice(0, 3).forEach((article, i) => {
          console.log(`      ${i + 1}. ${article.title}`);
        });
      }
      console.log('');
    } catch (error) {
      console.log(`   ❌ FAILED`);
      console.log(`   HTTP Status: ${error.response?.status}`);
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
      console.log(`   Sugerencia: ${getErrorSuggestion(error.response?.status)}\n`);
    }
    
    // 4. Test #2: Sin filtro temporal (código actual)
    console.log('4️⃣  TEST #2: Keywords sin filtro temporal (código actual)');
    console.log('═'.repeat(60));
    try {
      const keywords = config.cubaKeywords.slice(0, 3).join(' OR ');
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: keywords,
          language: 'es',
          sortBy: 'publishedAt',
          pageSize: 50,
          apiKey: apiKey
        },
        timeout: 10000
      });
      
      console.log(`   ✅ SUCCESS`);
      console.log(`   Query: "${keywords}"`);
      console.log(`   Total Results: ${response.data.totalResults}`);
      console.log(`   Articles Returned: ${response.data.articles?.length || 0}`);
      
      if (response.data.totalResults === 0) {
        console.log(`   ⚠️  WARNING: Sin filtro temporal retorna 0 resultados`);
      }
      console.log('');
    } catch (error) {
      console.log(`   ❌ FAILED`);
      console.log(`   HTTP Status: ${error.response?.status}`);
      console.log(`   Error: ${error.response?.data?.message || error.message}\n`);
    }
    
    // 5. Test #3: Query completa con filtro temporal
    console.log('5️⃣  TEST #3: Todos los keywords + filtro temporal');
    console.log('═'.repeat(60));
    try {
      const fromDate = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const fullKeywords = config.cubaKeywords.join(' OR ');
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: fullKeywords,
          language: 'es',
          from: fromDate.toISOString().split('T')[0],
          sortBy: 'publishedAt',
          pageSize: 50,
          apiKey: apiKey
        },
        timeout: 10000
      });
      
      console.log(`   ✅ SUCCESS`);
      console.log(`   Query length: ${fullKeywords.length} chars`);
      console.log(`   Total Results: ${response.data.totalResults}`);
      console.log(`   Articles Returned: ${response.data.articles?.length || 0}\n`);
    } catch (error) {
      console.log(`   ❌ FAILED`);
      console.log(`   HTTP Status: ${error.response?.status}`);
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
      console.log(`   ⚠️  Query puede ser demasiado larga\n`);
    }
    
    // Resumen
    console.log('6️⃣  RESUMEN Y RECOMENDACIONES');
    console.log('═'.repeat(60));
    console.log('   ✅ Diagnóstico completado');
    console.log('   📊 Resultados disponibles arriba');
    console.log('');
    console.log('   💡 Recomendaciones:');
    console.log('      1. Si TEST #1 es exitoso → Aplicar Fix #1 (añadir filtro temporal)');
    console.log('      2. Si todos fallan con 401 → Verificar API Key en NewsAPI.org');
    console.log('      3. Si todos fallan con 429 → Rate limit excedido, esperar 24h');
    console.log('      4. Si TEST #2 retorna 0 → Confirma que filtro temporal es necesario\n');
    
  } catch (error) {
    console.error('❌ Error fatal en diagnóstico:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Desconectado de MongoDB');
  }
}

function getErrorSuggestion(status) {
  const suggestions = {
    401: 'API Key inválida o expirada. Verificar en https://newsapi.org/account',
    403: 'Acceso denegado. Verificar permisos de la API Key',
    429: 'Rate limit excedido (100 requests/día en plan gratuito). Esperar 24h o upgrade',
    426: 'Upgrade Required. NewsAPI requiere plan de pago para esta operación',
    500: 'Error del servidor de NewsAPI. Reintentar más tarde'
  };
  return suggestions[status] || 'Error desconocido';
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runDiagnostic()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runDiagnostic };
