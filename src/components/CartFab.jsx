// src/components/CartFab.jsx
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function CartFab() {
  const { count, open } = useCart();

  if (count === 0) return null; // No mostrar si el carrito está vacío

  return (
    <button
      onClick={open}
      className="fixed bottom-6 right-6 z-50 bg-red-600 hover:bg-red-700 text-white rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-110 group"
      aria-label="Ver carrito"
    >
      <ShoppingCart size={24} className="group-hover:scale-110 transition-transform" />
      
      {/* Badge con contador */}
      {count > 0 && (
        <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-zinc-950 animate-pulse">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}

