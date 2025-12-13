import { Link } from "react-router-dom";
import { FaFacebook } from "react-icons/fa";
import LanguageSwitch from "./LanguageSwitch";

export default function HeroLevantateCuba() {
  return (
    <section
      className="relative w-full flex flex-col items-center justify-center min-h-[60vh] bg-black text-center overflow-hidden"
      aria-label="Sección principal LevántateCuba"
    >
      {/* Switch de idioma ES/EN */}
      <LanguageSwitch className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30" />

      {/* Glow sutil detrás del logo */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[36rem] h-[36rem] rounded-full bg-red-600/10 blur-3xl" />
      </div>

      {/* Logo - renderizado instantáneo sin transiciones */}
      <div 
        className="relative w-40 md:w-56 h-40 md:h-56 mb-6 flex items-center justify-center"
        style={{ animation: 'none', transition: 'none' }}
      >
        <img
          src="/img/levantatecubaLogo.png"
          alt="Logo LevántateCuba"
          width="224"
          height="224"
          className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(255,0,0,0.5)]"
          style={{ animation: 'none', transition: 'none', opacity: 1, transform: 'none' }}
          loading="eager"
          decoding="sync"
          fetchPriority="high"
        />
      </div>

      {/* Títulos */}
      <h1 className="relative text-white font-extrabold tracking-tight text-5xl md:text-6xl">
        LevántateCuba
      </h1>
      <p className="relative mt-2 text-white/70 text-lg md:text-xl">
        Medio digital independiente
      </p>

      {/* CTA */}
      <div className="relative mt-6">
        <Link
          to="/denuncias/nueva"
          className="inline-flex items-center justify-center rounded-full bg-red-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/60"
          aria-label="Conoce cómo ayudamos"
        >
          Conoce cómo ayudamos
        </Link>
      </div>
      {/* Icono Facebook debajo del CTA */}
      <a
        href="https://www.facebook.com/profile.php?id=61580079061652"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Visitar página de Facebook"
        title="Facebook"
        className="relative mt-8 z-20 inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/5 backdrop-blur border border-white/10 text-white/80 hover:text-white hover:bg-white/10 hover:border-white/20 ring-0 hover:ring-2 hover:ring-white/20 transition-all duration-300"
      >
        <FaFacebook size={20} className="opacity-90 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
      </a>
    </section>
  );
}
