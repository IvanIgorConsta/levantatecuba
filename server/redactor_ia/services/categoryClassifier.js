// server/redactor_ia/services/categoryClassifier.js

const categories = require('../config/categories');

/**
 * Clasificador ensemble híbrido de categorías
 * Combina: reglas + LLM forzado + similitud semántica
 * Precisión objetivo: ~95-98%
 */

/**
 * Clasificación por reglas basada en sinónimos
 */
function classifyByRules(text, title = '') {
  const scores = {};
  const normalizedText = (title + ' ' + text).toLowerCase();
  
  // Ponderar título x2
  const titleText = title.toLowerCase();
  
  categories.allowed.forEach(category => {
    let score = 0;
    const synonyms = categories.synonyms[category] || [];
    
    synonyms.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      const titleMatches = (titleText.match(new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, 'gi')) || []).length;
      const textMatches = (normalizedText.match(new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, 'gi')) || []).length;
      
      // Título vale x2
      score += titleMatches * 2 + textMatches;
    });
    
    scores[category] = score;
  });
  
  // Normalizar scores
  const maxScore = Math.max(...Object.values(scores), 1);
  const normalized = {};
  categories.allowed.forEach(cat => {
    normalized[cat] = scores[cat] / maxScore;
  });
  
  return normalized;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Clasificación por similitud TF-IDF simple
 */
function classifyBySimilarity(text, title = '') {
  const scores = {};
  const queryText = (title + ' ' + text).toLowerCase();
  const queryTerms = extractTerms(queryText);
  
  categories.allowed.forEach(category => {
    const description = categories.descriptions[category] || '';
    const descTerms = extractTerms(description.toLowerCase());
    
    // Similitud coseno simple
    scores[category] = cosineSimilarity(queryTerms, descTerms);
  });
  
  return scores;
}

function extractTerms(text) {
  const stopwords = new Set([
    'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se', 'no', 'haber',
    'por', 'con', 'su', 'para', 'como', 'estar', 'tener', 'le', 'lo', 'todo',
    'pero', 'más', 'hacer', 'o', 'poder', 'decir', 'este', 'ir', 'otro', 'ese',
    'si', 'me', 'ya', 'ver', 'porque', 'dar', 'cuando', 'él', 'muy', 'sin',
    'vez', 'mucho', 'saber', 'qué', 'sobre', 'mi', 'alguno', 'mismo', 'yo',
    'también', 'hasta', 'año', 'dos', 'querer', 'entre', 'así', 'primero'
  ]);
  
  const words = text
    .toLowerCase()
    .replace(/[^\w\sáéíóúñü]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));
  
  const termFreq = {};
  words.forEach(word => {
    termFreq[word] = (termFreq[word] || 0) + 1;
  });
  
  return termFreq;
}

function cosineSimilarity(terms1, terms2) {
  const allTerms = new Set([...Object.keys(terms1), ...Object.keys(terms2)]);
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  allTerms.forEach(term => {
    const v1 = terms1[term] || 0;
    const v2 = terms2[term] || 0;
    dotProduct += v1 * v2;
    magnitude1 += v1 * v1;
    magnitude2 += v2 * v2;
  });
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
}

/**
 * Clasificación por LLM con lista cerrada
 * Requiere función callLLM externa
 */
async function classifyByLLM({ title, summary, markdown, callLLM, config }) {
  const scores = {};
  
  try {
    const allowedList = categories.allowed.join(', ');
    const system = `Eres un clasificador de noticias. Debes asignar UNA categoría de esta lista CERRADA: ${allowedList}.
    
Reglas estrictas:
- Devuelve SOLO JSON: {"categoria":"<UNA_DE_LA_LISTA>"}
- Si habla de IA, software, tecnología digital → "Tecnología"
- Evita "General" salvo que realmente no haya señales claras
- Nunca inventes categorías nuevas`;
    
    const user = `Clasifica esta noticia:

TÍTULO: ${title}
BAJADA: ${summary || 'N/A'}
CONTENIDO (fragmento): ${markdown.substring(0, 500)}...

Categorías válidas: ${allowedList}
Responde SOLO con JSON: {"categoria":"..."}`;
    
    const response = await callLLM({
      model: config?.aiModel || 'claude-3-5-sonnet-20240620',
      system,
      user,
      temperature: 0.1
    });
    
    // Parse respuesta
    const parsed = JSON.parse(response.trim());
    const suggested = parsed.categoria;
    
    // Validar que esté en la lista
    if (categories.allowed.includes(suggested)) {
      // Score alto para la sugerida, bajo para las demás
      categories.allowed.forEach(cat => {
        scores[cat] = cat === suggested ? 1.0 : 0.0;
      });
    } else {
      console.warn(`[CategoryClassifier] LLM devolvió categoría inválida: ${suggested}`);
      // Fallback a General
      scores['General'] = 1.0;
    }
    
  } catch (error) {
    console.error('[CategoryClassifier] Error en LLM:', error.message);
    // En caso de error, no aportar puntos
    categories.allowed.forEach(cat => {
      scores[cat] = 0;
    });
  }
  
  return scores;
}

/**
 * Clasificador ensemble principal
 * @param {Object} params - { title, summary, markdown, tags, topicHint, callLLM, config }
 * @returns {Promise<Object>} - { category, confidence, detail, lowConfidence }
 */
async function classifyCategory(params) {
  const {
    title = '',
    summary = '',
    markdown = '',
    tags = [],
    topicHint = null,
    callLLM = null,
    config = null
  } = params;
  
  const fullText = `${title} ${summary} ${markdown}`;
  
  // 1. Clasificación por reglas
  const rulesScores = classifyByRules(fullText, title);
  
  // 2. Clasificación por similitud
  const similarityScores = classifyBySimilarity(fullText, title);
  
  // 3. Clasificación por LLM (si está disponible)
  let llmScores = {};
  if (callLLM && config) {
    llmScores = await classifyByLLM({ title, summary, markdown, callLLM, config });
  } else {
    // Sin LLM, distribuir uniformemente (no aporta información)
    categories.allowed.forEach(cat => {
      llmScores[cat] = 0;
    });
  }
  
  // 4. Combinar scores con pesos
  const weights = categories.weights;
  const ensembleScores = {};
  
  categories.allowed.forEach(cat => {
    const ruleScore = rulesScores[cat] || 0;
    const simScore = similarityScores[cat] || 0;
    const llmScore = llmScores[cat] || 0;
    
    // Si no hay LLM, redistribuir su peso
    const effectiveWeights = callLLM 
      ? weights
      : { rules: 0.55, llm: 0, similarity: 0.45 };
    
    ensembleScores[cat] = 
      ruleScore * effectiveWeights.rules +
      llmScore * effectiveWeights.llm +
      simScore * effectiveWeights.similarity;
  });
  
  // 5. Decidir categoría final
  let finalCategory = 'General';
  let maxScore = 0;
  
  // Encontrar la categoría con mayor score
  categories.allowed.forEach(cat => {
    if (ensembleScores[cat] > maxScore) {
      maxScore = ensembleScores[cat];
      finalCategory = cat;
    }
  });
  
  // 6. Aplicar umbrales y heurísticas
  const thresholds = categories.thresholds;
  let confidence = maxScore;
  let lowConfidence = false;
  
  // Evitar "General" si hay otra categoría fuerte
  if (finalCategory === 'General') {
    const otherScores = categories.allowed
      .filter(cat => cat !== 'General')
      .map(cat => ({ cat, score: ensembleScores[cat] }))
      .sort((a, b) => b.score - a.score);
    
    if (otherScores[0] && otherScores[0].score >= thresholds.avoidGeneral) {
      finalCategory = otherScores[0].cat;
      confidence = otherScores[0].score;
    }
  }
  
  // Si todo es bajo, usar topicHint
  if (maxScore < thresholds.lowConfidence && topicHint && categories.allowed.includes(topicHint)) {
    finalCategory = topicHint;
    confidence = 0.45; // Confianza baja pero aceptable
    lowConfidence = true;
  }
  
  // Si aún muy bajo, marcar como baja confianza
  if (maxScore < thresholds.lowConfidence) {
    lowConfidence = true;
  }
  
  // 7. Construir detalle para debugging
  const detail = {
    rules: rulesScores,
    llm: llmScores,
    similarity: similarityScores,
    ensemble: ensembleScores,
    topicHint,
    usedTopicHint: lowConfidence && topicHint === finalCategory
  };
  
  return {
    category: finalCategory,
    confidence: Math.round(confidence * 100) / 100, // 2 decimales
    lowConfidence,
    detail: JSON.stringify(detail).substring(0, 2000) // Truncar si es muy largo
  };
}

module.exports = {
  classifyCategory,
  classifyByRules,
  classifyBySimilarity,
  classifyByLLM
};
