// vite.config.js
// ✅ CONFIGURACIÓN OPTIMIZADA PARA PRODUCCIÓN
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  const isProd = mode === 'production';

  return {
    plugins: [
      react({
        // Optimización de JSX en producción
        babel: isProd ? {
          plugins: [
            // Remover PropTypes en producción
            ['babel-plugin-transform-react-remove-prop-types', { removeImport: true }]
          ]
        } : undefined
      })
    ],

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
        '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
        '@admin': fileURLToPath(new URL('./src/admin_dashboard/components', import.meta.url)),
      },
    },

    // SERVER - Configuración de desarrollo
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: false,
      open: true,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('[Vite Proxy] Error:', err.message);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('[Vite Proxy] Request:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('[Vite Proxy] Response:', proxyRes.statusCode, req.url);
            });
          },
        },
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        '/og': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        '/media': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // BUILD - Configuración optimizada para producción
    build: {
      outDir: 'dist',
      sourcemap: false, // Sin sourcemaps en producción
      minify: 'terser', // Minificación más agresiva
      
      // Optimización de assets
      assetsInlineLimit: 4096, // Inline assets < 4KB
      cssCodeSplit: true, // CSS splitting por ruta
      
      // Configuración de Terser (minificador)
      terserOptions: {
        compress: {
          drop_console: true, // 🔥 ELIMINAR console.* en producción
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        },
        format: {
          comments: false, // Remover comentarios
        },
      },

      // ROLLUP OPTIONS - Code splitting y chunking
      rollupOptions: {
        output: {
          // Naming optimizado
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',

          // Manual chunks para mejor cache
          manualChunks: (id) => {
            // Vendor chunks por tipo de librería
            if (id.includes('node_modules')) {
              // React core
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'react-vendor';
              }
              
              // UI/Animation libraries
              if (id.includes('framer-motion') || id.includes('lucide-react') || id.includes('react-icons')) {
                return 'ui-vendor';
              }
              
              // Admin dashboard libraries (lazy load)
              if (id.includes('recharts') || id.includes('diff2html') || id.includes('@mantine')) {
                return 'admin-vendor';
              }
              
              // E-commerce (Shopify, Stripe)
              if (id.includes('shopify') || id.includes('stripe')) {
                return 'commerce-vendor';
              }
              
              // Utilities (axios, dayjs, etc.)
              if (id.includes('axios') || id.includes('dayjs') || id.includes('dompurify')) {
                return 'utils-vendor';
              }
              
              // Resto de node_modules
              return 'vendor';
            }
            
            // Admin dashboard como chunk separado
            if (id.includes('/src/admin_dashboard/')) {
              return 'admin';
            }
            
            // Páginas de tienda como chunk separado
            if (id.includes('/src/pages/Tienda') || id.includes('/src/pages/ProductoDetalle')) {
              return 'shop';
            }
          },
        },
        
        // Optimizaciones adicionales
        treeshake: {
          preset: 'recommended',
          moduleSideEffects: false,
        },
      },

      // Límites de tamaño de chunks
      chunkSizeWarningLimit: 800, // Advertir si chunk > 800KB
      reportCompressedSize: true, // Reportar tamaño comprimido
    },

    // OPTIMIZACIONES
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'axios',
        'framer-motion',
        'lucide-react'
      ],
      exclude: [
        // Excluir paquetes pesados que no se usan en dev
        '@anthropic-ai/sdk',
        'puppeteer-extra'
      ]
    },

    // CONFIGURACIÓN DE PREVIEW (npm run preview)
    preview: {
      port: 4173,
      strictPort: true,
      open: true,
    },

    // VARIABLES DE ENTORNO
    define: {
      // Exponer solo variables necesarias
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },

    // PERFORMANCE
    esbuild: {
      // Optimizaciones de esbuild
      legalComments: 'none',
      logOverride: { 'this-is-undefined-in-esm': 'silent' },
    },
  };
});
