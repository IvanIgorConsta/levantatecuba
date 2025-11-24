import { Link } from "react-router-dom";
import PropTypes from "prop-types";

/**
 * Componente reutilizable para secciones "Sale pronto"
 * @param {Object} props
 * @param {string} props.title - Título de la sección
 * @param {string} props.subtitle - Descripción o mensaje
 * @param {string} props.ctaText - Texto del botón CTA
 * @param {string} props.backTo - Ruta a la que volver
 * @param {ReactNode} props.icon - Icono de la sección
 */
const ComingSoon = ({ title, subtitle, ctaText, backTo, icon }) => {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      {/* Fondo con gradiente sutil */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-black to-black opacity-50" />
      
      <div className="relative z-10 max-w-2xl mx-auto text-center">
        {/* Contenedor con borde y efecto glass */}
        <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-8 md:p-12 shadow-2xl">
          {/* Icono animado */}
          <div className="mb-6 flex justify-center">
            <div className="p-4 bg-red-600/10 rounded-full ring-2 ring-red-600/30 animate-pulse">
              {icon}
            </div>
          </div>
          
          {/* Badge "Próximamente" */}
          <div className="inline-block mb-4">
            <span className="px-4 py-1 bg-gradient-to-r from-red-600 to-orange-500 text-white text-sm font-semibold rounded-full">
              PRÓXIMAMENTE
            </span>
          </div>
          
          {/* Título */}
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            {title}
          </h1>
          
          {/* Subtítulo */}
          <p className="text-lg text-gray-400 mb-8 leading-relaxed">
            {subtitle}
          </p>
          
          {/* Línea decorativa */}
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent mx-auto mb-8" />
          
          {/* Botón de regreso */}
          <Link
            to={backTo}
            className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-red-600 border border-zinc-700 hover:border-red-600 text-white font-semibold py-3 px-8 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-600/30"
            aria-label={ctaText}
          >
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M10 19l-7-7m0 0l7-7m-7 7h18" 
              />
            </svg>
            {ctaText}
          </Link>
        </div>
        
        {/* Partículas decorativas de fondo */}
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-700" />
      </div>
    </div>
  );
};

ComingSoon.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  ctaText: PropTypes.string.isRequired,
  backTo: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired,
};

export default ComingSoon;
