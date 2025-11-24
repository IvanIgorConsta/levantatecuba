'use client'

import { useState, useEffect } from 'react'
import { ProductCard } from '@/components/ProductCard'
import { Hero } from '@/components/Hero'
import { useProducts } from '@/hooks/useProducts'
import { ShoppingBagIcon } from '@heroicons/react/24/outline'

export default function HomePage() {
  const { products, loading, error } = useProducts()
  const [filter, setFilter] = useState('all')

  const filteredProducts = products?.filter(product => {
    if (filter === 'all') return true
    return product.type?.value?.toLowerCase() === filter.toLowerCase()
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ShoppingBagIcon className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
          <p className="text-zinc-400">Error al cargar productos</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-transition">
      <Hero />
      
      {/* Sección de Productos */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">
            Nuestros <span className="text-gradient">Productos</span>
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Cada compra apoya directamente la causa de libertad y esperanza para Cuba.
            Productos de calidad que llevan un mensaje poderoso.
          </p>
        </div>

        {/* Filtros */}
        <div className="flex justify-center gap-4 mb-12">
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-2 rounded-full transition-all ${
              filter === 'all'
                ? 'bg-red-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('ropa')}
            className={`px-6 py-2 rounded-full transition-all ${
              filter === 'ropa'
                ? 'bg-red-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Ropa
          </button>
          <button
            onClick={() => setFilter('accesorios')}
            className={`px-6 py-2 rounded-full transition-all ${
              filter === 'accesorios'
                ? 'bg-red-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Accesorios
          </button>
        </div>

        {/* Grid de Productos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts?.length > 0 ? (
            filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <ShoppingBagIcon className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
              <p className="text-zinc-400">No hay productos disponibles</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-red-600 to-red-700 py-16">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold mb-4">
            ¿Necesitas ayuda con tu pedido?
          </h3>
          <p className="mb-8 text-red-100">
            Estamos aquí para asistirte. Contáctanos para cualquier pregunta.
          </p>
          <button className="bg-white text-red-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
            Contactar Soporte
          </button>
        </div>
      </section>
    </div>
  )
}
