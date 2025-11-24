// server/redactor_ia/services/themeProfiles.js
/**
 * THEME VISUAL PROFILES - Sistema IIF (Image Instruction Format)
 * 
 * Perfiles temáticos por tipo de noticia para generación de imágenes contextualizadas.
 * Define escenas, emociones y elementos visuales según la categoría editorial.
 */

const THEME_PROFILES = {
  'política': {
    scene_type: 'press_conference',
    emotion: 'seriedad institucional, tensión política',
    elements: 'micrófonos, podio, banderas de contexto, periodistas, funcionarios genéricos',
    avoid: 'retratos reconocibles, celebraciones, escenas corporativas',
    composition: 'formal, centrado, enfoque en orador o diálogo',
    lighting: 'iluminación institucional, interior o exterior gubernamental'
  },
  
  'protesta': {
    scene_type: 'political_protest',
    emotion: 'tensión social, demanda, inconformidad',
    elements: 'multitud, carteles en blanco, gestos expresivos, calles urbanas',
    avoid: 'violencia gráfica, retratos identificables, banderas equivocadas',
    composition: 'gran angular, multitudes, movimiento',
    lighting: 'luz natural, urbana, dramática'
  },
  
  'crisis_social': {
    scene_type: 'citizen_government_interaction',
    emotion: 'preocupación, conflicto, necesidad',
    elements: 'personas afectadas, funcionarios, encuentros tensos, espacios públicos',
    avoid: 'violencia explícita, imágenes sensacionalistas',
    composition: 'confrontación visual, contraste de posiciones',
    lighting: 'natural, documental'
  },
  
  'economía': {
    scene_type: 'economic_crisis',
    emotion: 'preocupación económica, análisis, impacto',
    elements: 'gráficas abstractas, monedas/billetes genéricos, comercios, personas preocupadas',
    avoid: 'logos de empresas, marcas específicas, celebraciones',
    composition: 'gráficos integrados, escenas de mercado',
    lighting: 'profesional, periodística'
  },
  
  'diplomacia': {
    scene_type: 'diplomatic_meeting',
    emotion: 'formalidad, negociación, ceremonial',
    elements: 'mesas de negociación, banderas (contextuales), apretones de manos simbólicos',
    avoid: 'retratos identificables de líderes, logos, símbolos partidistas',
    composition: 'formal, simétrica, equilibrada',
    lighting: 'institucional, interior formal'
  },
  
  'desastre_natural': {
    scene_type: 'natural_disaster',
    emotion: 'emergencia, solidaridad, destrucción contenida',
    elements: 'escenas de aftermath, equipos de rescate sin insignias, daños visibles, clima extremo',
    avoid: 'gore, víctimas identificables, logos de organizaciones',
    composition: 'dramática, documental, gran angular',
    lighting: 'natural dramática, condiciones climáticas visibles'
  },
  
  'conflicto_bélico': {
    scene_type: 'military_tension',
    emotion: 'tensión, alerta, conflicto latente',
    elements: 'soldados genéricos sin insignias, vehículos militares neutros, atmósfera tensa',
    avoid: 'gore, banderas específicas en uniformes, logos militares',
    composition: 'tensa, angular, documental de guerra',
    lighting: 'dramática, natural, posiblemente nocturna'
  },
  
  'justicia': {
    scene_type: 'courtroom',
    emotion: 'solemnidad judicial, proceso legal',
    elements: 'sala de tribunal, juez genérico, abogados, símbolos de justicia abstractos',
    avoid: 'retratos de jueces reales, logos judiciales específicos',
    composition: 'formal, arquitectura judicial',
    lighting: 'interior institucional'
  },
  
  'derechos_humanos': {
    scene_type: 'human_rights_scene',
    emotion: 'dignidad, lucha, reivindicación',
    elements: 'personas en situación de vulnerabilidad (sin identificar), espacios de protesta o refugio',
    avoid: 'victimización gráfica, identificación de personas',
    composition: 'humanista, documental',
    lighting: 'natural, emotiva'
  },
  
  'educación': {
    scene_type: 'educational_scene',
    emotion: 'aprendizaje, desarrollo, futuro',
    elements: 'aulas, estudiantes genéricos, libros, tecnología educativa',
    avoid: 'logos de instituciones, retratos identificables',
    composition: 'dinámica, positiva',
    lighting: 'natural, interior educativo'
  },
  
  'salud': {
    scene_type: 'healthcare_scene',
    emotion: 'atención médica, cuidado, sistema de salud',
    elements: 'personal médico genérico, hospitales, equipamiento médico sin marcas',
    avoid: 'gore, pacientes identificables, logos de hospitales',
    composition: 'profesional médica, documental',
    lighting: 'clínica, institucional'
  },
  
  'tecnología': {
    scene_type: 'tech_scene',
    emotion: 'innovación, modernidad, digital',
    elements: 'dispositivos genéricos, código abstracto, ambientes tech',
    avoid: 'logos de empresas tech, productos específicos de marcas',
    composition: 'moderna, futurista',
    lighting: 'tech, azulada, contemporánea'
  },
  
  'cultura': {
    scene_type: 'cultural_scene',
    emotion: 'expresión cultural, identidad, arte',
    elements: 'manifestaciones artísticas, espacios culturales, símbolos culturales del país',
    avoid: 'artistas reconocibles, logos de instituciones',
    composition: 'artística, expresiva',
    lighting: 'creativa, variada'
  },
  
  'deportes': {
    scene_type: 'sports_scene',
    emotion: 'acción deportiva, competencia, pasión',
    elements: 'atletas genéricos, instalaciones deportivas, movimiento',
    avoid: 'atletas reconocibles, logos de equipos, marcas deportivas',
    composition: 'dinámica, acción congelada',
    lighting: 'deportiva, dramática'
  },
  
  'medio_ambiente': {
    scene_type: 'environmental_scene',
    emotion: 'naturaleza, conservación, impacto ambiental',
    elements: 'naturaleza del país, impacto visible, activismo ambiental',
    avoid: 'logos de ONGs, catastrofismo excesivo',
    composition: 'documental ambiental',
    lighting: 'natural, exterior'
  },
  
  'generic': {
    scene_type: 'generic_scene',
    emotion: 'periodística neutral',
    elements: 'escena editorial relacionada con el titular',
    avoid: 'elementos identificables, logos, marcas',
    composition: 'equilibrada, profesional',
    lighting: 'natural, profesional'
  }
};

/**
 * Obtiene perfil temático por categoría
 * @param {string} category - Categoría de la noticia
 * @returns {Object} Perfil temático
 */
function getThemeProfile(category) {
  if (!category) return THEME_PROFILES.generic;
  
  const normalizedCategory = category.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u');
  
  const profile = THEME_PROFILES[normalizedCategory];
  if (!profile) {
    console.log(`[ThemeProfiles] Categoría "${category}" no encontrada, usando genérico`);
    return THEME_PROFILES.generic;
  }
  
  return profile;
}

/**
 * Detecta perfil temático desde keywords y contenido
 * @param {Object} params - {title, summary, tags, category}
 * @returns {Object} Perfil temático detectado
 */
function detectThemeFromContent({ title = '', summary = '', tags = [], category = '' }) {
  const text = `${title} ${summary} ${tags.join(' ')}`.toLowerCase();
  
  // Detección por keywords
  if (/protesta|manifestaci[oó]n|marcha|movilizaci[oó]n/i.test(text)) {
    return THEME_PROFILES.protesta;
  }
  if (/desastre|hurac[aá]n|terremoto|inundaci[oó]n|incendio/i.test(text)) {
    return THEME_PROFILES.desastre_natural;
  }
  if (/guerra|conflicto|militar|ataque|bombardeo/i.test(text)) {
    return THEME_PROFILES.conflicto_bélico;
  }
  if (/crisis|econom[ií]a|inflaci[oó]n|pobreza|desempleo/i.test(text)) {
    return THEME_PROFILES.economía;
  }
  if (/derechos|represi[oó]n|violaci[oó]n|abuso|tortura/i.test(text)) {
    return THEME_PROFILES.derechos_humanos;
  }
  if (/juicio|tribunal|condena|absolución|justicia/i.test(text)) {
    return THEME_PROFILES.justicia;
  }
  if (/diplom[aá]tico|embajada|relaciones|tratado|acuerdo/i.test(text)) {
    return THEME_PROFILES.diplomacia;
  }
  
  // Fallback por categoría
  return getThemeProfile(category);
}

module.exports = {
  THEME_PROFILES,
  getThemeProfile,
  detectThemeFromContent
};
