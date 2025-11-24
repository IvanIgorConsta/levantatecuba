const express = require("express");
const router = express.Router();

// ========================================================
// STUB DE DEPRECACIÓN - ELIMINAR DESPUÉS DEL 28/04/2025
// ========================================================
// Este endpoint ya no se usa. La funcionalidad de Rostros
// ha sido eliminada completamente del proyecto.
// Mantenemos temporalmente este stub para no romper
// clientes antiguos que puedan estar haciendo requests.
// 
// Fecha de eliminación: 28 de enero de 2025
// Remover este archivo después de: 28 de abril de 2025
// ========================================================

// Responder con 410 Gone a cualquier petición
// Usar middleware en lugar de wildcard para evitar problemas con path-to-regexp
router.use((req, res) => {
  console.warn(`[DEPRECATED] Intento de acceso a /api/rostros - ${req.method} ${req.originalUrl}`);
  
  res.status(410).json({
    error: "Gone",
    message: "El módulo de Rostros ha sido eliminado permanentemente de la plataforma",
    details: "Esta funcionalidad ya no está disponible y no será restaurada",
    deprecatedSince: "2025-01-28",
    removeAfter: "2025-04-28",
    alternativeSuggestion: "Por favor, contacte al administrador si necesita asistencia"
  });
});

module.exports = router;