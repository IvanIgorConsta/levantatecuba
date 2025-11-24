'use client'

import { useState } from 'react'
import { Product, ProductVariant } from '@/types'
import { useCartStore } from '@/store/cart'
import { ShoppingCartIcon, CheckIcon } from '@heroicons/react/24/outline'
import { cn } from '@/utils/cn'

interface AddToCartButtonProps {
  product: Product
  variant: ProductVariant
  quantity?: number
  compact?: boolean
  className?: string
}

export function AddToCartButton({ 
  product, 
  variant, 
  quantity = 1, 
  compact = false,
  className 
}: AddToCartButtonProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [justAdded, setJustAdded] = useState(false)
  const { addItem, getCartItem } = useCartStore()
  const existingItem = getCartItem(variant.id)
  
  const handleAddToCart = async () => {
    setIsAdding(true)
    
    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 300))
    
    addItem(product, variant, quantity)
    
    setIsAdding(false)
    setJustAdded(true)
    
    // Reset estado después de 2 segundos
    setTimeout(() => {
      setJustAdded(false)
    }, 2000)
  }
  
  if (compact) {
    return (
      <button
        onClick={handleAddToCart}
        disabled={isAdding}
        className={cn(
          "p-2 rounded-lg transition-all duration-200",
          justAdded 
            ? "bg-green-500 text-white" 
            : "bg-red-500 text-white hover:bg-red-600",
          isAdding && "opacity-50 cursor-wait",
          className
        )}
        aria-label="Agregar al carrito"
      >
        {justAdded ? (
          <CheckIcon className="w-5 h-5" />
        ) : (
          <ShoppingCartIcon className="w-5 h-5" />
        )}
      </button>
    )
  }
  
  return (
    <button
      onClick={handleAddToCart}
      disabled={isAdding || variant.inventory_quantity === 0}
      className={cn(
        "flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 transform active:scale-95",
        justAdded 
          ? "bg-green-500 text-white" 
          : "bg-red-500 text-white hover:bg-red-600",
        (isAdding || variant.inventory_quantity === 0) && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {isAdding ? (
        <>
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          <span>Agregando...</span>
        </>
      ) : justAdded ? (
        <>
          <CheckIcon className="w-5 h-5" />
          <span>¡Agregado!</span>
        </>
      ) : (
        <>
          <ShoppingCartIcon className="w-5 h-5" />
          <span>
            {existingItem 
              ? `Agregar más (${existingItem.quantity} en carrito)`
              : 'Agregar al carrito'
            }
          </span>
        </>
      )}
    </button>
  )
}
