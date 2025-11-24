// src/components/Divider.jsx
import { motion, useReducedMotion } from 'framer-motion';
import PropTypes from 'prop-types';

/**
 * Divider elegante con glow animado tipo Apple
 * Diseñado para ser visible incluso en fondos negros
 */
export default function Divider({ 
  color = 'red', 
  thickness = 2,
  glowStrength = 'md',
  animated = true,
  variant = 'line',
  className = ''
}) {
  const prefersReducedMotion = useReducedMotion();
  
  // Mapeo de colores a tokens de Tailwind
  const colorMap = {
    red: 'rgb(239, 68, 68)',      // red-500
    rose: 'rgb(244, 63, 94)',     // rose-500
    emerald: 'rgb(16, 185, 129)', // emerald-500
    cyan: 'rgb(6, 182, 212)',     // cyan-500
    yellow: 'rgb(234, 179, 8)',   // yellow-500
  };

  // Obtener color final (hex o token)
  const finalColor = colorMap[color] || color;
  
  // Mapeo de intensidad de glow
  const glowMap = {
    none: 0,
    sm: 8,
    md: 16,
    lg: 24,
  };
  
  const glowSize = glowMap[glowStrength] || 16;
  
  // Animación sutil tipo "breathing"
  const animation = animated && !prefersReducedMotion ? {
    initial: { 
      opacity: 0.85,
    },
    animate: { 
      opacity: [0.85, 1, 0.85],
      filter: [
        `drop-shadow(0 0 ${glowSize * 0.5}px ${finalColor})`,
        `drop-shadow(0 0 ${glowSize}px ${finalColor})`,
        `drop-shadow(0 0 ${glowSize * 0.5}px ${finalColor})`,
      ]
    },
    transition: { 
      duration: 5,
      repeat: Infinity,
      ease: 'easeInOut',
      repeatType: 'loop'
    }
  } : {
    initial: { opacity: 0.9 },
    animate: { opacity: 0.9 }
  };

  return (
    <div 
      className={`relative left-1/2 right-1/2 -mx-[50vw] w-screen ${className}`}
      role="separator"
      aria-hidden="true"
    >
      <div className="mx-auto max-w-7xl px-4">
        <motion.div
          {...animation}
          className="relative"
          style={{
            height: variant === 'aura' ? `${thickness * 3}px` : `${thickness}px`,
          }}
        >
          {/* Aura difusa (solo en variant "aura") */}
          {variant === 'aura' && glowStrength !== 'none' && (
            <div 
              className="pointer-events-none absolute inset-0 blur-sm opacity-30"
              style={{
                background: `linear-gradient(to right, transparent, ${finalColor} 50%, transparent)`,
              }}
            />
          )}
          
          {/* Línea central con gradiente */}
          <div 
            className="relative mx-auto"
            style={{
              height: `${thickness}px`,
              background: `linear-gradient(to right, transparent 0%, ${finalColor} 20%, ${finalColor} 80%, transparent 100%)`,
              boxShadow: glowStrength !== 'none' 
                ? `0 0 ${glowSize}px ${finalColor}, 0 0 ${glowSize * 0.5}px ${finalColor}`
                : 'none',
            }}
          />
          
          {/* Puntos luminosos en los extremos (solo en variant "aura") */}
          {variant === 'aura' && (
            <>
              <div 
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full blur-sm"
                style={{
                  background: finalColor,
                  boxShadow: `0 0 ${glowSize}px ${finalColor}`,
                }}
              />
              <div 
                className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full blur-sm"
                style={{
                  background: finalColor,
                  boxShadow: `0 0 ${glowSize}px ${finalColor}`,
                }}
              />
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

Divider.propTypes = {
  color: PropTypes.string,
  thickness: PropTypes.number,
  glowStrength: PropTypes.oneOf(['none', 'sm', 'md', 'lg']),
  animated: PropTypes.bool,
  variant: PropTypes.oneOf(['line', 'aura']),
  className: PropTypes.string,
};


