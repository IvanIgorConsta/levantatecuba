/**
 * Script para generar OG image y logo para Google
 * Ejecutar con: node scripts/generate-og-images.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const PUBLIC_IMG = path.join(__dirname, '../public/img');
const DIST_IMG = path.join(__dirname, '../dist/img');

async function generateImages() {
  console.log('🎨 Generando imágenes OG y logo...\n');

  // Usar el logo existente como fuente
  const logoPath = path.join(PUBLIC_IMG, 'levantatecubaLogo.png');
  
  if (!fs.existsSync(logoPath)) {
    console.error('❌ No se encontró el logo fuente en:', logoPath);
    process.exit(1);
  }

  // ========================================
  // TAREA 1: OG Image (1200x630) - Logo sobre fondo negro
  // ========================================
  console.log('1️⃣ Creando og-default.jpg (1200×630)...');
  
  try {
    // Obtener metadata del logo original
    const logoMeta = await sharp(logoPath).metadata();
    console.log(`   Logo original: ${logoMeta.width}x${logoMeta.height}`);

    // Redimensionar logo para que quepa bien (máx 550px de ancho/alto)
    const logoResized = await sharp(logoPath)
      .resize(550, 550, { 
        fit: 'inside',
        withoutEnlargement: false 
      })
      .toBuffer();

    const resizedMeta = await sharp(logoResized).metadata();
    
    // Calcular posición centrada horizontalmente, ligeramente arriba del centro vertical
    const ogWidth = 1200;
    const ogHeight = 630;
    const logoWidth = resizedMeta.width;
    const logoHeight = resizedMeta.height;
    
    const left = Math.round((ogWidth - logoWidth) / 2);
    const top = Math.round((ogHeight - logoHeight) / 2) - 30; // 30px arriba del centro

    // Crear imagen OG con fondo negro
    const ogBuffer = await sharp({
      create: {
        width: ogWidth,
        height: ogHeight,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    })
    .composite([{
      input: logoResized,
      left: left,
      top: Math.max(0, top)
    }])
    .jpeg({ quality: 85 })
    .toBuffer();

    // Guardar en ambas ubicaciones
    const ogDist = path.join(DIST_IMG, 'og-default.jpg');
    const ogPublic = path.join(PUBLIC_IMG, 'og-default.jpg');
    
    fs.writeFileSync(ogDist, ogBuffer);
    fs.writeFileSync(ogPublic, ogBuffer);
    
    const ogSize = (ogBuffer.length / 1024).toFixed(1);
    console.log(`   ✅ og-default.jpg creado (${ogSize} KB)`);
    console.log(`      → ${ogDist}`);
    console.log(`      → ${ogPublic}\n`);

  } catch (err) {
    console.error('❌ Error creando OG image:', err.message);
  }

  // ========================================
  // TAREA 2: Logo Organization (512x512) para Google
  // ========================================
  console.log('2️⃣ Creando logo-organization.png (512×512)...');
  
  try {
    // Redimensionar el logo a 512x512 manteniendo aspecto, fondo negro
    const logoResized = await sharp(logoPath)
      .resize(450, 450, { 
        fit: 'inside',
        withoutEnlargement: false 
      })
      .toBuffer();

    const resizedMeta = await sharp(logoResized).metadata();
    
    // Centrar en lienzo 512x512 negro
    const canvasSize = 512;
    const left = Math.round((canvasSize - resizedMeta.width) / 2);
    const top = Math.round((canvasSize - resizedMeta.height) / 2);

    const logoBuffer = await sharp({
      create: {
        width: canvasSize,
        height: canvasSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      }
    })
    .composite([{
      input: logoResized,
      left: left,
      top: top
    }])
    .png({ quality: 90 })
    .toBuffer();

    // Guardar en ambas ubicaciones
    const logoDist = path.join(DIST_IMG, 'logo-organization.png');
    const logoPublic = path.join(PUBLIC_IMG, 'logo-organization.png');
    
    fs.writeFileSync(logoDist, logoBuffer);
    fs.writeFileSync(logoPublic, logoBuffer);
    
    const logoSize = (logoBuffer.length / 1024).toFixed(1);
    console.log(`   ✅ logo-organization.png creado (${logoSize} KB)`);
    console.log(`      → ${logoDist}`);
    console.log(`      → ${logoPublic}\n`);

  } catch (err) {
    console.error('❌ Error creando logo:', err.message);
  }

  console.log('✨ ¡Proceso completado!');
}

generateImages().catch(console.error);
