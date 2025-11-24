/**
 * Cliente para Shopify Storefront API
 * Maneja la conexión y autenticación con Shopify
 */

const axios = require('axios');

// [Claude]: Validación y carga de variables de entorno con defaults seguros
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || '';
const SHOPIFY_STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

// [Claude]: Versiones de fallback si la principal falla
const API_VERSION_FALLBACKS = ['2024-10', '2024-07', '2024-01'];

// [Claude]: Validación de configuración al iniciar
function validateConfig() {
  const errors = [];
  
  if (!SHOPIFY_STORE_DOMAIN) {
    errors.push('SHOPIFY_STORE_DOMAIN no está configurado');
  }
  
  if (!SHOPIFY_STOREFRONT_TOKEN) {
    errors.push('SHOPIFY_STOREFRONT_TOKEN no está configurado');
  }
  
  if (errors.length > 0) {
    console.error('[Shopify] Errores de configuración:', errors.join(', '));
    return false;
  }
  
  // [Claude]: Validar formato del dominio
  if (!SHOPIFY_STORE_DOMAIN.includes('.myshopify.com')) {
    console.warn('[Shopify] El dominio no parece ser válido. Formato esperado: tu-tienda.myshopify.com');
  }
  
  return true;
}

// [Claude]: Construir URL del endpoint GraphQL
function buildGraphQLUrl(apiVersion = SHOPIFY_API_VERSION) {
  return `https://${SHOPIFY_STORE_DOMAIN}/api/${apiVersion}/graphql.json`;
}

/**
 * Función principal para hacer requests a Shopify Storefront API
 * @param {string} query - Query GraphQL a ejecutar
 * @param {object} variables - Variables para la query
 * @param {string} apiVersion - Versión de API a usar (opcional)
 * @returns {Promise<object>} - Respuesta de la API
 */
async function shopifyFetch(query, variables = {}, apiVersion = SHOPIFY_API_VERSION) {
  // [Claude]: Validar configuración antes de cada request
  if (!validateConfig()) {
    throw new Error('Configuración de Shopify incompleta. Revisa las variables de entorno.');
  }
  
  const url = buildGraphQLUrl(apiVersion);
  
  // [Claude]: Log del request (sin exponer el token)
  console.log(`[Shopify] Request to ${url.replace(SHOPIFY_STORE_DOMAIN, '***')}`);
  console.log(`[Shopify] Query type: ${query.match(/\w+/)?.[0] || 'Unknown'}`);
  
  try {
    const response = await axios.post(
      url,
      {
        query,
        variables
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
        },
        timeout: 10000, // [Claude]: Timeout de 10 segundos
      }
    );
    
    // [Claude]: Log de respuesta exitosa
    console.log(`[Shopify] Response status: ${response.status}`);
    
    // [Claude]: Verificar si hay errores en la respuesta GraphQL
    if (response.data.errors) {
      console.error('[Shopify] GraphQL errors:', response.data.errors);
      
      // [Claude]: Si hay errores de versión de API, intentar con fallbacks
      const versionError = response.data.errors.find(e => 
        e.message?.includes('version') || 
        e.message?.includes('API')
      );
      
      if (versionError && apiVersion === SHOPIFY_API_VERSION) {
        console.log('[Shopify] Intentando con versiones de API alternativas...');
        
        for (const fallbackVersion of API_VERSION_FALLBACKS) {
          if (fallbackVersion !== apiVersion) {
            try {
              console.log(`[Shopify] Probando con versión ${fallbackVersion}...`);
              return await shopifyFetch(query, variables, fallbackVersion);
            } catch (fallbackError) {
              console.log(`[Shopify] Versión ${fallbackVersion} falló, continuando...`);
            }
          }
        }
      }
      
      throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
    }
    
    return response.data.data;
    
  } catch (error) {
    // [Claude]: Manejo detallado de errores sin exponer información sensible
    console.error('[Shopify] Request failed:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      // No logueamos headers ni datos sensibles
    });
    
    // [Claude]: Mensajes de error más útiles según el código de estado
    if (error.response) {
      const status = error.response.status;
      
      if (status === 401) {
        throw new Error('Token de acceso inválido. Verifica SHOPIFY_STOREFRONT_TOKEN');
      } else if (status === 403) {
        throw new Error('Acceso denegado. Verifica los permisos del token de Storefront');
      } else if (status === 404) {
        throw new Error('Tienda no encontrada. Verifica SHOPIFY_STORE_DOMAIN');
      } else if (status === 400) {
        throw new Error('Query inválida o parámetros incorrectos');
      } else {
        throw new Error(`Error de Shopify: ${status} ${error.response.statusText}`);
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Timeout al conectar con Shopify');
    } else {
      throw new Error(`Error de conexión: ${error.message}`);
    }
  }
}

/**
 * Función helper para validar handles de productos
 * @param {string} handle - Handle del producto
 * @returns {string} - Handle validado
 */
function validateProductHandle(handle) {
  if (!handle || typeof handle !== 'string') {
    throw new Error('Handle de producto inválido');
  }
  
  // [Claude]: Los handles solo pueden contener letras, números y guiones
  const cleanHandle = handle.toLowerCase().trim();
  if (!/^[a-z0-9-]+$/.test(cleanHandle)) {
    throw new Error('Handle contiene caracteres inválidos');
  }
  
  // [Claude]: Limitar longitud del handle
  if (cleanHandle.length > 255) {
    throw new Error('Handle demasiado largo');
  }
  
  return cleanHandle;
}

/**
 * Función helper para validar IDs de Shopify
 * @param {string} id - ID de Shopify (GID)
 * @param {string} type - Tipo de recurso esperado (Product, Cart, etc.)
 * @returns {string} - ID validado
 */
function validateShopifyId(id, type = 'Product') {
  if (!id || typeof id !== 'string') {
    throw new Error(`ID de ${type} inválido`);
  }
  
  // [Claude]: Verificar formato GID
  const expectedPrefix = `gid://shopify/${type}/`;
  if (!id.startsWith(expectedPrefix)) {
    throw new Error(`ID debe tener formato ${expectedPrefix}...`);
  }
  
  // [Claude]: Verificar que el ID tenga un valor después del prefijo
  const idValue = id.substring(expectedPrefix.length);
  if (!idValue || !/^\d+$/.test(idValue)) {
    throw new Error(`ID de ${type} tiene formato incorrecto`);
  }
  
  return id;
}

// [Claude]: Exportar funciones y helpers
module.exports = {
  shopifyFetch,
  validateProductHandle,
  validateShopifyId,
  validateConfig,
  SHOPIFY_STORE_DOMAIN,
  SHOPIFY_API_VERSION,
};
