// src/App.jsx
import { useEffect } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import AppRoutes from "./routes"; // ✅ Usamos el archivo con TODAS las rutas
import ScrollToTop from "./components/ScrollToTop";
import CartFab from "./components/CartFab"; // ✅ Botón flotante del carrito
import CartDrawer from "./components/CartDrawer"; // ✅ Panel lateral del carrito

export default function App() {
  // Calcular altura del header para offset dinámico
  useEffect(() => {
    const setNavHeight = () => {
      const header = document.querySelector('#app-header');
      const height = header?.offsetHeight || 64; // fallback 64px
      document.documentElement.style.setProperty('--nav-h', `${height}px`);
    };
    
    setNavHeight();
    window.addEventListener('resize', setNavHeight);
    return () => window.removeEventListener('resize', setNavHeight);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header />
      <ScrollToTop />
      <main className="flex-grow">
        <AppRoutes /> {/* 🔁 Carga todas las rutas públicas y privadas */}
      </main>
      <Footer />
      
      {/* 🛒 Carrito global - visible en todas las páginas */}
      <CartFab />
      <CartDrawer />
    </div>
  );
}
