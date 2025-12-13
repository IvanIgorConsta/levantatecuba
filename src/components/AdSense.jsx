// src/components/AdSense.jsx
// Componente reutilizable para Google AdSense
// NO usar anuncios automáticos - solo posiciones manuales controladas

import { useEffect, useRef } from 'react';

/**
 * Componente de anuncio AdSense
 * @param {string} slot - ID del slot de anuncio (ej: "1234567890")
 * @param {string} format - Formato: "auto", "fluid", "rectangle", "horizontal", "vertical"
 * @param {string} layout - Layout para in-feed/in-article: "in-article", "in-feed"
 * @param {boolean} responsive - Si el anuncio es responsive (default: true)
 * @param {string} className - Clases CSS adicionales
 * @param {string} style - Estilos inline adicionales
 */
export default function AdSense({ 
  slot, 
  format = 'auto', 
  layout = null,
  responsive = true,
  className = '',
  style = {}
}) {
  const adRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    // Evitar duplicación de anuncios en navegación SPA
    if (initialized.current) return;
    
    // Verificar que adsbygoogle esté disponible
    if (typeof window === 'undefined') return;
    
    try {
      // Empujar el anuncio solo una vez
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      initialized.current = true;
    } catch (err) {
      console.warn('[AdSense] Error inicializando anuncio:', err.message);
    }

    // Cleanup al desmontar - no hay necesidad de remover el anuncio
    return () => {
      // El anuncio se limpia automáticamente al desmontar el componente
    };
  }, []);

  // No renderizar en SSR
  if (typeof window === 'undefined') return null;

  // Client ID de AdSense
  const clientId = 'ca-pub-2905851876833382';

  // Estilos base según el formato
  const baseStyle = {
    display: 'block',
    ...style
  };

  // Props del anuncio según formato
  const adProps = {
    'data-ad-client': clientId,
    'data-ad-slot': slot,
  };

  if (responsive) {
    adProps['data-ad-format'] = format;
    adProps['data-full-width-responsive'] = 'true';
  }

  if (layout) {
    adProps['data-ad-layout'] = layout;
  }

  return (
    <div 
      className={`adsense-container ${className}`}
      aria-label="Publicidad"
    >
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={baseStyle}
        {...adProps}
      />
    </div>
  );
}

/**
 * Anuncio In-Article (dentro del contenido)
 * Diseñado para integrarse naturalmente en el flujo de lectura
 * @param {boolean} isReady - Solo mostrar cuando el contenido esté cargado
 */
export function AdInArticle({ className = '', isReady = true }) {
  // NO mostrar anuncio si el contenido no está listo (evita infracción de AdSense)
  if (!isReady) return null;
  
  return (
    <div className={`my-8 ${className}`}>
      <div className="text-center text-xs text-zinc-500 mb-2">Publicidad</div>
      <AdSense 
        slot="4923543598"
        format="fluid"
        layout="in-article"
        className="min-h-[250px]"
      />
    </div>
  );
}

/**
 * Anuncio Display estándar (final de artículo, sidebar)
 * @param {boolean} isReady - Solo mostrar cuando el contenido esté cargado
 */
export function AdDisplay({ className = '', slot = '8341056189', isReady = true }) {
  // NO mostrar anuncio si el contenido no está listo
  if (!isReady) return null;
  
  return (
    <div className={`my-6 ${className}`}>
      <div className="text-center text-xs text-zinc-500 mb-2">Publicidad</div>
      <AdSense 
        slot={slot}
        format="auto"
        responsive={true}
        className="min-h-[100px]"
      />
    </div>
  );
}

/**
 * Anuncio para Sidebar (solo desktop)
 * Se oculta automáticamente en móvil
 * @param {boolean} isReady - Solo mostrar cuando el contenido esté cargado
 */
export function AdSidebar({ className = '', isReady = true }) {
  // NO mostrar anuncio si el contenido no está listo
  if (!isReady) return null;
  
  return (
    <div className={`hidden lg:block ${className}`}>
      <div className="sticky top-24">
        <div className="text-center text-xs text-zinc-500 mb-2">Publicidad</div>
        <AdSense 
          slot="6596536151"
          format="vertical"
          responsive={true}
          className="min-h-[600px] max-w-[300px]"
        />
      </div>
    </div>
  );
}
