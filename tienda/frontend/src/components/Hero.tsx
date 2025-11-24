'use client'

import { ArrowRightIcon } from '@heroicons/react/24/outline'

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
      
      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-full mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-red-400 text-sm font-medium">Tienda Oficial</span>
          </div>
          
          {/* Título Principal */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6">
            Apoya la <span className="text-gradient">Libertad</span>
            <br />
            de Cuba
          </h1>
          
          {/* Descripción */}
          <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
            Cada compra contribuye directamente a la causa de libertad y esperanza.
            Productos de calidad que llevan un mensaje poderoso.
          </p>
          
          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#productos"
              className="btn-primary inline-flex items-center justify-center gap-2"
            >
              Ver Productos
              <ArrowRightIcon className="w-4 h-4" />
            </a>
            <button className="btn-secondary">
              Nuestra Misión
            </button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 max-w-2xl mx-auto">
            <div>
              <div className="text-3xl font-bold text-white">100%</div>
              <div className="text-sm text-zinc-400 mt-1">Apoyo a la causa</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">24/7</div>
              <div className="text-sm text-zinc-400 mt-1">Envíos disponibles</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">🇨🇺</div>
              <div className="text-sm text-zinc-400 mt-1">Por Cuba Libre</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-red-500/20 rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-red-500/20 rounded-full filter blur-3xl opacity-20 animate-pulse delay-700"></div>
    </section>
  )
}
