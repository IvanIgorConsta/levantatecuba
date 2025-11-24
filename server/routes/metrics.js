const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Metric = require("../models/Metric");
const { body, validationResult } = require("express-validator");

const verifyToken = require("../middleware/verifyToken");
const verifyRole = require("../middleware/verifyRole");

// ✅ Registrar métrica (público)
router.post(
  "/track",
  [
    body("path").trim().escape().notEmpty().withMessage("La ruta (path) es obligatoria"),
    body("timestamp").optional().isNumeric().withMessage("Timestamp inválido"),
    body("ip").optional().isIP().withMessage("IP inválida"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: "Datos inválidos", detalles: errors.array() });

    try {
      const { path, timestamp, ip } = req.body;

      const nuevaMetrica = new Metric({
        path,
        timestamp: timestamp || Date.now(),
        ip: ip || req.ip,
      });

      await nuevaMetrica.save();

      res.status(201).json({ mensaje: "✅ Métrica registrada correctamente" });
    } catch (error) {
      console.error("❌ Error en /api/metrics/track:", error);
      res.status(500).json({ error: "Error al registrar métrica" });
    }
  }
);

// ✅ Obtener métricas (solo admin)
router.get("/", verifyToken, verifyRole("admin"), async (req, res) => {
  try {
    const metrics = await Metric.find().sort({ timestamp: -1 }).limit(500);
    res.json(metrics);
  } catch (error) {
    console.error("❌ Error al obtener métricas:", error);
    res.status(500).json({ error: "Error al obtener métricas" });
  }
});

module.exports = router;
