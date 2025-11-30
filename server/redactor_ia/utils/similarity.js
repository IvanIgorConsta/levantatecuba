// server/redactor_ia/utils/similarity.js
/**
 * Utilidades de similitud de texto para deduplicación de noticias
 * Implementa múltiples algoritmos: Jaccard, Levenshtein, Cosine
 */

/**
 * Normaliza un título para comparación
 * @param {string} title - Título original
 * @returns {string} Título normalizado
 */
function normalizeTitle(title) {
  if (!title || typeof title !== 'string') return '';
  
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^\w\s]/g, ' ')        // Quitar puntuación
    .replace(/\s+/g, ' ')            // Normalizar espacios
    .trim();
}

/**
 * Tokeniza un texto en palabras
 * @param {string} text - Texto a tokenizar
 * @returns {string[]} Array de tokens
 */
function tokenize(text) {
  const normalized = normalizeTitle(text);
  return normalized.split(' ').filter(w => w.length > 2); // Ignorar palabras muy cortas
}

/**
 * Calcula similitud Jaccard entre dos conjuntos de tokens
 * @param {string[]} tokens1 
 * @param {string[]} tokens2 
 * @returns {number} Similitud entre 0 y 1
 */
function jaccardSimilarity(tokens1, tokens2) {
  if (!tokens1.length || !tokens2.length) return 0;
  
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Calcula distancia de Levenshtein normalizada
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} Similitud entre 0 y 1
 */
function levenshteinSimilarity(str1, str2) {
  const s1 = normalizeTitle(str1);
  const s2 = normalizeTitle(str2);
  
  if (s1 === s2) return 1;
  if (!s1.length || !s2.length) return 0;
  
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  
  return 1 - (distance / maxLen);
}

/**
 * Calcula distancia de Levenshtein
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  
  // Optimización para strings muy diferentes en longitud
  if (Math.abs(m - n) > Math.max(m, n) * 0.5) {
    return Math.max(m, n);
  }
  
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // Eliminación
        dp[i][j - 1] + 1,      // Inserción
        dp[i - 1][j - 1] + cost // Sustitución
      );
    }
  }
  
  return dp[m][n];
}

/**
 * Calcula similitud coseno entre dos textos
 * @param {string} text1 
 * @param {string} text2 
 * @returns {number} Similitud entre 0 y 1
 */
function cosineSimilarity(text1, text2) {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  
  if (!tokens1.length || !tokens2.length) return 0;
  
  // Crear vocabulario
  const vocab = new Set([...tokens1, ...tokens2]);
  
  // Crear vectores de frecuencia
  const freq1 = {};
  const freq2 = {};
  
  tokens1.forEach(t => freq1[t] = (freq1[t] || 0) + 1);
  tokens2.forEach(t => freq2[t] = (freq2[t] || 0) + 1);
  
  // Calcular producto punto y magnitudes
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  vocab.forEach(word => {
    const v1 = freq1[word] || 0;
    const v2 = freq2[word] || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  });
  
  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

/**
 * Calcula similitud combinada usando múltiples algoritmos
 * @param {string} title1 
 * @param {string} title2 
 * @returns {{ combined: number, jaccard: number, levenshtein: number, cosine: number }}
 */
function combinedSimilarity(title1, title2) {
  const tokens1 = tokenize(title1);
  const tokens2 = tokenize(title2);
  
  const jaccard = jaccardSimilarity(tokens1, tokens2);
  const levenshtein = levenshteinSimilarity(title1, title2);
  const cosine = cosineSimilarity(title1, title2);
  
  // Promedio ponderado: Jaccard y Cosine son más robustos para títulos
  const combined = (jaccard * 0.35) + (levenshtein * 0.25) + (cosine * 0.40);
  
  return { combined, jaccard, levenshtein, cosine };
}

/**
 * Deduplica artículos por similitud de título
 * @param {Object[]} articles - Array de artículos
 * @param {Object} options - Opciones de configuración
 * @returns {{ unique: Object[], duplicatesSkipped: number }}
 */
function deduplicateByTitle(articles, options = {}) {
  const {
    titleField = 'title',
    impactField = 'impacto',
    threshold = 0.70,        // Umbral de similitud para considerar duplicado
    verbose = false
  } = options;
  
  if (!Array.isArray(articles) || articles.length === 0) {
    return { unique: [], duplicatesSkipped: 0 };
  }
  
  // Ordenar por impacto descendente (mantener el de mayor impacto)
  const sorted = [...articles].sort((a, b) => {
    const impactA = a[impactField] || 0;
    const impactB = b[impactField] || 0;
    return impactB - impactA;
  });
  
  const unique = [];
  const seenTitles = [];
  let duplicatesSkipped = 0;
  
  for (const article of sorted) {
    const title = article[titleField] || '';
    
    if (!title) {
      // Sin título, incluir de todos modos
      unique.push(article);
      continue;
    }
    
    // Verificar similitud con títulos ya vistos
    let isDuplicate = false;
    
    for (const seenTitle of seenTitles) {
      const sim = combinedSimilarity(title, seenTitle);
      
      if (sim.combined >= threshold) {
        isDuplicate = true;
        duplicatesSkipped++;
        
        if (verbose) {
          console.log(`[Similarity] 🔄 Duplicado detectado (${(sim.combined * 100).toFixed(1)}%):`);
          console.log(`  Original: "${seenTitle.substring(0, 60)}..."`);
          console.log(`  Duplicado: "${title.substring(0, 60)}..."`);
        }
        break;
      }
    }
    
    if (!isDuplicate) {
      unique.push(article);
      seenTitles.push(title);
    }
  }
  
  if (verbose && duplicatesSkipped > 0) {
    console.log(`[Similarity] ✅ Deduplicación completada: ${unique.length} únicos, ${duplicatesSkipped} duplicados eliminados`);
  }
  
  return { unique, duplicatesSkipped };
}

/**
 * Verifica si un título es similar a alguno en una lista existente
 * Útil para verificar contra noticias ya publicadas
 * @param {string} newTitle - Título nuevo a verificar
 * @param {string[]} existingTitles - Títulos existentes
 * @param {number} threshold - Umbral de similitud (default 0.70)
 * @returns {{ isDuplicate: boolean, matchedTitle: string|null, similarity: number }}
 */
function checkTitleDuplicate(newTitle, existingTitles, threshold = 0.70) {
  if (!newTitle || !Array.isArray(existingTitles)) {
    return { isDuplicate: false, matchedTitle: null, similarity: 0 };
  }
  
  let maxSimilarity = 0;
  let matchedTitle = null;
  
  for (const existing of existingTitles) {
    const sim = combinedSimilarity(newTitle, existing);
    
    if (sim.combined > maxSimilarity) {
      maxSimilarity = sim.combined;
      matchedTitle = existing;
    }
    
    if (sim.combined >= threshold) {
      return { 
        isDuplicate: true, 
        matchedTitle: existing, 
        similarity: sim.combined 
      };
    }
  }
  
  return { 
    isDuplicate: false, 
    matchedTitle, 
    similarity: maxSimilarity 
  };
}

module.exports = {
  normalizeTitle,
  tokenize,
  jaccardSimilarity,
  levenshteinSimilarity,
  cosineSimilarity,
  combinedSimilarity,
  deduplicateByTitle,
  checkTitleDuplicate
};
