// server/redactor_ia/services/imageThemeEngine.js
/**
 * Motor minimalista de detección de tema visual para imágenes
 * SIN sesgos geográficos ni heurísticas problemáticas
 * Selecciona tema basándose ÚNICAMENTE en título + resumen + contenido + etiquetas/categoría
 */

/**
 * Keywords por tema (intenciones claras)
 */
const THEME_KEYWORDS = {
  justice: [
    'espionaje', 'delito', 'fiscalía', 'juicio', 'tribunal', 'sentencia',
    'acusación', 'corrupción', 'juzgado', 'condena', 'investigación penal',
    'detención', 'arresto', 'cargo criminal', 'audiencia judicial'
  ],
  politics: [
    'ministro', 'gobierno', 'parlamento', 'política', 'decreto', 'partido',
    'presidente', 'congreso', 'senado', 'diputado', 'elecciones', 'reforma',
    'gabinete', 'legislación', 'diplomacia'
  ],
  economy: [
    'inflación', 'precios', 'salario', 'pib', 'importación', 'exportación',
    'mercado', 'divisa', 'economía', 'comercio', 'finanzas', 'inversión',
    'bolsa', 'deuda', 'déficit', 'crecimiento económico'
  ],
  technology: [
    'ia', 'software', 'ciberseguridad', 'datos', 'startup', 'app', 'satélite',
    'chip', 'tecnología', 'innovación', 'inteligencia artificial', 'blockchain',
    'algoritmo', 'programación', 'digital'
  ],
  sports: [
    'equipo', 'jugador', 'liga', 'campeonato', 'partido', 'estadio', 'entrenador',
    'torneo', 'copa', 'atleta', 'deporte', 'pelota', 'fútbol', 'béisbol'
  ],
  culture: [
    'arte', 'música', 'cine', 'teatro', 'exposición', 'festival', 'concierto',
    'película', 'artista', 'cultura', 'museo', 'literatura', 'danza'
  ],
  society: [
    'comunidad', 'sociedad', 'civil', 'ciudadano', 'vecinos', 'barrio',
    'población', 'social', 'bienestar', 'servicio público'
  ]
};

/**
 * Keywords de desastres (requieren alta confianza)
 */
const DISASTER_KEYWORDS = [
  'huracán', 'ciclón', 'tormenta tropical', 'terremoto', 'sismo',
  'incendio forestal', 'incendio', 'inundación', 'inundado', 'derrumbe',
  'desastre natural', 'desastre', 'devastación', 'catástrofe'
];

/**
 * Categorías mapeadas a temas de desastre
 */
const DISASTER_CATEGORIES = [
  'desastres', 'sucesos/desastres', 'clima extremo', 'emergencias'
];

/**
 * Extrae top keywords de un texto
 * @param {string} text - Texto a analizar
 * @param {number} topK - Cantidad de keywords a retornar
 * @returns {string[]}
 */
function extractTopKeywords(text, topK = 12) {
  if (!text || typeof text !== 'string') return [];
  
  const normalized = text.toLowerCase()
    .replace(/[^\wáéíóúñü\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  // Contar frecuencias
  const freq = {};
  normalized.forEach(word => {
    freq[word] = (freq[word] || 0) + 1;
  });
  
  // Ordenar por frecuencia
  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([word]) => word);
  
  return sorted;
}

/**
 * Motor de detección de tema visual
 */
class ImageThemeEngine {
  constructor(opts = {}) {
    this.disasterThreshold = opts.disasterThreshold || 0.75;
    this.keywordsThreshold = opts.keywordsThreshold || 2;
  }
  
  /**
   * Deriva el tema visual del borrador
   * CONTEXTUAL v2: Usa contenido limpio y recortado desde buildImagePromptFromDraft
   * @param {Object} signals - { title, summary, content (ya limpio), tags, category }
   * @returns {Object} { contextId, confidence, reasons, disaster, keywords }
   */
  deriveTheme(signals) {
    const { title = '', summary = '', content = '', tags = [], category = '' } = signals;
    
    console.log('[ImageTheme] 🎨 Analizando tema visual (contextual v2: título + summary + content)');
    
    // Normalizar inputs - content ya viene limpio desde stripMarkdownToPlainText
    const titleText = String(title || '').toLowerCase();
    const summaryText = String(summary || '').toLowerCase();
    const cleanContent = String(content || '').substring(0, 1500).toLowerCase(); // Hasta 1500 chars del contenido ya limpio
    
    // Construir texto de análisis con weight a título/summary, pero incluye contenido
    const fullText = `${titleText} ${summaryText} ${cleanContent}`;
    const normalizedCategory = (category || '').toLowerCase();
    const normalizedTags = tags.map(t => String(t).toLowerCase());
    
    // Extraer keywords de título + summary + parte del content
    const keywords = extractTopKeywords(`${title} ${summary} ${cleanContent.substring(0, 500)}`, 12);
    
    console.log(`[ImageTheme] text_sources: title=${!!title} summary=${!!summary} content_clean=${cleanContent.length}chars`);
    console.log(`[ImageTheme] detected_keywords: ${keywords.slice(0, 5).join(', ')}`);
    
    const reasons = [];
    let contextId = 'generic';
    let confidence = 0.3;
    let disaster = false;
    
    // ========== PASO 1: Detectar DESASTRE (alta confianza requerida) ==========
    
    // Señal 1: Categoría explícita de desastre
    const catIsDisaster = DISASTER_CATEGORIES.some(dc => normalizedCategory.includes(dc));
    
    // Señal 2: Keywords de desastre en título
    const titleDisasterMatches = DISASTER_KEYWORDS.filter(kw => 
      titleText.includes(kw)
    );
    
    // Señal 3: Keywords de desastre en contenido
    const contentDisasterMatches = DISASTER_KEYWORDS.filter(kw => 
      cleanContent.includes(kw)
    );
    
    // Señal 4: Tags con keywords de desastre
    const tagHasDisaster = normalizedTags.some(tag => 
      DISASTER_KEYWORDS.some(kw => tag.includes(kw))
    );
    
    // GATE ESTRICTO: Activar disaster solo con evidencia clara
    // Opción A: Categoría explícita
    if (catIsDisaster) {
      disaster = true;
      reasons.push(`category_disaster="${normalizedCategory}"`);
    }
    // Opción B: ≥2 keywords en título Y ≥1 en contenido
    else if (titleDisasterMatches.length >= 2 && contentDisasterMatches.length >= 1) {
      disaster = true;
      reasons.push(`title_keywords=${titleDisasterMatches.length}`, `content_keywords=${contentDisasterMatches.length}`);
    }
    // Opción C: Tags con keywords de desastre + ≥1 en título
    else if (tagHasDisaster && titleDisasterMatches.length >= 1) {
      disaster = true;
      reasons.push('tag_disaster=true', `title_keywords=${titleDisasterMatches.length}`);
    }
    
    if (disaster) {
      contextId = 'disaster';
      confidence = 0.9;
      reasons.push('theme=disaster');
      
      // Para desastres, verificar si hay interacción ciudadano-gobierno
      const citizenGovKeywords = ['damnificados', 'afectados', 'visita a zona afectada', 'encuentro con damnificados', 'reunión con pobladores'];
      const hasCitizenGov = citizenGovKeywords.some(kw => fullText.includes(kw));
      
      const disasterSceneType = hasCitizenGov ? 'citizen_government_interaction' : 'natural_disaster';
      
      return { contextId, confidence, reasons, disaster, keywords, visualSceneType: disasterSceneType };
    }
    
    // ========== PASO 2: Mapear por intención (NO-desastre) ==========
    
    // Intentar justice
    const justiceMatches = THEME_KEYWORDS.justice.filter(kw => fullText.includes(kw));
    if (justiceMatches.length >= 1) {
      contextId = 'justice';
      confidence = Math.min(0.95, 0.6 + justiceMatches.length * 0.1);
      reasons.push(`justice_keywords=${justiceMatches.length}`);
      return { contextId, confidence, reasons, disaster, keywords, visualSceneType: 'courtroom' };
    }
    
    // Intentar politics
    const politicsMatches = THEME_KEYWORDS.politics.filter(kw => fullText.includes(kw));
    if (politicsMatches.length >= this.keywordsThreshold) {
      // Detectar subtipo: protesta vs conferencia vs ciudadano-gobierno
      const protestKeywords = ['protesta', 'manifestación', 'marcha', 'concentración', 'activista', 'cacerolazo'];
      const conferenceKeywords = ['rueda de prensa', 'conferencia de prensa', 'periodistas', 'medios de comunicación', 'declaraciones a la prensa', 'micrófonos'];
      const citizenGovKeywords = ['ciudadanos', 'damnificados', 'vecinos', 'afectados', 'quejas', 'reclamaciones', 'reunión pública', 'intercambio con la población', 'visita a barrio', 'visita oficial a comunidad', 'encuentro con damnificados', 'reunión con pobladores', 'visita a zona afectada'];
      
      const hasProtest = protestKeywords.some(kw => fullText.includes(kw));
      const hasConference = conferenceKeywords.some(kw => fullText.includes(kw));
      const hasCitizenGov = citizenGovKeywords.some(kw => fullText.includes(kw));
      
      let visualSceneType = 'generic_scene';
      if (hasProtest) {
        visualSceneType = 'political_protest';
      } else if (hasCitizenGov) {
        visualSceneType = 'citizen_government_interaction';
      } else if (hasConference) {
        visualSceneType = 'press_conference';
      }
      
      contextId = 'politics';
      confidence = Math.min(0.95, 0.6 + politicsMatches.length * 0.08);
      reasons.push(`politics_keywords=${politicsMatches.length}`);
      return { contextId, confidence, reasons, disaster, keywords, visualSceneType };
    }
    
    // Intentar economy
    const economyMatches = THEME_KEYWORDS.economy.filter(kw => fullText.includes(kw));
    if (economyMatches.length >= this.keywordsThreshold) {
      contextId = 'economy';
      confidence = Math.min(0.95, 0.6 + economyMatches.length * 0.08);
      reasons.push(`economy_keywords=${economyMatches.length}`);
      return { contextId, confidence, reasons, disaster, keywords, visualSceneType: 'economic_crisis' };
    }
    
    // Intentar technology
    const technologyMatches = THEME_KEYWORDS.technology.filter(kw => fullText.includes(kw));
    if (technologyMatches.length >= this.keywordsThreshold) {
      contextId = 'technology';
      confidence = Math.min(0.95, 0.6 + technologyMatches.length * 0.08);
      reasons.push(`technology_keywords=${technologyMatches.length}`);
      return { contextId, confidence, reasons, disaster, keywords, visualSceneType: 'generic_scene' };
    }
    
    // Intentar sports
    const sportsMatches = THEME_KEYWORDS.sports.filter(kw => fullText.includes(kw));
    if (sportsMatches.length >= this.keywordsThreshold) {
      contextId = 'sports';
      confidence = Math.min(0.95, 0.6 + sportsMatches.length * 0.08);
      reasons.push(`sports_keywords=${sportsMatches.length}`);
      return { contextId, confidence, reasons, disaster, keywords, visualSceneType: 'generic_scene' };
    }
    
    // Intentar culture
    const cultureMatches = THEME_KEYWORDS.culture.filter(kw => fullText.includes(kw));
    if (cultureMatches.length >= this.keywordsThreshold) {
      contextId = 'culture';
      confidence = Math.min(0.95, 0.6 + cultureMatches.length * 0.08);
      reasons.push(`culture_keywords=${cultureMatches.length}`);
      return { contextId, confidence, reasons, disaster, keywords, visualSceneType: 'generic_scene' };
    }
    
    // Intentar society
    const societyMatches = THEME_KEYWORDS.society.filter(kw => fullText.includes(kw));
    if (societyMatches.length >= this.keywordsThreshold) {
      contextId = 'society';
      confidence = Math.min(0.95, 0.6 + societyMatches.length * 0.08);
      reasons.push(`society_keywords=${societyMatches.length}`);
      return { contextId, confidence, reasons, disaster, keywords, visualSceneType: 'generic_scene' };
    }
    
    // Mapeo de categoría a tema (fallback)
    if (normalizedCategory.includes('justicia') || normalizedCategory.includes('judicial')) {
      contextId = 'justice';
      confidence = 0.5;
      reasons.push('category_mapping=justice');
    } else if (normalizedCategory.includes('econom') || normalizedCategory.includes('mercado')) {
      contextId = 'economy';
      confidence = 0.5;
      reasons.push('category_mapping=economy');
    } else if (normalizedCategory.includes('polít') || normalizedCategory.includes('gobierno')) {
      contextId = 'politics';
      confidence = 0.5;
      reasons.push('category_mapping=politics');
    } else if (normalizedCategory.includes('tecnolog') || normalizedCategory.includes('digital')) {
      contextId = 'technology';
      confidence = 0.5;
      reasons.push('category_mapping=technology');
    } else if (normalizedCategory.includes('deport')) {
      contextId = 'sports';
      confidence = 0.5;
      reasons.push('category_mapping=sports');
    } else if (normalizedCategory.includes('cultur') || normalizedCategory.includes('arte')) {
      contextId = 'culture';
      confidence = 0.5;
      reasons.push('category_mapping=culture');
    } else if (normalizedCategory.includes('sociedad') || normalizedCategory.includes('social')) {
      contextId = 'society';
      confidence = 0.5;
      reasons.push('category_mapping=society');
    } else {
      // Sin match claro
      contextId = 'generic';
      confidence = 0.3;
      reasons.push('no_strong_signals');
    }
    
    // Detectar si hay menciones de guerra/militar para military_tension (ENDURECIDO)
    // Solo asignar si hay keywords MUY específicas de conflicto armado
    const militaryKeywords = [
      'guerra', 'conflicto armado', 'ataque', 'bombardeo', 'misil', 'misiles',
      'drones militares', 'invasión', 'tropas', 'ejército en combate', 'fuerzas armadas',
      'otan', 'frente de guerra', 'trincheras', 'ofensiva militar', 'combate armado',
      'ataque aéreo', 'bombardeo aéreo', 'operación militar'
    ];
    
    // Requiere AL MENOS 2 keywords militares para evitar falsos positivos
    const militaryMatches = militaryKeywords.filter(kw => fullText.includes(kw));
    const hasMilitary = militaryMatches.length >= 2;
    
    const visualSceneType = hasMilitary ? 'military_tension' : 'generic_scene';
    
    return { contextId, confidence, reasons, disaster, keywords, visualSceneType };
  }
}

module.exports = { ImageThemeEngine };
