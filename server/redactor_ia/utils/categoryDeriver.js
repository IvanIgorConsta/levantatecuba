// server/redactor_ia/utils/categoryDeriver.js
/**
 * Deriva categoría automáticamente basándose en contenido
 */

/**
 * Taxonomía de keywords por categoría
 */
const CATEGORY_KEYWORDS = {
  'Política': [
    'gobierno', 'ministro', 'ministra', 'asamblea', 'sanciones', 'derechos humanos',
    'partido', 'decreto', 'ley', 'congreso', 'senado', 'presidente', 'legisla',
    'elecciones', 'voto', 'político', 'política', 'dictadura', 'democracia',
    'régimen', 'oposición', 'disidente', 'represión', 'autoridades', 'parlamento'
  ],
  
  'Economía': [
    'inflación', 'salario', 'mercado', 'precios', 'dólar', 'remesas', 'comercio',
    'económico', 'economía', 'inversión', 'exportación', 'importación', 'pib',
    'financiero', 'banco', 'dinero', 'crisis económica', 'pobreza', 'desempleo',
    'turismo', 'industria', 'producción', 'peso', 'divisa', 'deuda'
  ],
  
  'Sociedad': [
    'salud', 'educación', 'transporte', 'vivienda', 'servicios', 'crimen',
    'comunidad', 'hospital', 'escuela', 'universidad', 'médico', 'enfermería',
    'paciente', 'barrio', 'vecinos', 'familia', 'social', 'población',
    'ciudadano', 'delito', 'violencia', 'seguridad ciudadana'
  ],
  
  'Internacional': [
    'onu', 'ee.uu', 'eeuu', 'estados unidos', 'unión europea', 'ue', 'frontera',
    'embajada', 'tratado', 'guerra', 'conflicto', 'diplomacia', 'exterior',
    'internacional', 'mundial', 'global', 'países', 'naciones', 'alianza',
    'acuerdo internacional', 'cancillería', 'relaciones exteriores'
  ],
  
  'Clima': [
    'huracán', 'tormenta', 'lluvia', 'inundación', 'sismo', 'apagón',
    'clima', 'meteorológico', 'temporal', 'ciclón', 'sequía', 'desastre',
    'terremoto', 'temblor', 'evacuación', 'alerta', 'emergencia climática',
    'defensa civil', 'protección civil', 'fenómeno natural'
  ],
  
  'Tecnología': [
    'internet', 'ciberseguridad', 'inteligencia artificial', 'ia', 'telecomunicaciones',
    'tecnología', 'tecnológico', 'digital', 'software', 'hardware', 'app',
    'aplicación', 'red', 'conectividad', 'computadora', 'móvil', 'celular',
    'innovación', 'startup', 'plataforma', 'datos'
  ],
  
  'Cultura': [
    'música', 'cine', 'festival', 'arte', 'artista', 'cultura', 'cultural',
    'teatro', 'concierto', 'película', 'libro', 'literatura', 'escritor',
    'pintura', 'exposición', 'museo', 'patrimonio', 'folclore'
  ],
  
  'Deportes': [
    'liga', 'campeonato', 'deporte', 'deportivo', 'fútbol', 'béisbol',
    'baloncesto', 'voleibol', 'atleta', 'entrenador', 'equipo', 'torneo',
    'juegos', 'medalla', 'competencia', 'olimpiadas', 'copa'
  ],
  
  'Socio político': [
    'protesta', 'manifestación', 'activista', 'movimiento social', 'reclamo',
    'cacerolazo', 'huelga', 'marcha', 'sociedad civil', 'derecho',
    'libertad', 'justicia social', 'reforma', 'cambio social'
  ]
};

/**
 * Deriva la categoría automáticamente basándose en título, resumen, tags y fuente
 * @param {Object} params
 * @param {string} params.title - Título de la noticia
 * @param {string} params.summary - Resumen breve
 * @param {string[]} params.tags - Etiquetas
 * @param {Object} params.source - Información de fuente principal
 * @returns {string} Categoría derivada
 */
function deriveCategory({ title = '', summary = '', tags = [], source = null }) {
  const fullText = `${title} ${summary} ${tags.join(' ')}`.toLowerCase();
  
  // Scoring por categoría
  const scores = {};
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    
    for (const keyword of keywords) {
      // Contar apariciones del keyword
      const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'gi');
      const matches = fullText.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    
    scores[category] = score;
  }
  
  // Ordenar por score descendente
  const sortedCategories = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .filter(([_, score]) => score > 0);
  
  // Si hay match, retornar la mejor
  if (sortedCategories.length > 0) {
    const [category, score] = sortedCategories[0];
    console.log(`[CategoryDeriver] Categoría derivada: "${category}" (score: ${score})`);
    return category;
  }
  
  // Fallback: si menciona Cuba y no hay match específico
  if (fullText.includes('cuba') || fullText.includes('cubano') || fullText.includes('habana')) {
    console.log('[CategoryDeriver] Fallback: "Política" (contexto cubano sin match específico)');
    return 'Política';
  }
  
  // Fallback final: categoría genérica según el proyecto
  console.log('[CategoryDeriver] Fallback: "Sociedad" (sin match específico)');
  return 'Sociedad';
}

/**
 * Valida si una categoría es válida según las permitidas
 * @param {string} category - Categoría a validar
 * @param {string[]} allowedCategories - Categorías permitidas
 * @returns {boolean}
 */
function isValidCategory(category, allowedCategories) {
  return allowedCategories.includes(category);
}

module.exports = {
  deriveCategory,
  isValidCategory,
  CATEGORY_KEYWORDS
};
