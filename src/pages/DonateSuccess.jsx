// ============================================================================
// PÁGINA DE ÉXITO DE DONACIÓN - PRODUCCIÓN - LEVANTATECUBA
// Página de confirmación optimizada para producción
// ============================================================================

import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export default function DonateSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const amount = searchParams.get('amount');

  // Configurar meta tags para SEO
  useEffect(() => {
    document.title = 'Donación Exitosa - LevántateCuba';
    
    // Agregar meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.content = 'Gracias por tu donación. Tu apoyo hace posible nuestra misión de libertad para Cuba.';
    }
    
    // Scroll al top
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white">
      <div className="container max-w-4xl mx-auto px-4 py-20">
        {/* Header con animación */}
        <div className="text-center mb-12 animate-fadeIn">
          {/* Ícono de éxito */}
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-500/20 rounded-full mb-6">
            <svg 
              className="w-12 h-12 text-green-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          </div>

          {/* Título principal */}
          <h1 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
            ¡Gracias por tu apoyo!
          </h1>

          {/* Mensaje de confirmación */}
          <p className="text-xl text-gray-300 mb-2">
            Tu donación {amount && `de $${amount} USD`} ha sido procesada exitosamente.
          </p>
          {sessionId && (
            <p className="text-sm text-gray-500 mb-4">
              ID de transacción: {sessionId.substring(0, 20)}...
            </p>
          )}
        </div>

        {/* Card de contenido */}
        <div className="bg-zinc-900/50 backdrop-blur rounded-2xl p-8 md:p-10 border border-zinc-800 mb-8">
          {/* Mensaje de agradecimiento */}
          <div className="text-center mb-8">
            <p className="text-gray-300 text-lg leading-relaxed">
              Tu contribución hace posible mantener esta plataforma independiente 
              y continuar nuestra misión de dar voz a todos los cubanos que luchan por la libertad.
            </p>
          </div>

          {/* Cita inspiradora */}
          <div className="bg-zinc-800/50 rounded-xl p-6 text-center mb-8">
            <blockquote className="text-red-400 italic text-lg mb-2">
              "La libertad es el derecho que tienen las personas de actuar libremente, 
              pensar y hablar sin hipocresía"
            </blockquote>
            <cite className="text-sm text-gray-500">— José Martí</cite>
          </div>

          {/* Qué sigue */}
          <div className="bg-gradient-to-r from-zinc-800/30 to-zinc-800/10 rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-3">
              💡 Tu donación en acción:
            </h2>
            <ul className="space-y-2 text-gray-400">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Mantenimiento de servidores seguros y anónimos</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Protección de denunciantes y activistas</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Difusión de información sin censura</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Desarrollo de nuevas herramientas de resistencia digital</span>
              </li>
            </ul>
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
              onClick={() => {
                const text = 'Acabo de apoyar a LevántateCuba. Únete a la causa de libertad 🇨🇺';
                const url = 'https://levantatecuba.com';
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
                window.open(twitterUrl, '_blank', 'noopener,noreferrer');
              }}
              className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-full font-semibold transition-all hover:scale-105 text-center"
            >
              Compartir en Twitter
            </button>
          </div>
        </div>

        {/* Footer message */}
        <div className="text-center text-sm text-gray-500">
          <p>Si tienes alguna pregunta sobre tu donación, </p>
          <p>
            contáctanos en{' '}
            <Link to="/contacto" className="text-red-400 hover:text-red-300 underline">
              nuestra página de contacto
            </Link>
          </p>
        </div>
      </div>

      {/* Estilos de animación */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
      `}</style>
    </main>
  );
}