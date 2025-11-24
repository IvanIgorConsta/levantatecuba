// src/components/DebugShopCTA.jsx
// Banner de debug controlado por entorno para el ShopCTA (solo visible si showDebug === true)

import { useEffect, useState } from 'react';

export default function DebugShopCTA() {
  const [info, setInfo] = useState(null);

  // Guardas de entorno para el overlay de debug
  const IS_PROD = import.meta.env.MODE === 'production';
  const DEBUG_FLAG = (import.meta.env.VITE_DEBUG_SHOP_CTA ?? 'false') === 'true';
  const showDebug = !IS_PROD && DEBUG_FLAG;

  useEffect(() => {
    if (!showDebug) return;

    const checkInterval = setInterval(() => {
      const shopCTAElement = document.querySelector('[aria-label="Apoya la causa"]');
      const hasShopCTA = !!shopCTAElement;
      const isMobile = window.innerWidth < 768;
      
      setInfo({
        hasShopCTA,
        isMobile,
        width: window.innerWidth,
        mounted: Date.now(),
      });
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [showDebug]);

  if (!showDebug) return null;
  if (!info) return null;

  return (
    <div className="shop-cta-debug fixed bottom-20 left-4 z-[100] bg-yellow-500 text-black text-xs p-3 rounded-lg shadow-lg font-mono max-w-[280px]">
      <div className="font-bold mb-2">🔍 DEBUG ShopCTA</div>
      <div className="space-y-1">
        <div>
          Montado: {info.hasShopCTA ? '✅ Sí' : '❌ No'}
        </div>
        <div>
          Dispositivo: {info.isMobile ? '📱 Móvil' : '💻 Desktop'}
        </div>
        <div>
          Ancho: {info.width}px
        </div>
        <div className="mt-2 pt-2 border-t border-black/20 text-[10px]">
          Revisa consola para logs detallados
        </div>
      </div>
    </div>
  );
}

