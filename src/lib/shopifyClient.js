// src/lib/shopifyClient.js
import { RUNTIME_CONFIG } from '../lib/runtimeConfig';

function pick(...vals) {
  for (const v of vals) {
    const s = (v ?? '').toString().trim();
    if (s) return s;
  }
  return '';
}

// 1) Resolver API_BASE con trazabilidad y fallback definitivo
const RESOLVED = {
  fromEnv: import.meta?.env?.VITE_SHOPIFY_API_BASE ?? '',
  fromRuntime: RUNTIME_CONFIG?.SHOPIFY_API_BASE ?? '',
  fromWindow: typeof window !== 'undefined' ? window.__APP_CONFIG__?.SHOPIFY_API_BASE ?? '' : '',
};
let API_BASE = pick(RESOLVED.fromEnv, RESOLVED.fromRuntime, RESOLVED.fromWindow);
if (!API_BASE) {
  // Fallback: ruta relativa que funciona tanto en dev como en producción
  API_BASE = '/api/shopify';
}
// Limpiar trailing slash y URLs locales que no funcionan en producción
API_BASE = API_BASE.replace(/\/$/, '');
// Si detectamos URL local en producción, usar ruta relativa
if (typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1' &&
    !window.location.hostname.startsWith('192.168.')) {
  // Estamos en producción, forzar ruta relativa si hay IP local
  if (API_BASE.includes('192.168.') || API_BASE.includes('localhost') || API_BASE.includes('127.0.0.1')) {
    console.warn('[Shopify FE] Detectada URL local en producción, usando ruta relativa');
    API_BASE = '/api/shopify';
  }
}

console.info('[Shopify FE] API_BASE sources:', RESOLVED);
console.info('[Shopify FE] API_BASE resolved →', API_BASE);

// 2) Normalizador robusto con variantes y opciones
export function normalizeProduct(raw) {
  const canon = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "")
      .replace("colour", "color")
      .replace("talla", "size")
      .replace("tamano", "size")
      .replace("tamaño", "size");

  const toNum = (x) => {
    if (x == null) return null;
    if (typeof x === "number") return x;
    if (typeof x === "object" && x.amount != null) return Number(x.amount);
    return Number(x);
  };

  const productImg =
    raw?.imageUrl ||
    raw?.image ||
    raw?.featuredImage?.url ||
    (Array.isArray(raw?.images) && raw.images[0]?.url) || null;

  // opciones del producto (no por variante)
  console.log("[DBG] raw.options:", raw?.options);
  const options = (raw?.options || []).map((opt) => {
    console.log("[DBG] opt.name:", opt?.name, "opt.values:", opt?.values, "type:", typeof opt?.values);
    
    // Si values es un string separado por comas, convertirlo a array
    let valuesArray = opt?.values || [];
    if (typeof valuesArray === 'string') {
      valuesArray = valuesArray.split(',').map(v => v.trim()).filter(Boolean);
    }
    
    return {
      name: opt?.name ?? "",
      key: canon(opt?.name),
      values: Array.from(new Set(valuesArray.map(String))),
    };
  });

  // variantes normalizadas y con selectedOptions canónicas
  const variants = (raw?.variants || []).map((v) => {
    const price = toNum(v?.price?.amount ?? v?.price);
    const currencyCode = v?.price?.currencyCode ?? v?.presentmentPrices?.[0]?.price?.currencyCode ?? raw?.priceRangeV2?.minVariantPrice?.currencyCode ?? "USD";
    const imageUrl =
      v?.image?.src || v?.image?.url || raw?.images?.[0]?.src || raw?.featuredImage?.url || null;

    if (raw?.variants && raw.variants[0] && raw.variants[0].selectedOptions) {
      console.log("[DBG] v0.selectedOptions:", raw?.variants?.[0]?.selectedOptions);
    }
    const selectedOptions = (v?.selectedOptions || []).map((so) => {
      const name = so?.name ?? "";
      const key  = canon(so?.name);
      let value  = so?.value ?? "";
      if (key === 'size' && typeof value === 'string' && value.includes(',')) {
        value = ''; // evita marcar talla a nivel de variante si trae el listado completo
      }
      return { name, key, value };
    });

    return {
      id: v?.id,
      price, // number
      currencyCode,
      available: v?.availableForSale ?? v?.available ?? true,
      quantityAvailable: v?.quantityAvailable ?? null,
      imageUrl,
      selectedOptions,
    };
  });

  // Para conveniencia: conjunto de claves de opción presentes en variantes O en options del producto
  const variantOptionKeys = Array.from(
    new Set(variants.flatMap((v) => v.selectedOptions.map((o) => o.key)))
  );

  // Mantener options que tengan valores (incluso si las variantes no las tienen explícitamente)
  // Esto es importante para productos de Printful/Shopify donde las options vienen del producto
  const optionsFiltered = options.filter((o) => o.values && o.values.length > 0);
  
  console.log("[DBG] optionsFiltered:", optionsFiltered.map(o => ({ name: o.name, values: o.values })));

  // rangos de precio para fallback/mostrar "desde"
  const numericPrices = variants.map((v) => v.price).filter((p) => typeof p === "number" && !Number.isNaN(p));
  const priceMin = numericPrices.length ? Math.min(...numericPrices) : null;
  const priceMax = numericPrices.length ? Math.max(...numericPrices) : null;

  return {
    id: raw?.id,
    title: raw?.title,
    handle: raw?.handle,
    description: raw?.description || raw?.descriptionHtml || "",
    imageUrl: productImg,
    options: optionsFiltered,
    variants,
    currencyCode: raw?.priceRangeV2?.minVariantPrice?.currencyCode ?? variants?.[0]?.currencyCode ?? 'USD',
    priceMin,
    priceMax,
  };
}

function normalizeProducts(raw) {
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.products) ? raw.products : [];
  return arr.map(normalizeProduct);
}

export async function listShopifyProducts() {
  const url = `${API_BASE}/products`;
  console.info('[Shopify FE Client] Fetching products from:', url);

  let res;
  try {
    res = await fetch(url, { method: 'GET' });
    console.log('[Shopify FE Client] Response status:', res.status, res.statusText);
  } catch (e) {
    console.error('[Shopify FE Client] ❌ Network error:', e?.message || e);
    console.error('[Shopify FE Client] Could not connect to backend. Is the server running?');
    return [];
  }
  
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('[Shopify FE Client] ❌ HTTP', res.status, '→', txt.slice(0, 300));
    return [];
  }

  let raw;
  try {
    raw = await res.json();
    console.log('[Shopify FE Client] Raw response type:', Array.isArray(raw) ? 'array' : typeof raw);
    console.log('[Shopify FE Client] Raw response count:', Array.isArray(raw) ? raw.length : 'N/A');
  } catch {
    const txt = await res.text().catch(() => '');
    console.error('[Shopify FE Client] ❌ Non-JSON response:', txt.slice(0, 300));
    return [];
  }

  const items = normalizeProducts(raw);
  console.info('[Shopify FE Client] ✅ Normalized', items.length, 'products');
  
  if (items[0]) {
    console.debug('[Shopify FE Client] First normalized product:', {
      title: items[0].title,
      priceMin: items[0].priceMin,
      priceMax: items[0].priceMax,
      currency: items[0].currencyCode,
      imageUrl: items[0].imageUrl ? '✓ presente' : '✗ ausente',
      options: items[0].options,
      variantCount: items[0].variants?.length || 0,
      sampleVariant: items[0].variants?.[0] ? {
        id: items[0].variants[0].id,
        price: items[0].variants[0].price,
        available: items[0].variants[0].available
      } : 'sin variantes'
    });
  } else {
    console.warn('[Shopify FE Client] ⚠️ No products to display');
  }
  
  return items;
}

/**
 * Obtener un producto específico por handle
 * @param {string} handle - Handle del producto (ej: "camiseta-de-manga-corta-unisex")
 * @returns {Promise<Object>} - Producto normalizado
 */
export async function getProductByHandle(handle) {
  const cleanHandle = (handle || '').toString().trim().toLowerCase();
  
  if (!cleanHandle) {
    console.error('[Shopify FE] Handle vacío');
    throw new Error('Handle de producto requerido');
  }
  
  const url = `${API_BASE}/products/${encodeURIComponent(cleanHandle)}`;
  console.info('[Shopify FE Client] Fetching product by handle:', cleanHandle);
  console.info('[Shopify FE Client] URL:', url);

  let res;
  try {
    res = await fetch(url, { 
      method: 'GET',
      credentials: 'include'
    });
    console.log('[Shopify FE Client] Response status:', res.status, res.statusText);
  } catch (e) {
    console.error('[Shopify FE Client] ❌ Network error:', e?.message || e);
    throw new Error('Error de conexión al obtener producto');
  }
  
  if (res.status === 404) {
    console.warn('[Shopify FE Client] ⚠️ Producto no encontrado:', cleanHandle);
    throw new Error('PRODUCT_NOT_FOUND');
  }
  
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('[Shopify FE Client] ❌ HTTP', res.status, '→', txt.slice(0, 300));
    throw new Error(`Error HTTP ${res.status}`);
  }

  let raw;
  try {
    raw = await res.json();
    console.log('[Shopify FE Client] Product data received:', raw.title);
  } catch {
    const txt = await res.text().catch(() => '');
    console.error('[Shopify FE Client] ❌ Non-JSON response:', txt.slice(0, 300));
    throw new Error('Respuesta inválida del servidor');
  }

  const normalized = normalizeProduct(raw);
  console.info('[Shopify FE Client] ✅ Product normalized:', {
    title: normalized.title,
    priceMin: normalized.priceMin,
    variantCount: normalized.variants?.length || 0,
    imageUrl: normalized.imageUrl ? '✓' : '✗'
  });
  
  return normalized;
}