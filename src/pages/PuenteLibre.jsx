// src/pages/PuenteLibre.jsx
// Página dedicada para la sección Puente Libre
import { Link } from 'react-router-dom';
import { Radio, Newspaper, ExternalLink, Globe, Wifi } from 'lucide-react';
import PageHeader from '../components/PageHeader';

export default function PuenteLibre() {
  return (
    <main className="min-h-screen bg-transparent">
      {/* Cabecera unificada */}
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Puente Libre' }
        ]}
        icon={Radio}
        title="Puente"
        titleHighlight="Libre"
        subtitle="Información sin censura. Conectando a Cuba con el mundo libre."
        bannerEmoji="🌐"
        bannerTitle="Mantente informado"
        bannerText="Accede a las últimas noticias verificadas sobre Cuba."
        ctaLabel="Ver noticias"
        ctaHref="/noticias"
        ctaIcon={Newspaper}
      />

      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-10">
        {/* Contenido principal */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Card: Misión */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30">
                <Wifi className="w-5 h-5 text-red-400" />
              </span>
              <h2 className="text-xl font-semibold text-white">Nuestra Misión</h2>
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Puente Libre es una solución creada para que las personas en Cuba puedan comprar en Amazon, Shein y otras tiendas internacionales, incluso sin acceso a tarjetas Visa o Mastercard. Servimos como puente seguro entre tus necesidades y las plataformas de compra global, utilizando criptomonedas como medio de pago para hacer posibles las compras que antes eran inaccesibles.
            </p>
          </div>

          {/* Card: Cómo funciona */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30">
                <Globe className="w-5 h-5 text-blue-400" />
              </span>
              <h2 className="text-xl font-semibold text-white">Acceso Global</h2>
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Convertimos tus criptomonedas en poder de compra internacional. A través de Puente Libre gestionamos tus pedidos en tiendas globales sin depender de bancos tradicionales ni tarjetas internacionales. Priorizamos la seguridad, la privacidad y la rapidez, para que puedas acceder a productos de cualquier parte del mundo desde Cuba.
            </p>
          </div>
        </div>

        {/* Sección de recursos */}
        <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-6 md:p-8">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-red-400" />
            Explora nuestro contenido
          </h3>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              to="/noticias"
              className="group flex items-center gap-4 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:border-red-500/50 hover:bg-zinc-800/50 transition-all"
            >
              <Newspaper className="w-8 h-8 text-zinc-500 group-hover:text-red-400 transition-colors" />
              <div>
                <p className="font-medium text-white">Noticias</p>
                <p className="text-sm text-zinc-500">Información actualizada</p>
              </div>
            </Link>

            <Link
              to="/denuncias"
              className="group flex items-center gap-4 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:border-red-500/50 hover:bg-zinc-800/50 transition-all"
            >
              <Radio className="w-8 h-8 text-zinc-500 group-hover:text-red-400 transition-colors" />
              <div>
                <p className="font-medium text-white">Denuncias</p>
                <p className="text-sm text-zinc-500">Voces ciudadanas</p>
              </div>
            </Link>

            <Link
              to="/tienda"
              className="group flex items-center gap-4 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:border-red-500/50 hover:bg-zinc-800/50 transition-all"
            >
              <span className="text-2xl">🛒</span>
              <div>
                <p className="font-medium text-white">Tienda</p>
                <p className="text-sm text-zinc-500">Apoya la causa</p>
              </div>
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
