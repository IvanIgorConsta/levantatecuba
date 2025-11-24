// server/redactor_ia/services/mediaStore.js
const fs = require('fs');
const path = require('path');

// CORREGIDO: Guardar en server/uploads/ai_drafts/ que SÍ está servido por Express
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'ai_drafts');

/**
 * Asegura que el directorio de uploads existe
 */
function ensureDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    console.log(`[MediaStore] Directorio creado: ${UPLOAD_DIR}`);
  }
}

/**
 * Guarda una imagen en base64 como archivo PNG
 * @param {string} base64 - Datos en base64 (sin prefijo data:image/png;base64,)
 * @param {string} filename - Nombre del archivo (ej: draft_abc123.png)
 * @returns {Promise<{filePath: string, publicUrl: string}>}
 */
async function saveBase64Png(base64, filename) {
  ensureDir();
  
  const filePath = path.join(UPLOAD_DIR, filename);
  const buffer = Buffer.from(base64, 'base64');
  
  await fs.promises.writeFile(filePath, buffer);
  
  // URL pública accesible desde el frontend
  const publicUrl = `/uploads/ai_drafts/${filename}`;
  
  console.log(`[MediaStore] Imagen guardada: ${publicUrl}`);
  
  return { filePath, publicUrl };
}

/**
 * Elimina un archivo si existe
 * @param {string} filename - Nombre del archivo a eliminar
 */
async function deleteFile(filename) {
  try {
    const filePath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`[MediaStore] Archivo eliminado: ${filename}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[MediaStore] Error eliminando archivo ${filename}:`, error.message);
    return false;
  }
}

module.exports = {
  saveBase64Png,
  deleteFile,
  ensureDir
};
