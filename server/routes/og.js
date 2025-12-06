const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const RateSnapshot = require("../models/RateSnapshot");

// Configurar puppeteer con stealth
puppeteer.use(StealthPlugin());

const router = express.Router();

// Cache en memoria para la imagen OG
let ogCache = {
  buffer: null,
  updatedAt: null,
  createdAt: null
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en ms

/**
 * Función para parsear datos de CUP similar al frontend
 */
function parseCupCell(raw = "") {
  const s = String(raw || "").replace(/\s+/g, " ").toUpperCase();

  const venta = (s.match(/VENTA\s*([0-9.,]+)/i) || [])[1];
  const compra = (s.match(/COMPRA\s*([0-9.,]+)/i) || [])[1];

  const ventaVar = (s.match(/VENTA[\s0-9.,]*CUP\s*([+\-]?[0-9.,]+)/i) || [])[1];
  const compraVar = (s.match(/COMPRA[\s0-9.,]*CUP\s*([+\-]?[0-9.,]+)/i) || [])[1];

  if (!venta && !compra) {
    const first = (s.match(/([0-9]+[.,]?[0-9]*)/) || [])[1];
    return { venta: first || null, ventaVar: null, compra: null, compraVar: null };
  }
  return { venta, ventaVar, compra, compraVar };
}

/**
 * Función para formatear números
 */
function formatNumber(value) {
  if (!value) return "—";
  const n = parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? new Intl.NumberFormat("es-ES", { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(n) : value;
}

/**
 * Función para obtener las tasas clave priorizadas
 */
function getKeyRates(tasas) {
  const priorities = ["zelle", "usd", "eur", "mlc"];
  const result = [];
  
  // Primero agregar las tasas priorizadas
  priorities.forEach(priority => {
    const tasa = tasas.find(t => 
      t.moneda.toLowerCase().includes(priority)
    );
    if (tasa && result.length < 5) {
      result.push(tasa);
    }
  });
  
  // Completar hasta 5 con otras tasas si es necesario
  tasas.forEach(tasa => {
    if (result.length < 5 && !result.some(r => r.moneda === tasa.moneda)) {
      result.push(tasa);
    }
  });
  
  return result.slice(0, 5);
}

/**
 * Generar HTML para la imagen OG
 */
function generateOGHTML(tasas, fechaTexto) {
  const keyRates = getKeyRates(tasas);
  
  const rows = keyRates.map(tasa => {
    const { venta, ventaVar, compra, compraVar } = parseCupCell(tasa.cup);
    const isZelle = tasa.moneda.toLowerCase().includes('zelle');
    
    const formatVariation = (val) => {
      if (!val) return "";
      const n = parseFloat(String(val).replace(",", "."));
      const sign = Number.isFinite(n) ? (n > 0 ? "+" : "") : "";
      const color = Number.isFinite(n) 
        ? n > 0 ? "#22c55e" : n < 0 ? "#ef4444" : "#9ca3af"
        : "#9ca3af";
      return `<span style="color: ${color}; font-size: 14px; margin-left: 8px;">${sign}${Number.isFinite(n) ? formatNumber(Math.abs(n)) : val}</span>`;
    };

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
        <td style="padding: 12px 16px;">
          <span style="
            background: ${isZelle ? '#fbbf24' : 'rgba(255,255,255,0.1)'};
            color: ${isZelle ? '#000' : '#fff'};
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
          ">${tasa.moneda}</span>
        </td>
        <td style="padding: 12px 16px; text-align: right; font-family: 'JetBrains Mono', monospace;">
          <div style="display: flex; justify-content: flex-end; align-items: center;">
            <span style="color: #fff; font-size: 16px; font-weight: 600;">${formatNumber(venta)}</span>
            ${formatVariation(ventaVar)}
          </div>
        </td>
        <td style="padding: 12px 16px; text-align: right; font-family: 'JetBrains Mono', monospace;">
          <div style="display: flex; justify-content: flex-end; align-items: center;">
            <span style="color: #fff; font-size: 16px; font-weight: 600;">${formatNumber(compra)}</span>
            ${formatVariation(compraVar)}
          </div>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          width: 1200px;
          height: 630px;
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          font-family: 'Montserrat', sans-serif;
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        
        .grain-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><defs><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/><feColorMatrix in="colorNoise" type="saturate" values="0"/></filter></defs><rect width="100%" height="100%" filter="url(%23noiseFilter)" opacity="0.05"/></svg>');
          pointer-events: none;
        }
        
        .container {
          width: 90%;
          max-width: 1000px;
          z-index: 1;
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        
        .title {
          font-size: 48px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 12px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .subtitle {
          font-size: 20px;
          color: #a1a1aa;
          margin-bottom: 8px;
        }
        
        .source {
          font-size: 16px;
          color: #71717a;
        }
        
        .table-container {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          overflow: hidden;
          backdrop-filter: blur(10px);
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .table-header th {
          background: rgba(0,0,0,0.3);
          padding: 16px;
          font-size: 18px;
          font-weight: 600;
          color: #d1d5db;
          text-align: left;
        }
        
        .table-header th:nth-child(2),
        .table-header th:nth-child(3) {
          text-align: right;
        }
        
        .footer {
          position: absolute;
          bottom: 30px;
          right: 30px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .logo {
          font-size: 24px;
          font-weight: 700;
          color: #fbbf24;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        }
        
        .date {
          font-size: 14px;
          color: #9ca3af;
        }
      </style>
    </head>
    <body>
      <div class="grain-overlay"></div>
      
      <div class="container">
        <div class="header">
          <h1 class="title">Tasa del mercado informal en Cuba</h1>
          <p class="subtitle">Venta y compra en CUP</p>
          <p class="source">Fuente: elTOQUE • ${fechaTexto}</p>
        </div>
        
        <div class="table-container">
          <table>
            <thead class="table-header">
              <tr>
                <th>Moneda</th>
                <th style="text-align: right;">Venta (CUP)</th>
                <th style="text-align: right;">Compra (CUP)</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="footer">
        <div class="logo">LevántateCuba</div>
        <div class="date">${fechaTexto}</div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generar imagen OG usando Puppeteer
 */
async function generateOGImage(tasas, fechaTexto) {
  let browser = null;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-images',
        '--disable-plugins',
        '--disable-extensions'
      ]
    });
    
    const page = await browser.newPage();
    
    // Configurar viewport exacto para OG
    await page.setViewport({ width: 1200, height: 630 });
    
    // Bloquear recursos pesados
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    const html = generateOGHTML(tasas, fechaTexto);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generar screenshot
    const buffer = await page.screenshot({
      type: 'png',
      clip: {
        x: 0,
        y: 0,
        width: 1200,
        height: 630
      }
    });
    
    return buffer;
    
  } catch (error) {
    console.error('❌ Error generando imagen OG:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Endpoint GET /og/tasas.png
 */
router.get("/tasas.png", async (req, res) => {
  try {
    // Obtener el último snapshot
    const latestSnapshot = await RateSnapshot.findOne()
      .sort({ fetchedAt: -1 });
    
    if (!latestSnapshot) {
      return res.status(404).json({ error: "No hay datos de tasas disponibles" });
    }
    
    const snapshotUpdatedAt = latestSnapshot.updatedAt || latestSnapshot.createdAt;
    const cacheIsValid = ogCache.buffer && 
      ogCache.updatedAt && 
      ogCache.updatedAt.getTime() === snapshotUpdatedAt.getTime() &&
      (Date.now() - ogCache.createdAt) < CACHE_DURATION;
    
    // Si el cache es válido, devolverlo
    if (cacheIsValid) {
      console.log('✅ Sirviendo imagen OG desde cache');
      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300',
        'Content-Length': ogCache.buffer.length
      });
      return res.send(ogCache.buffer);
    }
    
    console.log('🔄 Generando nueva imagen OG...');
    
    // Validar que hay tasas válidas
    if (!latestSnapshot.tasas || latestSnapshot.tasas.length < 3) {
      return res.status(500).json({ error: "Datos de tasas insuficientes" });
    }
    
    // Preparar fecha
    const fechaTexto = latestSnapshot.fetchedAt ? 
      new Date(latestSnapshot.fetchedAt).toLocaleString("es-ES", {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : "Actualizando…";
    
    // Generar imagen
    const imageBuffer = await generateOGImage(latestSnapshot.tasas, fechaTexto);
    
    // Actualizar cache
    ogCache = {
      buffer: imageBuffer,
      updatedAt: snapshotUpdatedAt,
      createdAt: Date.now()
    };
    
    console.log('✅ Imagen OG generada y cacheada');
    
    // Enviar respuesta
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300',
      'Content-Length': imageBuffer.length
    });
    res.send(imageBuffer);
    
  } catch (error) {
    console.error('❌ Error en endpoint OG:', error);
    
    // Generar imagen de fallback
    try {
      const fallbackHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              width: 1200px;
              height: 630px;
              background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              font-family: 'Montserrat', sans-serif;
              color: white;
            }
            .title { font-size: 48px; font-weight: 700; margin-bottom: 20px; }
            .subtitle { font-size: 24px; color: #a1a1aa; margin-bottom: 40px; }
            .error { font-size: 18px; color: #ef4444; }
            .logo { position: absolute; bottom: 40px; right: 40px; font-size: 24px; font-weight: 700; color: #fbbf24; }
          </style>
        </head>
        <body>
          <h1 class="title">Tasa del mercado informal en Cuba</h1>
          <p class="subtitle">Datos no disponibles temporalmente</p>
          <p class="error">Por favor, intenta de nuevo más tarde</p>
          <div class="logo">LevántateCuba</div>
        </body>
        </html>
      `;
      
      let browser = null;
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 630 });
        await page.setContent(fallbackHTML);
        const fallbackBuffer = await page.screenshot({ type: 'png' });
        
        res.set({
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=60'
        });
        res.send(fallbackBuffer);
      } finally {
        if (browser) await browser.close();
      }
    } catch (fallbackError) {
      console.error('❌ Error generando imagen de fallback:', fallbackError);
      res.status(500).json({ error: "Error generando imagen social" });
    }
  }
});

// ============================================================================
// OG TAGS DINÁMICAS PARA NOTICIAS (Facebook, WhatsApp, Twitter previews)
// Creado: 2025-12-01
// ============================================================================

const News = require("../models/News");
const { renderOgPage, isSocialBot } = require("../utils/renderOgPage");

/**
 * Construir URL absoluta de imagen
 */
function getAbsoluteImageUrl(imagePath) {
  if (!imagePath) return 'https://levantatecuba.com/img/og-default.jpg';
  
  // Si ya es URL absoluta
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Si es path relativo
  const base = 'https://levantatecuba.com';
  if (imagePath.startsWith('/')) {
    return base + imagePath;
  }
  return base + '/' + imagePath;
}

/**
 * Extraer texto plano del contenido HTML
 */
function getExcerpt(contenido, maxLength = 200) {
  if (!contenido) return 'Lee esta noticia en LevántateCuba';
  
  let text = contenido
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (text.length > maxLength) {
    text = text.substring(0, maxLength - 3) + '...';
  }
  
  return text || 'Lee esta noticia en LevántateCuba';
}

/**
 * GET /og/noticias/:id
 * Ruta dedicada para OG previews de noticias
 * Devuelve HTML con meta tags para bots de redes sociales
 */
router.get("/noticias/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validar ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.redirect(`https://levantatecuba.com/noticias`);
    }
    
    // Buscar noticia
    const noticia = await News.findById(id);
    
    if (!noticia) {
      return res.redirect(`https://levantatecuba.com/noticias`);
    }
    
    // Construir datos para OG
    const title = noticia.titulo || 'Noticia | LevántateCuba';
    const description = noticia.bajada || getExcerpt(noticia.contenido, 200);
    
    // Prioridad de imagen: imagen principal > imagenOpcional > imagenSecundaria > default
    let imageUrl = noticia.imagen || noticia.imagenOpcional || noticia.imagenSecundaria;
    imageUrl = getAbsoluteImageUrl(imageUrl);
    
    const url = `https://levantatecuba.com/noticias/${id}`;
    
    // Generar HTML con OG tags
    const html = renderOgPage({
      title,
      description,
      imageUrl,
      url,
      type: 'article',
      siteName: 'LevántateCuba'
    });
    
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
    
  } catch (error) {
    console.error('❌ Error en OG noticias:', error);
    res.redirect(`https://levantatecuba.com/noticias`);
  }
});

module.exports = router;

