// server/redactor_ia/utils/impactScore.js

/**
 * Calcula el score de impacto basado en múltiples factores
 * @param {Object} topic - Tema con información de fuentes
 * @param {Object} weights - Ponderaciones personalizadas
 * @returns {Object} { impacto: 0-100, confianza: 'Baja'|'Media'|'Alta', metadata }
 */
function calculateImpactScore(topic, weights = {}) {
  const defaultWeights = {
    recencia: 0.2,
    consenso: 0.15,
    autoridad: 0.15,
    tendencia: 0.15,
    relevanciaCuba: 0.2,
    novedad: 0.15
  };

  const w = { ...defaultWeights, ...weights };
  
  // 1. Recencia (0-100): más reciente = mayor score
  const recencia = calculateRecency(topic.sources);
  
  // 2. Consenso (0-100): cuántas fuentes hablan del mismo tema
  const consenso = calculateConsensus(topic.sources);
  
  // 3. Autoridad (0-100): calidad de las fuentes
  const autoridad = calculateAuthority(topic.sources);
  
  // 4. Tendencia (0-100): velocidad de aparición de noticias
  const tendencia = calculateTrend(topic.sources);
  
  // 5. Relevancia Cuba (0-100): keywords relacionados con Cuba
  const relevanciaCuba = calculateCubaRelevance(topic);
  
  // 6. Novedad (0-100): qué tan único/nuevo es el tema
  const novedad = calculateNovelty(topic);
  
  // 7. TrendScore no-político (boost para Tecnología/Tendencia/Virales)
  const nonPoliticalKeywords = [
    // IA y tecnología emergente
    'ia','inteligencia artificial','ai','chatgpt','gpt','openai','claude','gemini','bard',
    'machine learning','deep learning','neural network','llm','modelo de lenguaje',
    // Redes sociales y plataformas
    'whatsapp','instagram','tiktok','youtube','x','twitter','facebook','snapchat','threads',
    'telegram','discord','reddit','twitch','linkedin',
    // Dispositivos y marcas tech
    'iphone','android','samsung','pixel','ipad','macbook','apple','google','microsoft',
    'tesla','spacex','meta','nvidia','amd',
    // Criptomonedas y blockchain
    'bitcoin','btc','ethereum','eth','crypto','criptomoneda','blockchain','web3','nft',
    'binance','coinbase','solana','dogecoin','defi',
    // Tecnología general
    'tecnologia','tech','app','startup','software','hardware','cloud','nube',
    'ciberseguridad','hack','breach','vulnerabilidad','ransomware','malware',
    'datos','data','privacidad','encryption',
    // Gaming y entretenimiento
    'videojuego','gaming','gamer','esports','playstation','xbox','nintendo','steam',
    'trailer','gameplay','lanzamiento','beta','alpha','early access',
    // Streaming y contenido viral
    'streaming','streamer','netflix','disney+','hbo','amazon prime','spotify',
    'podcast','serie','pelicula','viral','trending','challenge','meme','filtro',
    'influencer','youtuber','tiktoker','creator','contenido viral',
    // Tendencias digitales
    'viral','trend','trending','boom','explosion','rompe internet','viraliza',
    'millones de vistas','sensacion','fenomeno','record','leak','filtrado',
    'outage','caida','fallo masivo','bug','glitch'
  ];
  const politicalStopwords = [
    'presidente','ministro','elecciones','gobierno','sancion','sanciones',
    'congreso','partido','embajada','parlamento','senado','diputado',
    'legislacion','ley','decreto','referendum','votacion'
  ];
  const trendText = `${(topic.title||'')} ${(topic.description||'')}`.toLowerCase();
  
  let trendMatches = 0;
  for (const k of nonPoliticalKeywords) if (trendText.includes(k)) trendMatches++;
  let politicalMatches = 0;
  for (const k of politicalStopwords) if (trendText.includes(k)) politicalMatches++;
  
  // Aumentar peso: cada match viral suma +20, cada político resta -15
  const trendScore = Math.min(100, Math.max(0, (trendMatches * 20) - (politicalMatches * 15)));
  
  // Score final ponderado (trendScore tiene peso de 0.30 para priorizar contenido viral/tech)
  const impacto = Math.round(
    recencia * w.recencia +
    consenso * w.consenso +
    autoridad * w.autoridad +
    tendencia * w.tendencia +
    relevanciaCuba * w.relevanciaCuba +
    novedad * w.novedad +
    (trendScore || 0) * 0.30
  );
  
  // Confianza basada en número de fuentes y consistencia
  const confianza = calculateConfidence(topic.sources, consenso);
  
  return {
    impacto: Math.min(100, Math.max(0, impacto)),
    confianza,
    metadata: {
      recencia,
      consenso,
      autoridad,
      tendencia,
      relevanciaCuba,
      novedad,
      trendScore
    }
  };
}

/**
 * Calcula score de recencia (más reciente = mayor score)
 */
function calculateRecency(sources) {
  if (!sources || sources.length === 0) return 0;
  
  const now = Date.now();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 días en ms
  
  const avgAge = sources.reduce((sum, s) => {
    const age = now - new Date(s.publishedAt || s.fecha).getTime();
    return sum + Math.min(age, maxAge);
  }, 0) / sources.length;
  
  // Normalizar: 0 horas = 100, 7 días = 0
  return Math.max(0, 100 - (avgAge / maxAge) * 100);
}

/**
 * Calcula consenso: cuántas fuentes coinciden
 */
function calculateConsensus(sources) {
  if (!sources || sources.length === 0) return 0;
  
  const count = sources.length;
  
  // Normalizar: 1 fuente = 20, 5+ fuentes = 100
  if (count === 1) return 20;
  if (count === 2) return 40;
  if (count === 3) return 60;
  if (count === 4) return 80;
  return 100;
}

/**
 * Calcula autoridad promedio de las fuentes
 */
function calculateAuthority(sources) {
  if (!sources || sources.length === 0) return 0;
  
  const authorityMap = {
    // Medios internacionales confiables
    'bbc': 95,
    'reuters': 95,
    'ap': 95,
    'afp': 90,
    'el país': 85,
    'the guardian': 85,
    'cnn': 80,
    'new york times': 90,
    'washington post': 90,
    
    // Medios especializados en Cuba
    'cubanet': 85,
    'diario de cuba': 80,
    '14ymedio': 85,
    'cibercuba': 75,
    'martí noticias': 80,
    
    // Medios estatales cubanos (menos autoridad para noticias críticas)
    'granma': 50,
    'cubadebate': 50,
    'prensa latina': 55
  };
  
  const avgAuthority = sources.reduce((sum, s) => {
    const sourceName = (s.source?.name || s.medio || '').toLowerCase();
    let authority = 60; // Default medio
    
    // Buscar coincidencia parcial en el mapa
    for (const [key, value] of Object.entries(authorityMap)) {
      if (sourceName.includes(key)) {
        authority = value;
        break;
      }
    }
    
    return sum + authority;
  }, 0) / sources.length;
  
  return Math.round(avgAuthority);
}

/**
 * Calcula tendencia: velocidad de publicación
 */
function calculateTrend(sources) {
  if (!sources || sources.length < 2) return 50;
  
  // Ordenar por fecha
  const sorted = [...sources].sort((a, b) => {
    const dateA = new Date(a.publishedAt || a.fecha).getTime();
    const dateB = new Date(b.publishedAt || b.fecha).getTime();
    return dateB - dateA;
  });
  
  const newest = new Date(sorted[0].publishedAt || sorted[0].fecha).getTime();
  const oldest = new Date(sorted[sorted.length - 1].publishedAt || sorted[sorted.length - 1].fecha).getTime();
  
  const timeSpan = (newest - oldest) / (1000 * 60 * 60); // en horas
  
  // Si muchas noticias en poco tiempo = alta tendencia
  const velocity = sources.length / Math.max(timeSpan, 1);
  
  // Normalizar: > 1 noticia/hora = 100
  return Math.min(100, Math.round(velocity * 100));
}

/**
 * Calcula relevancia sobre Cuba
 */
function calculateCubaRelevance(topic) {
  const cubaKeywords = [
    'cuba', 'cubano', 'cubana', 'la habana', 'díaz-canel',
    'economía cubana', 'política cubana', 'disidente', 'disidencia',
    'derechos humanos', 'bloqueo', 'embargo', 'reforma',
    'miguel díaz-canel', 'raúl castro', 'fidel castro',
    'régimen cubano', 'gobierno cubano', 'protestas',
    'libertad', 'represión', 'sanciones'
  ];
  
  const text = `${topic.title || ''} ${topic.description || ''} ${topic.content || ''}`.toLowerCase();
  
  let matches = 0;
  cubaKeywords.forEach(keyword => {
    if (text.includes(keyword)) matches++;
  });
  
  // Normalizar: 0 keywords = 0, 5+ keywords = 100
  return Math.min(100, matches * 20);
}

/**
 * Calcula novedad: qué tan único es el tema
 */
function calculateNovelty(topic) {
  // Placeholder: en producción, comparar contra temas anteriores
  // Por ahora, usar heurística simple
  
  const text = `${topic.title || ''} ${topic.description || ''}`.toLowerCase();
  
  // Palabras clave de novedad
  const noveltyKeywords = [
    'nuevo', 'primera vez', 'histórico', 'inédito', 'récord',
    'nunca antes', 'sorprendente', 'inesperado', 'exclusiva'
  ];
  
  let noveltyScore = 50; // Base
  
  noveltyKeywords.forEach(keyword => {
    if (text.includes(keyword)) noveltyScore += 10;
  });
  
  return Math.min(100, noveltyScore);
}

/**
 * Determina confianza basada en fuentes y consenso
 * Criterios para Alta: ≥3 fuentes únicas + consenso alto + concordancia temporal
 */
function calculateConfidence(sources, consenso) {
  const count = sources?.length || 0;
  
  // Verificar unicidad de fuentes (dominios diferentes)
  const uniqueDomains = new Set(
    sources.map(s => {
      try {
        const url = new URL(s.url || s.source?.url || '');
        return url.hostname;
      } catch {
        return s.medio || s.source?.name || 'unknown';
      }
    })
  ).size;
  
  // Verificar concordancia temporal (todas en rango de 48h)
  const dates = sources
    .map(s => new Date(s.publishedAt || s.fecha))
    .filter(d => !isNaN(d.getTime()));
  
  let temporalConsistency = false;
  if (dates.length >= 2) {
    const timestamps = dates.map(d => d.getTime());
    const maxDiff = Math.max(...timestamps) - Math.min(...timestamps);
    const hoursDiff = maxDiff / (1000 * 60 * 60);
    temporalConsistency = hoursDiff <= 48; // 48 horas máximo entre primera y última
  }
  
  // Alta: ≥3 fuentes únicas + consenso fuerte + concordancia temporal
  if (uniqueDomains >= 3 && consenso >= 60 && temporalConsistency) {
    return 'Alta';
  }
  
  // Media: ≥2 fuentes + consenso razonable
  if (count >= 2 && consenso >= 40) {
    return 'Media';
  }
  
  return 'Baja';
}

/**
 * Aplica boost de priorización de Cuba si está habilitado
 * @param {Object} topic - Tema con información básica
 * @param {number} baseScore - Score base calculado
 * @param {boolean} prioridadCuba - Si está habilitado el boost
 * @returns {number} Score con boost aplicado
 */
function applyCubaBoost(topic, baseScore, prioridadCuba = true) {
  if (!prioridadCuba) return baseScore;
  
  const text = `${topic.tituloSugerido || ''} ${topic.resumenBreve || ''}`.toLowerCase();
  const url = topic.fuentesTop?.[0]?.url || '';
  const category = (topic.categoriaSugerida || '').toLowerCase();
  
  // Keywords de Cuba (case-insensitive)
  const cubaKeywords = [
    'cuba', 'cubano', 'cubana', 'habana', 'habanero',
    'díaz-canel', 'diaz-canel', 'bloqueo', 'miami',
    'relaciones cuba', 'la habana'
  ];
  
  let boost = 0;
  
  // Detectar si hay match con keywords de Cuba
  const hasCubaKeyword = cubaKeywords.some(kw => 
    text.includes(kw) || url.toLowerCase().includes(kw)
  );
  
  if (hasCubaKeyword) {
    // Boost base para temas de Cuba
    boost += 40;
    
    // Boost adicional si co-ocurre con contexto internacional
    const hasInternationalContext = 
      text.includes('eeuu') || text.includes('ee.uu') || 
      text.includes('estados unidos') || text.includes('internacional') ||
      text.includes('diplomacia') || text.includes('relaciones');
    
    if (hasInternationalContext) {
      boost += 15;
    }
    
    // Boost adicional si la categoría es Internacional
    if (category === 'internacional') {
      boost += 10;
    }
  }
  
  return Math.min(100, baseScore + boost);
}

module.exports = {
  calculateImpactScore,
  calculateRecency,
  calculateConsensus,
  calculateAuthority,
  calculateTrend,
  calculateCubaRelevance,
  calculateNovelty,
  calculateConfidence,
  applyCubaBoost
};
