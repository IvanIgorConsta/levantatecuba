// src/components/store/CartButton.jsx
import { ShoppingCart } from 'lucide-react';
import PropTypes from 'prop-types';

export default function CartButton({ itemCount = 0, onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 bg-red-500 hover:bg-red-600 text-white rounded-full p-4 shadow-lg hover:shadow-red-500/30 transition-all duration-300 group"
      aria-label={`Carrito con ${itemCount} items`}
    >
      <div className="relative">
        <ShoppingCart size={24} className="group-hover:scale-110 transition-transform" />
        {itemCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-white text-red-500 text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-pulse">
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
      </div>
    </button>
  );
}

CartButton.propTypes = {
  itemCount: PropTypes.number,
  onClick: PropTypes.func.isRequired
};

