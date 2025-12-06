#!/usr/bin/env node
/**
 * Script para sanear noticias y borradores eliminando párrafos duplicados
 * 
 * Uso:
 *   node scripts/sanitize-duplicates.js --dry-run    # Ver qué se modificaría sin guardar
 *   node scripts/sanitize-duplicates.js --apply      # Aplicar cambios
 *   node scripts/sanitize-duplicates.js --apply --drafts-only  # Solo borradores
 *   node scripts/sanitize-duplicates.js --apply --news-only    # Solo noticias publicadas
 */

require('dotenv').config({ path: require('path').join(__dirname, '../server/.env') });
const mongoose = require('mongoose');
const News = require('../server/models/News');
const AiDraft = require('../server/models/AiDraft');

// Configuración
const DRY_RUN = process.argv.includes('--dry-run');
const APPLY = process.argv.includes('--apply');
const DRAFTS_ONLY = process.argv.includes('--drafts-only');
const NEWS_ONLY = process.argv.includes('--news-only');

if (!DRY_RUN && !APPLY) {
  console.log('Uso:');
  console.log('  node scripts/sanitize-duplicates.js --dry-run    # Ver cambios sin aplicar');
  console.log('  node scripts/sanitize-duplicates.js --apply      # Aplicar cambios');
  console.log('  node scripts/sanitize-duplicates.js --apply --drafts-only');
  console.log('  node scripts/sanitize-duplicates.js --apply --news-only');
  process.exit(1);
}

/**
 * Elimina párrafos duplicados consecutivos del contenido
 * @param {string} content - Contenido markdown
 * @returns {{ cleaned: string, duplicatesRemoved: number, sections: string[] }}
 */
function removeDuplicateParagraphs(content) {
  if (!content || typeof content !== 'string') {
    return { cleaned: content, duplicatesRemoved: 0, sections: [] };
  }

  // Dividir por secciones (## Título)
  const sectionRegex = /^(## .+)$/gm;
  const sections = content.split(sectionRegex);
  
  let duplicatesRemoved = 0;
  const affectedSections = [];
  
  const cleanedSections = sections.map((section, index) => {
    // Si es un encabezado, dejarlo como está
    if (section.match(/^## /)) {
      return section;
    }
    
    // Dividir en párrafos (separados por doble salto de línea)
    const paragraphs = section.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);
    
    // Eliminar párrafos duplicados consecutivos
    const uniqueParagraphs = [];
    const seenInSection = new Set();
    
    for (const paragraph of paragraphs) {
      // Normalizar para comparación (quitar espacios extra, lowercase)
      const normalized = paragraph.toLowerCase().replace(/\s+/g, ' ').trim();
      
      // Si el párrafo es muy corto (menos de 50 chars), no verificar duplicados
      if (normalized.length < 50) {
        uniqueParagraphs.push(paragraph);
        continue;
      }
      
      if (!seenInSection.has(normalized)) {
        seenInSection.add(normalized);
        uniqueParagraphs.push(paragraph);
      } else {
        duplicatesRemoved++;
        // Identificar la sección afectada (buscar el encabezado anterior)
        if (index > 0 && sections[index - 1].match(/^## /)) {
          const sectionName = sections[index - 1].trim();
          if (!affectedSections.includes(sectionName)) {
            affectedSections.push(sectionName);
          }
        }
      }
    }
    
    return uniqueParagraphs.join('\n\n');
  });
  
  // Reconstruir contenido
  let cleaned = cleanedSections.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  
  return { cleaned, duplicatesRemoved, sections: affectedSections };
}

/**
 * También elimina secciones completas duplicadas como "Verificaciones" o "Prompt de imagen"
 */
function removeUnwantedSections(content) {
  if (!content) return { cleaned: content, sectionsRemoved: [] };
  
  const unwantedPatterns = [
    /^##\s*Verificaciones?\s*\n[\s\S]*?(?=^##|\z)/gm,
    /^##\s*Prompt\s+de\s+imagen\s*\n[\s\S]*?(?=^##|\z)/gm,
    /^##\s*Prompts?\s+de\s+im[aá]genes?\s*\n[\s\S]*?(?=^##|\z)/gm,
    /^\*\*Verificaciones?\*\*:?\s*\n[\s\S]*?(?=^##|\*\*|\z)/gm,
  ];
  
  let cleaned = content;
  const sectionsRemoved = [];
  
  for (const pattern of unwantedPatterns) {
    const matches = cleaned.match(pattern);
    if (matches) {
      sectionsRemoved.push(...matches.map(m => m.split('\n')[0].trim()));
      cleaned = cleaned.replace(pattern, '');
    }
  }
  
  // Limpiar líneas sueltas que parecen verificaciones
  cleaned = cleaned.replace(/^Según [^,]+,.*verificad[oa].*$/gm, '');
  
  return { cleaned: cleaned.trim(), sectionsRemoved };
}

async function main() {
  console.log('═'.repeat(70));
  console.log('  SCRIPT DE SANEAMIENTO DE CONTENIDO DUPLICADO');
  console.log('═'.repeat(70));
  console.log(`Modo: ${DRY_RUN ? '🔍 DRY-RUN (solo lectura)' : '⚡ APLICAR CAMBIOS'}`);
  console.log('');

  // Conectar a MongoDB
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ Error: No se encontró MONGODB_URI en las variables de entorno');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Conectado a MongoDB\n');

  let totalProcessed = 0;
  let totalFixed = 0;
  let totalDuplicatesRemoved = 0;

  // ═══════════════════════════════════════════════════════════════
  // PROCESAR BORRADORES (AiDraft)
  // ═══════════════════════════════════════════════════════════════
  if (!NEWS_ONLY) {
    console.log('─'.repeat(70));
    console.log('📝 PROCESANDO BORRADORES (AiDraft)');
    console.log('─'.repeat(70));

    const drafts = await AiDraft.find({ contenidoMarkdown: { $exists: true, $ne: '' } });
    console.log(`Encontrados: ${drafts.length} borradores\n`);

    for (const draft of drafts) {
      totalProcessed++;
      const original = draft.contenidoMarkdown;
      
      // Paso 1: Eliminar secciones no deseadas
      const { cleaned: step1, sectionsRemoved } = removeUnwantedSections(original);
      
      // Paso 2: Eliminar párrafos duplicados
      const { cleaned: final, duplicatesRemoved, sections } = removeDuplicateParagraphs(step1);
      
      const hasChanges = original !== final;
      
      if (hasChanges) {
        totalFixed++;
        totalDuplicatesRemoved += duplicatesRemoved;
        
        console.log(`📄 ${draft.titulo.substring(0, 50)}...`);
        console.log(`   ID: ${draft._id}`);
        if (sectionsRemoved.length > 0) {
          console.log(`   🗑️  Secciones eliminadas: ${sectionsRemoved.join(', ')}`);
        }
        if (duplicatesRemoved > 0) {
          console.log(`   🔄 Párrafos duplicados eliminados: ${duplicatesRemoved}`);
          console.log(`   📍 En secciones: ${sections.join(', ')}`);
        }
        console.log(`   📊 Tamaño: ${original.length} → ${final.length} chars`);
        console.log('');
        
        if (APPLY) {
          draft.contenidoMarkdown = final;
          await draft.save();
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PROCESAR NOTICIAS PUBLICADAS (News)
  // ═══════════════════════════════════════════════════════════════
  if (!DRAFTS_ONLY) {
    console.log('─'.repeat(70));
    console.log('📰 PROCESANDO NOTICIAS PUBLICADAS (News)');
    console.log('─'.repeat(70));

    const news = await News.find({ contenido: { $exists: true, $ne: '' } });
    console.log(`Encontradas: ${news.length} noticias\n`);

    for (const article of news) {
      totalProcessed++;
      const original = article.contenido;
      
      // Paso 1: Eliminar secciones no deseadas
      const { cleaned: step1, sectionsRemoved } = removeUnwantedSections(original);
      
      // Paso 2: Eliminar párrafos duplicados
      const { cleaned: final, duplicatesRemoved, sections } = removeDuplicateParagraphs(step1);
      
      const hasChanges = original !== final;
      
      if (hasChanges) {
        totalFixed++;
        totalDuplicatesRemoved += duplicatesRemoved;
        
        console.log(`📰 ${article.titulo.substring(0, 50)}...`);
        console.log(`   ID: ${article._id}`);
        if (sectionsRemoved.length > 0) {
          console.log(`   🗑️  Secciones eliminadas: ${sectionsRemoved.join(', ')}`);
        }
        if (duplicatesRemoved > 0) {
          console.log(`   🔄 Párrafos duplicados eliminados: ${duplicatesRemoved}`);
          console.log(`   📍 En secciones: ${sections.join(', ')}`);
        }
        console.log(`   📊 Tamaño: ${original.length} → ${final.length} chars`);
        console.log('');
        
        if (APPLY) {
          article.contenido = final;
          await article.save();
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RESUMEN
  // ═══════════════════════════════════════════════════════════════
  console.log('═'.repeat(70));
  console.log('  RESUMEN');
  console.log('═'.repeat(70));
  console.log(`📊 Total procesados: ${totalProcessed}`);
  console.log(`✅ Con duplicados: ${totalFixed}`);
  console.log(`🔄 Párrafos duplicados encontrados: ${totalDuplicatesRemoved}`);
  console.log('');
  
  if (DRY_RUN && totalFixed > 0) {
    console.log('⚠️  Ejecuta con --apply para guardar los cambios');
  } else if (APPLY && totalFixed > 0) {
    console.log('✅ Cambios guardados en la base de datos');
  } else {
    console.log('✨ No se encontraron duplicados');
  }

  await mongoose.disconnect();
  console.log('\n🔌 Desconectado de MongoDB');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
