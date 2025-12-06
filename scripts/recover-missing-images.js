/**
 * Script de recuperación de imágenes perdidas
 * Ejecutar: node scripts/recover-missing-images.js [--dry-run] [--limit N] [--type draft|news]
 * 
 * Opciones:
 *   --dry-run    Solo muestra qué se haría, sin ejecutar
 *   --limit N    Limitar a N imágenes
 *   --type X     Solo procesar 'draft' o 'news'
 *   --placeholder  Generar placeholders en vez de re-descargar
 */

const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs").promises;
const sharp = require("sharp");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// Configuración
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://iiconstantin:gVLLGEofJGGy362p@cluster0.qglo8.mongodb.net/Levantatecuba?retryWrites=true&w=majority&appName=Cluster0";
const PUBLIC_DIR = path.join(process.cwd(), "public");
const MEDIA_DIR = path.join(PUBLIC_DIR, "media", "news");

// Argumentos
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const PLACEHOLDER_MODE = args.includes("--placeholder");
const limitIndex = args.indexOf("--limit");
const LIMIT = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : Infinity;
const typeIndex = args.indexOf("--type");
const TYPE_FILTER = typeIndex !== -1 ? args[typeIndex + 1] : null;

console.log("🔧 Configuración:");
console.log(`   Dry run: ${DRY_RUN}`);
console.log(`   Placeholder mode: ${PLACEHOLDER_MODE}`);
console.log(`   Limit: ${LIMIT === Infinity ? "sin límite" : LIMIT}`);
console.log(`   Type filter: ${TYPE_FILTER || "todos"}`);
console.log("");

/**
 * Genera un placeholder WebP
 */
async function generatePlaceholder(width = 1280, height = 720) {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="48" 
            fill="#4a5568" text-anchor="middle" dominant-baseline="middle">
        Imagen no disponible
      </text>
    </svg>
  `;
  
  return sharp(Buffer.from(svg))
    .resize(width, height)
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Intenta extraer y descargar imagen desde una URL fuente
 */
async function fetchImageFromSource(sourceUrl) {
  if (!sourceUrl) return null;
  
  try {
    // Importar dinámicamente para evitar problemas de módulos
    const fetch = (await import("node-fetch")).default;
    const cheerio = await import("cheerio");
    
    console.log(`   📥 Fetching: ${sourceUrl.substring(0, 60)}...`);
    
    // Obtener HTML de la página
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Buscar imagen principal usando selectores comunes
    const selectors = [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'article img[src]',
      '.post-content img[src]',
      '.entry-content img[src]',
      'main img[src]',
      '.article-image img[src]'
    ];
    
    let imageUrl = null;
    
    for (const selector of selectors) {
      const el = $(selector).first();
      if (el.length) {
        imageUrl = el.attr("content") || el.attr("src");
        if (imageUrl) break;
      }
    }
    
    if (!imageUrl) {
      console.log(`   ⚠️  No se encontró imagen en la fuente`);
      return null;
    }
    
    // Normalizar URL
    if (imageUrl.startsWith("//")) {
      imageUrl = "https:" + imageUrl;
    } else if (imageUrl.startsWith("/")) {
      const urlObj = new URL(sourceUrl);
      imageUrl = urlObj.origin + imageUrl;
    }
    
    console.log(`   🖼️  Imagen encontrada: ${imageUrl.substring(0, 60)}...`);
    
    // Descargar imagen
    const imgResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": sourceUrl
      },
      timeout: 15000
    });
    
    if (!imgResponse.ok) {
      throw new Error(`Image fetch failed: HTTP ${imgResponse.status}`);
    }
    
    const buffer = await imgResponse.buffer();
    
    // Validar tamaño mínimo
    if (buffer.length < 10000) {
      console.log(`   ⚠️  Imagen muy pequeña (${buffer.length} bytes), descartada`);
      return null;
    }
    
    return buffer;
    
  } catch (error) {
    console.log(`   ❌ Error fetching: ${error.message}`);
    return null;
  }
}

/**
 * Procesa y guarda imagen en múltiples formatos
 */
async function processAndSaveImage(buffer, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  
  const processed = sharp(buffer)
    .resize(1280, 720, { 
      fit: "cover", 
      position: "attention",
      withoutEnlargement: false 
    })
    .modulate({ saturation: 1.08 })
    .sharpen(1.2);
  
  // Guardar JPG
  await processed.clone()
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(targetDir, "cover.jpg"));
  
  // Guardar WebP
  await processed.clone()
    .webp({ quality: 82 })
    .toFile(path.join(targetDir, "cover.webp"));
  
  // Guardar AVIF
  try {
    await processed.clone()
      .avif({ quality: 58 })
      .toFile(path.join(targetDir, "cover.avif"));
  } catch (e) {
    console.log(`   ⚠️  AVIF no soportado: ${e.message}`);
  }
  
  return true;
}

/**
 * Función principal
 */
async function recoverImages() {
  console.log("🚀 Iniciando recuperación de imágenes...\n");
  
  if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI no definida en .env");
    process.exit(1);
  }
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");
    
    const AiDraft = require("../server/models/AiDraft");
    const News = require("../server/models/News");
    
    let missing = [];
    
    // Buscar AiDrafts con imágenes faltantes
    if (!TYPE_FILTER || TYPE_FILTER === "draft") {
      const drafts = await AiDraft.find({
        coverUrl: { $regex: /^\/media\/news\// }
      }).select("_id coverUrl imageKind titulo fuentes").lean();
      
      for (const d of drafts) {
        const imgPath = path.join(PUBLIC_DIR, d.coverUrl);
        try {
          await fs.access(imgPath);
        } catch {
          missing.push({
            type: "draft",
            id: d._id.toString(),
            imageKind: d.imageKind,
            titulo: d.titulo?.substring(0, 60),
            sourceUrl: d.fuentes?.[0]?.url,
            coverUrl: d.coverUrl
          });
        }
      }
    }
    
    // Buscar News con imágenes faltantes
    if (!TYPE_FILTER || TYPE_FILTER === "news") {
      const news = await News.find({
        imagen: { $regex: /^\/media\/news\// }
      }).select("_id imagen imageOriginal titulo").lean();
      
      for (const n of news) {
        const imgPath = path.join(PUBLIC_DIR, n.imagen);
        try {
          await fs.access(imgPath);
        } catch {
          missing.push({
            type: "news",
            id: n._id.toString(),
            titulo: n.titulo?.substring(0, 60),
            sourceUrl: n.imageOriginal,
            coverUrl: n.imagen
          });
        }
      }
    }
    
    console.log(`📊 Encontradas ${missing.length} imágenes faltantes`);
    
    if (missing.length === 0) {
      console.log("✅ No hay imágenes que recuperar");
      return;
    }
    
    // Aplicar límite
    const toProcess = missing.slice(0, LIMIT);
    console.log(`🔄 Procesando ${toProcess.length} imágenes...\n`);
    
    let recovered = 0;
    let failed = 0;
    
    for (const item of toProcess) {
      console.log(`\n[${recovered + failed + 1}/${toProcess.length}] ${item.type}: ${item.id}`);
      console.log(`   📰 ${item.titulo}...`);
      
      // Extraer ID del path para crear directorio
      const match = item.coverUrl.match(/\/media\/news\/([^/]+)\//);
      if (!match) {
        console.log(`   ❌ Path inválido: ${item.coverUrl}`);
        failed++;
        continue;
      }
      
      const newsId = match[1];
      const targetDir = path.join(MEDIA_DIR, newsId);
      
      if (DRY_RUN) {
        console.log(`   🔍 [DRY RUN] Se crearía directorio: ${targetDir}`);
        recovered++;
        continue;
      }
      
      try {
        let imageBuffer = null;
        
        if (!PLACEHOLDER_MODE && item.sourceUrl) {
          // Intentar obtener imagen de la fuente
          imageBuffer = await fetchImageFromSource(item.sourceUrl);
        }
        
        if (imageBuffer) {
          // Procesar y guardar imagen real
          await processAndSaveImage(imageBuffer, targetDir);
          console.log(`   ✅ Imagen recuperada desde fuente`);
          recovered++;
        } else {
          // Generar placeholder
          console.log(`   🎨 Generando placeholder...`);
          const placeholder = await generatePlaceholder();
          await fs.mkdir(targetDir, { recursive: true });
          await fs.writeFile(path.join(targetDir, "cover.webp"), placeholder);
          
          // También crear versión AVIF/JPG del placeholder
          await sharp(placeholder)
            .jpeg({ quality: 80 })
            .toFile(path.join(targetDir, "cover.jpg"));
          
          try {
            await sharp(placeholder)
              .avif({ quality: 50 })
              .toFile(path.join(targetDir, "cover.avif"));
          } catch {}
          
          console.log(`   ⚠️  Placeholder generado`);
          recovered++;
        }
        
        // Pequeña pausa para no saturar
        await new Promise(r => setTimeout(r, 500));
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        failed++;
      }
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("📊 RESUMEN:");
    console.log(`   ✅ Recuperadas: ${recovered}`);
    console.log(`   ❌ Fallidas: ${failed}`);
    console.log(`   📊 Total procesadas: ${recovered + failed}`);
    
    if (missing.length > toProcess.length) {
      console.log(`   ⏳ Pendientes: ${missing.length - toProcess.length}`);
    }
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n📦 Desconectado de MongoDB");
  }
}

// Ejecutar
recoverImages();
