const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const verifyToken = require("../middleware/verifyToken");
const verifyRole = require("../middleware/verifyRole");
const Rostro = require("../models/Rostro");

// 📦 Configuración de Multer para subir imagen
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "./uploads/rostros";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("❌ Tipo de archivo no permitido"), false);
  },
});

// ✅ Obtener todos los rostros
router.get("/", async (req, res) => {
  try {
    const rostros = await Rostro.find().sort({ createdAt: -1 });
    res.json(rostros);
  } catch (err) {
    console.error("❌ Error al obtener rostros:", err);
    res.status(500).json({ error: "Error al obtener rostros" });
  }
});

// ✅ Subir nuevo rostro (solo admins y editores)
router.post(
  "/",
  verifyToken,
  verifyRole(["admin", "editor"]),
  upload.single("imagen"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Imagen requerida" });

      const nuevoRostro = new Rostro({
        url: `/uploads/rostros/${req.file.filename}`,
        descripcion: "", // Eliminamos el campo, solo imagen
      });

      const guardado = await nuevoRostro.save();
      res.status(201).json(guardado);
    } catch (err) {
      console.error("❌ Error al guardar rostro:", err);
      res.status(500).json({ error: "Error al guardar rostro" });
    }
  }
);

// ✅ Eliminar rostro
router.delete("/:id", verifyToken, verifyRole(["admin", "editor"]), async (req, res) => {
  try {
    const eliminado = await Rostro.findByIdAndDelete(req.params.id);
    if (!eliminado) return res.status(404).json({ error: "Rostro no encontrado" });

    // Eliminar imagen del sistema de archivos
    const ruta = path.join(__dirname, "..", eliminado.url);
    if (fs.existsSync(ruta)) fs.unlinkSync(ruta);

    res.json({ mensaje: "✅ Rostro eliminado correctamente" });
  } catch (err) {
    console.error("❌ Error al eliminar rostro:", err);
    res.status(500).json({ error: "Error al eliminar rostro" });
  }
});

module.exports = router;
