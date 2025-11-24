// src/components/CartDrawer.jsx
import { X, Plus, Minus, Trash2, ShoppingBag, ExternalLink } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function CartDrawer() {
  const { items, count, total, isOpen, close, updateQuantity, removeItem, clearCart } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const handleCheckout = async () => {
    if (items.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    setIsCheckingOut(true);

    // Detectar si es móvil
    const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);

    try {
      console.log('[CartDrawer] Starting checkout process...', {
        itemCount: items.length,
        isMobile,
      });

      // Intentar crear checkout a través del backend
      const response = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:5000'}/api/shopify/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const { cartId, checkoutUrl } = await response.json();

      // Agregar líneas al carrito
      const lines = items.map(item => ({
        merchandiseId: item.variant?.id || item.productId,
        quantity: item.quantity,
      }));

      console.log('[CartDrawer] Adding lines to cart...', { lineCount: lines.length });

      const addResponse = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:5000'}/api/shopify/cart/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cartId, lines }),
      });

      if (!addResponse.ok) {
        const errorData = await addResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error agregando productos');
      }

      const { checkoutUrl: finalCheckoutUrl } = await addResponse.json();
      
      // Redirigir a Shopify checkout
      const redirectUrl = finalCheckoutUrl || checkoutUrl;
      
      console.log('[CartDrawer] ✅ Checkout URL obtained, redirecting...', { isMobile });
      
      if (isMobile) {
        window.location.href = redirectUrl; // Móvil: misma pestaña
      } else {
        window.location.href = redirectUrl; // Desktop: misma ventana
      }

    } catch (error) {
      console.error('[CartDrawer] ❌ Backend checkout failed:', error.message);
      
      // === FALLBACK: Crear checkout directamente con Storefront API ===
      console.log('[CartDrawer] Attempting fallback checkout...');
      
      try {
        const storeDomain = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN || 
                           window.__APP_CONFIG__?.SHOPIFY_STORE_DOMAIN ||
                           'i1jlfx-b5.myshopify.com';
        const token = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN || 
                     window.__APP_CONFIG__?.SHOPIFY_STOREFRONT_TOKEN ||
                     '289a67a37f66e598fb381fff10de1ade';
        const apiVersion = '2024-01';
        
        const endpoint = `https://${storeDomain}/api/${apiVersion}/graphql.json`;
        
        // Preparar líneas para Storefront API
        const lines = items.map(item => ({
          merchandiseId: item.variant?.id || item.productId,
          quantity: item.quantity || 1,
        }));

        console.log('[CartDrawer Fallback] Creating cart with Storefront API...', {
          endpoint,
          lineCount: lines.length
        });

        const query = `
          mutation CartCreate($input: CartInput!) {
            cartCreate(input: $input) {
              cart {
                id
                checkoutUrl
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': token,
          },
          body: JSON.stringify({
            query,
            variables: {
              input: { lines }
            }
          }),
        });

        if (!response.ok) {
          throw new Error(`Storefront API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.errors) {
          console.error('[CartDrawer Fallback] GraphQL errors:', data.errors);
          throw new Error(data.errors.map(e => e.message).join('; '));
        }

        const userErrors = data.data?.cartCreate?.userErrors;
        if (userErrors && userErrors.length > 0) {
          console.error('[CartDrawer Fallback] User errors:', userErrors);
          throw new Error(userErrors.map(e => e.message).join('; '));
        }

        const checkoutUrl = data.data?.cartCreate?.cart?.checkoutUrl;
        
        if (!checkoutUrl) {
          throw new Error('No se obtuvo checkoutUrl del fallback');
        }

        console.log('[CartDrawer Fallback] ✅ Checkout URL obtained via fallback');

        // Redirigir
        if (isMobile) {
          window.location.href = checkoutUrl;
        } else {
          window.location.href = checkoutUrl;
        }

      } catch (fallbackError) {
        console.error('[CartDrawer Fallback] ❌ Failed:', fallbackError);
        toast.error(`Error al procesar el checkout: ${fallbackError.message}. Verifica tu conexión e intenta de nuevo.`, {
          duration: 5000,
        });
        setIsCheckingOut(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={close}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-zinc-900 shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingBag className="text-red-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-white">Tu Carrito</h2>
              <p className="text-sm text-zinc-400">
                {count} {count === 1 ? 'producto' : 'productos'}
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Cerrar carrito"
          >
            <X className="text-zinc-400" size={24} />
          </button>
        </div>

        {/* Body - Lista de productos */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <ShoppingBag className="text-zinc-600 mb-4" size={64} />
              <p className="text-zinc-400 text-lg mb-2">Tu carrito está vacío</p>
              <p className="text-zinc-500 text-sm">Agrega productos desde la tienda</p>
            </div>
          ) : (
            <>
              {items.map((item, index) => (
                <div
                  key={`${item.productId}-${item.selectedColor}-${item.selectedSize}-${index}`}
                  className="bg-zinc-800 rounded-lg p-4 flex gap-4"
                >
                  {/* Imagen */}
                  <div className="w-20 h-20 bg-zinc-700 rounded-lg overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="text-zinc-600" size={24} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium text-sm mb-1 truncate">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
                      {item.selectedColor && (
                        <span className="px-2 py-0.5 bg-zinc-700 rounded">
                          {item.selectedColor}
                        </span>
                      )}
                      {item.selectedSize && (
                        <span className="px-2 py-0.5 bg-zinc-700 rounded">
                          {item.selectedSize}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      {/* Cantidad */}
                      <div className="flex items-center gap-1 bg-zinc-700 rounded">
                        <button
                          onClick={() => updateQuantity(item, item.quantity - 1)}
                          className="p-1.5 hover:bg-zinc-600 rounded transition-colors"
                          disabled={item.quantity <= 1}
                        >
                          <Minus size={14} className="text-zinc-300" />
                        </button>
                        <span className="px-3 text-white text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item, item.quantity + 1)}
                          className="p-1.5 hover:bg-zinc-600 rounded transition-colors"
                          disabled={item.quantity >= 10}
                        >
                          <Plus size={14} className="text-zinc-300" />
                        </button>
                      </div>

                      {/* Precio */}
                      <div className="flex items-center gap-2">
                        <span className="text-red-500 font-bold">
                          ${(parseFloat(item.price || 0) * item.quantity).toFixed(2)}
                        </span>
                        <button
                          onClick={() => {
                            removeItem(item);
                            toast.success('Producto eliminado');
                          }}
                          className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Limpiar carrito */}
              {items.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('¿Estás seguro de vaciar el carrito?')) {
                      clearCart();
                      toast.success('Carrito vaciado');
                    }
                  }}
                  className="w-full text-center text-sm text-zinc-500 hover:text-red-500 transition-colors py-2"
                >
                  Vaciar carrito
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer - Total y Checkout */}
        {items.length > 0 && (
          <div className="p-6 border-t border-zinc-800 space-y-4">
            {/* Total */}
            <div className="flex items-center justify-between text-lg">
              <span className="text-zinc-400">Total:</span>
              <span className="text-white font-bold text-2xl">
                ${total.toFixed(2)} USD
              </span>
            </div>

            {/* Botón Checkout */}
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingOut ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Procesando...
                </>
              ) : (
                <>
                  Proceder al pago
                  <ExternalLink size={18} />
                </>
              )}
            </button>

            <p className="text-xs text-zinc-500 text-center">
              Serás redirigido a Shopify para completar tu compra de forma segura
            </p>
          </div>
        )}
      </div>
    </>
  );
}

