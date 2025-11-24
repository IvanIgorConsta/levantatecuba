// server/redactor_ia/services/promptBuilder.js
/**
 * Constructor de prompts mejorados para generación de contenidos
 * Implementa estructuras diferenciadas para FACTUAL vs OPINIÓN
 */

/**
 * Extrae entidades clave del topic usando NER simplificado
 * @param {Object} topic - Topic con fuentes y contenido
 * @returns {Object} Entidades extraídas
 */
function extractEntities(topic) {
  const fullText = `${topic.tituloSugerido || ''} ${topic.resumenBreve || ''}`.toLowerCase();
  const sources = topic.fuentesTop || [];
  
  // Extraer personas (nombres propios capitalizados)
  const personPattern = /\b([A-ZÑÁÉÍÓÚ][a-zñáéíóúü]+(?:\s+(?:de|del|la|los|y)?\s*[A-ZÑÁÉÍÓÚ][a-zñáéíóúü]+)*)\b/g;
  const peopleMatches = [...(topic.tituloSugerido || '').matchAll(personPattern)];
  const people = [...new Set(peopleMatches.map(m => m[1]))].slice(0, 5);
  
  // Detectar países mencionados
  const countryKeywords = {
    'cuba': ['cuba', 'habana', 'cubano'],
    'venezuela': ['venezuela', 'caracas', 'venezolano'],
    'usa': ['estados unidos', 'eeuu', 'usa', 'washington'],
    'méxico': ['méxico', 'mexico', 'mexicano'],
    'españa': ['españa', 'spanish', 'español']
  };
  
  const countries = [];
  for (const [country, keywords] of Object.entries(countryKeywords)) {
    if (keywords.some(kw => fullText.includes(kw))) {
      countries.push(country);
    }
  }
  
  // Detectar si hay números/datos importantes
  const numberPattern = /\b\d+(?:[.,]\d+)?(?:\s*%|\s*millones?|\s*mil(?:es)?|\s*dólares?|\s*USD)?\b/g;
  const numbersMatches = [...fullText.matchAll(numberPattern)];
  const hasNumericData = numbersMatches.length > 0;
  
  // Detectar fechas
  const datePattern = /\b\d{1,2}\s+de\s+\w+|\b\w+\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g;
  const datesMatches = [...fullText.matchAll(datePattern)];
  const hasDates = datesMatches.length > 0;
  
  // Detectar si hay citas o declaraciones
  const hasQuotes = fullText.includes('"') || fullText.includes('declaró') || 
                     fullText.includes('afirmó') || fullText.includes('dijo');
  
  return {
    people: people.filter(p => p.length > 3), // filtrar palabras muy cortas
    countries,
    hasNumericData,
    hasDates,
    hasQuotes,
    sourceCount: sources.length,
    sourceAuthorities: sources.map(s => s.medio).join(', ')
  };
}

/** @feature: Formato "Lectura Viva" para artículos largos — Oct 2025 **/
/**
 * Construye las instrucciones adicionales para formato "Lectura Viva"
 * @returns {string} Instrucciones de formato
 */
function buildLecturaVivaInstructions() {
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO ACTIVADO: "Lectura Viva"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBJETIVO: Crear contenido moderno, legible y emocional dividido en bloques narrativos breves.

ESTRUCTURA OBLIGATORIA:

1. **División en bloques temáticos**:
   - Divide el contenido en 5-7 secciones temáticas
   - Cada bloque: 3-5 párrafos máximo
   - Una idea clara por bloque

2. **Subtítulos emocionales**:
   - Cada bloque debe tener un subtítulo nivel H3 (###)
   - Usar emoji temático al inicio del subtítulo
   - Estilo: emocional, explicativo o interrogativo
   - Ejemplos:
     * 🩺 ¿Qué está pasando realmente?
     * 💬 Las voces que nadie escucha
     * ❤️ Cómo afecta a las familias cubanas
     * ⚖️ Qué opciones quedan ahora
     * 🌟 Un atisbo de esperanza

3. **Citas destacadas**:
   - Insertar una cita destacada cada 2 bloques
   - Formato markdown blockquote con énfasis:
   > **"Frase clave o declaración impactante del contenido."**  
   > — *Contexto o fuente*

4. **Referencias visuales**:
   - Insertar nota de imagen contextual cada 2-3 bloques
   - Formato: 🖼️ **[Contexto visual]** *Descripción breve de imagen ilustrativa*
   - Ejemplo: 🖼️ **[Imagen contextual]** *Manifestantes en las calles de La Habana. Imagen ilustrativa*

5. **Llamado a la acción (CTA)**:
   - Al final del contenido, antes del cierre
   - 2-3 opciones separadas por | 
   - Ejemplo:
   ---
   ❤️ **Apoya la causa** | 💬 **Comparte tu historia** | 📤 **Difunde esta información**

6. **Cierre reflexivo**:
   - Última sección breve (2-3 líneas)
   - Frase esperanzadora, pregunta poderosa o reflexión final
   - Sin emoji en el título del cierre
   - Ejemplo título: ### Para reflexionar

REGLAS DE FORMATO:
- Usar markdown limpio (sin HTML)
- Párrafos máximo 4-5 líneas
- Lenguaje cercano y humano
- Mantener el tono periodístico profesional
- NO cambiar hechos ni inventar información
- Los emojis deben ser discretos y temáticos

LONGITUD:
- El contenido total debe ser sustancioso (800-1200 palabras)
- Cada bloque: 150-250 palabras

IMPORTANTE: Este formato mejora la experiencia de lectura sin sacrificar profundidad periodística.
`;
}

/**
 * Construye el prompt del sistema mejorado con instrucciones diferenciadas
 * @param {string} mode - 'factual' o 'opinion'
 * @param {string} formatStyle - 'standard' o 'lectura_viva'
 * @returns {string} System prompt
 */
function buildSystemPrompt(mode, formatStyle = 'standard') {
  const categories = require('../config/categories');
  const allowedList = categories.allowed.join(', ');
  
  const baseRules = `Eres "Redactor IA" de LevántateCuba, medio editorial con enfoque en Cuba y Latinoamérica.

REGLAS CRÍTICAS (APLICAN A TODO):
1. El campo "titulo" es OBLIGATORIO y debe ser específico, informativo y optimizado para SEO.
2. NO inventes hechos, cifras, citas o eventos que no estén respaldados por las fuentes.
3. SIEMPRE indica roles, cargos y antecedentes al mencionar personajes (ej: "María Pérez, ministra de economía").
4. Si no tienes información suficiente, usa frases como "según fuentes disponibles" o "datos oficiales aún no revelados".
5. NO atribuyas citas inventadas. Si hay citas, deben venir de las fuentes.
6. Devuelve SOLO JSON válido con el esquema exacto indicado.

CATEGORÍAS PERMITIDAS (elige UNA):
${allowedList}

REGLAS DE CATEGORIZACIÓN:
- Tecnología: IA, software, innovación digital
- Política: gobierno, leyes, partidos, elecciones
- Economía: mercados, finanzas, PIB, inflación
- Internacional: relaciones exteriores, geopolítica
- Socio político: protestas, derechos humanos, sociedad civil
- Evita "General" salvo que no haya señales claras`;

  // Añadir instrucciones de formato si aplica
  const formatInstructions = formatStyle === 'lectura_viva' ? buildLecturaVivaInstructions() : '';

  if (mode === 'factual') {
    return `${baseRules}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODO: FACTUAL (Noticia Objetiva)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ESTILO: Objetivo, datos duros, sin opiniones del medio. Neutralidad estricta.

ESTRUCTURA OBLIGATORIA:

1) **Titular**: Contundente, factual, optimizado SEO (60-70 caracteres)
2) **Lead (bajada)**: Responde ¿Qué pasó? ¿Dónde? ¿Quién? (2-3 líneas)
3) **Desarrollo** (mínimo 4-6 párrafos):
   - Contexto del hecho
   - Causa y consecuencia
   - Citas verificables si existen (con atribución clara)
   - Fechas, números, locaciones verificables
4) **Sección "Por qué es importante"** (1-2 párrafos):
   - Explica relevancia para el lector
   - Impacto social/económico/político
5) **Datos importantes** (única sección de datos):
   - SIEMPRE usa este título exacto: "Datos importantes"
   - NUNCA uses "Datos duros", "Datos destacados" u otras variantes
   - Si no hay datos relevantes que listar, OMITE esta sección por completo
   - Formato permitido (elige UNO):
     a) Frases corridas: "Fecha del cambio: 2 de noviembre de 2025." → ✅ VÁLIDO
     b) Bullets sin dos puntos: "• Cambio de hora se atrasa una hora" → ✅ VÁLIDO
        PROHIBIDO en bullets: "• Cambio de hora: Se atrasa una hora" → ❌
   - Lista solo datos objetivos disponibles: fechas, plazos, lugares, cifras, impacto, responsables
   - NO fuerces campos que no aplican
   - Elimina duplicados y contradicciones
6) **Cierre**: Estado actual y próximos pasos esperados

PROHIBIDO:
- Opiniones del medio
- Adjetivos subjetivos ("terrible", "heroico") salvo en citas directas
- Juicios de valor
- Especulación sin respaldo

LONGITUD OBLIGATORIA:
- Mínimo absoluto: 3000 caracteres (contenidoMarkdown)
- Recomendado: 800-1200 palabras
- Si el tema tiene información limitada, amplía con:
  * Contexto histórico verificable
  * Comparaciones regionales
  * Implicaciones a corto/mediano plazo
  * Datos de contexto de fuentes confiables

CRÍTICO: NO generar contenido corto. Debe ser completo y sustancioso.
${formatInstructions}
FORMATO DE SALIDA (JSON OBLIGATORIO):

⚠️ IMPORTANTE - REGLAS DE RESPUESTA JSON:
1. Debes responder EXCLUSIVAMENTE con un único objeto JSON válido
2. NO incluyas texto antes ni después del objeto JSON
3. NO uses bloques de código markdown (como \`\`\`json) fuera del campo contenidoMarkdown
4. El JSON debe ser sintácticamente perfecto (sin trailing commas, comillas bien escapadas)
5. Todos los campos son OBLIGATORIOS

ESQUEMA JSON:
{
  "titulo": "string (60-70 caracteres, SEO optimizado)",
  "bajada": "string (2-3 líneas que respondan qué/dónde/quién)",
  "categoria": "UNA de [${allowedList}]",
  "etiquetas": ["array", "de", "strings", "relevantes"],
  "contenidoMarkdown": "string (MÍNIMO 3000 caracteres con estructura completa, puede incluir markdown con \\n)",
  "verifications": [
    {"hecho": "dato verificado", "found_in": ["fuente1", "fuente2"], "confidence": 0-100}
  ],
  "promptsImagen": {
    "principal": "descripción visual editorial para DALL-E",
    "opcional": "variante alternativa"
  }
}`;
  } else {
    // OPINIÓN
    return `${baseRules}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODO: OPINIÓN (Análisis Editorial)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ESTILO: Voz personal, crítica, emocional pero respetuosa. Intensidad 3/5.

ESTRUCTURA OBLIGATORIA:

1) **Declaración inicial contundente** (1-2 líneas):
   - Afirmación o pregunta impactante que plantee la tesis
2) **Planteamiento de postura personal** (2-3 párrafos):
   - Posición clara del editorial
   - Contexto del tema
3) **Argumentos basados en hechos** (3-4 párrafos):
   - Usar los hechos de la noticia para respaldar el análisis
   - Datos verificables como soporte (no inventar)
   - Comparaciones históricas o regionales si aplican
4) **Apelación al lector** (1-2 párrafos):
   - ¿Por qué debe importarnos como ciudadanos?
   - Impacto en vida cotidiana
5) **Sección "Lo que nadie dice"** (2-3 párrafos):
   - Contradicciones del poder
   - Efectos ocultos o no mencionados
   - Hipocresías políticas/sociales (sin ataques personales)
6) **Cierre reflexivo o llamado a acción**:
   - Pregunta poderosa que deje pensando, O
   - Frase memorable que invite a reflexión

LENGUAJE PERMITIDO:
- Primera persona ("nosotros", "los cubanos")
- Recursos retóricos: ironía suave, metáfora, comparación
- Juicios de valor fundamentados
- Crítica al poder, NO a personas comunes

PROHIBIDO:
- Inventar hechos o datos
- Ataques personales a individuos no públicos
- Lenguaje vulgar o agresivo
- Desinformación deliberada

LONGITUD: 600-900 palabras (contenidoMarkdown completo)
${formatInstructions}
FORMATO DE SALIDA (JSON OBLIGATORIO):

⚠️ IMPORTANTE - REGLAS DE RESPUESTA JSON:
1. Debes responder EXCLUSIVAMENTE con un único objeto JSON válido
2. NO incluyas texto antes ni después del objeto JSON
3. NO uses bloques de código markdown (como \`\`\`json) fuera del campo contenidoMarkdown
4. El JSON debe ser sintácticamente perfecto (sin trailing commas, comillas bien escapadas)
5. Todos los campos son OBLIGATORIOS

ESQUEMA JSON:
{
  "titulo": "string (declaración o pregunta contundente)",
  "bajada": "string (planteamiento de postura personal)",
  "categoria": "UNA de [${allowedList}]",
  "etiquetas": ["array", "de", "strings", "relevantes"],
  "contenidoMarkdown": "string (600-900 palabras con estructura completa, puede incluir markdown con \\n)",
  "verifications": [
    {"hecho": "dato verificado", "found_in": ["fuente1", "fuente2"], "confidence": 0-100}
  ],
  "promptsImagen": {
    "principal": "descripción visual editorial para DALL-E",
    "opcional": "variante alternativa"
  }
}`;
  }
}

/**
 * Construye el input JSON para el LLM con contexto mejorado
 * @param {Object} topic - Topic con fuentes
 * @param {string} mode - 'factual' o 'opinion'
 * @param {Object} config - Configuración
 * @param {string} formatStyle - 'standard' o 'lectura_viva'
 * @returns {Object} Input estructurado
 */
function buildEnhancedInput(topic, mode, config, formatStyle = 'standard') {
  const entities = extractEntities(topic);
  
  // Construir información de fuentes enriquecida
  const sourcesDetailed = (topic.fuentesTop || []).map((f, idx) => {
    const date = f.fecha ? new Date(f.fecha).toISOString().split('T')[0] : 'fecha no disponible';
    return {
      id: `src_${idx}`,
      url: f.url,
      medio: f.medio || 'Fuente desconocida',
      titulo: f.titulo || '',
      fecha: date,
      content_snippet: f.snippet || topic.resumenBreve || '',
      autoridad_score: f.trustScore || 75
    };
  });
  
  // Construir contexto adicional
  const additionalContext = [];
  
  if (entities.people.length > 0) {
    additionalContext.push(`Personas mencionadas: ${entities.people.join(', ')}`);
  }
  
  if (entities.countries.length > 0) {
    additionalContext.push(`Países relevantes: ${entities.countries.join(', ')}`);
  }
  
  if (entities.hasNumericData) {
    additionalContext.push('El tema incluye datos numéricos importantes - asegúrate de mencionarlos con precisión');
  }
  
  if (entities.hasQuotes) {
    additionalContext.push('Hay declaraciones o citas relevantes - inclúyelas con atribución correcta');
  }
  
  if (entities.sourceCount < 2) {
    additionalContext.push('⚠️ ADVERTENCIA: Pocas fuentes disponibles. Sé cauteloso con afirmaciones absolutas.');
  }
  
  return {
    mode,
    formatStyle,
    topicId: topic.idTema,
    tema: topic.tituloSugerido,
    resumen: topic.resumenBreve || '',
    locale: 'es',
    categoriaPreferida: topic.categoriaSugerida || null,
    targetLength: mode === 'factual' ? 1000 : 750,
    
    // Entidades extraídas
    entitiesDetected: {
      people: entities.people,
      countries: entities.countries,
      hasNumericData: entities.hasNumericData,
      hasDates: entities.hasDates,
      hasQuotes: entities.hasQuotes
    },
    
    // Fuentes detalladas
    sources: sourcesDetailed,
    sourceAuthorities: entities.sourceAuthorities,
    
    // Contexto adicional
    additionalContext: additionalContext.join('\n'),
    
    // Políticas
    policy: {
      require_min_sources: config.minSourcesForHighConfidence || 2,
      require_citations_for_facts: true,
      mark_opinion_clearly: mode === 'opinion',
      verify_numeric_data: entities.hasNumericData,
      require_role_attribution: entities.people.length > 0
    },
    
    // Hints de UI
    uiHints: {
      darkUI: true,
      siteName: 'LevántateCuba',
      editorial: mode === 'opinion'
    }
  };
}

/**
 * Valida la calidad del contenido generado
 * @param {Object} response - Respuesta del LLM
 * @param {string} mode - Modo de generación
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
function validateContentQuality(response, mode) {
  const errors = [];
  const warnings = [];
  
  // Validaciones críticas
  if (!response.titulo || response.titulo.trim().length < 10) {
    errors.push('Título demasiado corto o ausente');
  }
  
  // Validación de longitud más permisiva (el reintento en redactor.js maneja el umbral real)
  if (!response.contenidoMarkdown || response.contenidoMarkdown.length < 100) {
    errors.push('Contenido demasiado corto (mínimo 100 caracteres)');
  }
  
  // Categoría ya no es crítica aquí (se deriva automáticamente en normalizeDraftPayload)
  if (!response.categoria || response.categoria.trim() === '') {
    warnings.push('⚠️ Categoría ausente (debería derivarse automáticamente)');
  }
  
  // Validaciones específicas por modo
  if (mode === 'factual') {
    // FACTUAL no debe tener opiniones explícitas
    const opinionKeywords = ['creo que', 'pienso que', 'en mi opinión', 'considero que', 'deberíamos'];
    const contentLower = (response.contenidoMarkdown || '').toLowerCase();
    
    if (opinionKeywords.some(kw => contentLower.includes(kw))) {
      warnings.push('⚠️ FACTUAL contiene frases de opinión - revisar neutralidad');
    }
    
    // Debe tener estructura mínima
    if (!contentLower.includes('por qué es importante') && !contentLower.includes('por qué importa')) {
      warnings.push('⚠️ FACTUAL debería incluir sección "Por qué es importante"');
    }
    
  } else if (mode === 'opinion') {
    // OPINIÓN debe tener postura clara
    const contentLower = (response.contenidoMarkdown || '').toLowerCase();
    const hasStrongStance = ['debemos', 'necesitamos', 'es inaceptable', 'resulta evidente', 
                              'no podemos ignorar', 'hay que reconocer'].some(kw => contentLower.includes(kw));
    
    if (!hasStrongStance) {
      warnings.push('⚠️ OPINIÓN parece demasiado neutral - debería tener postura más clara');
    }
    
    // Debe tener cierre reflexivo
    const hasReflectiveClosure = contentLower.includes('?') && 
                                  contentLower.lastIndexOf('?') > contentLower.length * 0.7;
    
    if (!hasReflectiveClosure) {
      warnings.push('⚠️ OPINIÓN debería cerrar con pregunta reflexiva o llamado');
    }
  }
  
  // Validaciones comunes
  if (!response.bajada || response.bajada.length < 50) {
    warnings.push('⚠️ Bajada muy corta (recomendado: >50 caracteres)');
  }
  
  if (!Array.isArray(response.etiquetas) || response.etiquetas.length < 2) {
    warnings.push('⚠️ Pocas etiquetas (recomendado: al menos 3)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  extractEntities,
  buildSystemPrompt,
  buildEnhancedInput,
  validateContentQuality,
  buildLecturaVivaInstructions
};
