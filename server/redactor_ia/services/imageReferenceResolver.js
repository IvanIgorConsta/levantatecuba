// server/redactor_ia/services/imageReferenceResolver.js
/**
 * Resuelve imágenes editoriales reales para personas públicas
 * Usa Bing Image Search API (o stub) con filtros de licencia
 * NO reconocimiento facial - solo búsqueda por nombre + filtros editoriales
 * 
 * CONTROL: Respeta flag IMG_DISABLE_EDITORIAL_MODE para bypass
 */

const axios = require('axios');
const { IMG } = require('../../config/image');

/**
 * Busca imagen editorial de una persona pública
 * @param {Object} params
 * @param {string} params.name - Nombre de la persona
 * @param {string[]} params.contextKeywords - Keywords de contexto (opcional)
 * @param {string} params.country - País (opcional)
 * @param {string} params.role - Rol/cargo (opcional)
 * @returns {Promise<Object|null>} { imageUrl, sourceUrl, provider, width, height, license, thumbnailUrl } o null
 */
async function resolveEditorialImage({ name, contextKeywords = [], country = null, role = null }) {
  // BYPASS 1: Flag global de modo editorial
  if (IMG.DISABLE_EDITORIAL_MODE) {
    console.log('[EditorialResolver] ⏭️ SKIPPED (IMG_DISABLE_EDITORIAL_MODE=true)');
    return null;
  }
  
  // BYPASS 2: Variable de entorno específica
  const enableEditorial = process.env.IMG_USE_EDITORIAL_COVER !== 'false'; // Default true
  
  if (!enableEditorial) {
    console.log('[EditorialResolver] Editorial mode disabled (IMG_USE_EDITORIAL_COVER=false)');
    return null;
  }
  
  if (!name || typeof name !== 'string' || name.length < 3) {
    console.log('[EditorialResolver] Invalid or too short name');
    return null;
  }
  
  console.log(`[EditorialResolver] Buscando imagen editorial para: "${name}"`);
  
  // Verificar si tenemos API key de Bing
  const bingApiKey = process.env.BING_IMAGE_SEARCH_API_KEY || process.env.AZURE_COGNITIVE_KEY;
  
  if (!bingApiKey) {
    console.warn('[EditorialResolver] No BING_IMAGE_SEARCH_API_KEY found → usando stub/fallback');
    return resolveEditorialImageStub({ name, contextKeywords, country, role });
  }
  
  try {
    // Construir query de búsqueda
    const roleContext = role ? ` ${role}` : '';
    const countryContext = country ? ` ${country}` : '';
    const query = `${name}${roleContext}${countryContext} foto editorial`;
    
    console.log(`[EditorialResolver] Query Bing: "${query}"`);
    
    // Llamada a Bing Image Search API v7
    const response = await axios.get('https://api.bing.microsoft.com/v7.0/images/search', {
      headers: {
        'Ocp-Apim-Subscription-Key': bingApiKey
      },
      params: {
        q: query,
        count: 10, // Top 10 resultados
        offset: 0,
        mkt: 'es-ES',
        safeSearch: 'Strict',
        aspect: 'Wide', // Aprox 3:2
        size: 'Large', // ≥ 1024px
        // Filtros de licencia: Public, Share, ShareCommercially, Modify
        // Bing usa "license" pero los valores varían según región
        // Para editorial, buscamos "Public" o "ShareCommercially"
        license: 'Public,Share,ShareCommercially',
        freshness: 'Month' // Preferir imágenes recientes
      },
      timeout: 5000
    });
    
    if (!response.data || !response.data.value || response.data.value.length === 0) {
      console.log('[EditorialResolver] No results from Bing');
      return null;
    }
    
    // Ranking de resultados
    const candidates = response.data.value.map(img => {
      let score = 0;
      
      // Verificar que el nombre esté en título/alt
      const nameInTitle = (img.name || '').toLowerCase().includes(name.toLowerCase());
      const nameInAlt = (img.contentUrl || '').toLowerCase().includes(name.toLowerCase());
      if (nameInTitle) score += 50;
      if (nameInAlt) score += 20;
      
      // Preferir dominios confiables editoriales
      const trustedDomains = [
        'gettyimages.com', 'shutterstock.com', 'alamy.com',
        'reuters.com', 'apimages.com', 'afp.com',
        'efe.com', 'europapress.es', 'agenciasinc.es'
      ];
      const hostPageUrl = img.hostPageUrl || '';
      const isTrusted = trustedDomains.some(domain => hostPageUrl.includes(domain));
      if (isTrusted) score += 40;
      
      // Preferir alta resolución
      if (img.width >= 1600) score += 30;
      else if (img.width >= 1024) score += 15;
      
      // Penalizar marcas de agua visibles en nombre
      const hasWatermark = /watermark|marca de agua|preview/i.test(img.name || '');
      if (hasWatermark) score -= 50;
      
      // Bonus si es editorial explícito
      if (/editorial|news|press/i.test(img.name || '')) score += 20;
      
      return {
        imageUrl: img.contentUrl,
        sourceUrl: img.hostPageUrl,
        provider: new URL(img.hostPageUrl).hostname.replace('www.', ''),
        width: img.width,
        height: img.height,
        thumbnailUrl: img.thumbnailUrl,
        license: img.imageInsightsToken ? 'Editorial' : 'Unknown', // Simplificado
        title: img.name,
        score
      };
    });
    
    // Ordenar por score descendente
    candidates.sort((a, b) => b.score - a.score);
    
    // Filtrar candidatos con score mínimo
    const winner = candidates.find(c => c.score >= 50);
    
    if (!winner) {
      console.log('[EditorialResolver] No high-quality editorial match found (all scores < 50)');
      return null;
    }
    
    console.log(`[EditorialResolver] ✅ Editorial hit: ${winner.provider} (score=${winner.score})`);
    console.log(`[EditorialResolver] URL: ${winner.imageUrl.substring(0, 80)}...`);
    
    return {
      imageUrl: winner.imageUrl,
      sourceUrl: winner.sourceUrl,
      provider: winner.provider,
      width: winner.width,
      height: winner.height,
      license: winner.license,
      thumbnailUrl: winner.thumbnailUrl
    };
    
  } catch (error) {
    console.error('[EditorialResolver] Error calling Bing API:', error.message);
    return null;
  }
}

/**
 * Stub/fallback cuando no hay API key de Bing
 * Retorna null (cae a modo IA)
 */
function resolveEditorialImageStub({ name, contextKeywords, country, role }) {
  console.log(`[EditorialResolver:Stub] Sin API key, no se puede buscar imagen editorial para "${name}"`);
  console.log('[EditorialResolver:Stub] Para activar: configura BING_IMAGE_SEARCH_API_KEY en .env');
  
  // En modo stub, siempre retornar null para caer al pipeline IA
  return null;
}

/**
 * Descarga y guarda imagen editorial en /media
 * @param {string} imageUrl - URL de la imagen
 * @param {string} draftId - ID del borrador
 * @returns {Promise<string|null>} Ruta local guardada o null
 */
async function downloadEditorialImage(imageUrl, draftId) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LevántateCuba/1.0)'
      }
    });
    
    if (!response.data) {
      console.error('[EditorialResolver] No image data received');
      return null;
    }
    
    // Convertir a base64
    const b64 = Buffer.from(response.data, 'binary').toString('base64');
    
    // Guardar usando el mismo sistema que las imágenes IA
    const { saveBase64Png } = require('./mediaStore');
    const localPath = await saveBase64Png(b64, `editorial_${draftId}`);
    
    console.log(`[EditorialResolver] Imagen editorial descargada y guardada: ${localPath}`);
    return localPath;
    
  } catch (error) {
    console.error('[EditorialResolver] Error downloading editorial image:', error.message);
    return null;
  }
}

module.exports = {
  resolveEditorialImage,
  downloadEditorialImage
};
