// src/pages/legal/ContenidoUsuarios.jsx
import { Link } from 'react-router-dom';
import { Users, ChevronRight, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function ContenidoUsuarios() {
  return (
    <>
      <Helmet>
        <title>Política de Contenido de Usuarios | LevántateCuba</title>
        <meta name="description" content="Política sobre denuncias y contenido generado por usuarios en LevántateCuba. Normas, moderación y responsabilidades." />
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
            <span className="text-zinc-300">Contenido de Usuarios</span>
          </nav>

          {/* Título */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-900/70 border border-zinc-800/60">
              <Users className="w-5 h-5 text-zinc-300" strokeWidth={1.5} />
            </span>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-100">
              Contenido de <span className="text-zinc-400">Usuarios</span>
            </h1>
          </div>
          <p className="mt-2 text-zinc-400 text-sm">
            Política sobre denuncias y contenido generado por la comunidad
          </p>
        </header>

        {/* Contenido */}
        <article className="max-w-4xl mx-auto px-4 md:px-6 pb-12">
          <div className="prose prose-invert prose-zinc max-w-none">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 md:p-8 space-y-8">
              
              {/* Qué son las denuncias */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">1. ¿Qué son las denuncias ciudadanas?</h2>
                <p className="text-zinc-300 leading-relaxed">
                  LevántateCuba permite a los usuarios enviar <strong>denuncias ciudadanas</strong>: 
                  testimonios, reportes e información sobre situaciones relevantes relacionadas con 
                  Cuba. Estas denuncias pueden incluir texto, imágenes y vídeos que documenten hechos 
                  de interés público.
                </p>
                <p className="text-zinc-300 leading-relaxed mt-3">
                  El objetivo es dar voz a quienes desean compartir su experiencia y contribuir a la 
                  transparencia informativa.
                </p>
              </section>

              {/* Reglas básicas */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">2. Reglas para el contenido</h2>
                
                {/* Alerta importante */}
                <div className="flex gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-200 font-medium text-sm">Importante</p>
                    <p className="text-red-200/80 text-sm">
                      El incumplimiento de estas normas puede resultar en la eliminación del contenido 
                      y/o la suspensión de la cuenta.
                    </p>
                  </div>
                </div>

                <p className="text-zinc-300 leading-relaxed mb-3">
                  <strong>Está permitido:</strong>
                </p>
                <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-2 mb-4">
                  <li>Compartir testimonios verídicos y documentados.</li>
                  <li>Publicar imágenes y vídeos que ilustren situaciones de interés público.</li>
                  <li>Denunciar abusos, injusticias y situaciones irregulares.</li>
                  <li>Aportar contexto informativo a las publicaciones.</li>
                </ul>

                <p className="text-zinc-300 leading-relaxed mb-3">
                  <strong>Está prohibido:</strong>
                </p>
                <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-2">
                  <li>Publicar datos extremadamente sensibles de terceros (direcciones privadas, 
                      números de teléfono personales, documentos de identidad) sin justificación 
                      informativa clara.</li>
                  <li>Incitar al odio, la violencia o la discriminación contra personas o grupos.</li>
                  <li>Publicar amenazas, difamación explícita o contenido de acoso (<em>doxxing</em>).</li>
                  <li>Compartir contenido gráfico extremadamente violento sin contexto informativo 
                      que lo justifique.</li>
                  <li>Publicar contenido sexual explícito o que involucre a menores.</li>
                  <li>Difundir información falsa de forma deliberada.</li>
                  <li>Suplantar la identidad de otras personas u organizaciones.</li>
                </ul>
              </section>

              {/* Moderación */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">3. Moderación del contenido</h2>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  El equipo de LevántateCuba se reserva el derecho de:
                </p>
                <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-2">
                  <li><strong>Revisar</strong> todas las denuncias antes de su publicación.</li>
                  <li><strong>Editar</strong> contenido para proteger datos sensibles o mejorar la claridad.</li>
                  <li><strong>Rechazar</strong> denuncias que no cumplan con las normas de la plataforma.</li>
                  <li><strong>Eliminar</strong> contenido publicado que posteriormente se determine inadecuado.</li>
                  <li><strong>Suspender</strong> cuentas de usuarios que infrinjan repetidamente las normas.</li>
                </ul>
                <p className="text-zinc-300 leading-relaxed mt-3">
                  <strong>No garantizamos la publicación de todo el contenido enviado.</strong> La 
                  decisión final sobre qué se publica corresponde al equipo de moderación.
                </p>
              </section>

              {/* Anonimato */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">4. Denuncias anónimas</h2>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  LevántateCuba permite enviar denuncias de forma anónima para proteger la identidad 
                  de quienes comparten información sensible.
                </p>
                <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                  <p className="text-zinc-300 text-sm leading-relaxed">
                    <strong>Aviso importante:</strong> El anonimato no exime de responsabilidad legal 
                    si se publica contenido ilegal, difamatorio o que viole derechos de terceros. 
                    Aunque la denuncia sea anónima, LevántateCuba puede estar obligada a cooperar 
                    con autoridades competentes en caso de requerimiento legal.
                  </p>
                </div>
              </section>

              {/* Conservación */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">5. Conservación del contenido</h2>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  Las denuncias y contenidos publicados pueden permanecer en la plataforma de forma 
                  indefinida como parte del archivo histórico e informativo de LevántateCuba.
                </p>
                <p className="text-zinc-300 leading-relaxed">
                  En determinadas circunstancias, el contenido puede ser eliminado:
                </p>
                <ul className="list-disc list-inside text-zinc-300 space-y-2 ml-2 mt-2">
                  <li>Por solicitud del usuario que lo publicó (sujeto a evaluación).</li>
                  <li>Por obligación legal o requerimiento de autoridades competentes.</li>
                  <li>Por decisión del equipo de moderación si el contenido ya no es relevante o 
                      incumple las normas actualizadas.</li>
                </ul>
              </section>

              {/* Responsabilidad */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">6. Responsabilidad del contenido</h2>
                <p className="text-zinc-300 leading-relaxed">
                  <strong>El contenido publicado por usuarios es responsabilidad exclusiva de quien 
                  lo publica.</strong> LevántateCuba actúa como plataforma de difusión y no se hace 
                  responsable de la veracidad, exactitud o legalidad de las denuncias y testimonios 
                  compartidos por la comunidad.
                </p>
              </section>

              {/* Contacto */}
              <section>
                <h2 className="text-xl font-semibold text-white mb-3">7. Contacto y reclamaciones</h2>
                <p className="text-zinc-300 leading-relaxed">
                  Si consideras que algún contenido publicado en LevántateCuba viola tus derechos 
                  o estas normas, puedes contactarnos en:{' '}
                  <a href="mailto:contacto@levantatecuba.com" className="text-red-400 hover:text-red-300">
                    contacto@levantatecuba.com
                  </a>
                </p>
                <p className="text-zinc-300 leading-relaxed mt-2">
                  Revisaremos tu solicitud y responderemos en el menor tiempo posible.
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
