/**
 * Rutas Express para Shopify Storefront API
 * Maneja operaciones de carrito y productos
 */

const express = require('express');
const router = express.Router();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// [Claude]: Importar cliente y funciones de validación
const { 
  shopifyFetch, 
  validateProductHandle, 
  validateShopifyId,
  validateConfig,
  SHOPIFY_STORE_DOMAIN 
} = require('../integrations/shopify/client');

// [Claude]: Importar todas las queries incluyendo las nuevas
const {
  CART_CREATE,
  CART_LINES_ADD,
  CART_LINES_REMOVE,
  CART_QUERY,
  PRODUCTS_MIN,
  PRODUCT_BY_ID,
  PRODUCT_BY_HANDLE,
  TEST_QUERY,
} = require('../integrations/shopify/queries');

// [Claude]: Rate limiter específico para las rutas de Shopify
const shopifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60, // 60 requests por minuto por IP
  message: {
    error: 'Demasiadas solicitudes desde esta IP',
    hint: 'Por favor intenta de nuevo en un minuto',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// [Claude]: Middleware para verificar configuración antes de cada request
const checkConfig = (req, res, next) => {
  if (!validateConfig()) {
    console.error('[Shopify] Configuración incompleta');
    return res.status(503).json({
      error: 'Servicio de tienda no disponible',
      hint: 'El servidor no está configurado correctamente. Contacta al administrador.',
      details: 'Faltan variables de entorno críticas'
    });
  }
  next();
};

// [Claude]: Aplicar helmet, rate limiter y verificación de config a todas las rutas
router.use(helmet());
router.use(shopifyLimiter);
router.use(checkConfig);

/**
 * Formatear descripción del producto para mejor legibilidad
 * @param {string} raw - Descripción cruda de Shopify
 * @returns {string} - Descripción formateada
 */
function formatDescription(raw = '') {
  if (!raw || typeof raw !== 'string') return '';
  
  let txt = raw;

  // 1. Normalizar espacios múltiples
  txt = txt.replace(/\s{2,}/g, ' ');

  // 2. Asegurar espacios después de punto y antes de "•"
  txt = txt.replace(/\.\s*•/g, '.\n• ');     // fin de oración + bullet
  txt = txt.replace(/([^\s])•/g, '$1 • ');   // asegura espacio antes del bullet
  txt = txt.replace(/•\s*/g, '• ');          // bullet con espacio consistente

  // 3. Corregir uniones comunes sin alterar contenido
  txt = txt.replace(/EEUU\s*Age/gi, 'EEUU. Age');          // "EEUUAge" -> "EEUU. Age"
  txt = txt.replace(/inc\.?\s*y\s+SINDEN/gi, 'Inc. y SINDEN'); // "inc.y SINDEN" -> "Inc. y SINDEN"
  txt = txt.replace(/LIMITED\./gi, 'LIMITED.');             // normalizar mayúsculas
  txt = txt.replace(/,\s*\)/g, ')');                        // comas pegadas a paréntesis
  txt = txt.replace(/\(\s*/g, '(');                         // quitar espacio después de (
  txt = txt.replace(/\s*\)/g, ')');                         // quitar espacio antes de )

  // 4. Asegurar espacio después de puntos antes de mayúsculas
  txt = txt.replace(/\.([A-ZÁÉÍÓÚÑ])/g, '. $1');
  txt = txt.replace(/,([^\s])/g, ', $1');                   // espacio después de comas

  // 5. Convertir bullets en lista HTML
  const parts = txt.split('•').map(s => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    const head = parts[0]; // texto antes del primer bullet
    const items = parts.slice(1); // items de la lista
    const lis = items.map(li => `  <li>${li}</li>`).join('\n');
    return `<p>${head}</p>\n<ul class="mt-3 space-y-1 list-disc list-inside">\n${lis}\n</ul>`;
  }

  // 6. Si no hay bullets, envolver en párrafo
  return `<p>${txt.trim()}</p>`;
}

/**
 * Validación básica de inputs para carrito
 */
function validateCartId(cartId) {
  if (!cartId || typeof cartId !== 'string') {
    throw new Error('ID de carrito inválido');
  }
  // [Claude]: Shopify cart IDs tienen formato: gid://shopify/Cart/...
  if (!cartId.startsWith('gid://shopify/Cart/')) {
    throw new Error('Formato de ID de carrito inválido');
  }
  // [Claude]: Limitar longitud para evitar ataques
  if (cartId.length > 100) {
    throw new Error('ID de carrito demasiado largo');
  }
  return cartId;
}

function validateMerchandiseId(merchandiseId) {
  if (!merchandiseId || typeof merchandiseId !== 'string') {
    throw new Error('ID de merchandise inválido');
  }
  // [Claude]: Shopify variant IDs tienen formato: gid://shopify/ProductVariant/...
  if (!merchandiseId.startsWith('gid://shopify/ProductVariant/')) {
    throw new Error('Formato de ID de merchandise inválido');
  }
  if (merchandiseId.length > 100) {
    throw new Error('ID de merchandise demasiado largo');
  }
  return merchandiseId;
}

function validateQuantity(quantity) {
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty < 1 || qty > 100) {
    throw new Error('La cantidad debe estar entre 1 y 100');
  }
  return qty;
}

/**
 * GET /api/shopify/test
 * Test básico de conexión con Shopify
 */
router.get('/test', async (req, res) => {
  try {
    console.log('[Shopify] Testing connection...');
    const data = await shopifyFetch(TEST_QUERY);
    
    console.log('[Shopify] Test successful:', data.shop?.name);
    
    res.json({
      success: true,
      shop: data.shop,
      message: 'Conexión exitosa con Shopify Storefront API',
      domain: SHOPIFY_STORE_DOMAIN.replace(/[^.]+/, '***') // [Claude]: Ocultar parte del dominio
    });
  } catch (error) {
    console.error('[Shopify] Test error:', error.message);
    
    // [Claude]: Respuesta estructurada de error
    res.status(500).json({ 
      success: false,
      error: 'Error al conectar con Shopify',
      details: error.message,
      hint: 'Verifica SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_TOKEN y SHOPIFY_API_VERSION'
    });
  }
});

/**
 * GET /api/shopify/products
 * Listar productos disponibles - Devuelve array directo
 */
router.get('/products', async (req, res) => {
  try {
    // [Claude]: Validar y limitar el parámetro limit
    const limit = parseInt(req.query.limit) || 50;
    const first = Math.min(Math.max(limit, 1), 100); // Entre 1 y 100
    
    console.log(`[Shopify BE] Fetching ${first} products from Shopify Storefront API...`);
    console.log(`[Shopify BE] Store: ${SHOPIFY_STORE_DOMAIN}`);
    
    const data = await shopifyFetch(PRODUCTS_MIN, { first });

    if (!data || !data.products) {
      console.warn('[Shopify BE] No products data returned from Shopify');
      console.warn('[Shopify BE] Response data:', JSON.stringify(data, null, 2));
      return res.json([]);
    }

    // [Claude]: Formatear productos - Devolver array directo
    const rawProducts = data.products?.edges || [];
    console.log(`[Shopify BE] Raw products count: ${rawProducts.length}`);
    
    const products = rawProducts
      .map(edge => edge.node)
      .map(p => {
        console.log(`[Shopify BE] Processing product: ${p.title}, available: ${p.availableForSale}, variants: ${p.variants?.edges?.length || 0}`);
        return {
          id: p.id,
          handle: p.handle,
          title: p.title,
          description: p.description || '',
          descriptionHtml: formatDescription(p.description || ''), // Descripción formateada con HTML
          price: p.priceRange?.minVariantPrice?.amount || '0.00',
          currencyCode: p.priceRange?.minVariantPrice?.currencyCode || 'USD',
          imageUrl: p.featuredImage?.url || null,
          image: p.featuredImage?.url || null,
          featuredImage: p.featuredImage,
          priceRange: p.priceRange,
          category: p.productType || 'general',
          productType: p.productType || 'general',
          availableForSale: p.availableForSale || (p.variants?.edges?.some(v => v.node.availableForSale) ?? false),
          available: p.availableForSale || (p.variants?.edges?.some(v => v.node.availableForSale) ?? false),
          options: Array.isArray(p.options) ? p.options.map(o => ({
            name: o?.name,
            values: Array.isArray(o?.values) ? o.values : [],
          })) : [],
          variants: p.variants?.edges?.map(v => v.node) || [],
        };
      });

    console.info(`[Shopify BE] ✅ Successfully fetched and formatted ${products.length} products`);
    if (products[0]) {
      console.info(`[Shopify BE] First product sample:`, {
        title: products[0].title,
        price: products[0].price,
        currency: products[0].currencyCode,
        available: products[0].available,
        variantCount: products[0].variants?.length || 0
      });
    } else {
      console.warn('[Shopify BE] ⚠️ No products returned - check Shopify admin to ensure products are published to the Headless sales channel');
    }
    
    // [Claude]: Devolver array directo, no objeto con {products, count}
    res.json(products);
    
  } catch (error) {
    console.error('[Shopify] ❌ Error getting products:', error.message);
    console.error('[Shopify] Error stack:', error.stack);
    
    // [Claude]: Si no hay productos, devolver array vacío
    if (error.message.includes('Not Found') || error.message.includes('404')) {
      console.warn('[Shopify] Store not found, returning empty array');
      return res.json([]);
    }
    
    res.status(500).json({ 
      error: 'Error al obtener productos',
      details: error.message,
      hint: 'Verifica la configuración de la tienda y que SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_TOKEN estén correctos'
    });
  }
});

/**
 * GET /api/shopify/products/:handle
 * [Claude]: Endpoint RESTful - Obtener un producto por handle en la ruta
 */
router.get('/products/:handle', async (req, res) => {
  try {
    const { handle } = req.params;
    
    // [Claude]: Validar handle
    const validatedHandle = validateProductHandle(handle);
    console.log(`[Shopify BE] Fetching product by handle (RESTful): ${validatedHandle}`);
    
    const data = await shopifyFetch(PRODUCT_BY_HANDLE, { handle: validatedHandle });
    const product = data?.productByHandle;
    
    if (!product) {
      console.warn(`[Shopify BE] Product not found: ${validatedHandle}`);
      return res.status(404).json({
        error: 'Producto no encontrado',
        hint: `No se encontró ningún producto con handle: ${validatedHandle}`
      });
    }
    
    // [Claude]: Formatear igual que en /products para consistencia
    // Procesar variantes con selectedOptions e imagen
    const variants = (product.variants?.edges || []).map(edge => {
      const v = edge.node;
      return {
        id: v.id,
        title: v.title,
        availableForSale: v.availableForSale,
        available: v.availableForSale,
        quantityAvailable: v.quantityAvailable,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        image: v.image || null,
        imageUrl: v.image?.url || null,
        selectedOptions: v.selectedOptions || [],
      };
    });

    const formattedProduct = {
      id: product.id,
      handle: product.handle,
      title: product.title,
      description: product.description || '',
      descriptionHtml: formatDescription(product.description || ''), // Descripción formateada
      price: product.priceRange?.minVariantPrice?.amount || '0.00',
      currencyCode: product.priceRange?.minVariantPrice?.currencyCode || 'USD',
      imageUrl: product.featuredImage?.url || null,
      image: product.featuredImage?.url || null,
      featuredImage: product.featuredImage,
      priceRange: product.priceRange,
      category: product.productType || 'general',
      productType: product.productType || 'general',
      availableForSale: product.availableForSale,
      available: product.availableForSale,
      // [Claude]: Opciones de producto (Color, Size, etc.)
      options: Array.isArray(product.options) ? product.options.map(o => ({
        name: o?.name,
        values: Array.isArray(o?.values) ? o.values : [],
      })) : [],
      // [Claude]: Variantes con selectedOptions para mapear color+talla
      variants: variants,
      images: product.images?.edges || [],
      vendor: product.vendor,
      tags: product.tags,
      seo: product.seo,
    };
    
    // Log para debug de opciones
    console.log(`[Shopify BE] Product options:`, formattedProduct.options);
    console.log(`[Shopify BE] Variants count: ${variants.length}, sample selectedOptions:`, variants[0]?.selectedOptions);
    
    console.log(`[Shopify BE] ✅ Product found: ${product.title}`);
    
    // Devolver en el mismo formato que /products (objeto directo, no wrapped)
    res.json(formattedProduct);
    
  } catch (error) {
    console.error('[Shopify BE] ❌ Error getting product by handle:', error.message);
    
    if (error.message.includes('Handle contiene caracteres inválidos')) {
      return res.status(400).json({ 
        error: 'Handle inválido',
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Error al obtener el producto',
      details: error.message,
      hint: 'Verifica que el handle sea válido y que el producto exista en Shopify'
    });
  }
});

/**
 * GET /api/shopify/product
 * [Claude]: Nuevo endpoint - Obtener un producto por ID o handle (legacy con query params)
 */
router.get('/product', async (req, res) => {
  try {
    const { id, handle } = req.query;
    
    // [Claude]: Validar que se proporcione uno de los dos parámetros
    if (!id && !handle) {
      return res.status(400).json({
        error: 'Parámetros faltantes',
        hint: 'Debes proporcionar "id" o "handle" como query parameter',
        examples: [
          '/api/shopify/product?handle=camiseta-levantatecuba',
          '/api/shopify/product?id=gid://shopify/Product/1234567890123'
        ]
      });
    }
    
    // [Claude]: No permitir ambos parámetros a la vez
    if (id && handle) {
      return res.status(400).json({
        error: 'Demasiados parámetros',
        hint: 'Proporciona solo "id" O "handle", no ambos'
      });
    }
    
    let data;
    let productKey;
    
    if (id) {
      // [Claude]: Validar y buscar por ID
      const validatedId = validateShopifyId(id, 'Product');
      console.log(`[Shopify] Fetching product by ID: ${validatedId.substring(0, 30)}...`);
      
      data = await shopifyFetch(PRODUCT_BY_ID, { id: validatedId });
      productKey = 'product';
      
    } else {
      // [Claude]: Validar y buscar por handle
      const validatedHandle = validateProductHandle(handle);
      console.log(`[Shopify] Fetching product by handle: ${validatedHandle}`);
      
      data = await shopifyFetch(PRODUCT_BY_HANDLE, { handle: validatedHandle });
      productKey = 'productByHandle';
    }
    
    // [Claude]: Verificar si se encontró el producto
    const product = data?.[productKey];
    if (!product) {
      console.warn(`[Shopify] Product not found: ${id || handle}`);
      return res.status(404).json({
        error: 'Producto no encontrado',
        hint: `No se encontró ningún producto con ${id ? 'ID' : 'handle'}: ${id || handle}`
      });
    }
    
    // [Claude]: Formatear respuesta del producto
    const formattedProduct = {
      id: product.id,
      handle: product.handle,
      title: product.title,
      description: product.description,
      vendor: product.vendor,
      productType: product.productType,
      tags: product.tags,
      featuredImage: product.featuredImage,
      images: product.images?.edges?.map(e => e.node) || [],
      priceRange: product.priceRange,
      variants: product.variants?.edges?.map(e => e.node) || [],
      seo: product.seo,
      variantCount: product.variants?.edges?.length || 0
    };
    
    console.log(`[Shopify] Product found: ${product.title}`);
    
    res.json({
      success: true,
      product: formattedProduct
    });
    
  } catch (error) {
    console.error('[Shopify] Error getting product:', error.message);
    
    res.status(500).json({
      error: 'Error al obtener el producto',
      details: error.message,
      hint: 'Verifica que el ID o handle sea válido'
    });
  }
});

/**
 * POST /api/shopify/cart
 * Crear un nuevo carrito
 */
router.post('/cart', async (req, res) => {
  const start = Date.now();
  try {
    console.log('[Shopify Cart] Creating new cart...', {
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']?.substring(0, 100),
      ip: req.ip,
    });
    
    const data = await shopifyFetch(CART_CREATE);

    if (data.cartCreate?.userErrors?.length > 0) {
      console.error('[Shopify Cart] Creation errors:', data.cartCreate.userErrors);
      return res.status(400).json({
        error: 'Error al crear el carrito',
        details: data.cartCreate.userErrors,
        hint: 'Revisa los errores específicos del campo'
      });
    }

    const cart = data.cartCreate?.cart;
    if (!cart) {
      throw new Error('No se recibió carrito de Shopify');
    }

    console.log(`[Shopify Cart] ✅ Cart created successfully`, {
      cartId: cart.id.substring(0, 40) + '...',
      checkoutUrl: cart.checkoutUrl ? 'present' : 'missing',
      ms: Date.now() - start
    });

    res.json({
      success: true,
      cartId: cart.id,
      checkoutUrl: cart.checkoutUrl,
      totalQuantity: cart.totalQuantity,
      cost: cart.cost,
    });
    
  } catch (error) {
    console.error('[Shopify Cart] ❌ Error creating cart:', {
      message: error.message,
      stack: error.stack,
      ms: Date.now() - start
    });
    res.status(500).json({ 
      error: 'Error al crear el carrito',
      message: error.message,
      details: error.message,
      hint: 'Intenta de nuevo o contacta soporte'
    });
  }
});

/**
 * POST /api/shopify/cart/lines
 * Agregar líneas al carrito
 */
router.post('/cart/lines', async (req, res) => {
  const start = Date.now();
  try {
    const { cartId, lines } = req.body;

    console.log('[Shopify Cart Lines] Adding lines to cart...', {
      cartId: cartId?.substring(0, 40) + '...',
      lineCount: lines?.length || 0,
      origin: req.headers.origin,
    });

    // [Claude]: Validar inputs
    const validatedCartId = validateCartId(cartId);
    
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ 
        error: 'Líneas inválidas',
        message: 'Las líneas deben ser un array no vacío',
        hint: 'Las líneas deben ser un array no vacío'
      });
    }
    
    if (lines.length > 20) {
      return res.status(400).json({ 
        error: 'Demasiadas líneas',
        message: 'Máximo 20 líneas por solicitud',
        hint: 'Máximo 20 líneas por solicitud'
      });
    }

    // [Claude]: Validar y preparar líneas
    const validatedLines = lines.map((line, index) => {
      try {
        return {
          merchandiseId: validateMerchandiseId(line.merchandiseId),
          quantity: validateQuantity(line.quantity),
        };
      } catch (error) {
        throw new Error(`Error en línea ${index + 1}: ${error.message}`);
      }
    });

    console.log(`[Shopify Cart Lines] Validated ${validatedLines.length} lines`);

    const data = await shopifyFetch(CART_LINES_ADD, {
      cartId: validatedCartId,
      lines: validatedLines,
    });

    if (data.cartLinesAdd?.userErrors?.length > 0) {
      console.error('[Shopify Cart Lines] Add errors:', data.cartLinesAdd.userErrors);
      return res.status(400).json({
        error: 'Error al agregar líneas al carrito',
        message: data.cartLinesAdd.userErrors.map(e => e.message).join('; '),
        details: data.cartLinesAdd.userErrors,
        hint: 'Verifica los IDs de productos y cantidades'
      });
    }

    const cart = data.cartLinesAdd?.cart;
    if (!cart) {
      throw new Error('No se recibió carrito actualizado de Shopify');
    }

    // [Claude]: Formatear líneas para respuesta más limpia
    const formattedLines = cart.lines?.edges?.map(edge => ({
      id: edge.node.id,
      quantity: edge.node.quantity,
      merchandise: edge.node.merchandise,
    })) || [];

    console.log(`[Shopify Cart Lines] ✅ Added successfully`, {
      totalItems: cart.totalQuantity,
      checkoutUrl: cart.checkoutUrl ? 'present' : 'missing',
      ms: Date.now() - start
    });

    res.json({
      success: true,
      cartId: cart.id,
      checkoutUrl: cart.checkoutUrl,
      totalQuantity: cart.totalQuantity,
      lines: formattedLines,
      cost: cart.cost,
    });
    
  } catch (error) {
    console.error('[Shopify Cart Lines] ❌ Error:', {
      message: error.message,
      stack: error.stack,
      ms: Date.now() - start
    });
    res.status(500).json({ 
      error: 'Error al agregar productos al carrito',
      message: error.message,
      details: error.message,
      hint: 'Verifica el formato de los datos enviados'
    });
  }
});

/**
 * POST /api/shopify/cart/lines/remove
 * Eliminar líneas del carrito
 */
router.post('/cart/lines/remove', async (req, res) => {
  try {
    const { cartId, lineIds } = req.body;

    // [Claude]: Validar inputs
    const validatedCartId = validateCartId(cartId);
    
    if (!Array.isArray(lineIds) || lineIds.length === 0) {
      return res.status(400).json({ 
        error: 'IDs de líneas inválidos',
        hint: 'lineIds debe ser un array no vacío'
      });
    }
    
    if (lineIds.length > 20) {
      return res.status(400).json({ 
        error: 'Demasiadas líneas',
        hint: 'Máximo 20 líneas por solicitud'
      });
    }

    console.log(`[Shopify] Removing ${lineIds.length} lines from cart...`);

    const data = await shopifyFetch(CART_LINES_REMOVE, {
      cartId: validatedCartId,
      lineIds,
    });

    if (data.cartLinesRemove?.userErrors?.length > 0) {
      console.error('[Shopify] Cart lines remove errors:', data.cartLinesRemove.userErrors);
      return res.status(400).json({
        error: 'Error al eliminar líneas del carrito',
        details: data.cartLinesRemove.userErrors,
        hint: 'Verifica que los IDs de líneas sean válidos'
      });
    }

    const cart = data.cartLinesRemove?.cart;
    if (!cart) {
      throw new Error('No se recibió carrito actualizado de Shopify');
    }

    // [Claude]: Formatear líneas para respuesta más limpia
    const formattedLines = cart.lines?.edges?.map(edge => ({
      id: edge.node.id,
      quantity: edge.node.quantity,
      merchandise: edge.node.merchandise,
    })) || [];

    console.log(`[Shopify] Removed lines successfully. Remaining items: ${cart.totalQuantity}`);

    res.json({
      success: true,
      cartId: cart.id,
      checkoutUrl: cart.checkoutUrl,
      totalQuantity: cart.totalQuantity,
      lines: formattedLines,
      cost: cart.cost,
    });
    
  } catch (error) {
    console.error('[Shopify] Error removing lines from cart:', error.message);
    res.status(500).json({ 
      error: 'Error al eliminar productos del carrito',
      details: error.message,
      hint: 'Verifica el formato de los datos enviados'
    });
  }
});

/**
 * GET /api/shopify/cart/:cartId
 * Obtener carrito por ID
 */
router.get('/cart/:cartId', async (req, res) => {
  try {
    const cartId = req.params.cartId;
    const validatedCartId = validateCartId(cartId);

    console.log(`[Shopify] Getting cart: ${validatedCartId.substring(0, 30)}...`);

    const data = await shopifyFetch(CART_QUERY, {
      id: validatedCartId,
    });

    const cart = data.cart;
    if (!cart) {
      console.warn(`[Shopify] Cart not found: ${validatedCartId.substring(0, 30)}...`);
      return res.status(404).json({ 
        error: 'Carrito no encontrado',
        hint: 'El carrito puede haber expirado o el ID es incorrecto'
      });
    }

    // [Claude]: Formatear líneas para respuesta más limpia
    const formattedLines = cart.lines?.edges?.map(edge => ({
      id: edge.node.id,
      quantity: edge.node.quantity,
      merchandise: edge.node.merchandise,
    })) || [];

    console.log(`[Shopify] Cart found with ${cart.totalQuantity} items`);

    res.json({
      success: true,
      cartId: cart.id,
      checkoutUrl: cart.checkoutUrl,
      totalQuantity: cart.totalQuantity,
      lines: formattedLines,
      cost: cart.cost,
    });
    
  } catch (error) {
    console.error('[Shopify] Error getting cart:', error.message);
    res.status(500).json({ 
      error: 'Error al obtener el carrito',
      details: error.message,
      hint: 'Verifica que el ID del carrito sea válido'
    });
  }
});

module.exports = router;