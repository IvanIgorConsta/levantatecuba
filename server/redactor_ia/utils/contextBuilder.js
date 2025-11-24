// server/redactor_ia/utils/contextBuilder.js
/**
 * Motor de selección de contexto visual para generación de imágenes
 * Mapea contenido de noticia → contextId → reglas de prompt
 * Incluye adaptación por nivel económico del país
 * 
 * DEFAULT_CONTEXT: "generic-city" (neutral, sin sesgo a desastre)
 * storm-impact solo se usa con alta confianza (≥2 keywords específicos)
 */

// Contexto neutral por defecto (sin sesgo a desastre)
const DEFAULT_CONTEXT = 'generic-city';

/**
 * Clasificación de países por nivel económico
 */
const COUNTRY_ECONOMIC_LEVELS = {
  rich: [
    'estados unidos', 'usa', 'eeuu', 'united states', 'miami', 'nueva york', 'california',
    'canadá', 'canada',
    'alemania', 'germany', 'berlín',
    'francia', 'france', 'parís',
    'reino unido', 'uk', 'united kingdom', 'inglaterra', 'londres',
    'japón', 'japan', 'tokio',
    'corea del sur', 'south korea', 'seúl',
    'australia', 'sydney',
    'españa', 'spain', 'madrid', 'barcelona',
    'italia', 'italy', 'roma',
    'países bajos', 'holanda', 'netherlands', 'ámsterdam',
    'suiza', 'switzerland',
    'noruega', 'norway',
    'suecia', 'sweden',
    'dinamarca', 'denmark'
  ],
  
  moderate: [
    'méxico', 'mexico', 'ciudad de méxico',
    'brasil', 'brazil', 'são paulo', 'rio de janeiro',
    'colombia', 'bogotá',
    'argentina', 'buenos aires',
    'chile', 'santiago',
    'perú', 'peru', 'lima',
    'ecuador', 'quito',
    'uruguay', 'montevideo',
    'costa rica', 'san josé',
    'panamá', 'panama',
    'turquía', 'turkey', 'estambul',
    'rumania', 'romania',
    'polonia', 'poland',
    'portugal', 'lisboa',
    'grecia', 'greece', 'atenas',
    'república dominicana', 'santo domingo',
    'guatemala'
  ],
  
  poor: [
    'cuba', 'habana', 'la habana', 'santiago de cuba',
    'venezuela', 'caracas',
    'haití', 'haiti', 'puerto príncipe',
    'nicaragua', 'managua',
    'honduras', 'tegucigalpa',
    'bolivia', 'la paz',
    'el salvador', 'san salvador',
    'paraguay', 'asunción'
  ]
};

/**
 * Detecta país mencionado en el contenido con confianza
 * NUEVA LÓGICA: Detección fiable basada en aliases, SIN fallback a Cuba/USA
 * @returns {{ countryCode: string|null, countryName: string|null, countryConfidence: number, economicLevel: string }}
 */
function detectCountry({ title, summary = '', tags = [], content = '' }) {
  // Construir texto de análisis (título + summary + content limpio + tags)
  const cleanContent = String(content || '').substring(0, 1000);
  const fullText = `${title} ${summary} ${cleanContent} ${tags.join(' ')}`.toLowerCase();
  
  // Lista de países con aliases (inglés y español) + códigos ISO
  const countryPatterns = [
    { patterns: ['cuba', 'cubano', 'cubana', 'cubanos', 'la habana', 'habana', 'santiago de cuba'], countryName: 'Cuba', countryCode: 'CU' },
    { patterns: ['bélgica', 'belgium', 'belgian', 'bruselas', 'brussels', 'brujas', 'amberes'], countryName: 'Belgium', countryCode: 'BE' },
    { patterns: ['reino unido', 'uk', 'united kingdom', 'inglaterra', 'england', 'londres', 'london', 'británico', 'british'], countryName: 'United Kingdom', countryCode: 'GB' },
    { patterns: ['estados unidos', 'eeuu', 'usa', 'united states', 'american', 'estadounidense', 'miami', 'nueva york', 'washington'], countryName: 'United States', countryCode: 'US' },
    { patterns: ['rusia', 'russia', 'russian', 'ruso', 'moscú', 'moscow', 'san petersburgo'], countryName: 'Russia', countryCode: 'RU' },
    { patterns: ['india', 'indian', 'indio', 'nueva delhi', 'mumbai', 'bangalore'], countryName: 'India', countryCode: 'IN' },
    { patterns: ['china', 'chinese', 'chino', 'beijing', 'pekín', 'shanghai', 'hong kong'], countryName: 'China', countryCode: 'CN' },
    { patterns: ['francia', 'france', 'french', 'francés', 'parís', 'paris', 'lyon'], countryName: 'France', countryCode: 'FR' },
    { patterns: ['alemania', 'germany', 'german', 'alemán', 'berlín', 'berlin', 'munich'], countryName: 'Germany', countryCode: 'DE' },
    { patterns: ['españa', 'spain', 'spanish', 'español', 'madrid', 'barcelona'], countryName: 'Spain', countryCode: 'ES' },
    { patterns: ['italia', 'italy', 'italian', 'italiano', 'roma', 'rome', 'milán'], countryName: 'Italy', countryCode: 'IT' },
    { patterns: ['japón', 'japan', 'japanese', 'japonés', 'tokio', 'tokyo'], countryName: 'Japan', countryCode: 'JP' },
    { patterns: ['méxico', 'mexico', 'mexican', 'mexicano', 'ciudad de méxico'], countryName: 'Mexico', countryCode: 'MX' },
    { patterns: ['brasil', 'brazil', 'brazilian', 'brasileño', 'são paulo', 'rio de janeiro'], countryName: 'Brazil', countryCode: 'BR' },
    { patterns: ['argentina', 'argentino', 'buenos aires'], countryName: 'Argentina', countryCode: 'AR' },
    { patterns: ['colombia', 'colombiano', 'bogotá'], countryName: 'Colombia', countryCode: 'CO' },
    { patterns: ['venezuela', 'venezuelano', 'caracas'], countryName: 'Venezuela', countryCode: 'VE' },
    { patterns: ['chile', 'chileno', 'santiago'], countryName: 'Chile', countryCode: 'CL' },
    { patterns: ['perú', 'peru', 'peruano', 'lima'], countryName: 'Peru', countryCode: 'PE' }
  ];
  
  // Buscar primera coincidencia en el texto (orden = prioridad)
  let firstMatch = null;
  let firstPosition = Infinity;
  
  for (const { patterns, countryName, countryCode } of countryPatterns) {
    for (const pattern of patterns) {
      const pos = fullText.indexOf(pattern);
      if (pos !== -1 && pos < firstPosition) {
        firstPosition = pos;
        firstMatch = { countryName, countryCode };
      }
    }
  }
  
  if (firstMatch) {
    // Calcular confianza basada en posición (título > summary > content)
    const titleLen = title.length;
    const summaryLen = summary.length;
    let confidence = 0.9; // Alta confianza por defecto
    
    if (firstPosition < titleLen) {
      confidence = 0.95; // Muy alta si está en título
    } else if (firstPosition < titleLen + summaryLen) {
      confidence = 0.85; // Alta si está en summary
    } else {
      confidence = 0.7; // Media si solo está en contenido
    }
    
    console.log(`[ContextBuilder] 🌍 País detectado: ${firstMatch.countryName} (${firstMatch.countryCode}) - confianza: ${confidence}`);
    
    return {
      countryCode: firstMatch.countryCode,
      countryName: firstMatch.countryName,
      countryConfidence: confidence,
      economicLevel: 'neutral'
    };
  }
  
  // NO se detectó país específico → marcar como "global"
  console.log('[ContextBuilder] 🌐 Sin país detectado → contexto global');
  return {
    countryCode: null,
    countryName: 'global',
    countryConfidence: 0,
    economicLevel: 'neutral'
  };
}

/**
 * Variantes económicas para contextos sensibles
 * Aplica realismo económico según el país detectado
 */
const ECONOMIC_VARIANTS = {
  'storm-provisions': {
    rich: 'modern logistics center with new forklifts, LED lighting, wide organized warehouse, clean signage, modern work clothing, new materials, FEMA-style professional setup',
    moderate: 'mixed infrastructure warehouse, modern but worn equipment, irregular lighting, somewhat used walls, varied pallets and boxes, adequate but not abundant resources',
    poor: 'rustic state warehouse, deteriorated walls, dim fluorescent lighting, visible scarcity, generic boxes without logos, few tools, simple clothing, improvised solutions',
    neutral: 'warehouse-like distribution center with generic supply boxes and packages being organized, civil defense workers in simple vests handling provisions, indoor storage facility'
  },
  
  'queue-ration': {
    rich: 'modern government service center with digital screens, organized queue management system, clean counters, professional staff',
    moderate: 'government office with basic queue system, worn furniture, mixed modern and old equipment, adequate but aging infrastructure',
    poor: 'simple state window with people waiting, basic queue, worn counters, minimal equipment, improvised organization',
    neutral: 'people waiting in line at generic government window, queue formation, administrative setting with blank forms (no readable text)'
  },
  
  'economy-market': {
    rich: 'modern supermarket with organized shelves, abundant products (no brands visible), clean aisles, good lighting, modern checkout',
    moderate: 'neighborhood market with mixed product availability, basic shelving, adequate lighting, some wear and tear',
    poor: 'simple store with limited products on basic shelves, scarce inventory, improvised displays, minimal infrastructure',
    neutral: 'market or store scene with generic products on shelves (no brands), cash transactions with generic bills, economic activity'
  },
  
  'government-press': {
    rich: 'professional press room with modern podium, high-quality backdrop, multiple microphones, good lighting setup',
    moderate: 'formal government room with standard podium, basic backdrop, adequate lighting, mixed equipment quality',
    poor: 'simple official room with basic podium, plain backdrop, minimal equipment, improvised press setup',
    neutral: 'official press conference setting with podium, neutral backdrop with generic government seal (no text), microphones without visible logos'
  },
  
  'hospital': {
    rich: 'modern medical facility with advanced equipment, clean bright spaces, latest technology (no brand names)',
    moderate: 'functional hospital with adequate equipment, some modern some older, maintained but showing use',
    poor: 'basic medical facility with limited equipment, older technology, scarce resources, simple infrastructure',
    neutral: 'medical facility with generic equipment, healthcare workers in scrubs or white coats, clinical setting with medical supplies (no brand names)'
  },
  
  'energy-blackout': {
    rich: 'modern power infrastructure with advanced equipment, maintenance crews with new gear, professional utility vehicles',
    moderate: 'standard electrical infrastructure with adequate maintenance, mixed equipment age, functional utility setup',
    poor: 'aged electrical infrastructure, improvised repairs, limited equipment, basic utility response',
    neutral: 'darkened cityscape or power infrastructure, electrical poles and lines, night scene with minimal lighting, utility workers'
  }
};

// NEGATIVOS MÍNIMOS: Solo texto y logos para maximizar libertad creativa
const MINIMAL_NEGATIVE = 'text, letters, logos, watermarks, readable signage';

/**
 * Taxonomía de contextos visuales
 * Cada contexto define: escena, negative prompts MÍNIMOS, y estilo
 * CAMBIO: Negativos reducidos al mínimo (solo texto/logos) para eliminar censura visual
 */
const CONTEXT_TAXONOMY = {
  'storm-provisions': {
    keywords: ['provisiones', 'raciones', 'abastecimiento', 'libreta', 'tiendas', 'azúcar', 'arroz', 'defensa civil', 'suministros', 'alimentos', 'distribución'],
    promptContext: 'warehouse-like distribution center with generic supply boxes and packages being organized, civil defense workers in simple vests handling provisions, indoor storage facility',
    negative: MINIMAL_NEGATIVE,
    style: 'Photojournalism, documentary realism, 3:2 aspect ratio'
  },
  
  'storm-impact': {
    keywords: ['lluvia', 'viento', 'calles inundadas', 'techos', 'protección civil', 'evacuación', 'refugio', 'daños', 'inundación', 'inundaciones', 'huracán', 'ciclón', 'tormenta', 'deslizamiento', 'rescate', 'emergencia'],
    promptContext: 'rain-soaked streets with pooled water, wind-blown debris, damaged roofs or infrastructure, civil protection personnel in rain gear, overcast stormy atmosphere',
    negative: MINIMAL_NEGATIVE,
    style: 'Photojournalism, documentary realism, dramatic weather lighting, 3:2'
  },
  
  'protest': {
    keywords: ['protesta', 'manifestación', 'cacerolazo', 'pancartas', 'concentración', 'marcha', 'activistas', 'detención', 'represión'],
    promptContext: 'street protest scene with crowd of people holding blank placards and banners (no readable text), urban setting, diverse group of demonstrators',
    negative: MINIMAL_NEGATIVE,
    style: 'Photojournalism, street photography, natural lighting, 3:2'
  },
  
  'courtroom': {
    keywords: ['juicio', 'tribunal', 'fiscalía', 'audiencia', 'corte', 'sala judicial', 'sentencia'],
    promptContext: 'courtroom interior with wooden benches, judge bench, neutral government seal (no text), formal legal setting',
    negative: MINIMAL_NEGATIVE,
    style: 'Documentary photography, formal composition, neutral lighting, 3:2'
  },
  
  'hospital': {
    keywords: ['hospital', 'UCI', 'ambulancia', 'vacunación', 'médico', 'enfermera', 'clínica', 'salud'],
    promptContext: 'medical facility with generic equipment, healthcare workers in scrubs or white coats, clinical setting with medical supplies (no brand names)',
    negative: MINIMAL_NEGATIVE,
    style: 'Documentary photography, clinical lighting, professional, 3:2'
  },
  
  'school': {
    keywords: ['escuela', 'aula', 'estudiantes', 'maestro', 'educación', 'universidad', 'colegio'],
    promptContext: 'classroom setting with desks, students (backs or distant), teacher at blackboard, educational materials without readable text',
    negative: MINIMAL_NEGATIVE,
    style: 'Documentary photography, natural classroom lighting, 3:2'
  },
  
  'government-press': {
    keywords: ['conferencia de prensa', 'anuncio gubernamental', 'portavoz', 'declaraciones oficiales', 'rueda de prensa', 'reunión oficial', 'reunión', 'encuentro', 'cumbre'],
    promptContext: 'official press conference setting with podium, neutral backdrop with generic government seal (no text), microphones without visible logos',
    negative: MINIMAL_NEGATIVE,
    style: 'Editorial photography, formal composition, neutral lighting, 3:2'
  },
  
  'economy-market': {
    keywords: ['inflación', 'mercado', 'colas', 'billetes', 'precios', 'economía', 'comercio', 'tienda'],
    promptContext: 'market or store scene with generic products on shelves (no brands), cash transactions with generic bills, economic activity',
    negative: MINIMAL_NEGATIVE,
    style: 'Documentary photography, natural market lighting, candid, 3:2'
  },
  
  'border-migration': {
    keywords: ['frontera', 'migración', 'guardia fronteriza', 'aduana', 'migrantes', 'cruce'],
    promptContext: 'border checkpoint or barrier, border patrol vehicles (no text), people waiting in line, neutral border infrastructure',
    negative: MINIMAL_NEGATIVE,
    style: 'Documentary photography, outdoor natural lighting, wide angle, 3:2'
  },
  
  'police-military': {
    keywords: ['operativo policial', 'patrulla', 'retén', 'policía', 'militar', 'seguridad'],
    promptContext: 'police or military patrol scene, generic patrol vehicles (no text), security checkpoint, uniformed personnel',
    negative: MINIMAL_NEGATIVE,
    style: 'Documentary photography, neutral composition, 3:2'
  },
  
  'fire': {
    keywords: ['incendio', 'bomberos', 'humo', 'llamas', 'brigada'],
    promptContext: 'fire scene with smoke and flames, firefighters in protective gear, fire trucks (no text), emergency response',
    negative: MINIMAL_NEGATIVE,
    style: 'Photojournalism, dramatic lighting from fire, action shot, 3:2'
  },
  
  'agriculture': {
    keywords: ['cosecha', 'campo', 'tractor', 'agricultura', 'cultivo', 'campesinos'],
    promptContext: 'agricultural field with crops, farming equipment (no brands), rural setting, farmers working',
    negative: MINIMAL_NEGATIVE,
    style: 'Documentary photography, natural outdoor lighting, 3:2'
  },
  
  'energy-blackout': {
    keywords: ['apagón', 'planta eléctrica', 'postes', 'ciudad a oscuras', 'energía', 'electricidad', 'corte de luz'],
    promptContext: 'darkened cityscape or power infrastructure, electrical poles and lines, night scene with minimal lighting, utility workers',
    negative: MINIMAL_NEGATIVE,
    style: 'Documentary photography, low-light urban, dramatic shadows, 3:2'
  },
  
  'queue-ration': {
    keywords: ['colas', 'ventanilla estatal', 'cupones', 'fila', 'espera', 'trámite'],
    promptContext: 'people waiting in line at generic government window, queue formation, administrative setting with blank forms (no readable text)',
    negative: MINIMAL_NEGATIVE,
    style: 'Documentary photography, neutral composition, 3:2'
  },
  
  'tech-press': {
    keywords: ['presentación tecnológica', 'lanzamiento', 'innovación', 'tecnología', 'startup'],
    promptContext: 'technology presentation with generic displays (no brand names), presenter with neutral backdrop, tech event setting',
    negative: MINIMAL_NEGATIVE,
    style: 'Editorial photography, modern lighting, professional, 3:2'
  },
  
  'street-interview': {
    keywords: ['entrevista callejera', 'opinión pública', 'vox populi', 'declaraciones'],
    promptContext: 'street interview scene with journalist holding generic microphone (no logo), urban background, candid interaction',
    negative: MINIMAL_NEGATIVE,
    style: 'Documentary photography, natural street lighting, candid, 3:2'
  },
  
  'person-press': {
    keywords: ['discurso', 'declaración', 'comparecencia', 'líder', 'político'],
    promptContext: 'official speaking at podium or formal setting, neutral government backdrop (no text), professional atmosphere',
    negative: MINIMAL_NEGATIVE,
    style: 'Editorial photography, formal composition, neutral lighting, 3:2'
  },
  
  'generic-city': {
    keywords: [], // fallback
    promptContext: 'neutral urban scene, city street or plaza, everyday city life, balanced composition',
    negative: MINIMAL_NEGATIVE,
    style: 'Documentary photography, natural lighting, 3:2'
  }
};

/**
 * Selecciona el contextId más apropiado basado en el contenido
 * AHORA incluye detección de país con confianza
 * @param {Object} params
 * @param {string} params.title - Título
 * @param {string} params.summary - Resumen/bajada
 * @param {string[]} params.tags - Etiquetas
 * @param {string} params.content - Contenido limpio (opcional)
 * @param {string[]} params.sources - URLs de fuentes (opcional)
 * @param {string} params.eventType - Tipo de evento detectado (opcional)
 * @param {boolean} params.isPerson - Si se detectó una persona
 * @returns {{ contextId: string, keywords: string[], confidence: number, countryCode: string|null, countryName: string|null, countryConfidence: number, economicLevel: string }}
 */
function selectContext({ title, summary = '', tags = [], content = '', sources = [], eventType = null, isPerson = false }) {
  // Detectar país y nivel económico
  const { countryCode, countryName, countryConfidence, economicLevel } = detectCountry({ title, summary, tags, content, sources });
  const fullText = `${title} ${summary} ${tags.join(' ')}`.toLowerCase();
  
  console.log('[ContextBuilder] Seleccionando contexto para:', title.substring(0, 60));
  
  // Si hay evento detectado, priorizar contextos relacionados SOLO con alta confianza
  if (eventType) {
    const eventContextMap = {
      'storm': ['storm-impact', 'storm-provisions'],
      'fire': ['fire'],
      'blackout': ['energy-blackout'],
      'protest': ['protest'],
      'earthquake': ['storm-impact'], // similar a desastre
      'flood': ['storm-impact']
    };
    
    const candidateContexts = eventContextMap[eventType] || [];
    
    // NUEVA LÓGICA: Requerir ≥2 keywords para storm-impact, ≥1 para otros
    const minKeywords = (eventType === 'storm' || eventType === 'flood' || eventType === 'earthquake') ? 2 : 1;
    
    for (const contextId of candidateContexts) {
      const context = CONTEXT_TAXONOMY[contextId];
      const matchedKws = context.keywords.filter(kw => fullText.includes(kw));
      const matchCount = matchedKws.length;
      
      if (matchCount >= minKeywords) {
        console.log(`[Context] id=${contextId} reason=event_${eventType} keywords=${matchCount} matched=[${matchedKws.join(', ')}]`);
        return {
          contextId,
          keywords: matchedKws,
          confidence: 90,
          countryCode,
          countryName,
          countryConfidence,
          economicLevel
        };
      } else if (matchCount > 0) {
        console.log(`[Context] id=${contextId} rejected, insufficient keywords (${matchCount} < ${minKeywords})`);
      }
    }
    
    // NO usar fallback automático para desastres - debe haber evidencia real
    console.log(`[Context] event=${eventType} detected but insufficient keywords → falling back to keyword search`);
  }
  
  // Si es persona con contexto específico
  if (isPerson) {
    // Buscar contextos que mencionen persona/político
    const scored = Object.entries(CONTEXT_TAXONOMY).map(([contextId, context]) => {
      const matchCount = context.keywords.filter(kw => fullText.includes(kw)).length;
      return { contextId, matchCount, context };
    });
    
    scored.sort((a, b) => b.matchCount - a.matchCount);
    
    if (scored[0].matchCount > 0) {
      const { contextId, matchCount, context } = scored[0];
      const matchedKeywords = context.keywords.filter(kw => fullText.includes(kw));
      
      console.log(`[Context] id=${contextId} reason=keywords_match keywords=[${matchedKeywords.join(', ')}]`);
      
      return {
        contextId,
        keywords: matchedKeywords,
        confidence: Math.min(95, 60 + matchCount * 10),
        countryCode,
        countryName,
        countryConfidence,
        economicLevel
      };
    }
    
    // Fallback para persona sin contexto específico
    console.log('[Context] id=person-press reason=person_fallback');
    return { contextId: 'person-press', keywords: [], confidence: 50, countryCode, countryName, countryConfidence, economicLevel };
  }
  
  // Búsqueda general por keywords
  const scored = Object.entries(CONTEXT_TAXONOMY).map(([contextId, context]) => {
    const matchCount = context.keywords.filter(kw => fullText.includes(kw)).length;
    return { contextId, matchCount, context };
  });
  
  scored.sort((a, b) => b.matchCount - a.matchCount);
  
  if (scored[0].matchCount > 0) {
    const { contextId, matchCount, context } = scored[0];
    const matchedKeywords = context.keywords.filter(kw => fullText.includes(kw));
    
    console.log(`[Context] id=${contextId} reason=keywords_match keywords=[${matchedKeywords.join(', ')}]`);
    
    return {
      contextId,
      keywords: matchedKeywords,
      confidence: Math.min(95, 50 + matchCount * 15),
      countryCode,
      countryName,
      countryConfidence,
      economicLevel
    };
  }
  
  // Fallback a DEFAULT_CONTEXT (generic-city neutral)
  console.log(`[Context] id=${DEFAULT_CONTEXT} reason=no_match (default_neutral)`);
  return { contextId: DEFAULT_CONTEXT, keywords: [], confidence: 30, countryCode, countryName, countryConfidence, economicLevel };
}

/**
 * Obtiene las reglas de un contexto SIN adaptación económica
 * @param {string} contextId - ID del contexto
 * @param {string} economicLevel - Nivel económico (IGNORADO)
 * @returns {{ promptContext: string, negative: string, style: string }}
 */
function getContextRules(contextId, economicLevel = 'neutral') {
  const context = CONTEXT_TAXONOMY[contextId] || CONTEXT_TAXONOMY['generic-city'];
  
  // NO aplicar variantes económicas - usar solo el prompt base neutral
  return {
    promptContext: context.promptContext,
    negative: context.negative,
    style: context.style
  };
}

module.exports = {
  selectContext,
  getContextRules,
  detectCountry,
  CONTEXT_TAXONOMY,
  ECONOMIC_VARIANTS
};
