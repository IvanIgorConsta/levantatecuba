// scripts/check-drafts-db.js
/**
 * Script de diagnóstico rápido para verificar datos en MongoDB
 * Ejecutar con: node scripts/check-drafts-db.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AiDraft = require('../server/models/AiDraft');

async function checkDrafts() {
  try {
    console.log('🔍 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado\n');

    // 1. Conteo total
    const total = await AiDraft.countDocuments();
    console.log(`📊 Total de AiDrafts en BD: ${total}`);

    if (total === 0) {
      console.log('\n⚠️ NO HAY BORRADORES EN LA BASE DE DATOS\n');
      console.log('Para crear un borrador de prueba, ejecuta:');
      console.log('  node scripts/create-test-draft.js\n');
      await mongoose.disconnect();
      return;
    }

    // 2. Agrupación por status
    const byStatus = await AiDraft.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('\n📈 Borradores por status:');
    byStatus.forEach(({ _id, count }) => {
      console.log(`  - ${_id || 'undefined'}: ${count}`);
    });

    // 3. Agrupación por tenantId
    const byTenant = await AiDraft.aggregate([
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('\n🏢 Borradores por tenantId:');
    byTenant.forEach(({ _id, count }) => {
      console.log(`  - "${_id || 'undefined'}": ${count}`);
    });

    // 4. Específico: filtro que usa el frontend
    const targetQuery = {
      tenantId: 'levantatecuba',
      status: 'draft'
    };
    const targetCount = await AiDraft.countDocuments(targetQuery);
    console.log(`\n🎯 Borradores con query del frontend:`);
    console.log(`   ${JSON.stringify(targetQuery)}`);
    console.log(`   Resultado: ${targetCount} borradores\n`);

    if (targetCount === 0) {
      console.log('⚠️ NO HAY BORRADORES QUE CUMPLAN EL FILTRO\n');
      
      // Mostrar samples para diagnóstico
      const samples = await AiDraft.find().limit(3).select('tenantId status titulo createdAt');
      if (samples.length > 0) {
        console.log('📝 Muestra de borradores existentes:');
        samples.forEach((s, i) => {
          console.log(`  ${i + 1}. tenantId="${s.tenantId}" status="${s.status}" titulo="${s.titulo.substring(0, 50)}..."`);
        });
        console.log('\n💡 Verifica que tenantId coincida exactamente (case-sensitive)\n');
      }
    } else {
      console.log(`✅ Hay ${targetCount} borradores que deberían aparecer en el frontend\n`);
    }

    await mongoose.disconnect();
    console.log('👋 Desconectado de MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkDrafts();
