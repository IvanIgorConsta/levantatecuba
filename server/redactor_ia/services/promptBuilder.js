// server/redactor_ia/services/promptBuilder.js
/**
 * Constructor de prompts mejorados para generación de contenidos
 * Implementa estructuras diferenciadas para FACTUAL vs OPINIÓN
 * 
 * IMPORTANTE: Este módulo define la estructura OBLIGATORIA para todos los artículos.
 * Cualquier generador (redactor.js, urlDraftGenerator.js, etc.) DEBE usar estas funciones.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIONES OBLIGATORIAS PARA ARTÍCULOS FACTUALES (STRICT MODE)
// TODAS estas secciones DEBEN aparecer EXACTAMENTE con estos títulos
// El orden es CRÍTICO: 1→2→3→4
// ═══════════════════════════════════════════════════════════════════════════════
const REQUIRED_SECTIONS_FACTUAL = [
  { id: 'contexto', heading: '## Contexto del hecho', required: true, order: 1 },
  { id: 'causa', heading: '## Causa y consecuencia', required: true, order: 2 },
  { id: 'importancia', heading: '## Por qué es importante', required: true, order: 3 },
  { id: 'datos', heading: '## Datos importantes', required: true, order: 4 },
];

// Regex patterns para detectar cada sección (case-insensitive)
const SECTION_PATTERNS = {
  contexto: /^##\s*contexto\s+del\s+hecho/im,
  causa: /^##\s*causa\s+y\s+consecuencia/im,
  importancia: /^##\s*por\s+qu[eé]\s+(es\s+)?importante/im,
  datos: /^##\s*datos\s+importantes/im,
};

/**
 * Genera las instrucciones de estructura obligatoria para el prompt
 * @param {string} mode - 'factual' o 'opinion'
 * @returns {string} Instrucciones de estructura
 */
function getStructureInstructions(mode = 'factual') {
  if (mode === 'factual') {
    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║  🚨 ESTRUCTURA OBLIGATORIA - PRIORIDAD MÁXIMA (contenidoMarkdown) 🚨         ║
╚══════════════════════════════════════════════════════════════════════════════╝

⛔ ADVERTENCIA: Si no cumples con esta estructura EXACTA, el artículo será RECHAZADO.
⛔ La estructura es MÁS IMPORTANTE que la creatividad o el estilo.
⛔ NUNCA omitas una sección. NUNCA cambies los títulos.

El campo "contenidoMarkdown" DEBE contener EXACTAMENTE estas 4 secciones EN ESTE ORDEN:

┌─────────────────────────────────────────────────────────────────────────────┐
│ SECCIÓN 1: ## Contexto del hecho                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ - 2-3 PÁRRAFOS (prosa continua, SIN bullets ni viñetas)                     │
│ - Explica contexto, antecedentes y situación actual                         │
│ - Responde: ¿Qué pasó? ¿Dónde? ¿Cuándo? ¿Quiénes están involucrados?        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ SECCIÓN 2: ## Causa y consecuencia                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ - 2-3 PÁRRAFOS (prosa continua, SIN bullets ni viñetas)                     │
│ - Explica qué provocó el hecho y sus efectos                                │
│ - Responde: ¿Por qué ocurrió? ¿Qué pasará después?                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ SECCIÓN 3: ## Por qué es importante                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ - 2-3 PÁRRAFOS (prosa continua, SIN bullets ni viñetas)                     │
│ - Explica la relevancia para el lector                                      │
│ - Impacto social, económico o político                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ SECCIÓN 4: ## Datos importantes                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ - ÚNICA sección que usa bullets (OBLIGATORIO usar guión - al inicio)        │
│ - CADA línea DEBE empezar con "- " (guión + espacio)                        │
│ - Ejemplo correcto:                                                         │
│   - La declaración se realizó el 4 de diciembre de 2025.                    │
│   - Las negociaciones involucran a EE.UU. y Ucrania.                        │
│   - El conflicto en Donbas inició en 2014.                                  │
│ - Si NO hay datos: "- No se han divulgado datos oficiales adicionales."     │
│ - ⚠️ NUNCA omitas esta sección, siempre incluye aunque sea el placeholder   │
└─────────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════════╗
║  ⛔ REGLAS ESTRICTAS - VIOLACIÓN = RECHAZO AUTOMÁTICO ⛔                     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ 1. Los 4 encabezados DEBEN aparecer EXACTAMENTE como se muestran arriba     ║
║ 2. El ORDEN debe ser: Contexto → Causa → Importancia → Datos                ║
║ 3. NO uses variantes como "Datos duros", "Contexto", "Importancia"          ║
║ 4. NO generes contenido sin secciones (bloque único)                        ║
║ 5. Cada sección debe tener contenido sustancial (mínimo 100 caracteres)     ║
║ 6. NO añadas secciones extra como "## Cierre" o "## Conclusión"             ║
║ 7. NUNCA incluyas secciones "Verificaciones" ni "Prompt de imagen"          ║
║ 8. NUNCA repitas información entre secciones (ver regla 9)                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════════════╗
║  🔁 CONTROL DE REPETICIÓN - REGLA 9 (OBLIGATORIA)                           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ ⛔ PROHIBIDO REPETIR PÁRRAFOS:                                               ║
║ - NUNCA escribas el mismo párrafo dos veces dentro de una sección           ║
║ - NUNCA copies contenido de una sección a otra                              ║
║ - Si escribiste algo, NO lo repitas con otras palabras                      ║
║ - Cada párrafo debe contener información NUEVA y ÚNICA                      ║
║                                                                              ║
║ DIFERENCIACIÓN ENTRE SECCIONES:                                             ║
║ - "Contexto" = qué pasó y dónde (hechos puros, NO causas)                   ║
║ - "Causa" = por qué ocurrió (factores, decisiones - NO repetir contexto)    ║
║ - "Importancia" = cómo afecta al ciudadano (NO repetir causas ni contexto)  ║
║ - "Datos" = SOLO bullets con cifras/fechas/nombres (NO narrativa)           ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;
  }
  
  // Para opinión, estructura diferente
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRUCTURA OBLIGATORIA DEL CONTENIDO (contenidoMarkdown)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

El campo "contenidoMarkdown" DEBE contener estas secciones.
⚠️ FORMATO: Todas las secciones deben ser PÁRRAFOS (prosa continua). NO uses bullets ni viñetas.

## Declaración inicial
[1-2 párrafos con afirmación o pregunta impactante que plantee la tesis]

## Nuestra postura
[2-3 párrafos con la posición clara del editorial y contexto]

## Los hechos que respaldan
[3-4 párrafos con argumentos basados en datos verificables]

## Por qué debe importarnos
[1-2 párrafos sobre el impacto en la vida cotidiana]

## Lo que nadie dice
[2-3 párrafos sobre contradicciones, efectos ocultos, hipocresías]

## Reflexión final
[1-2 párrafos con pregunta poderosa o frase memorable]

╔══════════════════════════════════════════════════════════════════════════════╗
║  🔁 CONTROL DE REPETICIÓN Y PROHIBICIONES (OBLIGATORIO)                     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ - NUNCA incluyas secciones "Verificaciones" ni "Prompt de imagen"          ║
║ - Cada sección debe aportar UNA idea nueva que no exista en las anteriores  ║
║ - Si detectas que repites la misma idea con otras palabras, pasa a otro     ║
║   ángulo o dato.                                                            ║
║                                                                              ║
║ DIFERENCIACIÓN CLARA:                                                       ║
║ - "Declaración" = gancho emocional, pregunta o afirmación provocadora       ║
║ - "Postura" = contexto y posición del medio (NO repetir el gancho)          ║
║ - "Hechos" = datos duros que respaldan (NO opinión aquí)                    ║
║ - "Por qué importa" = cómo afecta al lector común en su vida diaria         ║
║ - "Lo que nadie dice" = ángulo oculto, hipocresía (NO repetir impacto)      ║
║ - "Reflexión" = cierre memorable (NO resumir lo anterior)                   ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;
}

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

╔══════════════════════════════════════════════════════════════════════════════╗
║  🛡️ CONTROL EDITORIAL OBLIGATORIO - HECHOS FUTUROS                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ 1. PROHIBIDO presentar hechos futuros como confirmados                       ║
║ 2. Proyectos, lanzamientos, implementaciones futuras = LENGUAJE CONDICIONAL  ║
║ 3. El TÍTULO y la BAJADA cumplen las MISMAS reglas que el cuerpo             ║
╚══════════════════════════════════════════════════════════════════════════════╝

⛔ VERBOS PROHIBIDOS PARA HECHOS FUTUROS (corregir automáticamente):
   lanza, implementará, comenzará, operará, llegará, marcará, convertirá,
   promete, garantizará, reducirá, posiciona, consolida, responde a, será

✅ USAR EN SU LUGAR:
   podría, tiene previsto, planea, se proyecta, según estimaciones,
   sujeto a pruebas piloto, pendiente de aprobación regulatoria

📋 DIFERENCIACIÓN OBLIGATORIA:
   - Hechos CONFIRMADOS → tiempo pasado o presente
   - Proyecciones/planes → SIEMPRE condicional

💰 IMPACTOS NUNCA GARANTIZADOS:
   - Beneficios económicos, sociales, ambientales o tecnológicos
   - ❌ NO se presentan como hechos
   - ✅ Se formulan como "posibles", "potenciales" o "estimados"

🔍 AUTOVERIFICACIÓN ANTES DE ENTREGAR:
   - Revisa TÍTULO, BAJADA y CADA SECCIÓN
   - Si detectas UNA frase afirmativa sobre el futuro → CORRÍGELA
   - No preguntes. No informes. CORRIGE y continúa.

⚠️ CONDICIÓN DE FINALIZACIÓN:
   Solo genera el borrador si:
   - No existen verbos afirmativos en futuro
   - Ningún proyecto en desarrollo se presenta como hecho cerrado
   - El tono es factual, prudente y periodístico

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

CAMPOS JSON OBLIGATORIOS:
1) **titulo**: Contundente, factual, optimizado SEO (60-70 caracteres)
2) **bajada**: Responde ¿Qué pasó? ¿Dónde? ¿Quién? (2-3 líneas)
3) **contenidoMarkdown**: VER ESTRUCTURA OBLIGATORIA ABAJO
4) **categoria**: Una de las categorías permitidas
5) **etiquetas**: Array de 3-5 tags relevantes
${getStructureInstructions('factual')}

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
  "contenidoMarkdown": "string (MÍNIMO 3000 caracteres con estructura completa, puede incluir markdown con \\n)"
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
  "contenidoMarkdown": "string (600-900 palabras con estructura completa, puede incluir markdown con \\n)"
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
      content_snippet: (f.snippet || topic.resumenBreve || '').substring(0, 500), // Truncate to avoid excessive tokens
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

/**
 * Valida que el contenido tenga las secciones obligatorias (versión estricta)
 * @param {string} content - contenidoMarkdown
 * @param {string} mode - 'factual' o 'opinion'
 * @returns {{ valid: boolean, missingSections: string[], presentSections: string[], warnings: string[] }}
 */
function validateStructure(content, mode = 'factual') {
  const missingSections = [];
  const presentSections = [];
  const warnings = [];
  
  if (!content || typeof content !== 'string') {
    return { 
      valid: false, 
      missingSections: REQUIRED_SECTIONS_FACTUAL.map(s => s.id), 
      presentSections: [],
      warnings: ['contenido vacío'] 
    };
  }
  
  if (mode === 'factual') {
    // Usar los regex patterns estrictos para validar cada sección
    for (const section of REQUIRED_SECTIONS_FACTUAL) {
      const pattern = SECTION_PATTERNS[section.id];
      if (pattern && pattern.test(content)) {
        presentSections.push(section.id);
      } else {
        missingSections.push(section.id);
      }
    }
    
    // Verificar que no sea un bloque único (debe tener al menos 4 encabezados ##)
    const headingCount = (content.match(/^##\s+/gm) || []).length;
    if (headingCount < 4) {
      warnings.push(`Solo ${headingCount} secciones H2 detectadas (mínimo requerido: 4)`);
    }
    
    // Advertir si tiene secciones extra no esperadas
    const allH2 = content.match(/^##\s+.+$/gm) || [];
    const extraSections = allH2.filter(h2 => {
      const h2Lower = h2.toLowerCase();
      return !Object.values(SECTION_PATTERNS).some(p => p.test(h2));
    });
    if (extraSections.length > 0) {
      warnings.push(`Secciones extra detectadas: ${extraSections.join(', ')}`);
    }
  }
  
  return {
    valid: missingSections.length === 0,
    missingSections,
    presentSections,
    warnings
  };
}

/**
 * VALIDACIÓN ESTRICTA CON AUTOCORRECCIÓN
 * Valida la estructura y opcionalmente intenta corregir secciones faltantes
 * @param {string} content - contenidoMarkdown
 * @param {Object} options - { model: string, allowAutocorrect: boolean }
 * @returns {{ 
 *   valid: boolean, 
 *   corrected: boolean,
 *   correctedContent: string | null,
 *   missingSections: string[], 
 *   issues: string[],
 *   shouldReject: boolean,
 *   rejectReason: string | null
 * }}
 */
function strictValidateAndAutocorrect(content, options = {}) {
  const { model = 'unknown', allowAutocorrect = true } = options;
  const issues = [];
  let correctedContent = null;
  let corrected = false;
  let shouldReject = false;
  let rejectReason = null;
  
  // Validar estructura con la función estándar
  const validation = validateStructure(content, 'factual');
  
  // Log detallado
  console.log(`[PromptBuilder:StrictValidate] Modelo: ${model}`);
  console.log(`[PromptBuilder:StrictValidate] Secciones presentes: [${validation.presentSections.join(', ')}]`);
  console.log(`[PromptBuilder:StrictValidate] Secciones faltantes: [${validation.missingSections.join(', ')}]`);
  
  if (validation.valid) {
    // Todo OK, no hay nada que hacer
    return {
      valid: true,
      corrected: false,
      correctedContent: null,
      missingSections: [],
      issues: validation.warnings,
      shouldReject: false,
      rejectReason: null
    };
  }
  
  // Hay secciones faltantes
  const missingCount = validation.missingSections.length;
  issues.push(`Faltan ${missingCount} secciones obligatorias: ${validation.missingSections.join(', ')}`);
  
  // Si faltan más de 2 secciones, rechazar sin autocorrección
  if (missingCount > 2) {
    shouldReject = true;
    rejectReason = `Demasiadas secciones faltantes (${missingCount}/5). El contenido no cumple la estructura obligatoria. Modelo: ${model}`;
    console.error(`[PromptBuilder:StrictValidate] ❌ RECHAZO: ${rejectReason}`);
    
    return {
      valid: false,
      corrected: false,
      correctedContent: null,
      missingSections: validation.missingSections,
      issues,
      shouldReject: true,
      rejectReason
    };
  }
  
  // Intentar autocorrección si está habilitado y faltan ≤ 2 secciones
  if (allowAutocorrect && missingCount <= 2) {
    console.log(`[PromptBuilder:StrictValidate] ⚠️ Intentando autocorrección para: ${validation.missingSections.join(', ')}`);
    
    const placeholders = {
      contexto: '\n\n## Contexto del hecho\n\nLa información de contexto no está disponible al momento de esta publicación. Se actualizará cuando se obtengan más detalles.\n',
      causa: '\n\n## Causa y consecuencia\n\nAún no se han determinado las causas exactas de este suceso ni sus posibles consecuencias a mediano plazo.\n',
      importancia: '\n\n## Por qué es importante\n\nEste hecho representa un evento significativo cuyas implicaciones aún están siendo evaluadas por analistas y observadores.\n',
      datos: '\n\n## Datos importantes\n\n- No se han divulgado datos oficiales adicionales al momento de esta publicación.\n'
    };
    
    correctedContent = content;
    
    // Añadir secciones faltantes al final del contenido
    for (const sectionId of validation.missingSections) {
      if (placeholders[sectionId]) {
        correctedContent += placeholders[sectionId];
        issues.push(`Sección "${sectionId}" añadida con placeholder`);
      }
    }
    
    corrected = true;
    console.log(`[PromptBuilder:StrictValidate] ✅ Autocorrección aplicada. ${missingCount} secciones añadidas con placeholders.`);
  } else if (!allowAutocorrect) {
    shouldReject = true;
    rejectReason = `Estructura incompleta y autocorrección deshabilitada. Faltan: ${validation.missingSections.join(', ')}. Modelo: ${model}`;
  }
  
  return {
    valid: corrected, // Es válido si se pudo corregir
    corrected,
    correctedContent,
    missingSections: validation.missingSections,
    issues,
    shouldReject,
    rejectReason
  };
}

/**
 * Genera instrucciones de estructura para usar en prompts de usuario
 * Útil para urlDraftGenerator y otros generadores
 * @param {string} mode - 'factual' o 'opinion'
 * @returns {string}
 */
function getStructureInstructionsForUserPrompt(mode = 'factual') {
  return getStructureInstructions(mode);
}

module.exports = {
  extractEntities,
  buildSystemPrompt,
  buildEnhancedInput,
  validateContentQuality,
  validateStructure,
  strictValidateAndAutocorrect, // ← Nueva función de validación estricta con autocorrección
  getStructureInstructionsForUserPrompt,
  buildLecturaVivaInstructions,
  REQUIRED_SECTIONS_FACTUAL,
  SECTION_PATTERNS // ← Exportar patterns para uso externo
};
