/**
 * Capa de estado del carrito (sin UI)
 * Maneja localStorage y proporciona helpers para interactuar con el carrito
 */

import { createCart, addLines, getCart } from './shopifyClient';

const CART_ID_KEY = 'shop_cart_id';
const CART_CHECKOUT_URL_KEY = 'shop_checkout_url';

/**
 * Obtener el ID del carrito desde localStorage
 * @returns {string|null}
 */
export function getStoredCartId() {
  try {
    return localStorage.getItem(CART_ID_KEY);
  } catch (error) {
    console.warn('No se pudo acceder a localStorage:', error);
    return null;
  }
}

/**
 * Guardar el ID del carrito en localStorage
 * @param {string} cartId
 */
export function setStoredCartId(cartId) {
  try {
    localStorage.setItem(CART_ID_KEY, cartId);
  } catch (error) {
    console.warn('No se pudo guardar en localStorage:', error);
  }
}

/**
 * Obtener la URL de checkout desde localStorage
 * @returns {string|null}
 */
export function getStoredCheckoutUrl() {
  try {
    return localStorage.getItem(CART_CHECKOUT_URL_KEY);
  } catch (error) {
    console.warn('No se pudo acceder a localStorage:', error);
    return null;
  }
}

/**
 * Guardar la URL de checkout en localStorage
 * @param {string} checkoutUrl
 */
export function setStoredCheckoutUrl(checkoutUrl) {
  try {
    localStorage.setItem(CART_CHECKOUT_URL_KEY, checkoutUrl);
  } catch (error) {
    console.warn('No se pudo guardar en localStorage:', error);
  }
}

/**
 * Limpiar todo el estado del carrito
 */
export function clearCart() {
  try {
    localStorage.removeItem(CART_ID_KEY);
    localStorage.removeItem(CART_CHECKOUT_URL_KEY);
  } catch (error) {
    console.warn('No se pudo limpiar localStorage:', error);
  }
}

/**
 * Asegurar que existe un carrito válido
 * Si no existe o está inválido, crea uno nuevo
 * @returns {Promise<{cartId: string, checkoutUrl: string}>}
 */
export async function ensureCart() {
  let cartId = getStoredCartId();
  
  if (cartId) {
    try {
      // Verificar que el carrito aún es válido
      const cart = await getCart(cartId);
      if (cart && cart.checkoutUrl) {
        setStoredCheckoutUrl(cart.checkoutUrl);
        return { cartId: cart.cartId, checkoutUrl: cart.checkoutUrl };
      }
    } catch (error) {
      console.log('Carrito existente no válido, creando uno nuevo...');
      clearCart();
    }
  }
  
  // Crear nuevo carrito
  try {
    const newCart = await createCart();
    setStoredCartId(newCart.cartId);
    setStoredCheckoutUrl(newCart.checkoutUrl);
    return newCart;
  } catch (error) {
    console.error('Error al crear carrito:', error);
    throw error;
  }
}

/**
 * Agregar un producto al carrito
 * @param {{merchandiseId: string, quantity: number}} item - Producto a agregar
 * @returns {Promise<{cartId: string, checkoutUrl: string, lines: Array}>}
 */
export async function addToCart({ merchandiseId, quantity = 1 }) {
  try {
    // Validación básica
    if (!merchandiseId) {
      throw new Error('merchandiseId es requerido');
    }
    if (quantity < 1 || quantity > 100) {
      throw new Error('La cantidad debe estar entre 1 y 100');
    }
    
    // Asegurar que tenemos un carrito
    const { cartId } = await ensureCart();
    
    // Agregar el producto
    const updatedCart = await addLines(cartId, [{ merchandiseId, quantity }]);
    
    // Actualizar checkout URL por si cambió
    if (updatedCart.checkoutUrl) {
      setStoredCheckoutUrl(updatedCart.checkoutUrl);
    }
    
    return updatedCart;
  } catch (error) {
    console.error('Error al agregar al carrito:', error);
    throw error;
  }
}

/**
 * Obtener el carrito actual con sus líneas
 * @returns {Promise<{cartId: string, checkoutUrl: string, lines: Array, cost: Object}|null>}
 */
export async function getCurrentCart() {
  const cartId = getStoredCartId();
  if (!cartId) {
    return null;
  }
  
  try {
    const cart = await getCart(cartId);
    if (cart.checkoutUrl) {
      setStoredCheckoutUrl(cart.checkoutUrl);
    }
    return cart;
  } catch (error) {
    console.error('Error al obtener carrito:', error);
    clearCart();
    return null;
  }
}

/**
 * Redirigir al checkout de Shopify
 * @param {boolean} newTab - Si abrir en nueva pestaña (default: false)
 */
export async function goToCheckout(newTab = false) {
  try {
    // Primero intentar con el URL guardado
    let checkoutUrl = getStoredCheckoutUrl();
    
    // Si no hay URL guardado, obtenerlo del carrito
    if (!checkoutUrl) {
      const cartId = getStoredCartId();
      if (!cartId) {
        throw new Error('No hay carrito activo');
      }
      
      const cart = await getCart(cartId);
      checkoutUrl = cart.checkoutUrl;
      
      if (checkoutUrl) {
        setStoredCheckoutUrl(checkoutUrl);
      }
    }
    
    if (!checkoutUrl) {
      throw new Error('No se pudo obtener la URL de checkout');
    }
    
    // Detectar si es móvil
    const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
    
    // Redirigir al checkout
    // En móvil: siempre usar location.href (evita pop-up blocker)
    // En desktop: respetar newTab preference
    if (isMobile) {
      console.log('[shopCart] Mobile detected, using direct navigation');
      window.location.href = checkoutUrl;
    } else if (newTab) {
      console.log('[shopCart] Desktop, opening in new tab');
      window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = checkoutUrl;
    }
  } catch (error) {
    console.error('Error al ir al checkout:', error);
    throw error;
  }
}

/**
 * Obtener número total de items en el carrito
 * @returns {Promise<number>}
 */
export async function getCartItemCount() {
  try {
    const cart = await getCurrentCart();
    return cart?.totalQuantity || 0;
  } catch (error) {
    console.error('Error al obtener cantidad de items:', error);
    return 0;
  }
}

// Exportar todo como un objeto para uso conveniente
const shopCart = {
  getStoredCartId,
  setStoredCartId,
  getStoredCheckoutUrl,
  setStoredCheckoutUrl,
  clearCart,
  ensureCart,
  addToCart,
  getCurrentCart,
  goToCheckout,
  getCartItemCount,
};

// Exponer en window para pruebas de desarrollo (opcional)
if (import.meta.env.DEV) {
  window.Shop = shopCart;
  console.log('🛒 Shop utilities disponibles en window.Shop para pruebas');
}

export default shopCart;

