// server/redactor_ia/utils/similarity.js
/**
 * Utilidades de similitud de texto para deduplicación de noticias
 * Implementa múltiples algoritmos: Cosine, Levenshtein, Jaccard
 * 
 * Umbrales de duplicado:
 * - Cosine similarity ≥ 0.70
 * - Levenshtein score ≥ 0.60
 * - Jaccard similarity ≥ 0.65
 */

// Stopwords en español para normalización
const SPANISH_STOPWORDS = new Set([
  'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por',
  'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero',
  'sus', 'le', 'ya', 'o', 'este', 'sí', 'porque', 'esta', 'entre', 'cuando',
  'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay', 'donde', 'quien',
  'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra',
  'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos',
  'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos',
  'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas',
  'algunas', 'algo', 'nosotros', 'mi', 'mis', 'tú', 'te', 'ti', 'tu', 'tus',
  'ellas', 'nosotras', 'vosotros', 'vosotras', 'os', 'mío', 'mía', 'míos', 'mías',
  'tuyo', 'tuya', 'tuyos', 'tuyas', 'suyo', 'suya', 'suyos', 'suyas', 'nuestro',
  'nuestra', 'nuestros', 'nuestras', 'vuestro', 'vuestra', 'vuestros', 'vuestras',
  'esos', 'esas', 'estoy', 'estás', 'está', 'estamos', 'estáis', 'están', 'esté',
  'estés', 'estemos', 'estéis', 'estén', 'estaré', 'estarás', 'estará', 'estaremos',
  'estaréis', 'estarán', 'estaría', 'estarías', 'estaríamos', 'estaríais', 'estarían',
  'estaba', 'estabas', 'estábamos', 'estabais', 'estaban', 'estuve', 'estuviste',
  'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron', 'estuviera', 'estuvieras',
  'estuviéramos', 'estuvierais', 'estuvieran', 'estuviese', 'estuvieses', 'estuviésemos',
  'estuvieseis', 'estuviesen', 'estando', 'estado', 'estada', 'estados', 'estadas',
  'estad', 'he', 'has', 'ha', 'hemos', 'habéis', 'han', 'haya', 'hayas', 'hayamos',
  'hayáis', 'hayan', 'habré', 'habrás', 'habrá', 'habremos', 'habréis', 'habrán',
  'habría', 'habrías', 'habríamos', 'habríais', 'habrían', 'había', 'habías',
  'habíamos', 'habíais', 'habían', 'hube', 'hubiste', 'hubo', 'hubimos', 'hubisteis',
  'hubieron', 'hubiera', 'hubieras', 'hubiéramos', 'hubierais', 'hubieran', 'hubiese',
  'hubieses', 'hubiésemos', 'hubieseis', 'hubiesen', 'habiendo', 'habido', 'habida',
  'habidos', 'habidas', 'soy', 'eres', 'es', 'somos', 'sois', 'son', 'sea', 'seas',
  'seamos', 'seáis', 'sean', 'seré', 'serás', 'será', 'seremos', 'seréis', 'serán',
  'sería', 'serías', 'seríamos', 'seríais', 'serían', 'era', 'eras', 'éramos',
  'erais', 'eran', 'fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron', 'fuera',
  'fueras', 'fuéramos', 'fuerais', 'fueran', 'fuese', 'fueses', 'fuésemos', 'fueseis',
  'fuesen', 'siendo', 'sido', 'tengo', 'tienes', 'tiene', 'tenemos', 'tenéis',
  'tienen', 'tenga', 'tengas', 'tengamos', 'tengáis', 'tengan', 'tendré', 'tendrás',
  'tendrá', 'tendremos', 'tendréis', 'tendrán', 'tendría', 'tendrías', 'tendríamos',
  'tendríais', 'tendrían', 'tenía', 'tenías', 'teníamos', 'teníais', 'tenían',
  'tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron', 'tuviera', 'tuvieras',
  'tuviéramos', 'tuvierais', 'tuvieran', 'tuviese', 'tuvieses', 'tuviésemos',
  'tuvieseis', 'tuviesen', 'teniendo', 'tenido', 'tenida', 'tenidos', 'tenidas', 'tened'
]);

// Stopwords en inglés
const ENGLISH_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have',
  'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
  'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'it', 'its',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what',
  'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also'
]);

// Combinar stopwords
const ALL_STOPWORDS = new Set([...SPANISH_STOPWORDS, ...ENGLISH_STOPWORDS]);

/**
 * Normaliza texto para comparación de similitud
 * - Lowercase
 * - Remove punctuation
 * - Remove stopwords
 * - Collapse spaces
 * @param {string} text - Texto a normalizar
 * @returns {string} Texto normalizado
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s]/g, ' ')        // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 1 && !ALL_STOPWORDS.has(word))
    .join(' ')
    .trim();
}

/**
 * Tokeniza texto en palabras únicas (para Jaccard/Cosine)
 * @param {string} text - Texto normalizado
 * @returns {Set<string>} Set de palabras únicas
 */
function tokenize(text) {
  const normalized = normalizeText(text);
  return new Set(normalized.split(/\s+/).filter(w => w.length > 0));
}

/**
 * Calcula similitud de Jaccard entre dos textos
 * J(A,B) = |A ∩ B| / |A ∪ B|
 * @param {string} text1 - Primer texto
 * @param {string} text2 - Segundo texto
 * @returns {number} Similitud entre 0 y 1
 */
function jaccardSimilarity(text1, text2) {
  const set1 = tokenize(text1);
  const set2 = tokenize(text2);
  
  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Calcula similitud coseno entre dos textos usando TF (Term Frequency)
 * @param {string} text1 - Primer texto
 * @param {string} text2 - Segundo texto
 * @returns {number} Similitud entre 0 y 1
 */
function cosineSimilarity(text1, text2) {
  const words1 = normalizeText(text1).split(/\s+/).filter(w => w.length > 0);
  const words2 = normalizeText(text2).split(/\s+/).filter(w => w.length > 0);
  
  if (words1.length === 0 && words2.length === 0) return 1;
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Build term frequency maps
  const tf1 = {};
  const tf2 = {};
  
  words1.forEach(w => { tf1[w] = (tf1[w] || 0) + 1; });
  words2.forEach(w => { tf2[w] = (tf2[w] || 0) + 1; });
  
  // Get all unique terms
  const allTerms = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);
  
  // Calculate dot product and magnitudes
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  allTerms.forEach(term => {
    const v1 = tf1[term] || 0;
    const v2 = tf2[term] || 0;
    dotProduct += v1 * v2;
    magnitude1 += v1 * v1;
    magnitude2 += v2 * v2;
  });
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Calcula distancia de Levenshtein entre dos strings
 * @param {string} str1 - Primer string
 * @param {string} str2 - Segundo string
 * @returns {number} Distancia de edición
 */
function levenshteinDistance(str1, str2) {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;
  
  // Use two-row optimization for memory efficiency
  let prevRow = Array(s2.length + 1).fill(0).map((_, i) => i);
  let currRow = Array(s2.length + 1).fill(0);
  
  for (let i = 1; i <= s1.length; i++) {
    currRow[0] = i;
    
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,      // deletion
        currRow[j - 1] + 1,  // insertion
        prevRow[j - 1] + cost // substitution
      );
    }
    
    [prevRow, currRow] = [currRow, prevRow];
  }
  
  return prevRow[s2.length];
}

/**
 * Calcula score de similitud Levenshtein normalizado (0-1)
 * @param {string} str1 - Primer string
 * @param {string} str2 - Segundo string
 * @returns {number} Similitud entre 0 y 1
 */
function levenshteinSimilarity(str1, str2) {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  
  if (s1 === s2) return 1;
  
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}

/**
 * Determina si dos títulos son duplicados usando múltiples algoritmos
 * Un par es duplicado si cumple CUALQUIERA de:
 * - Cosine similarity ≥ 0.70
 * - Levenshtein score ≥ 0.60
 * - Jaccard similarity ≥ 0.65
 * 
 * @param {string} title1 - Primer título
 * @param {string} title2 - Segundo título
 * @param {Object} thresholds - Umbrales personalizados (opcional)
 * @returns {{ isDuplicate: boolean, scores: Object, matchedBy: string|null }}
 */
function areDuplicates(title1, title2, thresholds = {}) {
  const {
    cosineThreshold = 0.70,
    levenshteinThreshold = 0.60,
    jaccardThreshold = 0.65
  } = thresholds;
  
  const cosine = cosineSimilarity(title1, title2);
  const levenshtein = levenshteinSimilarity(title1, title2);
  const jaccard = jaccardSimilarity(title1, title2);
  
  const scores = { cosine, levenshtein, jaccard };
  
  let matchedBy = null;
  
  if (cosine >= cosineThreshold) {
    matchedBy = 'cosine';
  } else if (levenshtein >= levenshteinThreshold) {
    matchedBy = 'levenshtein';
  } else if (jaccard >= jaccardThreshold) {
    matchedBy = 'jaccard';
  }
  
  return {
    isDuplicate: matchedBy !== null,
    scores,
    matchedBy
  };
}

/**
 * Deduplica una lista de artículos/temas basándose en similitud de títulos
 * Mantiene el artículo con mayor impacto, o el primero si son iguales
 * 
 * @param {Array} items - Lista de artículos/temas con campo 'title' o 'tituloSugerido'
 * @param {Object} options - Opciones de configuración
 * @param {string} options.titleField - Campo que contiene el título (default: 'title')
 * @param {string} options.impactField - Campo que contiene el impacto (default: 'impacto')
 * @param {boolean} options.verbose - Si loguear duplicados encontrados (default: true)
 * @returns {{ unique: Array, duplicatesSkipped: number, duplicateDetails: Array }}
 */
function deduplicateByTitle(items, options = {}) {
  const {
    titleField = 'title',
    impactField = 'impacto',
    verbose = true
  } = options;
  
  if (!items || items.length === 0) {
    return { unique: [], duplicatesSkipped: 0, duplicateDetails: [] };
  }
  
  const unique = [];
  const duplicateDetails = [];
  let duplicatesSkipped = 0;
  
  for (const item of items) {
    const itemTitle = item[titleField] || item.tituloSugerido || item.title || '';
    const itemImpact = item[impactField] || item.impacto || 0;
    
    let isDuplicate = false;
    let duplicateOf = null;
    let duplicateIndex = -1;
    let matchInfo = null;
    
    // Comparar con items ya aceptados
    for (let i = 0; i < unique.length; i++) {
      const existingTitle = unique[i][titleField] || unique[i].tituloSugerido || unique[i].title || '';
      const result = areDuplicates(itemTitle, existingTitle);
      
      if (result.isDuplicate) {
        isDuplicate = true;
        duplicateOf = existingTitle;
        duplicateIndex = i;
        matchInfo = result;
        break;
      }
    }
    
    if (isDuplicate) {
      const existingImpact = unique[duplicateIndex][impactField] || unique[duplicateIndex].impacto || 0;
      
      // Si el nuevo tiene mayor impacto, reemplazar
      if (itemImpact > existingImpact) {
        if (verbose) {
          console.log(`[Scanner] 🔄 Reemplazando duplicado (mayor impacto ${itemImpact} > ${existingImpact}): "${itemTitle.substring(0, 60)}..."`);
        }
        duplicateDetails.push({
          skipped: unique[duplicateIndex][titleField] || unique[duplicateIndex].tituloSugerido,
          keptTitle: itemTitle,
          matchedBy: matchInfo.matchedBy,
          scores: matchInfo.scores
        });
        unique[duplicateIndex] = item;
      } else {
        if (verbose) {
          console.log(`[Scanner] ⏭️  Duplicado ignorado (${matchInfo.matchedBy}=${matchInfo.scores[matchInfo.matchedBy].toFixed(2)}): "${itemTitle.substring(0, 60)}..."`);
        }
        duplicateDetails.push({
          skipped: itemTitle,
          keptTitle: duplicateOf,
          matchedBy: matchInfo.matchedBy,
          scores: matchInfo.scores
        });
      }
      duplicatesSkipped++;
    } else {
      unique.push(item);
    }
  }
  
  return { unique, duplicatesSkipped, duplicateDetails };
}

/**
 * Verifica si un nuevo artículo es duplicado de alguno existente en la base de datos
 * Útil para verificar antes de insertar
 * 
 * @param {string} newTitle - Título del nuevo artículo
 * @param {Array} existingTitles - Lista de títulos existentes
 * @returns {{ isDuplicate: boolean, duplicateOf: string|null, matchInfo: Object|null }}
 */
function checkAgainstExisting(newTitle, existingTitles) {
  for (const existingTitle of existingTitles) {
    const result = areDuplicates(newTitle, existingTitle);
    if (result.isDuplicate) {
      return {
        isDuplicate: true,
        duplicateOf: existingTitle,
        matchInfo: result
      };
    }
  }
  
  return { isDuplicate: false, duplicateOf: null, matchInfo: null };
}

module.exports = {
  normalizeText,
  tokenize,
  jaccardSimilarity,
  cosineSimilarity,
  levenshteinDistance,
  levenshteinSimilarity,
  areDuplicates,
  deduplicateByTitle,
  checkAgainstExisting,
  // Export constants for testing
  SPANISH_STOPWORDS,
  ENGLISH_STOPWORDS,
  ALL_STOPWORDS
};
