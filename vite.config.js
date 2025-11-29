// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react()
    // Si más adelante quieres volver a usar el plugin de PropTypes:
    // react({
    //   babel: {
    //     plugins: [
    //       ['babel-plugin-transform-react-remove-prop-types', { removeImport: true }]
    //     ]
    //   }
    // })
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@admin': fileURLToPath(new URL('./src/admin_dashboard/components', import.meta.url)),
    },
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
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

  build: {
    outDir: 'dist',
    sourcemap: false,
    // ❌ Quitamos minify: 'terser' y terserOptions
    // ❌ Quitamos manualChunks y treeshake agresivo
    // Usamos la configuración estándar de Vite (esbuild) que es muy estable
  },
});
