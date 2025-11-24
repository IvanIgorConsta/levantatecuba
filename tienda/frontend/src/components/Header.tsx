'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ShoppingCartIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { useCartStore } from '@/store/cart'
import { CartSheet } from './CartSheet'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const { items, getItemCount } = useCartStore()
  const itemCount = getItemCount()

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [])

  return (
    <>
      <header className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800">
        <nav className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                <span className="text-white">Levántate</span>
                <span className="text-red-500">Cuba</span>
              </div>
              <span className="text-xs text-zinc-400 hidden sm:block">STORE</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="/"
                className="text-zinc-300 hover:text-white transition-colors"
              >
                Productos
              </Link>
              <Link
                href="/collections"
                className="text-zinc-300 hover:text-white transition-colors"
              >
                Colecciones
              </Link>
              <Link
                href="/about"
                className="text-zinc-300 hover:text-white transition-colors"
              >
                Nosotros
              </Link>
              <a
                href={process.env.NEXT_PUBLIC_MAIN_SITE_URL || 'http://localhost:5173'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-300 hover:text-white transition-colors"
              >
                Sitio Principal ↗
              </a>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
              {/* Cart Button */}
              <button
                onClick={() => setCartOpen(true)}
                className="relative p-2 text-zinc-300 hover:text-white transition-colors"
                aria-label="Abrir carrito"
              >
                <ShoppingCartIcon className="w-6 h-6" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                    {itemCount}
                  </span>
                )}
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-zinc-300 hover:text-white transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <XMarkIcon className="w-6 h-6" />
                ) : (
                  <Bars3Icon className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-zinc-800 animate-slide-up">
              <div className="flex flex-col gap-4">
                <Link
                  href="/"
                  className="text-zinc-300 hover:text-white transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Productos
                </Link>
                <Link
                  href="/collections"
                  className="text-zinc-300 hover:text-white transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Colecciones
                </Link>
                <Link
                  href="/about"
                  className="text-zinc-300 hover:text-white transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Nosotros
                </Link>
                <a
                  href={process.env.NEXT_PUBLIC_MAIN_SITE_URL || 'http://localhost:5173'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-300 hover:text-white transition-colors py-2"
                >
                  Sitio Principal ↗
                </a>
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Cart Sheet */}
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  )
}
