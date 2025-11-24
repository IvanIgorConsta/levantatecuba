// src/components/store/CartSheet.jsx
import { X, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import PropTypes from 'prop-types';
import { useEffect } from 'react';

export default function CartSheet({ isOpen, onClose, cartItems, onUpdateQuantity, onRemoveItem, onCheckout }) {
  // Calcular totales
  const subtotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const itemCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  // Prevenir scroll cuando está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Panel lateral */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-zinc-950 border-l border-zinc-800 z-50 flex flex-col transform transition-transform duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <ShoppingBag className="text-red-500" size={24} />
            <h2 className="text-xl font-semibold text-white">
              Tu Carrito ({itemCount} {itemCount === 1 ? 'item' : 'items'})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
            aria-label="Cerrar carrito"
          >
            <X size={24} />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6">
          {cartItems.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="mx-auto text-zinc-600 mb-4" size={48} />
              <p className="text-zinc-400">Tu carrito está vacío</p>
              <button
                onClick={onClose}
                className="mt-4 text-red-500 hover:text-red-400 underline"
              >
                Continuar comprando
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div 
                  key={`${item.productId}-${item.variant?.id}`}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
                >
                  <div className="flex gap-4">
                    {/* Imagen */}
                    <div className="w-20 h-20 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={item.image || `https://via.placeholder.com/80x80/1a1a1a/ef4444?text=${encodeURIComponent(item.title)}`}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = `https://via.placeholder.com/80x80/1a1a1a/ef4444?text=Producto`;
                        }}
                      />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium mb-1 truncate">
                        {item.title}
                      </h3>
                      {item.variant && (
                        <p className="text-sm text-zinc-400">
                          {item.variant.size || item.variant.color || item.variant.type}
                        </p>
                      )}
                      <div className="text-red-500 font-semibold">
                        ${item.price.toFixed(2)}
                      </div>
                    </div>

                    {/* Eliminar */}
                    <button
                      onClick={() => onRemoveItem(item)}
                      className="text-zinc-400 hover:text-red-500 transition-colors"
                      aria-label="Eliminar del carrito"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  {/* Cantidad */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUpdateQuantity(item, item.quantity - 1)}
                        className="p-1 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                        disabled={item.quantity <= 1}
                        aria-label="Disminuir cantidad"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="px-3 py-1 bg-zinc-800 rounded text-white font-medium min-w-[40px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item, item.quantity + 1)}
                        className="p-1 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                        disabled={item.quantity >= 10}
                        aria-label="Aumentar cantidad"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="text-white font-semibold">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer con totales y checkout */}
        {cartItems.length > 0 && (
          <div className="border-t border-zinc-800 p-6">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-semibold text-white">
                <span>Total</span>
                <span className="text-red-500">${subtotal.toFixed(2)}</span>
              </div>
            </div>
            
            <button
              onClick={onCheckout}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Proceder al Checkout
            </button>
            
            <button
              onClick={onClose}
              className="w-full mt-2 text-zinc-400 hover:text-white transition-colors"
            >
              Continuar comprando
            </button>
          </div>
        )}
      </div>
    </>
  );
}

CartSheet.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  cartItems: PropTypes.arrayOf(PropTypes.shape({
    productId: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    quantity: PropTypes.number.isRequired,
    image: PropTypes.string,
    variant: PropTypes.object
  })).isRequired,
  onUpdateQuantity: PropTypes.func.isRequired,
  onRemoveItem: PropTypes.func.isRequired,
  onCheckout: PropTypes.func.isRequired
};

