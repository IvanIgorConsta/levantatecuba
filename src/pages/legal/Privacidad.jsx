// src/pages/legal/Privacidad.jsx
import { Link } from 'react-router-dom';
import { Shield, ChevronRight, ArrowLeft } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function Privacidad() {
  return (
    <>
      <Helmet>
        <title>Política de Privacidad | LevántateCuba</title>
        <meta name="description" content="Política de privacidad de LevántateCuba. Información sobre cómo recopilamos, usamos y protegemos tus datos personales." />
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
            <span className="text-zinc-300">Política de Privacidad</span>
          </nav>

          {/* Título */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-900/70 border border-zinc-800/60">
              <Shield className="w-5 h-5 text-zinc-300" strokeWidth={1.5} />
            </span>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-100">
              Política de <span className="text-zinc-400">Privacidad</span>
            </h1>
          </div>
        </header>

        {/* Contenido */}
        <article className="max-w-4xl mx-auto px-4 md:px-6 pb-12">
          <div className="prose prose-invert prose-zinc max-w-none">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 md:p-8 space-y-8">
              
              {/* Quiénes somos */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">1. Quiénes somos</h2>
                <p className="text-zinc-300 leading-relaxed">
                  <strong>LevántateCuba</strong> es una plataforma informativa y de participación ciudadana 
                  dedicada a visibilizar la realidad de Cuba. Nuestro objetivo es proporcionar un espacio 
                  seguro para compartir información, denuncias y noticias relevantes.
                </p>
              </section>

              {/* Datos que recopilamos */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">2. Datos que recopilamos</h2>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  Recopilamos diferentes tipos de información según tu interacción con la plataforma:
                </p>
                <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-2">
                  <li><strong>Datos de cuenta:</strong> correo electrónico, nombre de usuario y contraseña (almacenada de forma encriptada).</li>
                  <li><strong>Datos de uso:</strong> páginas visitadas, tiempo de navegación e interacciones con el contenido.</li>
                  <li><strong>Contenido generado:</strong> denuncias, comentarios, noticias propuestas y cualquier material que decidas compartir.</li>
                  <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador y dispositivo utilizado.</li>
                </ul>
              </section>

              {/* Finalidad */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">3. Finalidad del tratamiento</h2>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  Utilizamos tus datos para los siguientes propósitos:
                </p>
                <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-2">
                  <li><strong>Funcionamiento del sitio:</strong> gestionar tu cuenta, procesar tus envíos y mantener la plataforma operativa.</li>
                  <li><strong>Moderación de contenido:</strong> revisar denuncias y publicaciones para garantizar el cumplimiento de nuestras normas.</li>
                  <li><strong>Analítica básica:</strong> comprender cómo se utiliza la plataforma para mejorar la experiencia del usuario.</li>
                  <li><strong>Seguridad:</strong> prevenir fraudes, abusos y actividades maliciosas.</li>
                  <li><strong>Comunicaciones:</strong> enviarte información relevante sobre tu cuenta o cambios importantes en el servicio.</li>
                </ul>
              </section>

              {/* Google AdSense y cookies publicitarias */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">4. Publicidad y Google AdSense</h2>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  Este sitio web utiliza <strong>Google AdSense</strong> para mostrar anuncios. Google y otros 
                  proveedores de publicidad pueden utilizar cookies para mostrar anuncios basados en visitas 
                  anteriores a este sitio web u otros sitios en Internet.
                </p>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  Las cookies publicitarias permiten a Google y sus socios mostrar anuncios personalizados 
                  o no personalizados según tus preferencias de consentimiento.
                </p>
                <p className="text-zinc-300 leading-relaxed">
                  Puedes gestionar tus preferencias de publicidad visitando la 
                  <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 ml-1">
                    Configuración de Anuncios de Google
                  </a>.
                </p>
              </section>

              {/* Bases legales */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">5. Bases legales</h2>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  El tratamiento de tus datos se fundamenta en:
                </p>
                <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-2">
                  <li><strong>Tu consentimiento:</strong> cuando creas una cuenta, envías contenido o aceptas cookies.</li>
                  <li><strong>Interés legítimo:</strong> para garantizar la seguridad de la plataforma y prevenir abusos.</li>
                  <li><strong>Ejecución del servicio:</strong> para proporcionarte las funcionalidades de la plataforma.</li>
                </ul>
              </section>

              {/* Derechos del usuario */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">6. Tus derechos</h2>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  Como usuario, tienes los siguientes derechos sobre tus datos personales:
                </p>
                <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-2">
                  <li><strong>Acceso:</strong> puedes solicitar información sobre los datos que tenemos sobre ti.</li>
                  <li><strong>Rectificación:</strong> puedes corregir datos inexactos o incompletos.</li>
                  <li><strong>Eliminación:</strong> puedes solicitar la eliminación de tus datos en determinadas circunstancias.</li>
                  <li><strong>Limitación:</strong> puedes solicitar que limitemos el uso de tus datos.</li>
                  <li><strong>Oposición:</strong> puedes oponerte al tratamiento de tus datos para ciertos fines.</li>
                  <li><strong>Portabilidad:</strong> puedes solicitar tus datos en un formato estructurado y de uso común.</li>
                </ul>
              </section>

              {/* Contacto */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">7. Contacto</h2>
                <p className="text-zinc-300 leading-relaxed">
                  Si tienes preguntas sobre esta política de privacidad o deseas ejercer alguno de tus derechos, 
                  puedes contactarnos en: <a href="mailto:soporte@levantatecuba.com" className="text-red-400 hover:text-red-300">soporte@levantatecuba.com</a>
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
