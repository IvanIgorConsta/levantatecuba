/**
 * Script de limpieza para eliminar la colección de Rostros de MongoDB
 * Ejecutar: node scripts/cleanup-rostros.js
 * 
 * IMPORTANTE: Hacer backup antes de ejecutar este script
 */

const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs").promises;
require("dotenv").config();

// Configuración de MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/levantatecuba";

async function cleanupRostros() {
  console.log("🧹 Iniciando limpieza del módulo Rostros...\n");

  try {
    // 1. Conectar a MongoDB
    console.log("📦 Conectando a MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    // 2. Eliminar la colección de rostros
    console.log("🗑️  Eliminando colección 'rostros'...");
    const db = mongoose.connection.db;
    
    // Verificar si la colección existe
    const collections = await db.listCollections().toArray();
    const rostrosExists = collections.some(col => col.name === "rostros");
    
    if (rostrosExists) {
      const result = await db.collection("rostros").drop();
      console.log("✅ Colección 'rostros' eliminada:", result);
    } else {
      console.log("ℹ️  La colección 'rostros' no existe en la base de datos");
    }

    // 3. Limpiar archivos de imágenes
    console.log("\n🖼️  Limpiando archivos de imágenes...");
    const uploadsPath = path.join(__dirname, "../server/uploads/rostros");
    
    try {
      const files = await fs.readdir(uploadsPath);
      
      if (files.length > 0) {
        console.log(`📁 Encontrados ${files.length} archivos en ${uploadsPath}`);
        
        // Crear backup antes de eliminar
        const backupPath = path.join(__dirname, "../server/uploads/rostros_backup_" + Date.now());
        await fs.rename(uploadsPath, backupPath);
        console.log(`✅ Archivos movidos a backup: ${backupPath}`);
      } else {
        console.log("ℹ️  No hay archivos de rostros para limpiar");
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log("ℹ️  El directorio de uploads/rostros no existe");
      } else {
        throw err;
      }
    }

    // 4. Resumen de archivos a eliminar manualmente
    console.log("\n📝 ARCHIVOS PARA ELIMINAR MANUALMENTE:");
    console.log("=====================================");
    const filesToDelete = [
      "server/models/Rostro.js",
      "server/routes/rostros.js",
      "src/admin_dashboard/AdminRostros.jsx",
      "public/rostros/*" // Si hay imágenes estáticas
    ];
    
    filesToDelete.forEach(file => {
      console.log(`  ❌ ${file}`);
    });

    console.log("\n📝 ARCHIVOS TEMPORALES (eliminar después del 28/04/2025):");
    console.log("=========================================================");
    console.log("  ⏰ server/routes/rostros-deprecated.js");

    // 5. Actualización en server.js
    console.log("\n⚠️  RECORDATORIO:");
    console.log("================");
    console.log("Después del 28/04/2025, elimina la línea de rostros-deprecated en server.js:");
    console.log('  app.use("/api/rostros", require("./routes/rostros-deprecated"));');

    console.log("\n✅ Limpieza completada exitosamente!");

  } catch (error) {
    console.error("\n❌ Error durante la limpieza:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n📦 Desconectado de MongoDB");
  }
}

// Confirmación antes de ejecutar
const readline = require("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("⚠️  ADVERTENCIA: Este script eliminará permanentemente todos los datos de Rostros");
console.log("📌 Se recomienda hacer un backup de la base de datos antes de continuar");
console.log("");

rl.question("¿Deseas continuar? (s/n): ", (answer) => {
  if (answer.toLowerCase() === "s" || answer.toLowerCase() === "si") {
    rl.close();
    cleanupRostros();
  } else {
    console.log("❌ Operación cancelada");
    rl.close();
    process.exit(0);
  }
});
