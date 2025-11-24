import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Product, ProductVariant } from '@/types'
import toast from 'react-hot-toast'

interface CartItem {
  id: string
  product: Product
  variant: ProductVariant
  quantity: number
  price: number
}

interface CartStore {
  items: CartItem[]
  cartId: string | null
  isLoading: boolean
  
  // Actions
  addItem: (product: Product, variant: ProductVariant, quantity?: number) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  setCartId: (cartId: string) => void
  
  // Getters
  getItemCount: () => number
  getSubtotal: () => number
  getCartItem: (variantId: string) => CartItem | undefined
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      isLoading: false,

      addItem: (product, variant, quantity = 1) => {
        const existingItem = get().items.find(item => item.variant.id === variant.id)
        
        if (existingItem) {
          // Si el item ya existe, actualizar cantidad
          set((state) => ({
            items: state.items.map(item =>
              item.variant.id === variant.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            )
          }))
          toast.success(`Se actualizó la cantidad de ${product.title}`)
        } else {
          // Si no existe, agregar nuevo item
          const newItem: CartItem = {
            id: `${product.id}_${variant.id}`,
            product,
            variant,
            quantity,
            price: variant.prices[0]?.amount || 0
          }
          set((state) => ({
            items: [...state.items, newItem]
          }))
          toast.success(`${product.title} agregado al carrito`)
        }
      },

      removeItem: (itemId) => {
        const item = get().items.find(i => i.id === itemId)
        set((state) => ({
          items: state.items.filter(item => item.id !== itemId)
        }))
        if (item) {
          toast.success(`${item.product.title} eliminado del carrito`)
        }
      },

      updateQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(itemId)
          return
        }
        
        set((state) => ({
          items: state.items.map(item =>
            item.id === itemId
              ? { ...item, quantity }
              : item
          )
        }))
      },

      clearCart: () => {
        set({ items: [], cartId: null })
        toast.success('Carrito vaciado')
      },

      setCartId: (cartId) => {
        set({ cartId })
      },

      getItemCount: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },

      getSubtotal: () => {
        return get().items.reduce((total, item) => {
          return total + (item.price * item.quantity)
        }, 0)
      },

      getCartItem: (variantId) => {
        return get().items.find(item => item.variant.id === variantId)
      }
    }),
    {
      name: 'levantatecuba-cart',
      partialize: (state) => ({
        items: state.items,
        cartId: state.cartId
      })
    }
  )
)
