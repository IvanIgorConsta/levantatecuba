/**
 * Rutas para servir imágenes procesadas de noticias
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { generateETag, generatePlaceholder } = require('../services/imageProcessor');

/**
 * GET /media/news/:id/cover
 * Sirve imagen procesada con content negotiation (AVIF/WebP)
 */
router.get('/news/:id/cover', async (req, res) => {
  try {
    const { id } = req.params;
    const accept = req.headers.accept || '';
    
    // Determinar formato según Accept header
    const supportsAvif = accept.includes('image/avif');
    const supportsWebp = accept.includes('image/webp');
    
    const extension = supportsAvif ? 'avif' : (supportsWebp ? 'webp' : 'webp');
    const mimeType = extension === 'avif' ? 'image/avif' : 'image/webp';
    
    const filePath = path.join(process.cwd(), 'public', 'media', 'news', id, `cover.${extension}`);
    
    try {
      // Verificar si existe el archivo
      await fs.access(filePath);
      
      // Generar ETag
      const etag = await generateETag(filePath);
      
      // Verificar cache del cliente
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      
      // Leer archivo
      const fileBuffer = await fs.readFile(filePath);
      
      // Enviar con headers de cache
      res.set({
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'ETag': etag,
        'Vary': 'Accept'
      });
      
      return res.send(fileBuffer);
      
    } catch (error) {
      // Si no existe, intentar con WebP como fallback
      if (extension === 'avif') {
        const webpPath = path.join(process.cwd(), 'public', 'media', 'news', id, 'cover.webp');
        try {
          await fs.access(webpPath);
          const fileBuffer = await fs.readFile(webpPath);
          const etag = await generateETag(webpPath);
          
          res.set({
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
            'ETag': etag,
            'Vary': 'Accept'
          });
          
          return res.send(fileBuffer);
        } catch {
          // Continuar al placeholder
        }
      }
      
      // Generar y servir placeholder
      const placeholder = await generatePlaceholder();
      
      res.set({
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=3600',
        'Vary': 'Accept'
      });
      
      return res.send(placeholder);
    }
    
  } catch (error) {
    console.error('[Media] Error sirviendo imagen:', error);
    res.status(500).json({ error: 'Error al servir imagen' });
  }
});

/**
 * GET /media/news/:id/secondary
 * Sirve imagen secundaria procesada
 */
router.get('/news/:id/secondary', async (req, res) => {
  try {
    const { id } = req.params;
    const accept = req.headers.accept || '';
    
    const supportsAvif = accept.includes('image/avif');
    const supportsWebp = accept.includes('image/webp');
    
    const extension = supportsAvif ? 'avif' : (supportsWebp ? 'webp' : 'webp');
    const mimeType = extension === 'avif' ? 'image/avif' : 'image/webp';
    
    const filePath = path.join(process.cwd(), 'public', 'media', 'news', id, `secondary.${extension}`);
    
    try {
      await fs.access(filePath);
      
      const etag = await generateETag(filePath);
      
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      
      const fileBuffer = await fs.readFile(filePath);
      
      res.set({
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'ETag': etag,
        'Vary': 'Accept'
      });
      
      return res.send(fileBuffer);
      
    } catch {
      const placeholder = await generatePlaceholder(800, 800); // Cuadrado para secundaria
      
      res.set({
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=3600',
        'Vary': 'Accept'
      });
      
      return res.send(placeholder);
    }
    
  } catch (error) {
    console.error('[Media] Error sirviendo imagen secundaria:', error);
    res.status(500).json({ error: 'Error al servir imagen' });
  }
});

/**
 * Middleware para servir archivos estáticos de /media con extensión explícita
 * Sirve archivos como /media/news/:id/cover.avif directamente
 */
router.use(express.static(path.join(process.cwd(), 'public', 'media'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.avif')) {
      res.setHeader('Content-Type', 'image/avif');
    } else if (filePath.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

module.exports = router;
