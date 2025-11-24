// src/context/CartContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const CartContext = createContext();

const CART_STORAGE_KEY = 'lc_cart';

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  // Cargar carrito desde localStorage al iniciar
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setItems(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error('[CartContext] Error cargando carrito:', error);
    }
  }, []);

  // Guardar carrito en localStorage cuando cambie
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('[CartContext] Error guardando carrito:', error);
    }
  }, [items]);

  // Calcular total de items
  const count = items.reduce((total, item) => total + (item.quantity || 1), 0);

  // Calcular total en dinero
  const total = items.reduce((sum, item) => {
    const price = parseFloat(item.price || 0);
    const qty = parseInt(item.quantity || 1);
    return sum + (price * qty);
  }, 0);

  // Agregar item al carrito
  const addItem = (newItem) => {
    setItems(prevItems => {
      // Buscar si ya existe (mismo producto + color + talla)
      const existingIndex = prevItems.findIndex(
        item => 
          item.productId === newItem.productId &&
          item.selectedColor === newItem.selectedColor &&
          item.selectedSize === newItem.selectedSize
      );

      if (existingIndex >= 0) {
        // Actualizar cantidad
        const updated = [...prevItems];
        updated[existingIndex].quantity += (newItem.quantity || 1);
        return updated;
      } else {
        // Agregar nuevo
        return [...prevItems, { ...newItem, quantity: newItem.quantity || 1 }];
      }
    });
  };

  // Actualizar cantidad de un item
  const updateQuantity = (item, newQuantity) => {
    if (newQuantity < 1 || newQuantity > 10) return;
    
    setItems(prevItems =>
      prevItems.map(i => {
        if (
          i.productId === item.productId &&
          i.selectedColor === item.selectedColor &&
          i.selectedSize === item.selectedSize
        ) {
          return { ...i, quantity: newQuantity };
        }
        return i;
      })
    );
  };

  // Eliminar item del carrito
  const removeItem = (item) => {
    setItems(prevItems =>
      prevItems.filter(
        i => !(
          i.productId === item.productId &&
          i.selectedColor === item.selectedColor &&
          i.selectedSize === item.selectedSize
        )
      )
    );
  };

  // Limpiar carrito
  const clearCart = () => {
    setItems([]);
  };

  // Abrir/cerrar drawer
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen(prev => !prev);

  const value = {
    items,
    count,
    total,
    isOpen,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    open,
    close,
    toggle,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

CartProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe usarse dentro de CartProvider');
  }
  return context;
}

