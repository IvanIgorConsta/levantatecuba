/**
 * Página de Debug Temporal para inspeccionar configuración
 * ELIMINAR EN PRODUCCIÓN
 */

import { useEffect, useState } from 'react';
import { getStoreMode, getStoreExternalUrl, RUNTIME_CONFIG } from '../lib/runtimeConfig';

export default function EnvDebug() {
  const [debugInfo, setDebugInfo] = useState({});
  
  useEffect(() => {
    // Recopilar toda la información de debug
    const rawModeEnv = import.meta.env.VITE_STORE_MODE;
    const rawExternalUrlEnv = import.meta.env.VITE_STORE_EXTERNAL_URL;
    const cfg = RUNTIME_CONFIG;
    const storeMode = getStoreMode();
    const externalUrl = getStoreExternalUrl();
    
    const info = {
      environment: {
        mode: import.meta.env.MODE,
        dev: import.meta.env.DEV,
        prod: import.meta.env.PROD,
      },
      store: {
        VITE_STORE_MODE: rawModeEnv,
        VITE_STORE_EXTERNAL_URL: rawExternalUrlEnv,
        computedStoreMode: storeMode,
        computedExternalUrl: externalUrl,
        isInternalMode: storeMode === 'internal',
        willShowCatalog: storeMode === 'internal',
        willRedirect: storeMode === 'external' && !!externalUrl,
        runtimeConfig: cfg,
      },
      allEnvVars: Object.keys(import.meta.env)
        .filter(key => key.startsWith('VITE_'))
        .reduce((acc, key) => {
          acc[key] = import.meta.env[key];
          return acc;
        }, {})
    };
    
    setDebugInfo(info);
    
    // También log en consola para debugging
    console.log('[EnvDebug] Full debug info:', info);
  }, []);
  
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-red-500 mb-2">
            🔍 Debug de Configuración
          </h1>
          <p className="text-zinc-400">
            Esta página es temporal. <strong className="text-yellow-500">ELIMINAR EN PRODUCCIÓN</strong>
          </p>
        </div>
        
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
          <pre className="text-sm overflow-x-auto text-green-400 font-mono">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
        
        <div className="mt-8 space-y-4">
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
            <h2 className="text-lg font-semibold mb-2 text-yellow-500">
              ⚠️ Diagnóstico Rápido
            </h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className={debugInfo.store?.computedStoreMode === 'internal' ? 'text-green-500' : 'text-blue-500'}>
                  {debugInfo.store?.computedStoreMode === 'internal' ? '🛒' : '🔗'}
                </span>
                <span className="text-zinc-300">
                  Modo de tienda: <strong className="text-white">{debugInfo.store?.computedStoreMode || 'Cargando...'}</strong>
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className={debugInfo.store?.willShowCatalog ? 'text-green-500' : 'text-yellow-500'}>
                  {debugInfo.store?.willShowCatalog ? '✅' : '⚠️'}
                </span>
                <span className="text-zinc-300">
                  Mostrará catálogo interno: {debugInfo.store?.willShowCatalog ? 'SÍ' : 'NO'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className={debugInfo.store?.willRedirect ? 'text-blue-500' : 'text-gray-500'}>
                  {debugInfo.store?.willRedirect ? '🔗' : '—'}
                </span>
                <span className="text-zinc-300">
                  Redirigirá a URL externa: {debugInfo.store?.willRedirect ? `SÍ → ${debugInfo.store?.computedExternalUrl}` : 'NO'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className={debugInfo.store?.runtimeConfig ? 'text-green-500' : 'text-red-500'}>
                  {debugInfo.store?.runtimeConfig ? '✅' : '❌'}
                </span>
                <span className="text-zinc-300">
                  Configuración runtime cargada: {debugInfo.store?.runtimeConfig ? 'SÍ' : 'NO'}
                </span>
              </li>
            </ul>
          </div>
          
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
            <h2 className="text-lg font-semibold mb-2 text-blue-500">
              📝 Instrucciones
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-300">
              <li><strong>Modo Interno (por defecto):</strong> La tienda muestra catálogo de productos</li>
              <li>Para activar <strong>modo externo</strong>, configura en <code className="bg-zinc-800 px-1 py-0.5 rounded">.env</code>:
                <pre className="bg-zinc-800 rounded p-2 mt-1 text-xs">VITE_STORE_MODE=external
VITE_STORE_EXTERNAL_URL=https://tu-tienda.com</pre>
              </li>
              <li>El modo interno funciona <strong>sin configuración adicional</strong></li>
              <li>Después de cambiar .env, reinicia con <code className="bg-zinc-800 px-1 py-0.5 rounded">npm run dev</code></li>
              <li>Para producción, edita <code className="bg-zinc-800 px-1 py-0.5 rounded">/public/app-config.json</code> sin recompilar</li>
            </ol>
          </div>
          
          <div className="flex gap-4">
            <a 
              href="/" 
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
            >
              ← Volver al inicio
            </a>
            <a 
              href="/tienda" 
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
            >
              Probar /tienda →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}