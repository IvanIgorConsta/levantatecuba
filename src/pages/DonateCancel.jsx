// ============================================================================
// PÁGINA DE CANCELACIÓN DE DONACIÓN - PRODUCCIÓN - LEVANTATECUBA
// Página neutral cuando el usuario cancela el proceso
// ============================================================================

import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function DonateCancel() {
  // Configurar meta tags para SEO
  useEffect(() => {
    document.title = 'Proceso Cancelado - LevántateCuba';
    
    // Agregar meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.content = 'Has cancelado el proceso de donación. Continúa explorando LevántateCuba.';
    }
    
    // Scroll al top
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white">
      <div className="container max-w-4xl mx-auto px-4 py-20">
        {/* Header */}
        <div className="text-center mb-12">
          {/* Ícono informativo */}
          <div className="inline-flex items-center justify-center w-24 h-24 bg-yellow-500/20 rounded-full mb-6">
            <svg 
              className="w-12 h-12 text-yellow-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>

          {/* Título */}
          <h1 className="text-3xl md:text-5xl font-bold mb-4 text-white">
            Proceso cancelado
          </h1>

          {/* Mensaje neutro */}
          <p className="text-xl text-gray-300">
            No se ha realizado ningún cargo a tu tarjeta.
          </p>
        </div>

        {/* Card de contenido */}
        <div className="bg-zinc-900/50 backdrop-blur rounded-2xl p-8 md:p-10 border border-zinc-800 mb-8">
          {/* Mensaje principal */}
          <div className="text-center mb-8">
            <p className="text-gray-300 text-lg mb-6">
              Has cancelado el proceso de donación. Si cambiaste de opinión o tuviste algún problema, 
              puedes intentarlo nuevamente cuando lo desees.
            </p>
            
            <p className="text-gray-400">
              Tu apoyo es importante para mantener esta plataforma independiente, 
              pero entendemos que cada situación es diferente.
            </p>
          </div>

          {/* Por qué donar */}
          <div className="bg-zinc-800/30 rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              🤔 ¿Por qué apoyar LevántateCuba?
            </h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start">
                <span className="text-red-400 mr-2 mt-1">•</span>
                <div>
                  <p className="text-gray-300 font-medium">100% Independiente</p>
                  <p className="text-gray-500">Sin compromisos políticos ni censura</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-red-400 mr-2 mt-1">•</span>
                <div>
                  <p className="text-gray-300 font-medium">Seguridad garantizada</p>
                  <p className="text-gray-500">Protegemos la identidad de denunciantes</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-red-400 mr-2 mt-1">•</span>
                <div>
                  <p className="text-gray-300 font-medium">Transparencia total</p>
                  <p className="text-gray-500">Cada centavo va a la causa</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-red-400 mr-2 mt-1">•</span>
                <div>
                  <p className="text-gray-300 font-medium">Pago seguro</p>
                  <p className="text-gray-500">Procesado por Stripe (certificado PCI)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full font-semibold transition-all hover:scale-105 text-center"
            >
              ← Volver al inicio
            </Link>
            
            <button
              onClick={() => window.history.back()}
              className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-full font-semibold transition-all hover:scale-105 text-center"
            >
              Intentar de nuevo
            </button>
          </div>

          {/* Otras formas de ayudar */}
          <div className="mt-8 pt-8 border-t border-zinc-800">
            <p className="text-center text-gray-400 mb-4">
              También puedes ayudar de otras formas:
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                to="/denuncias/nueva"
                className="px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 text-gray-300 rounded-lg text-sm transition-all"
              >
                📢 Hacer una denuncia
              </Link>
              <Link
                to="/noticias"
                className="px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 text-gray-300 rounded-lg text-sm transition-all"
              >
                📰 Ver noticias
              </Link>
              <button
                onClick={() => {
                  navigator.share?.({
                    title: 'LevántateCuba',
                    text: 'Plataforma de resistencia digital cubana',
                    url: 'https://levantatecuba.com'
                  }).catch(() => {
                    // Si share API no está disponible, copiar al clipboard
                    navigator.clipboard.writeText('https://levantatecuba.com');
                    alert('Enlace copiado al portapapeles');
                  });
                }}
                className="px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 text-gray-300 rounded-lg text-sm transition-all"
              >
                🔗 Compartir el sitio
              </button>
            </div>
          </div>
        </div>

        {/* Footer message */}
        <div className="text-center text-sm text-gray-500">
          <p>¿Problemas con el proceso de donación?</p>
          <p>
            <a href="mailto:contacto@levantatecuba.com" className="text-red-400 hover:text-red-300 underline">
              contacto@levantatecuba.com
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}