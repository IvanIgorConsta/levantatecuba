// src/pages/legal/Terminos.jsx
import { Link } from 'react-router-dom';
import { FileText, ChevronRight, ArrowLeft } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function Terminos() {
  return (
    <>
      <Helmet>
        <title>Términos y Condiciones | LevántateCuba</title>
        <meta name="description" content="Términos y condiciones de uso de LevántateCuba. Conoce las reglas y responsabilidades al usar nuestra plataforma." />
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
            <span className="text-zinc-300">Términos y Condiciones</span>
          </nav>

          {/* Título */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-900/70 border border-zinc-800/60">
              <FileText className="w-5 h-5 text-zinc-300" strokeWidth={1.5} />
            </span>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-100">
              Términos y <span className="text-zinc-400">Condiciones</span>
            </h1>
          </div>
        </header>

        {/* Contenido */}
        <article className="max-w-4xl mx-auto px-4 md:px-6 pb-12">
          <div className="prose prose-invert prose-zinc max-w-none">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 md:p-8 space-y-8">
              
              {/* Descripción general */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">1. Descripción del servicio</h2>
                <p className="text-zinc-300 leading-relaxed">
                  <strong>LevántateCuba</strong> es una plataforma informativa y de participación ciudadana 
                  que permite a los usuarios acceder a noticias, compartir denuncias y participar en la 
                  difusión de información sobre la realidad cubana. Nuestro objetivo es proporcionar un 
                  espacio seguro y libre para la expresión ciudadana.
                </p>
              </section>

              {/* Aceptación */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">2. Aceptación de los términos</h2>
                <p className="text-zinc-300 leading-relaxed">
                  Al acceder y utilizar LevántateCuba, aceptas cumplir con estos términos y condiciones. 
                  Si no estás de acuerdo con alguna parte de estos términos, te rogamos que no utilices 
                  la plataforma. El uso continuado del sitio constituye la aceptación de cualquier 
                  modificación a estos términos.
                </p>
              </section>

              {/* Uso permitido */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">3. Uso permitido</h2>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  Al utilizar LevántateCuba, te comprometes a:
                </p>
                <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-2">
                  <li>No publicar contenido ilegal, difamatorio o que viole derechos de terceros.</li>
                  <li>No incitar al odio, la violencia, el acoso o la discriminación.</li>
                  <li>Respetar a otros usuarios y sus opiniones, incluso cuando no las compartas.</li>
                  <li>No utilizar el sitio para actividades fraudulentas o malintencionadas.</li>
                  <li>No intentar acceder a áreas restringidas o comprometer la seguridad del sitio.</li>
                  <li>No publicar spam, publicidad no autorizada o contenido repetitivo.</li>
                </ul>
              </section>

              {/* Cuenta de usuario */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">4. Cuenta de usuario</h2>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  Si creas una cuenta en LevántateCuba:
                </p>
                <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-2">
                  <li>Eres responsable de mantener la confidencialidad de tus credenciales de acceso.</li>
                  <li>Debes proporcionar información veraz y mantenerla actualizada.</li>
                  <li>No debes compartir tu cuenta con otras personas.</li>
                  <li>Eres responsable de todas las actividades que ocurran bajo tu cuenta.</li>
                  <li>Debes notificarnos inmediatamente si sospechas de un uso no autorizado de tu cuenta.</li>
                </ul>
              </section>

              {/* Contenido y propiedad intelectual */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">5. Contenido y propiedad intelectual</h2>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  <strong>Contenido del sitio:</strong> El diseño, logotipos, textos, gráficos y otros 
                  materiales originales de LevántateCuba están protegidos por derechos de propiedad 
                  intelectual y pertenecen a LevántateCuba o sus licenciantes.
                </p>
                <p className="text-zinc-300 leading-relaxed">
                  <strong>Contenido del usuario:</strong> Conservas los derechos sobre el contenido que 
                  publicas en la plataforma. Sin embargo, al publicar contenido, otorgas a LevántateCuba 
                  una licencia no exclusiva, gratuita y mundial para mostrar, distribuir y promocionar 
                  dicho contenido en relación con los servicios de la plataforma.
                </p>
              </section>

              {/* Limitación de responsabilidad */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">6. Limitación de responsabilidad</h2>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  LevántateCuba se proporciona "tal cual" y "según disponibilidad". No garantizamos que:
                </p>
                <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-2 mb-3">
                  <li>El servicio estará disponible de forma ininterrumpida o libre de errores.</li>
                  <li>La información publicada por usuarios sea precisa, completa o actualizada.</li>
                  <li>El contenido generado por usuarios refleje las opiniones de LevántateCuba.</li>
                </ul>
                <p className="text-zinc-300 leading-relaxed">
                  <strong>Las denuncias y opiniones publicadas son responsabilidad exclusiva de quienes 
                  las publican.</strong> LevántateCuba no se hace responsable del uso que terceros 
                  puedan hacer de la información publicada en la plataforma.
                </p>
              </section>

              {/* Modificaciones */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">7. Modificaciones</h2>
                <p className="text-zinc-300 leading-relaxed">
                  Nos reservamos el derecho de modificar estos términos y condiciones en cualquier momento. 
                  Los cambios entrarán en vigor en el momento de su publicación. Te recomendamos revisar 
                  esta página periódicamente. La fecha de última actualización se indicará al final del 
                  documento.
                </p>
              </section>

              {/* Terminación */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">8. Terminación</h2>
                <p className="text-zinc-300 leading-relaxed">
                  Nos reservamos el derecho de suspender o cancelar tu acceso a la plataforma, sin previo 
                  aviso, si consideramos que has violado estos términos o que tu comportamiento puede 
                  perjudicar a otros usuarios o a la plataforma.
                </p>
              </section>

              {/* Contacto */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">9. Contacto</h2>
                <p className="text-zinc-300 leading-relaxed">
                  Si tienes preguntas sobre estos términos y condiciones, puedes contactarnos en:{' '}
                  <a href="mailto:soporte@levantatecuba.com" className="text-red-400 hover:text-red-300">
                    soporte@levantatecuba.com
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
