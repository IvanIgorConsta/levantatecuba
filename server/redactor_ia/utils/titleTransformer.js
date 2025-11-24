// server/redactor_ia/utils/titleTransformer.js
/**
 * GENERADOR DE PROMPTS CONTEXTUALES PARA IMÁGENES EDITORIALES
 * 
 * FILOSOFÍA: El prompt debe describir fielmente el tema central de la noticia,
 * usando el contexto completo: bajada > contenido > título > categoría > tags
 * 
 * EVITA patrones genéricos repetitivos (ej: "mujer damnificada en calles destruidas")
 * GENERA covers específicos al tema real de cada noticia
 */

/**
 * Extrae brief contextual desde bajada, contenido, categoría y tags
 * @param {Object} params
 * @returns {string} Brief descriptivo del tema central
 */
function extractContextualBrief({ bajada, contenido, categoria, tags }) {
  let brief = '';
  
  // 1. Prioridad: bajada (resumen corto y específico)
  if (bajada && bajada.trim().length > 20) {
    brief = bajada.trim();
    console.log('[ContextualBrief] Usando bajada como brief principal');
    return brief;
  }
  
  // 2. Fallback: primeras 2-3 oraciones del contenido
  if (contenido && contenido.trim().length > 50) {
    const sentences = contenido
      .replace(/\n+/g, ' ')
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 30)
      .slice(0, 3);
    
    if (sentences.length > 0) {
      brief = sentences.join('. ') + '.';
      console.log('[ContextualBrief] Usando primeras oraciones del contenido');
      return brief;
    }
  }
  
  // 3. Fallback: categoría + tags
  if (categoria || (tags && tags.length > 0)) {
    const parts = [];
    if (categoria) parts.push(`Categoría: ${categoria}`);
    if (tags && tags.length > 0) {
      parts.push(`Temas: ${tags.slice(0, 5).join(', ')}`);
    }
    brief = parts.join('. ');
    console.log('[ContextualBrief] Usando categoría + tags como brief');
    return brief;
  }
  
  console.warn('[ContextualBrief] No hay contexto suficiente');
  return '';
}

/**
 * Mapea categoría a elementos visuales
 */
function getCategoryVisualRules(categoria) {
  if (!categoria) return { elementos: '', evitar: '' };
  
  const cat = categoria.toLowerCase();
  
  // Política / Socio político / Derechos humanos / Periodismo
  if (cat.includes('polít') || cat.includes('socio') || cat.includes('derecho') || cat.includes('periodis')) {
    return {
      elementos: 'abstract symbols of journalism (microphones, cameras, documents), press room settings, symbolic censorship elements (bars, shadows, redacted papers), silhouettes of reporters, laptop screens, dramatic lighting. Use GENERIC FIGURES (not realistic portraits), prefer shadows and silhouettes',
      evitar: 'NO realistic portraits, NO identifiable politicians, NO propaganda, NO dramatic street scenes with suffering people'
    };
  }
  
  // Economía
  if (cat.includes('econom') || cat.includes('mercado') || cat.includes('comercio')) {
    return {
      elementos: 'gráficos, billetes, mercados, precios, colas, tiendas, comercios',
      evitar: 'NO símbolos abstractos complejos'
    };
  }
  
  // Desastres / Huracanes / Clima
  if (cat.includes('desastre') || cat.includes('huracán') || cat.includes('clima') || cat.includes('emergencia')) {
    return {
      elementos: 'documentary style: damaged infrastructure, extreme weather impact, affected buildings, recovery efforts. Focus on ENVIRONMENT and CONTEXT, not dramatic people. Use wide shots, aerial perspectives, architectural damage',
      evitar: 'NO repetitive "suffering woman in street" scenes, NO dramatic close-ups of distressed people, VARY compositions heavily'
    };
  }
  
  // Internacional / Diplomacia
  if (cat.includes('internacional') || cat.includes('diplom') || cat.includes('exterior')) {
    return {
      elementos: 'símbolos de cooperación, reuniones, contextos internacionales, flags and national symbols when relevant',
      evitar: '' // Permitir banderas y símbolos nacionales
    };
  }
  
  // Tecnología
  if (cat.includes('tecnolog') || cat.includes('digital') || cat.includes('ciber')) {
    return {
      elementos: 'dispositivos tecnológicos, interfaces, conectividad, innovación',
      evitar: 'NO ciencia ficción excesiva'
    };
  }
  
  // Salud
  if (cat.includes('salud') || cat.includes('epidem') || cat.includes('médic')) {
    return {
      elementos: 'hospitales, personal médico, símbolos de salud, atención sanitaria',
      evitar: 'NO gore, NO escenas gráficas'
    };
  }
  
  return {
    elementos: 'relevant editorial scene based on theme, use symbolic and abstract elements, generic silhouettes if people needed',
    evitar: 'NO realistic portraits, NO repetitive patterns, NO unnecessary drama'
  };
}

/**
 * Construye prompt contextual basado en bajada, contenido, categoría y tags
 * @param {Object} params - Parámetros
 * @param {string} params.title - Título de la noticia
 * @param {string} [params.bajada] - Bajada/resumen (PRIORIDAD ALTA)
 * @param {string} [params.contenido] - Contenido completo
 * @param {string} [params.category] - Categoría de la noticia
 * @param {Array<string>} [params.tags] - Tags/etiquetas
 * @returns {string} Prompt contextual para imagen
 */
function buildImagePromptFromTitle({ title, bajada, contenido, category, tags }) {
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    console.warn('[TitleTransformer] Título vacío, usando prompt genérico');
    return 'Ilustración editorial moderna y profesional para noticia periodística.';
  }

  // 1. Extraer brief contextual (bajada > contenido > categoría+tags)
  const brief = extractContextualBrief({ bajada, contenido, categoria: category, tags });
  
  console.log(`[TitleTransformer] brief_length=${brief.length} chars`);
  
  // 2. Obtener reglas visuales por categoría
  const visualRules = getCategoryVisualRules(category);
  
  // 3. Construir prompt editorial contextual
  const parts = [];
  
  // Base: brief contextual como descripción principal
  if (brief && brief.length > 0) {
    parts.push(`Editorial illustration for a news article. Main theme: ${brief.substring(0, 400)}.`);
  } else {
    parts.push(`Editorial illustration for: "${title}".`);
  }
  
  // Elementos visuales por categoría
  if (visualRules.elementos) {
    parts.push(`Visual elements: ${visualRules.elementos}.`);
  }
  
  // Estilo editorial profesional
  parts.push(
    'Style: Modern editorial illustration, ' +
    'horizontal format 16:9, cinematic lighting, clear composition. ' +
    'Professional and neutral. ' +
    'Use SYMBOLIC and ABSTRACT elements. ' +
    'If people needed: use GENERIC SILHOUETTES or SHADOWY FIGURES (NOT realistic portraits).'
  );
  
  // Restricciones globales reforzadas
  const restrictions = [
    visualRules.evitar,
    'NO realistic human portraits or faces',
    'NO identifiable politicians or public figures',
    'NO dramatic suffering scenes',
    'NO text or readable signs',
    'NO watermarks',
    'PREFER: symbols, abstract elements, environmental context over people'
  ].filter(Boolean);
  
  parts.push(`MANDATORY RESTRICTIONS: ${restrictions.join(', ')}.`);

  const finalPrompt = parts.join(' ');
  
  console.log(`[TitleTransformer] prompt_length=${finalPrompt.length} chars`);
  
  return finalPrompt;
}

/**
 * Transforma contexto completo en prompt contextual (interfaz pública)
 * @param {string} title - Título de la noticia
 * @param {Object} [options] - Opciones adicionales
 * @param {string} [options.bajada] - Bajada/resumen (PRIORIDAD)
 * @param {string} [options.contenido] - Contenido completo
 * @param {string} [options.category] - Categoría
 * @param {Array<string>} [options.tags] - Tags
 * @returns {string} Prompt contextual
 */
function transformTitleToConcept(title, options = {}) {
  console.log(`[TitleTransformer] 📰 Título: "${title?.substring(0, 80)}${title?.length > 80 ? '...' : ''}"`);
  
  const prompt = buildImagePromptFromTitle({
    title,
    bajada: options.bajada,
    contenido: options.contenido,
    category: options.category,
    tags: options.tags
  });
  
  console.log(`[TitleTransformer] ✅ Prompt contextual generado`);
  console.log(`[TitleTransformer] Preview: "${prompt.substring(0, 150)}..."`);
  
  return prompt;
}

/**
 * Detecta si el contenido/título es político
 * @param {string} text - Texto a analizar
 * @returns {boolean} True si contiene menciones políticas
 */
function isPoliticalContent(text) {
  if (!text) return false;
  
  const textLower = text.toLowerCase();
  
  // Keywords políticas (políticos cubanos y contexto político)
  const politicalKeywords = [
    'díaz-canel', 'diaz-canel',
    'raúl castro', 'raul castro',
    'fidel castro',
    'presidente', 'mandatario',
    'gobierno cubano', 'régimen',
    'asamblea nacional', 'parlamento',
    'primer ministro', 'ministro',
    'partido comunista'
  ];
  
  return politicalKeywords.some(keyword => textLower.includes(keyword));
}

/**
 * Genera resumen corto del contenido para usar en prompt
 * @param {string} content - Contenido completo del borrador
 * @param {string} title - Título de la noticia
 * @returns {string} Resumen de 3-5 oraciones
 */
function generateContentSummary(content, title) {
  if (!content || typeof content !== 'string') {
    return title || 'Noticia editorial sobre situación actual.';
  }
  
  // Tomar primeras 3-5 oraciones del contenido
  const sentences = content
    .replace(/\n+/g, ' ')
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20)
    .slice(0, 5);
  
  if (sentences.length === 0) {
    return title || 'Noticia editorial sobre situación actual.';
  }
  
  return sentences.join('. ') + '.';
}

/**
 * Construye prompt PROFESIONAL para contenido político (anti-políticos, contextual)
 * Analiza el tema real y genera prompts específicos, NO genéricos
 * @param {string} title - Título de la noticia
 * @param {string} content - Contenido completo del borrador
 * @param {string} bajada - Bajada/resumen (opcional)
 * @param {string} category - Categoría (opcional)
 * @returns {string} Prompt profesional en inglés
 */
function buildPoliticalImagePrompt(title, content, bajada = '', category = '') {
  const summary = bajada && bajada.length > 30 ? bajada : generateContentSummary(content, title);
  
  console.log('[TitleTransformer] 🎯 Contenido POLÍTICO detectado → usando prompt contextual profesional');
  console.log(`[TitleTransformer] Summary (${summary.length} chars): "${summary.substring(0, 100)}..."`);
  
  // Detectar tema específico
  const summaryLower = (summary + ' ' + title).toLowerCase();
  let sceneGuidance = '';
  
  // Periodismo / Libertad de prensa
  if (summaryLower.includes('periodista') || summaryLower.includes('prensa') || summaryLower.includes('censura') || summaryLower.includes('libertad de expresión')) {
    sceneGuidance = `
SCENE GUIDANCE (Journalism/Press Freedom):
- Use ABSTRACT SYMBOLS: microphones, cameras (no logos), documents, keyboards
- Press room settings with dramatic lighting
- Symbolic censorship: bars, shadows, redacted papers, broken chains
- If journalists needed: use SILHOUETTES or GENERIC FIGURES (not realistic faces)
- Focus on SYMBOLS and ENVIRONMENT, not people
- NO politicians, NO specific individuals`;
  }
  // Protestas / Manifestaciones
  else if (summaryLower.includes('protest') || summaryLower.includes('manifestación') || summaryLower.includes('marcha')) {
    sceneGuidance = `
SCENE GUIDANCE (Protests/Demonstrations):
- Show ABSTRACT crowd scenes (not individual faces)
- Urban environment with raised hands/banners (no readable text)
- Use atmospheric perspective, wide shots
- Focus on COLLECTIVE MOVEMENT, not dramatic individuals
- Silhouettes and shadows preferred over detailed people`;
  }
  // Economía / Crisis / Escasez
  else if (summaryLower.includes('econom') || summaryLower.includes('crisis') || summaryLower.includes('escasez') || summaryLower.includes('inflación')) {
    sceneGuidance = `
SCENE GUIDANCE (Economy/Crisis):
- Focus on ENVIRONMENT: empty shelves, markets, stores, price tags
- Queue scenes (people as background elements, not main focus)
- Economic symbols: charts, currency, graphs
- Use wide establishing shots
- Avoid close-ups of distressed individuals
- VARY compositions heavily`;
  }
  // Desastres (solo si realmente es desastre)
  else if (summaryLower.includes('huracán') || summaryLower.includes('inundación') || summaryLower.includes('desastre') || summaryLower.includes('damnificado')) {
    sceneGuidance = `
SCENE GUIDANCE (Disaster/Emergency):
- DOCUMENTARY STYLE: damaged infrastructure, extreme weather, affected buildings
- Aerial/wide perspectives preferred
- Focus on ENVIRONMENT and ARCHITECTURAL damage, not dramatic people
- If people shown: distant figures, recovery teams (generic, not close-ups)
- CRITICAL: VARY compositions (NOT repetitive "woman in destroyed street")
- Use different angles: aerial, wide establishing, architectural details`;
  }
  // Genérico político (reuniones, decisiones, controversias)
  else {
    sceneGuidance = `
SCENE GUIDANCE (Generic Political):
- ABSTRACT and SYMBOLIC approach
- Government buildings (generic architecture), documents, meeting rooms
- Atmospheric lighting, shadows, silhouettes
- Urban environments as backdrop
- Focus on SYMBOLS and CONTEXT, avoid showing specific people
- Use empty spaces, architectural elements, lighting to convey mood`;
  }
  
  const prompt = `Create a NEWS COVER IMAGE for the following article.

ARTICLE SUMMARY:
${summary}
${sceneGuidance}

VISUAL STYLE:
- Modern editorial illustration (NOT photorealistic)
- Horizontal format 16:9, cinematic lighting
- Professional and NEUTRAL tone
- Use SYMBOLIC and ABSTRACT elements
- If people needed: GENERIC SILHOUETTES or SHADOWY FIGURES only
- Rich environmental detail, atmospheric perspective

CRITICAL RESTRICTIONS (MANDATORY):
- NO realistic human portraits or faces
- NO politicians or identifiable public figures
- NO text or readable signs
- NO dramatic close-ups of suffering individuals
- NO repetitive "woman in distress" patterns
- PREFER: symbols, abstract elements, environmental context, architectural details
- National flags and symbols ARE ALLOWED when contextually relevant
- Focus on THEME and CONTEXT through symbols, not through dramatic people`;

  return prompt;
}

/**
 * Función de compatibilidad (mantener por si algo la usa)
 * @deprecated Usar transformTitleToConcept directamente
 */
function sanitizeTitleForConcept(title) {
  // Ya no necesitamos sanitizar porque usamos el título tal cual
  return title || '';
}

module.exports = {
  transformTitleToConcept,
  buildImagePromptFromTitle,
  buildPoliticalImagePrompt,
  isPoliticalContent,
  sanitizeTitleForConcept // Por compatibilidad
};

