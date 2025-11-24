'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Product } from '@/types'
import { formatPrice } from '@/utils/format'
import { AddToCartButton } from './AddToCartButton'

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const defaultVariant = product.variants?.[0]
  const price = defaultVariant?.prices?.[0]
  
  return (
    <div className="product-card group">
      <Link href={`/product/${product.handle}`}>
        <div className="relative aspect-square overflow-hidden bg-zinc-800">
          {product.thumbnail ? (
            <Image
              src={product.thumbnail}
              alt={product.title}
              width={300}
              height={300}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          
          {/* Stock Badge */}
          {defaultVariant && defaultVariant.inventory_quantity !== undefined && (
            <div className="absolute top-2 right-2">
              {defaultVariant.inventory_quantity > 0 ? (
                defaultVariant.inventory_quantity < 10 && (
                  <span className="badge badge-red">
                    ¡Últimas {defaultVariant.inventory_quantity}!
                  </span>
                )
              ) : (
                <span className="badge badge-red">
                  Agotado
                </span>
              )}
            </div>
          )}
        </div>
      </Link>

      <div className="p-4">
        <Link href={`/product/${product.handle}`}>
          <h3 className="text-lg font-semibold text-white hover:text-red-400 transition-colors line-clamp-1">
            {product.title}
          </h3>
        </Link>
        
        {product.description && (
          <p className="text-zinc-400 text-sm mt-1 line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-4">
          {price ? (
            <span className="text-2xl font-bold text-white">
              {formatPrice(price.amount, price.currency_code)}
            </span>
          ) : (
            <span className="text-zinc-500">Sin precio</span>
          )}
          
          {defaultVariant && defaultVariant.inventory_quantity !== undefined && defaultVariant.inventory_quantity > 0 ? (
            <AddToCartButton
              product={product}
              variant={defaultVariant}
              compact
            />
          ) : (
            <button
              disabled
              className="px-4 py-2 bg-zinc-800 text-zinc-500 rounded-lg cursor-not-allowed"
            >
              Agotado
            </button>
          )}
        </div>

        {/* Tags */}
        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {product.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="text-xs px-2 py-1 bg-zinc-800 text-zinc-400 rounded-full"
              >
                #{tag.value}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
