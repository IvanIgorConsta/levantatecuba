import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import { Toaster } from "react-hot-toast"; // ✅ Notificaciones
import { CartProvider } from "./context/CartContext"; // ✅ Carrito global
import ErrorBoundary from "./components/ErrorBoundary"; // ✅ Captura de errores
import "./index.css";
import "./i18n"; // ✅ Traducciones
import ScrollToTop from "./components/ScrollToTop";
// loadConfig eliminado - ahora la precedencia ENV > app-config es directa

const root = ReactDOM.createRoot(document.getElementById("root"));

// Renderizar la aplicación directamente - configuración con precedencia ENV > app-config
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <CartProvider>
            <ScrollToTop />
            <App />
            <Toaster 
            position="top-right" 
            reverseOrder={false}
            toastOptions={{
              style: { 
                background: '#18181b', 
                color: '#f4f4f5', 
                border: '1px solid #27272a',
                borderRadius: '0.75rem',
                padding: '12px 16px'
              },
              success: { 
                iconTheme: { primary: '#22c55e', secondary: '#18181b' },
                duration: 3000
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#18181b' },
                duration: 4000
              },
              loading: {
                iconTheme: { primary: '#3b82f6', secondary: '#18181b' }
              }
            }}
          />
        </CartProvider>
      </BrowserRouter>
    </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
