// src/pages/legal/Cookies.jsx
import { Link } from 'react-router-dom';
import { Cookie, ChevronRight, ArrowLeft } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function Cookies() {
  return (
    <>
      <Helmet>
        <title>Política de Cookies | LevántateCuba</title>
        <meta name="description" content="Política de cookies de LevántateCuba. Información sobre las cookies que utilizamos y cómo gestionarlas." />
      </Helmet>

      <main className="min-h-screen bg-transparent">
        {/* Header */}
        <header className="max-w-4xl mx-auto px-4 md:px-6 pt-[calc(var(--nav-h,64px)+12px)] mb-6">
          {/* Botón Volver (móvil) */}
          <div className="flex sm:hidden items-center mb-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Link>
          </div>

          {/* Breadcrumb (desktop) */}
          <nav className="hidden md:flex items-center gap-2 text-sm text-zinc-400 mb-2">
            <Link to="/" className="hover:text-zinc-300 transition-colors">Inicio</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-zinc-300">Política de Cookies</span>
          </nav>

          {/* Título */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-900/70 border border-zinc-800/60">
              <Cookie className="w-5 h-5 text-zinc-300" strokeWidth={1.5} />
            </span>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-100">
              Política de <span className="text-zinc-400">Cookies</span>
            </h1>
          </div>
        </header>

        {/* Contenido */}
        <article className="max-w-4xl mx-auto px-4 md:px-6 pb-12">
          <div className="prose prose-invert prose-zinc max-w-none">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 md:p-8 space-y-8">
              
              {/* Qué son las cookies */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">1. ¿Qué son las cookies?</h2>
                <p className="text-zinc-300 leading-relaxed">
                  Las cookies son pequeños archivos de texto que los sitios web almacenan en tu dispositivo 
                  (ordenador, móvil o tablet) cuando los visitas. Sirven para recordar tus preferencias, 
                  mejorar tu experiencia de navegación y recopilar información sobre el uso del sitio.
                </p>
              </section>

              {/* Tipos de cookies */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">2. Tipos de cookies que utilizamos</h2>
                
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                    <h3 className="font-semibold text-white mb-2">Cookies esenciales</h3>
                    <p className="text-zinc-300 text-sm leading-relaxed">
                      Son necesarias para el funcionamiento básico del sitio. Permiten mantener tu sesión 
                      iniciada, recordar tus preferencias de idioma y garantizar la seguridad de la plataforma. 
                      Sin estas cookies, el sitio no funcionaría correctamente.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                    <h3 className="font-semibold text-white mb-2">Cookies analíticas / de rendimiento</h3>
                    <p className="text-zinc-300 text-sm leading-relaxed">
                      Nos ayudan a entender cómo los visitantes interactúan con el sitio web, recopilando 
                      información de forma anónima. Esta información nos permite mejorar continuamente 
                      la experiencia del usuario.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                    <h3 className="font-semibold text-white mb-2">Cookies publicitarias</h3>
                    <p className="text-zinc-300 text-sm leading-relaxed">
                      Utilizamos <strong>Google AdSense</strong> para mostrar anuncios en nuestro sitio. 
                      Google y sus socios publicitarios pueden utilizar cookies para mostrar anuncios 
                      basados en tus visitas anteriores a este sitio u otros sitios web. Estas cookies 
                      permiten mostrar publicidad relevante para ti.
                    </p>
                  </div>
                </div>
              </section>

              {/* Google AdSense y CMP */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">3. Google AdSense y Plataforma de Consentimiento (CMP)</h2>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  Este sitio web utiliza la <strong>Plataforma de Gestión de Consentimiento (CMP) de Google</strong> 
                  para solicitar tu consentimiento antes de utilizar cookies publicitarias.
                </p>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  Cuando visitas el sitio por primera vez, verás un banner que te permite:
                </p>
                <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-2">
                  <li>Aceptar todas las cookies</li>
                  <li>Rechazar las cookies no esenciales</li>
                  <li>Personalizar tus preferencias de cookies</li>
                </ul>
              </section>

              {/* Gestión de cookies */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">4. Cómo gestionar las cookies</h2>
                <p className="text-zinc-300 leading-relaxed mb-4">
                  Tienes varias opciones para gestionar las cookies:
                </p>
                
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                    <h3 className="font-semibold text-white mb-2">Desde el banner de consentimiento</h3>
                    <p className="text-zinc-300 text-sm leading-relaxed">
                      Puedes cambiar tus preferencias de cookies en cualquier momento haciendo clic en 
                      el enlace "Gestionar cookies" que encontrarás en el pie de página del sitio web.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                    <h3 className="font-semibold text-white mb-2">Desde tu navegador</h3>
                    <p className="text-zinc-300 text-sm leading-relaxed mb-2">
                      La mayoría de navegadores te permiten gestionar las cookies desde su configuración. 
                      Puedes bloquear o eliminar cookies, aunque esto puede afectar al funcionamiento del sitio.
                    </p>
                    <ul className="list-disc list-inside text-zinc-400 text-sm space-y-1 ml-2">
                      <li><strong>Chrome:</strong> Configuración → Privacidad y seguridad → Cookies</li>
                      <li><strong>Firefox:</strong> Opciones → Privacidad y seguridad → Cookies</li>
                      <li><strong>Safari:</strong> Preferencias → Privacidad → Cookies</li>
                      <li><strong>Edge:</strong> Configuración → Privacidad → Cookies</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Más información */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">5. Más información</h2>
                <p className="text-zinc-300 leading-relaxed">
                  Para más información sobre cómo Google utiliza la información de sitios web que usan 
                  sus servicios, visita:{' '}
                  <a 
                    href="https://policies.google.com/technologies/partner-sites" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-red-400 hover:text-red-300"
                  >
                    Política de privacidad de Google
                  </a>
                </p>
              </section>

              {/* Contacto */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">6. Contacto</h2>
                <p className="text-zinc-300 leading-relaxed">
                  Si tienes preguntas sobre nuestra política de cookies, puedes contactarnos en:{' '}
                  <a href="mailto:contacto@levantatecuba.com" className="text-red-400 hover:text-red-300">
                    contacto@levantatecuba.com
                  </a>
                </p>
              </section>

              {/* Última actualización */}
              <div className="pt-6 border-t border-zinc-800">
                <p className="text-zinc-500 text-sm">
                  Última actualización: 2025
                </p>
              </div>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
