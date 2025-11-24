// server/routes/ssr.js
// Server-Side Rendering para Open Graph y meta-tags de redes sociales

const express = require('express');
const router = express.Router();
const News = require('../models/News');
const { generateNewsDetailHTML } = require('../templates/newsDetail');
const { botDetectionMiddleware } = require('../middleware/botDetector');

// Obtener BASE_URL desde variables de entorno con fallback
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || process.env.PUBLIC_ORIGIN || 'https://levantatecuba.com';

// Aplicar middleware de detección de bots
router.use(botDetectionMiddleware);

/**
 * GET /noticias/:id
 * Ruta SSR para detalle de noticia
 * - Si es bot: sirve HTML con meta-tags Open Graph
 * - Si es usuario: deja pasar al SPA
 */
router.get('/noticias/:id', async (req, res, next) => {
  // Si no es un bot, pasar al siguiente middleware (SPA)
  if (!req.isBot) {
    return next();
  }
  
  try {
    const { id } = req.params;
    
    // Validar formato de ID (MongoDB ObjectId tiene 24 caracteres hex)
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return next(); // ID inválido, dejar que el SPA maneje el 404
    }
    
    // Buscar la noticia
    const noticia = await News.findById(id);
    
    // Si no existe o no está publicada, pasar al SPA
    if (!noticia) {
      return next();
    }
    
    // Si la noticia está programada (no publicada), solo admins pueden verla
    // Los bots no deben ver noticias programadas
    if (noticia.status === 'scheduled') {
      return next();
    }
    
    // Generar HTML con meta-tags
    const html = generateNewsDetailHTML(noticia, PUBLIC_BASE_URL);
    
    // Enviar HTML con headers correctos
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache 1 hora
    res.send(html);
    
  } catch (error) {
    console.error('[SSR] Error al renderizar noticia:', error);
    // En caso de error, pasar al SPA
    next();
  }
});

module.exports = router;
