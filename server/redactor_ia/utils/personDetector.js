// server/redactor_ia/utils/personDetector.js
/**
 * Detector ligero de entidades PERSON y EVENTOS (NER simplificado)
 * Extrae el nombre de la figura pública principal mencionada en el contenido
 * O detecta eventos/fenómenos (huracanes, protestas, etc.)
 * 
 * CONTROL: Respetar flag IMG_DISABLE_PERSON_DETECTOR para bypass completo
 */

const { IMG } = require('../../config/image');

/**
 * Patrones de fenómenos naturales y eventos
 */
const EVENT_PATTERNS = {
  storm: /\b(huracán|tormenta|depresión\s+tropical|ciclón|tifón)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñü]+)\b/gi,
  earthquake: /\b(sismo|terremoto|temblor)\s+(?:de\s+)?(\d+\.?\d*|magnitud)/gi,
  fire: /\b(incendio|fuego)\s+(?:en|de)\s+([a-záéíóúñ\s]+)/gi,
  blackout: /\b(apagón|corte\s+(?:de\s+)?(?:luz|energía|electricidad)|fallo\s+eléctrico)/gi,
  flood: /\b(inundación|inundaciones|desbordamiento)/gi,
  protest: /\b(protesta|manifestación|cacerolazo|concentración|marcha)\s+(?:en|de|por|contra)/gi
};

/**
 * Cargos genéricos sin nombre propio asociado (no son PERSON identificables)
 */
const GENERIC_TITLES = [
  /\b(ministro|ministra|canciller|embajador|embajadora|secretario|secretaria)\s+(?:de|del)\b/i,
  /\balcalde\b/i,
  /\bfiscal\b/i,
  /\bportavoz\b/i,
  /\bfuncionario\b/i
];

/**
 * Patrones comunes de nombres propios en español
 * - Nombres con mayúsculas: "Mike Waltz", "Donald Trump"
 * - Títulos + nombres: "Presidente Biden", "Senador Cruz"
 * - Nombres con partículas: "José de la Cruz", "María del Carmen"
 */
const TITLE_PATTERNS = [
  'presidente', 'senador', 'senadora', 'diputado', 'diputada',
  'ministro', 'ministra', 'gobernador', 'gobernadora',
  'canciller', 'embajador', 'embajadora', 'secretario', 'secretaria',
  'doctor', 'doctora', 'dr', 'dra', 'general', 'coronel'
];

/**
 * Palabras comunes que NO son nombres (stopwords)
 */
const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'al', 'para', 'por', 'con', 'sin', 'sobre',
  'estado', 'estados', 'unidos', 'casa', 'blanca', 'congreso',
  'washington', 'miami', 'cuba', 'habana', 'eeuu', 'onu'
]);

/**
 * Extrae candidatos a nombres propios del texto
 * @param {string} text - Texto a analizar
 * @returns {string[]} Array de posibles nombres
 */
function extractNameCandidates(text) {
  if (!text || typeof text !== 'string') return [];
  
  const candidates = [];
  
  // Regex para detectar secuencias de palabras capitalizadas
  // Captura: "Mike Waltz", "Donald J. Trump", "José de la Cruz"
  const capitalizedPattern = /\b([A-ZÑÁÉÍÓÚ][a-zñáéíóúü]+(?:\s+(?:de|del|la|las|los|y|e|von|van|di|da)?\s*[A-ZÑÁÉÍÓÚ][a-zñáéíóúü]+)*)\b/g;
  
  let match;
  while ((match = capitalizedPattern.exec(text)) !== null) {
    const candidate = match[1].trim();
    
    // Filtrar candidatos muy cortos (< 5 chars) o que son stopwords
    if (candidate.length < 5) continue;
    
    const words = candidate.toLowerCase().split(/\s+/);
    const hasStopword = words.some(w => STOPWORDS.has(w));
    
    // Si todas las palabras son stopwords, descartar
    if (words.every(w => STOPWORDS.has(w))) continue;
    
    // Si tiene algún stopword pero también palabras válidas, es probable que sea un nombre
    candidates.push(candidate);
  }
  
  return candidates;
}

/**
 * Normaliza un nombre para comparación
 * @param {string} name 
 * @returns {string}
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .trim();
}

/**
 * Cuenta menciones de cada candidato en el texto completo
 * @param {string[]} candidates 
 * @param {string} fullText 
 * @returns {Map<string, number>}
 */
function countMentions(candidates, fullText) {
  const mentions = new Map();
  const normalizedText = normalizeName(fullText);
  
  candidates.forEach(candidate => {
    const normalized = normalizeName(candidate);
    
    // Contar apariciones completas del nombre
    const regex = new RegExp(`\\b${normalized.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    const matches = normalizedText.match(regex);
    const count = matches ? matches.length : 0;
    
    if (count > 0) {
      mentions.set(candidate, count);
    }
  });
  
  return mentions;
}

/**
 * Verifica si un nombre está en los tags
 * @param {string} name 
 * @param {string[]} tags 
 * @returns {boolean}
 */
function isInTags(name, tags) {
  if (!Array.isArray(tags) || tags.length === 0) return false;
  
  const normalized = normalizeName(name);
  return tags.some(tag => {
    const normalizedTag = normalizeName(tag);
    return normalizedTag.includes(normalized) || normalized.includes(normalizedTag);
  });
}

/**
 * Detecta eventos/fenómenos en el texto
 * DESACTIVADO: No se usa, ImageThemeEngine maneja detección de desastres
 * @deprecated - Mantener por compatibilidad
 * @param {string} text - Texto a analizar
 * @returns {{ eventType: string|null, eventName: string|null, confidence: number }}
 */
function detectEvent(text) {
  // DESACTIVADO: ImageThemeEngine maneja esto con umbrales más estrictos
  return { eventType: null, eventName: null, confidence: 0 };
}

/**
 * Verifica si el candidato es un cargo genérico sin nombre propio
 * @param {string} candidate - Candidato a verificar
 * @param {string} context - Contexto del candidato
 * @returns {boolean}
 */
function isGenericTitle(candidate, context) {
  const fullText = `${context} ${candidate}`.toLowerCase();
  return GENERIC_TITLES.some(pattern => pattern.test(fullText));
}

/**
 * Detecta la figura pública principal en el contenido
 * AHORA incluye desambiguación: retorna evento si detecta uno, o persona si aplica
 * CONTROL: Respeta flag IMG_DISABLE_PERSON_DETECTOR para bypass
 * @param {Object} params
 * @param {string} params.title - Título del artículo
 * @param {string} params.lead - Bajada/resumen
 * @param {string[]} params.tags - Etiquetas
 * @param {string} params.content - Contenido completo (opcional)
 * @returns {{ isPerson: boolean, primaryPerson: string|null, mentions: number, inTags: boolean, confidence: number, eventType: string|null, eventName: string|null }}
 */
function detectPrimaryPerson({ title, lead = '', tags = [], content = '' }) {
  // BYPASS: Si PersonDetector está desactivado, retornar vacío
  if (IMG.DISABLE_PERSON_DETECTOR) {
    console.log('[PersonDetector] ⏭️ SKIPPED (IMG_DISABLE_PERSON_DETECTOR=true)');
    return { 
      isPerson: false, 
      primaryPerson: null, 
      mentions: 0, 
      inTags: false, 
      confidence: 0, 
      eventType: null, 
      eventName: null 
    };
  }
  
  console.log('[PersonDetector] Iniciando detección de personaje/evento principal');
  
  // Concatenar textos relevantes (priorizar título y lead)
  const primaryText = `${title} ${lead}`.trim();
  const fullText = `${primaryText} ${content}`.substring(0, 2000); // Limitar para performance
  
  if (!primaryText) {
    console.log('[PersonDetector] No hay texto para analizar');
    return { isPerson: false, primaryPerson: null, mentions: 0, inTags: false, confidence: 0, eventType: null, eventName: null };
  }
  
  // PASO 1: Detectar eventos/fenómenos (prioridad)
  const event = detectEvent(fullText);
  if (event.eventType) {
    return {
      isPerson: false,
      primaryPerson: null,
      mentions: 0,
      inTags: false,
      confidence: 0,
      eventType: event.eventType,
      eventName: event.eventName
    };
  }
  
  // PASO 2: Extraer candidatos a nombres de personas
  const candidates = extractNameCandidates(fullText);
  
  if (candidates.length === 0) {
    console.log('[PersonDetector] No se encontraron candidatos a nombres');
    return { isPerson: false, primaryPerson: null, mentions: 0, inTags: false, confidence: 0, eventType: null, eventName: null };
  }
  
  console.log(`[PersonDetector] Candidatos encontrados: ${candidates.slice(0, 5).join(', ')}${candidates.length > 5 ? '...' : ''}`);
  
  // Contar menciones de cada candidato
  const mentions = countMentions(candidates, fullText);
  
  // Ordenar candidatos por:
  // 1. Menciones en texto (peso: 50%)
  // 2. Presencia en tags (peso: 30%)
  // 3. Posición en título (peso: 20%)
  const scored = Array.from(mentions.entries()).map(([name, count]) => {
    const inTags = isInTags(name, tags);
    const inTitle = normalizeName(title).includes(normalizeName(name));
    
    // Verificar si es cargo genérico
    const generic = isGenericTitle(name, fullText);
    
    let score = 0;
    if (!generic) {
      score += count * 50; // Peso por menciones
      score += inTags ? 30 : 0; // Bonus si está en tags
      score += inTitle ? 20 : 0; // Bonus si está en título
    }
    
    return { name, mentions: count, inTags, inTitle, score, generic };
  });
  
  // Filtrar cargos genéricos y ordenar por score descendente
  const validScored = scored.filter(s => !s.generic);
  validScored.sort((a, b) => b.score - a.score);
  
  if (validScored.length === 0) {
    console.log('[PersonDetector] Solo se encontraron cargos genéricos');
    return { isPerson: false, primaryPerson: null, mentions: 0, inTags: false, confidence: 0, eventType: null, eventName: null };
  }
  
  const winner = validScored[0];
  
  // Criterio de aceptación: ≥2 menciones O presente en tags
  const isValid = winner.mentions >= 2 || winner.inTags;
  
  if (!isValid) {
    console.log(`[PersonDetector] Candidato principal "${winner.name}" no cumple criterio (menciones: ${winner.mentions}, inTags: ${winner.inTags})`);
    return { isPerson: false, primaryPerson: null, mentions: winner.mentions, inTags: winner.inTags, confidence: 0, eventType: null, eventName: null };
  }
  
  // Calcular confianza (0-100)
  let confidence = Math.min(100, winner.score);
  
  console.log(`[PersonDetector] Personaje detectado: "${winner.name}" (menciones: ${winner.mentions}, inTags: ${winner.inTags}, confidence: ${confidence})`);
  
  return {
    isPerson: true,
    primaryPerson: winner.name,
    mentions: winner.mentions,
    inTags: winner.inTags,
    confidence,
    eventType: null,
    eventName: null
  };
}

module.exports = {
  detectPrimaryPerson,
  extractNameCandidates
};
