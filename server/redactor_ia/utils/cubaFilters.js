// server/redactor_ia/utils/cubaFilters.js

/**
 * Filtros estrictos para contenido relacionado con Cuba
 * Usados cuando strictCuba mode está activo
 * Versión robusta: normaliza texto, incluye inglés, bypass por dominio
 */

/**
 * Normaliza texto eliminando diacríticos (acentos)
 * Ejemplo: "Camagüey" → "camaguey", "Díaz-Canel" → "diaz-canel"
 */
function removeDiacritics(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Palabras clave positivas AMPLIADAS (español + inglés)
// Array para permitir búsqueda con .includes() más flexible
const CUBA_POSITIVE_KEYWORDS = [
  // País y demonyms
  'cuba', 'cubano', 'cubana', 'cubanos', 'cubanas', 'cuban', 'cubans',
  
  // Capital y ciudades
  'havana', 'la habana', 'habana',
  
  // Provincias y ciudades principales (15 provincias + variantes)
  'matanzas', 'pinar del rio', 'mayabeque', 'artemisa', 'isla de la juventud',
  'villa clara', 'cienfuegos', 'sancti spiritus', 'camaguey', 'las tunas',
  'holguin', 'granma', 'santiago de cuba', 'guantanamo', 'ciego de avila',
  'santiago', 'oriente', // Regiones comunes
  
  // Gobierno y políticas
  'diaz canel', 'diaz-canel', 'dias canel', 'díaz-canel',
  'fidel castro', 'raul castro', 'raúl castro',
  'minrex', 'minsap', 'minint', 'gaceta oficial',
  'gobierno cubano', 'autoridades cubanas', 'regimen cubano',
  
  // Economía (AMPLIADO)
  'bloqueo', 'embargo', 'sanciones', 'remesas',
  'mipyme', 'mipymes', 'tarea ordenamiento',
  'peso cubano', 'cup', 'mlc', 'moneda nacional',
  'mercado cambiario', 'tipo de cambio', 'dolar cuba',
  'inflacion', 'inflación cubana', 'crisis economica',
  'reforma economica', 'economia cubana', 'economic crisis cuba',
  'escasez', 'desabastecimiento', 'apagon', 'apagón', 'apagones',
  'combustible', 'gasolina cuba', 'energia cuba',
  'gaesa', 'etecsa', 'empresas cubanas',
  
  // Migración y diáspora
  'migrantes cubanos', 'balseros', 'florida straits', 'estrecho de florida',
  'miami cuban', 'exilio cubano', 'comunidad cubana',
  'ley de ajuste cubano', 'parole humanitario',
  
  // Social y derechos
  'disidencia cubana', 'derechos humanos cuba', 'presos politicos',
  'libertad de expresion cuba', 'manifestaciones cuba',
  'represion cuba'
];

// Palabras de ruido global (aplicar solo si NO hay match positivo)
const NOISE_KEYWORDS = [
  'israel', 'gaza', 'ukraine', 'ucrania', 'russia', 'rusia',
  'nfl', 'nba', 'mlb', 'bitcoin', 'ethereum', 'grok'
];

// Hosts EXCLUIDOS de toda ingesta (blacklist dura)
const EXCLUDED_HOSTS = new Set([
  'cubadebate.cu'
]);

// Dominios cubanos con BYPASS TOTAL (medios 100% sobre Cuba)
// Estos medios publican casi exclusivamente sobre Cuba, no necesitan verificación de contenido
const HARD_CU_BYPASS = new Set([
  '14ymedio.com',
  'diariodecuba.com',
  'cibercuba.com',
  'cubanet.org',
  'martinoticias.com',
  'adncuba.com',
  'ddcuba.com',
  'cubanosporelmundo.com',
  'eltoque.com',        
  'eltoque.news',     
  'eltoque.org' 
]);

// Dominios cubanos MIXTOS que publican contenido regional/internacional
// REQUIEREN mención explícita de Cuba en el texto (NO bypass automático)
const CU_REQUIRE_POS = new Set([
  'prensa-latina.cu',
  'prensalatina.cu',
  'oncubamagazine.com',
  'radiohc.cu'
]);

// DEPRECADO: Movido a HARD_CU_BYPASS
const CUBA_SPECIALIZED = new Set([]);

/**
 * Concatena y normaliza texto de un artículo + URL
 * @param {Object} article - { title, description, content, url }
 * @returns {string} Texto normalizado sin acentos en minúsculas
 */
function concatText(article) {
  if (!article) return '';
  // Incluir URL en el texto para detectar rutas como /cuba/, /economia/, etc.
  const url = article.url || article.sourceUrl || article.link || '';
  const raw = `${article.title || ''} ${article.description || ''} ${article.content || ''} ${url}`;
  return removeDiacritics(raw.toLowerCase());
}

/**
 * Verifica si un artículo tiene match estricto con Cuba
 * @param {Object} article - { title, description, content }
 * @returns {boolean}
 */
function isCubaHardMatch(article) {
  if (!article) return false;
  
  const text = concatText(article);
  return CUBA_POSITIVE_KEYWORDS.some(keyword => text.includes(keyword));
}

/**
 * Verifica si un artículo es obviamente NO relacionado con Cuba
 * Detecta temas globales comunes que suelen ser ruido
 * IMPORTANTE: Solo aplica si NO hubo match positivo previo
 * @param {Object} article - { title, description }
 * @returns {boolean}
 */
function obviousNotCuba(article) {
  if (!article) return false;
  
  // Solo revisar título y descripción para ser más estricto
  const text = concatText({ title: article.title, description: article.description });
  
  // Si NO tiene match de Cuba Y contiene ruido → descartar
  if (isCubaHardMatch(article)) return false;
  
  return NOISE_KEYWORDS.some(noise => text.includes(noise));
}

/**
 * Verifica si un dominio tiene BYPASS TOTAL (medios 100% nacionales)
 * @param {string} host - hostname normalizado
 * @returns {boolean}
 */
function isCubaHostBypass(host) {
  if (!host) return false;
  const normalized = host.replace(/^www\./, '').toLowerCase();
  return HARD_CU_BYPASS.has(normalized);
}

/**
 * Verifica si un dominio es cubano pero requiere verificación de contenido
 * @param {string} host - hostname normalizado
 * @returns {boolean}
 */
function isCubaHostRequirePos(host) {
  if (!host) return false;
  const normalized = host.replace(/^www\./, '').toLowerCase();
  return CU_REQUIRE_POS.has(normalized) || CUBA_SPECIALIZED.has(normalized);
}

/**
 * Verifica si un artículo proviene de cualquier dominio cubano (bypass o require-pos)
 * @param {string} urlOrHost - URL completa o hostname
 * @returns {boolean}
 */
function isCubaDomain(urlOrHost) {
  if (!urlOrHost) return false;
  
  try {
    // Si es URL completa, extraer hostname
    let host = urlOrHost;
    if (urlOrHost.includes('://')) {
      host = new URL(urlOrHost).hostname;
    }
    
    // Normalizar (remover www.)
    host = host.replace(/^www\./, '').toLowerCase();
    
    return isCubaHostBypass(host) || isCubaHostRequirePos(host);
  } catch (error) {
    return false;
  }
}

/**
 * Verifica si las entidades extraídas contienen Cuba
 * Compatible con diferentes formatos de NER
 * @param {Array} entities - [{ text, type }] o similar
 * @returns {boolean}
 */
function hasCubaEntity(entities) {
  if (!entities || !Array.isArray(entities)) return false;
  
  return entities.some(entity => {
    const text = removeDiacritics((entity.text || entity.name || '').toLowerCase());
    const type = (entity.type || entity.label || '').toUpperCase();
    
    // Buscar "Cuba" o "Havana" en entidades de tipo GPE/LOC
    const hasCubaText = /cuba|havana/.test(text);
    const isLocationEntity = /GPE|LOC|LOCATION|PLACE/.test(type);
    
    return hasCubaText && isLocationEntity;
  });
}


/**
 * Filtra artículos en modo Cuba estricto (versión robusta con logs detallados)
 * Orden de evaluación:
 * 1. Bypass por dominio cubano prioritario (CiberCuba, ElToque, etc.) → PASA
 * 2. Match positivo (texto, URL paths, o NER) → PASA
 * 3. Ruido obvio → RECHAZA
 * 4. Default conservador → RECHAZA
 * 
 * @param {Array} articles - Lista de artículos
 * @param {boolean} debug - Si true, loguea cada artículo individualmente
 * @returns {Array} Artículos filtrados
 */
function strictCubaFilter(articles, debug = false) {
  if (!Array.isArray(articles)) return [];
  
  const stats = {
    total: articles.length,
    passedByDomain: 0,
    passedByText: 0,
    passedByURL: 0,
    passedByNER: 0,
    rejectedByNoise: 0,
    rejectedByDefault: 0
  };
  
  let excludedCount = 0;
  const detailedLogs = [];
  
  const filtered = articles.filter(article => {
    // Extraer hostname normalizado
    const hostname = article.hostname || (() => {
      try {
        const sourceUrl = article.url || article.sourceUrl || article.link;
        return sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, '').toLowerCase() : '';
      } catch (e) {
        return (article.source?.name || '').toLowerCase();
      }
    })();
    
    // 0. EXCLUSIÓN DURA: Rechazar hosts en blacklist
    if (EXCLUDED_HOSTS.has(hostname)) {
      excludedCount++;
      if (debug) {
        detailedLogs.push(`[CUBA FILTER] ❌ EXCLUIDA: fuente=${hostname} razón=blacklist título="${article.title?.substring(0, 60)}"`);
      }
      return false;
    }
    
    // 1. BYPASS TOTAL: Medios 100% nacionales (CiberCuba, ElToque, 14ymedio, etc.)
    if (isCubaHostBypass(hostname)) {
      stats.passedByDomain++;
      if (debug) {
        detailedLogs.push(`[CUBA FILTER] ✅ INCLUIDA: fuente=${hostname} razón=fuente_prioritaria título="${article.title?.substring(0, 60)}"`);
      }
      return true;
    }
    
    // 2. Verificar contenido (para medios mixtos y resto)
    const hasTextMatch = isCubaHardMatch(article);
    const hasNERMatch = hasCubaEntity(article.entities);
    
    // Detectar rutas cubanas en URL (ej: /cuba/, /economia/, /migracion/)
    const url = article.url || article.sourceUrl || article.link || '';
    const hasURLPath = /\/(cuba|economia|migracion|sociedad|politica)\//i.test(url);
    
    // Si es dominio cubano mixto (Prensa Latina, OnCuba, etc.), EXIGE mención de Cuba
    if (isCubaHostRequirePos(hostname)) {
      if (hasTextMatch || hasNERMatch || hasURLPath) {
        if (hasTextMatch) stats.passedByText++;
        if (hasNERMatch) stats.passedByNER++;
        if (hasURLPath) stats.passedByURL++;
        if (debug) {
          const reason = hasTextMatch ? 'keyword_match' : (hasURLPath ? 'url_path' : 'ner_match');
          detailedLogs.push(`[CUBA FILTER] ✅ INCLUIDA: fuente=${hostname} razón=${reason} título="${article.title?.substring(0, 60)}"`);
        }
        return true;
      } else {
        // Medio cubano pero sin mención de Cuba → rechazar (ej: Prensa Latina sobre Brasil)
        stats.rejectedByDefault++;
        if (debug) {
          detailedLogs.push(`[CUBA FILTER] ❌ EXCLUIDA: fuente=${hostname} razón=medio_cubano_sin_keywords título="${article.title?.substring(0, 60)}"`);
        }
        return false;
      }
    }
    
    // 3. Para otros dominios, verificar contenido
    if (hasTextMatch || hasNERMatch || hasURLPath) {
      if (hasTextMatch) stats.passedByText++;
      if (hasNERMatch) stats.passedByNER++;
      if (hasURLPath) stats.passedByURL++;
      
      // Descartar si es ruido obvio
      if (obviousNotCuba(article)) {
        stats.rejectedByNoise++;
        if (debug) {
          detailedLogs.push(`[CUBA FILTER] ❌ EXCLUIDA: fuente=${hostname} razón=ruido_global título="${article.title?.substring(0, 60)}"`);
        }
        return false;
      }
      
      if (debug) {
        const reason = hasTextMatch ? 'keyword_match' : (hasURLPath ? 'url_path' : 'ner_match');
        detailedLogs.push(`[CUBA FILTER] ✅ INCLUIDA: fuente=${hostname} razón=${reason} título="${article.title?.substring(0, 60)}"`);
      }
      return true;
    }
    
    // Sin match de Cuba, rechazar
    stats.rejectedByDefault++;
    if (debug) {
      detailedLogs.push(`[CUBA FILTER] ❌ EXCLUIDA: fuente=${hostname} razón=sin_keywords_cuba título="${article.title?.substring(0, 60)}"`);
    }
    return false;
  });
  
  // Imprimir logs detallados si debug está activo
  if (debug && detailedLogs.length > 0) {
    console.info(`\n[CUBA FILTER] === LOGS DETALLADOS (${detailedLogs.length} artículos procesados) ===`);
    detailedLogs.forEach(log => console.info(log));
    console.info('[CUBA FILTER] === FIN LOGS DETALLADOS ===\n');
  }
  
  // Log de estadísticas SIEMPRE (incluso sin debug)
  console.info('[strictCubaFilter] Estadísticas:', {
    entrada: stats.total,
    salida: filtered.length,
    tasa_inclusion: `${Math.round((filtered.length / stats.total) * 100)}%`,
    pasaron: {
      porDominio: stats.passedByDomain,
      porTexto: stats.passedByText,
      porURL: stats.passedByURL,
      porNER: stats.passedByNER
    },
    rechazados: {
      porRuido: stats.rejectedByNoise,
      porDefecto: stats.rejectedByDefault,
      porExclusion: excludedCount
    }
  });
  
  // Log de exclusiones si hubo
  if (excludedCount > 0) {
    console.info(`[strictCubaFilter] Excluidos por blacklist: ${excludedCount} artículos de:`, Array.from(EXCLUDED_HOSTS));
  }
  
  // Warning si se rechazó TODO
  if (filtered.length === 0 && stats.total > 0) {
    console.warn('[strictCubaFilter] ⚠️  TODOS los artículos fueron rechazados. Sugerencias:');
    console.warn('  - Verificar que las fuentes prioritarias (CiberCuba, ElToque) estén en allowlist');
    console.warn('  - Ampliar freshnessWindowHours si las noticias son viejas');
    console.warn('  - Revisar keywords en CUBA_POSITIVE_KEYWORDS');
  }
  
  return filtered;
}

/**
 * Genera query para NewsAPI en modo Cuba estricto
 * Incluye variantes en español e inglés para máxima cobertura
 * @returns {string}
 */
function getCubaStrictQuery() {
  // Query simple sin paréntesis anidados (NewsAPI no los soporta bien)
  return 'Cuba OR cubano OR cubana OR Havana OR Cuban';
}


module.exports = {
  isCubaHardMatch,
  obviousNotCuba,
  hasCubaEntity,
  isCubaDomain,
  isCubaHostBypass,
  isCubaHostRequirePos,
  strictCubaFilter,
  getCubaStrictQuery,
  removeDiacritics,
  concatText,
  // Exportar para testing/debugging
  CUBA_POSITIVE_KEYWORDS,
  NOISE_KEYWORDS,
  HARD_CU_BYPASS,
  CU_REQUIRE_POS,
  CUBA_SPECIALIZED,
  EXCLUDED_HOSTS
};
