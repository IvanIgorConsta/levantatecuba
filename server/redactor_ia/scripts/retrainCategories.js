// server/redactor_ia/scripts/retrainCategories.js

/**
 * Script de análisis y sugerencias para mejorar clasificación de categorías
 * Analiza feedback editorial y sugiere nuevos sinónimos y ajustes de pesos
 * 
 * Uso: node server/redactor_ia/scripts/retrainCategories.js
 */

const mongoose = require('mongoose');
const AiCategoryFeedback = require('../../models/AiCategoryFeedback');
const categories = require('../config/categories');

async function analyzeFeedback() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/levantatecuba');
    console.log('[Retrain] Conectado a MongoDB');
    
    // Obtener todo el feedback
    const feedback = await AiCategoryFeedback.find({})
      .sort({ createdAt: -1 })
      .limit(500); // Últimos 500 feedbacks
    
    console.log(`\n[Retrain] Analizando ${feedback.length} correcciones...\n`);
    
    // Estadísticas por categoría
    const stats = {};
    categories.allowed.forEach(cat => {
      stats[cat] = { corrections: 0, fromGeneral: 0, totalConfidence: 0 };
    });
    
    feedback.forEach(f => {
      const chosen = f.chosenCategory;
      if (stats[chosen]) {
        stats[chosen].corrections++;
        stats[chosen].totalConfidence += f.originalConfidence;
        if (f.originalCategory === 'General') {
          stats[chosen].fromGeneral++;
        }
      }
    });
    
    // Mostrar estadísticas
    console.log('=== ESTADÍSTICAS DE CORRECCIONES ===\n');
    Object.entries(stats)
      .sort((a, b) => b[1].corrections - a[1].corrections)
      .forEach(([cat, data]) => {
        if (data.corrections > 0) {
          const avgConf = (data.totalConfidence / data.corrections).toFixed(2);
          console.log(`${cat}:`);
          console.log(`  - Total correcciones: ${data.corrections}`);
          console.log(`  - Desde "General": ${data.fromGeneral}`);
          console.log(`  - Confianza promedio original: ${avgConf}`);
          console.log('');
        }
      });
    
    // Análisis TF-IDF simple para sugerir nuevos sinónimos
    console.log('\n=== SUGERENCIAS DE NUEVOS SINÓNIMOS ===\n');
    
    const categoryTexts = {};
    categories.allowed.forEach(cat => {
      categoryTexts[cat] = [];
    });
    
    feedback.forEach(f => {
      const cat = f.chosenCategory;
      if (categoryTexts[cat]) {
        const text = `${f.title} ${f.summary}`.toLowerCase();
        categoryTexts[cat].push(text);
      }
    });
    
    Object.entries(categoryTexts).forEach(([cat, texts]) => {
      if (texts.length === 0) return;
      
      const allText = texts.join(' ');
      const words = allText
        .replace(/[^\w\sáéíóúñü]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3);
      
      // Contar frecuencias
      const freq = {};
      words.forEach(word => {
        freq[word] = (freq[word] || 0) + 1;
      });
      
      // Filtrar sinónimos ya existentes
      const existingSynonyms = new Set(
        (categories.synonyms[cat] || []).map(s => s.toLowerCase())
      );
      
      // Top palabras nuevas
      const newWords = Object.entries(freq)
        .filter(([word, count]) => count >= 3 && !existingSynonyms.has(word))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      if (newWords.length > 0 && stats[cat].corrections >= 5) {
        console.log(`${cat} (${stats[cat].corrections} correcciones):`);
        console.log(`  Sugerencias: ${newWords.map(([w, c]) => `${w}(${c})`).join(', ')}`);
        console.log('');
      }
    });
    
    // Recomendaciones de ajuste de pesos
    console.log('\n=== RECOMENDACIONES DE AJUSTE ===\n');
    
    const highErrorCategories = Object.entries(stats)
      .filter(([cat, data]) => data.corrections >= 10)
      .map(([cat]) => cat);
    
    if (highErrorCategories.length > 0) {
      console.log('Categorías con ≥10 correcciones (considerar fortalecer reglas):');
      highErrorCategories.forEach(cat => {
        const data = stats[cat];
        const generalRatio = (data.fromGeneral / data.corrections * 100).toFixed(0);
        console.log(`  - ${cat}: ${data.corrections} correcciones, ${generalRatio}% desde General`);
      });
      console.log('\nAcción sugerida: Añadir más sinónimos o aumentar peso de reglas.\n');
    }
    
    // Calcular precisión global
    const totalDrafts = feedback.length * 2; // Aproximación
    const accuracy = ((totalDrafts - feedback.length) / totalDrafts * 100).toFixed(1);
    console.log(`\n=== PRECISIÓN ESTIMADA ===`);
    console.log(`Precisión: ~${accuracy}% (objetivo: ≥95%)\n`);
    
    if (parseFloat(accuracy) < 95) {
      console.log('⚠️  Precisión por debajo del objetivo. Revisar sinónimos y pesos.\n');
    } else {
      console.log('✅ Precisión dentro del objetivo.\n');
    }
    
  } catch (error) {
    console.error('[Retrain] Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('[Retrain] Conexión cerrada');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  analyzeFeedback();
}

module.exports = { analyzeFeedback };
