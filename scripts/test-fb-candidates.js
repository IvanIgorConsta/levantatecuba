/**
 * Script de prueba para verificar que los candidatos de Facebook coincidan
 * entre el scheduler y el backend
 * 
 * Uso: node scripts/test-fb-candidates.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { getFacebookScheduleSummary, isNewsAFacebookCandidate } = require('../server/redactor_ia/services/facebookAutoPublisher');
const News = require('../server/models/News');

async function testCandidates() {
  try {
    console.log('🔍 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Conectado\n');
    
    // 1. Obtener resumen del scheduler
    console.log('📊 Obteniendo resumen del scheduler...');
    const summary = await getFacebookScheduleSummary();
    console.log(`   Candidatos según scheduler: ${summary.candidatesCount}`);
    console.log(`   Publicados hoy: ${summary.publishedToday}`);
    console.log(`   Habilitado: ${summary.enabled}`);
    console.log('');
    
    // 2. Obtener todas las noticias published sin Facebook
    console.log('🔍 Buscando noticias published sin Facebook...');
    const allPublished = await News.find({
      status: 'published',
      $and: [
        {
          $or: [
            { publishedToFacebook: false },
            { publishedToFacebook: { $exists: false } }
          ]
        },
        {
          $or: [
            { facebook_status: 'not_shared' },
            { facebook_status: { $exists: false } }
          ]
        }
      ]
    })
    .select('_id titulo status publishedToFacebook facebook_status publishedAt categoria isEvergreen')
    .lean();
    
    console.log(`   Total noticias base: ${allPublished.length}\n`);
    
    // 3. Filtrar con isNewsAFacebookCandidate
    console.log('✨ Aplicando filtros de frescura...');
    const realCandidates = allPublished.filter(news => isNewsAFacebookCandidate(news));
    const notCandidates = allPublished.filter(news => !isNewsAFacebookCandidate(news));
    
    console.log(`   Candidatos reales: ${realCandidates.length}`);
    console.log(`   Excluidos por frescura: ${notCandidates.length}\n`);
    
    // 4. Verificar coincidencia
    const match = summary.candidatesCount === realCandidates.length;
    console.log('═══════════════════════════════════════════════════');
    console.log('📈 RESULTADO:');
    console.log(`   Scheduler:  ${summary.candidatesCount} candidatos`);
    console.log(`   Backend:    ${realCandidates.length} candidatos`);
    console.log(`   Coinciden:  ${match ? '✅ SÍ' : '❌ NO'}`);
    console.log('═══════════════════════════════════════════════════\n');
    
    // 5. Mostrar candidatos reales
    if (realCandidates.length > 0) {
      console.log('✅ CANDIDATOS REALES (aparecerán con etiqueta "FB pendiente"):');
      realCandidates.forEach((n, i) => {
        const age = Math.floor((Date.now() - new Date(n.publishedAt)) / (1000 * 60 * 60 * 24));
        console.log(`   ${i + 1}. [${n.categoria}] ${n.titulo.substring(0, 60)}...`);
        console.log(`      Edad: ${age} días | ID: ${n._id}`);
      });
      console.log('');
    }
    
    // 6. Mostrar noticias excluidas (primeras 10)
    if (notCandidates.length > 0) {
      console.log('❌ EXCLUIDOS POR FRESCURA (NO aparecerán con etiqueta):');
      notCandidates.slice(0, 10).forEach((n, i) => {
        const age = Math.floor((Date.now() - new Date(n.publishedAt)) / (1000 * 60 * 60 * 24));
        let maxAge = 5;
        if (n.categoria === 'Cuba' || n.categoria === 'Tendencia' || n.categoria === 'Tecnología') {
          maxAge = 7;
        }
        const reason = age > maxAge ? `${age}d > ${maxAge}d máx` : 'otro motivo';
        console.log(`   ${i + 1}. [${n.categoria}] ${n.titulo.substring(0, 50)}...`);
        console.log(`      Razón: ${reason} | ID: ${n._id}`);
      });
      if (notCandidates.length > 10) {
        console.log(`   ... y ${notCandidates.length - 10} más\n`);
      }
    }
    
    // 7. Desglose por categoría
    console.log('\n📊 DESGLOSE POR CATEGORÍA (candidatos reales):');
    const byCategory = realCandidates.reduce((acc, n) => {
      const cat = n.categoria || 'Sin categoría';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});
    Object.entries(byCategory).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });
    
    // 8. Verificación final
    console.log('\n═══════════════════════════════════════════════════');
    if (match) {
      console.log('✅ TODO CORRECTO');
      console.log('   Los números coinciden perfectamente.');
      console.log('   La etiqueta "FB pendiente" aparecerá solo en los');
      console.log(`   ${realCandidates.length} candidatos reales listados arriba.`);
    } else {
      console.log('⚠️  ADVERTENCIA: Discrepancia detectada');
      console.log(`   Scheduler: ${summary.candidatesCount}`);
      console.log(`   Backend:   ${realCandidates.length}`);
      console.log('   Revisa los logs para más detalles.');
    }
    console.log('═══════════════════════════════════════════════════\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testCandidates();
