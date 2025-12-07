import { Helmet } from "react-helmet-async";
import { Users, Target, Shield, Eye, Mail, MessageCircle, Heart, Scale, Globe, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { startDonation } from "../hooks/useDonate";

export default function About() {
  // Redes sociales activas (agregar más cuando estén disponibles)
  const socialLinks = [
    { name: "Facebook", url: "https://www.facebook.com/profile.php?id=61580079061652", icon: "facebook" }
    // { name: "Telegram", url: "https://t.me/levantatecuba", icon: "telegram" },
    // { name: "Twitter", url: "https://twitter.com/levantatecuba", icon: "twitter" },
  ];

  const schemaOrg = {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    "name": "LevántateCuba",
    "alternateName": "Levántate Cuba",
    "url": "https://levantatecuba.com",
    "logo": "https://levantatecuba.com/img/logo-organization.png",
    "foundingDate": "2025",
    "description": "Medio de información independiente sobre Cuba. Noticias verificadas, denuncias ciudadanas y cobertura sin censura de la actualidad cubana.",
    "sameAs": socialLinks.map(s => s.url),
    "contactPoint": {
      "@type": "ContactPoint",
      "email": "soporte@levantatecuba.com",
      "contactType": "customer service",
      "availableLanguage": "Spanish"
    },
    "publishingPrinciples": "https://levantatecuba.com/about#metodologia",
    "correctionsPolicy": "https://levantatecuba.com/about#correcciones",
    "ethicsPolicy": "https://levantatecuba.com/about#valores"
  };

  return (
    <>
      <Helmet>
        <title>Sobre Nosotros — LevántateCuba | Periodismo Independiente</title>
        <meta name="description" content="Conoce a LevántateCuba: medio de información independiente sobre Cuba fundado en 2025. Noticias verificadas, denuncias ciudadanas y periodismo sin censura." />
        <link rel="canonical" href="https://levantatecuba.com/about" />
        <meta name="robots" content="index,follow" />
        
        {/* Open Graph */}
        <meta property="og:title" content="Sobre Nosotros — LevántateCuba" />
        <meta property="og:description" content="Medio de información independiente sobre Cuba. Noticias verificadas, denuncias ciudadanas y periodismo sin censura." />
        <meta property="og:url" content="https://levantatecuba.com/about" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://levantatecuba.com/img/og-about.jpg" />
        
        {/* Schema.org */}
        <script type="application/ld+json">
          {JSON.stringify(schemaOrg)}
        </script>
      </Helmet>

      <main className="min-h-screen bg-zinc-950 text-white">
        {/* Hero Section */}
        <section className="relative py-16 md:py-24 bg-gradient-to-b from-red-950/30 to-zinc-950">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Sobre <span className="text-red-500">LevántateCuba</span>
            </h1>
            <p className="text-xl md:text-2xl text-zinc-300 max-w-3xl mx-auto leading-relaxed">
              Medio de información independiente dedicado a visibilizar la realidad de Cuba 
              con periodismo verificado, participación ciudadana y tecnología de vanguardia.
            </p>
            <p className="mt-6 text-zinc-400">
              Fundado en <strong className="text-white">2025</strong>
            </p>
          </div>
        </section>

        {/* Misión y Visión */}
        <section className="py-16 border-t border-zinc-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Target className="text-red-500" size={28} />
                  <h2 className="text-2xl font-bold">Nuestra Misión</h2>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  Proporcionar información veraz, independiente y sin censura sobre Cuba y temas 
                  de interés para la comunidad cubana. Amplificar las voces del pueblo, documentar 
                  la realidad y defender la libertad de expresión a través del periodismo ciudadano.
                </p>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Eye className="text-red-500" size={28} />
                  <h2 className="text-2xl font-bold">Nuestra Visión</h2>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  Ser el medio de referencia para cubanos en todo el mundo que buscan información 
                  confiable y sin filtros. Construir una comunidad activa que participe en la 
                  documentación de la realidad cubana y promueva el cambio social.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Valores */}
        <section id="valores" className="py-16 bg-zinc-900/30 border-t border-zinc-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl font-bold text-center mb-12">Nuestros Valores</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Shield, title: "Independencia", desc: "Sin afiliación política ni gubernamental. Nuestro único compromiso es con la verdad." },
                { icon: Scale, title: "Veracidad", desc: "Verificamos cada información antes de publicar. La credibilidad es nuestro activo más valioso." },
                { icon: Users, title: "Participación", desc: "Creemos en el periodismo ciudadano. Cada cubano puede ser parte de esta historia." },
                { icon: Globe, title: "Transparencia", desc: "Operamos con total apertura sobre nuestros métodos, fuentes y proceso editorial." }
              ].map((valor, i) => (
                <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 text-center hover:border-red-500/30 transition-colors">
                  <valor.icon className="mx-auto text-red-500 mb-3" size={32} />
                  <h3 className="font-bold text-lg mb-2">{valor.title}</h3>
                  <p className="text-sm text-zinc-400">{valor.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Metodología */}
        <section id="metodologia" className="py-16 border-t border-zinc-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="flex items-center gap-3 justify-center mb-8">
              <Zap className="text-red-500" size={28} />
              <h2 className="text-3xl font-bold">Cómo Trabajamos</h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-red-500 mb-2">1</div>
                <h3 className="font-bold text-lg mb-2">Monitoreo Continuo</h3>
                <p className="text-sm text-zinc-400">
                  Utilizamos tecnología avanzada e inteligencia artificial para monitorear 
                  fuentes verificadas las 24 horas, detectando noticias relevantes en tiempo real.
                </p>
              </div>
              
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-red-500 mb-2">2</div>
                <h3 className="font-bold text-lg mb-2">Verificación</h3>
                <p className="text-sm text-zinc-400">
                  Cada noticia pasa por un proceso de verificación donde cruzamos múltiples 
                  fuentes independientes antes de publicar. No publicamos rumores.
                </p>
              </div>
              
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-red-500 mb-2">3</div>
                <h3 className="font-bold text-lg mb-2">Participación Ciudadana</h3>
                <p className="text-sm text-zinc-400">
                  A través de nuestra sección de denuncias, cualquier ciudadano puede reportar 
                  situaciones que merecen ser documentadas y visibilizadas.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Correcciones */}
        <section id="correcciones" className="py-12 bg-zinc-900/30 border-t border-zinc-800">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl font-bold mb-4">Política de Correcciones</h2>
            <p className="text-zinc-400">
              Si cometemos un error, lo corregimos públicamente. La credibilidad se construye 
              reconociendo equivocaciones. Si encuentras información incorrecta en nuestro sitio, 
              por favor contáctanos y lo revisaremos de inmediato.
            </p>
          </div>
        </section>

        {/* Fundador */}
        <section className="py-16 border-t border-zinc-800">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl font-bold mb-6">Sobre el Proyecto</h2>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8">
              <p className="text-lg text-zinc-300 mb-4">
                <strong className="text-white">LevántateCuba</strong> fue fundado y desarrollado por 
                <strong className="text-red-400"> Ivan Igor Constantin</strong>, Ingeniero de Software, 
                comprometido con la libertad de información y la participación ciudadana.
              </p>
              <p className="text-zinc-400 mb-6">
                "Mientras exista la necesidad de información libre, existirán voces que se levanten 
                para contarla."
              </p>
              <p className="text-sm text-zinc-500">
                Desarrollo profesional con tecnología de vanguardia, incluyendo inteligencia artificial 
                para cobertura informativa continua.
              </p>
            </div>
          </div>
        </section>

        {/* Contacto */}
        <section className="py-16 bg-gradient-to-t from-red-950/20 to-zinc-950 border-t border-zinc-800">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl font-bold mb-6">Contáctanos</h2>
            <p className="text-zinc-400 mb-8">
              ¿Tienes preguntas, sugerencias o información que compartir? Estamos aquí para escucharte.
            </p>
            
            <div className="flex justify-center">
              <a 
                href="mailto:soporte@levantatecuba.com"
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 px-6 py-3 rounded-lg transition-colors font-semibold"
              >
                <Mail size={20} />
                soporte@levantatecuba.com
              </a>
            </div>

            {/* Redes Sociales */}
            {socialLinks.length > 0 && (
              <div className="mt-8">
                <p className="text-zinc-500 mb-4">Síguenos en redes sociales</p>
                <div className="flex gap-4 justify-center">
                  {socialLinks.map((social, i) => (
                    <a 
                      key={i}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-full transition-colors"
                      aria-label={social.name}
                    >
                      {social.icon === "facebook" && (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* CTA Final */}
        <section className="py-12 border-t border-zinc-800">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h3 className="text-xl font-bold mb-4">¿Quieres ser parte del cambio?</h3>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/denuncias/nueva"
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Hacer una Denuncia
              </Link>
              <button 
                onClick={() => startDonation(10)}
                className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                <Heart size={18} />
                Apoyar el Proyecto
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
