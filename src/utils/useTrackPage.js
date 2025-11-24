import { useEffect } from "react";

// DESHABILITADO: Metrics eliminado 09/11/2025
// Hook mantenido para no romper imports existentes, pero sin funcionalidad
export default function useTrackPage(pageName = null) {
  useEffect(() => {
    // Tracking deshabilitado - endpoint /api/metrics eliminado
    // const page = pageName || window.location.pathname;
    // fetch("/api/metrics/track", { ... });
  }, [pageName]);
}
