'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Product, ProductVariant } from '@/types'
import { getProductByHandle } from '@/lib/medusa'
import { formatPrice } from '@/utils/format'
import { AddToCartButton } from '@/components/AddToCartButton'
import { ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline'

export default function ProductPage() {
  const params = useParams()
  const router = useRouter()
  const handle = params.handle as string
  
  const [product, setProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true)
      const data = await getProductByHandle(handle)
      if (data) {
        setProduct(data)
        // Seleccionar primer variante por defecto
        if (data.variants?.length > 0) {
          setSelectedVariant(data.variants[0])
          // Establecer opciones iniciales
          const initialOptions: Record<string, string> = {}
          data.variants[0].options?.forEach(opt => {
            const option = data.options?.find(o => o.id === opt.option_id)
            if (option) {
              initialOptions[option.title] = opt.value
            }
          })
          setSelectedOptions(initialOptions)
        }
      }
      setLoading(false)
    }
    
    fetchProduct()
  }, [handle])

  const handleOptionChange = (optionTitle: string, value: string) => {
    const newOptions = { ...selectedOptions, [optionTitle]: value }
    setSelectedOptions(newOptions)
    
    // Buscar variante que coincida con las opciones seleccionadas
    const matchingVariant = product?.variants.find(variant => {
      return variant.options.every(opt => {
        const option = product.options?.find(o => o.id === opt.option_id)
        return option && newOptions[option.title] === opt.value
      })
    })
    
    if (matchingVariant) {
      setSelectedVariant(matchingVariant)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-white mb-4">Producto no encontrado</h1>
        <Link href="/" className="btn-primary">
          Volver a la tienda
        </Link>
      </div>
    )
  }

  const images = product.images?.length > 0 
    ? product.images 
    : product.thumbnail 
      ? [{ url: product.thumbnail, alt: product.title }]
      : []

  return (
    <div className="container mx-auto px-4 py-8 page-transition">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Volver a productos
        </Link>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Images Gallery */}
        <div>
          <div className="relative aspect-square bg-zinc-800 rounded-xl overflow-hidden mb-4">
            {images.length > 0 ? (
              <Image
                src={images[selectedImageIndex]?.url || ''}
                alt={images[selectedImageIndex]?.alt || product.title}
                width={600}
                height={600}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {images.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`relative aspect-square bg-zinc-800 rounded-lg overflow-hidden border-2 transition-all ${
                    selectedImageIndex === index 
                      ? 'border-red-500' 
                      : 'border-transparent hover:border-zinc-600'
                  }`}
                >
                  <Image
                    src={img.url}
                    alt={img.alt || `${product.title} ${index + 1}`}
                    width={150}
                    height={150}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          <h1 className="text-4xl font-bold text-white mb-4">
            {product.title}
          </h1>

          {selectedVariant && selectedVariant.prices?.[0] && (
            <div className="text-3xl font-bold text-white mb-6">
              {formatPrice(selectedVariant.prices[0].amount, selectedVariant.prices[0].currency_code)}
            </div>
          )}

          {product.description && (
            <p className="text-zinc-300 mb-8 leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Options */}
          {product.options && product.options.length > 0 && (
            <div className="space-y-6 mb-8">
              {product.options.map(option => (
                <div key={option.id}>
                  <label className="block text-white font-medium mb-3">
                    {option.title}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {option.values.map(value => (
                      <button
                        key={value.id || value.value}
                        onClick={() => handleOptionChange(option.title, value.value)}
                        className={`px-4 py-2 rounded-lg border transition-all ${
                          selectedOptions[option.title] === value.value
                            ? 'border-red-500 bg-red-500/20 text-white'
                            : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600'
                        }`}
                      >
                        {value.value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quantity Selector */}
          <div className="mb-8">
            <label className="block text-white font-medium mb-3">
              Cantidad
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-12 h-12 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
              >
                -
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 h-12 text-center bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                min="1"
              />
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-12 h-12 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Stock Info */}
          {selectedVariant && selectedVariant.inventory_quantity !== undefined && (
            <div className="mb-8">
              {selectedVariant.inventory_quantity > 0 ? (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckIcon className="w-5 h-5" />
                  <span>En stock ({selectedVariant.inventory_quantity} disponibles)</span>
                </div>
              ) : (
                <div className="text-red-400">
                  Sin stock disponible
                </div>
              )}
            </div>
          )}

          {/* Add to Cart */}
          {selectedVariant && (
            <AddToCartButton
              product={product}
              variant={selectedVariant}
              quantity={quantity}
              className="w-full"
            />
          )}

          {/* Product Features */}
          <div className="mt-12 space-y-4">
            <div className="flex items-start gap-3">
              <CheckIcon className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <h3 className="text-white font-medium">Envío rápido</h3>
                <p className="text-zinc-400 text-sm">
                  Procesamos tu pedido en 24-48 horas
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckIcon className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <h3 className="text-white font-medium">Calidad garantizada</h3>
                <p className="text-zinc-400 text-sm">
                  Productos de alta calidad con garantía
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckIcon className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <h3 className="text-white font-medium">Apoyas la causa</h3>
                <p className="text-zinc-400 text-sm">
                  100% de las ganancias apoyan la libertad de Cuba
                </p>
              </div>
            </div>
          </div>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="text-sm px-3 py-1 bg-zinc-800 text-zinc-400 rounded-full"
                >
                  #{tag.value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
