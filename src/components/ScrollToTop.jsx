// src/components/ScrollToTop.jsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  // Desactiva la restauración automática del navegador
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      const prev = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
      return () => { window.history.scrollRestoration = prev; };
    }
  }, []);

  // Fuerza (0,0) al entrar y en cada cambio de ruta
  useEffect(() => {
    window.scrollTo(0, 0);
    // Fallback inmediato para Safari/iOS frente a rebotes
    setTimeout(() => window.scrollTo(0, 0), 0);
  }, [pathname]);

  return null;
}
