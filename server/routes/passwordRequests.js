// server/routes/passwordRequests.js
// Rutas para recuperación de contraseña vía email
const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");

const router = express.Router();

const PasswordResetToken = require("../models/PasswordResetToken");
const User = require("../models/User");
const { sendMail } = require("../utils/mailer");

// ===============================
// 1) Solicitud de reset (PÚBLICO)
// POST /api/password/request
// - Genera token y envía enlace por email
// ===============================
router.post(
  "/request",
  [body("email").isEmail().normalizeEmail().withMessage("Email no válido")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ error: "Email inválido", detalles: errors.array() });

    try {
      const { email } = req.body;

      // Seguridad: no revelar si existe/no existe
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(200).json({
          message: "Si el correo existe, se enviará un enlace para restablecer la contraseña.",
        });
      }

      // Generar token 30 minutos
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await PasswordResetToken.create({ userId: user._id, token, expiresAt });

      // Link al frontend
      const base = process.env.PUBLIC_ORIGIN || process.env.APP_BASE_URL || "http://localhost:5173";
      const link = `${base}/reset-password?token=${token}`;

      // Enviar email
      await sendMail({
        to: email,
        subject: "Restablecer contraseña",
        html: `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial">
            <h2>Restablecer contraseña</h2>
            <p>Recibimos una solicitud para restablecer tu contraseña.</p>
            <p>Haz clic en el botón o usa el enlace. El enlace vence en 30 minutos.</p>
            <p>
              <a href="${link}" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
                Definir nueva contraseña
              </a>
            </p>
            <p style="word-break:break-all;">${link}</p>
            <p>Si no solicitaste este cambio, ignora este correo.</p>
          </div>
        `,
      });

      return res.status(200).json({
        message: "Si el correo existe, se enviará un enlace para restablecer la contraseña.",
      });
    } catch (err) {
      console.error("❌ Error en /password/request:", err);
      return res.status(500).json({ error: "Error del servidor" });
    }
  }
);

// ===============================
// 2) Reset con token (PÚBLICO)
// POST /api/password/reset
// body: { token, password }
// ===============================
router.post(
  "/reset",
  [
    body("token").trim().notEmpty().withMessage("Token requerido"),
    body("password").isLength({ min: 6 }).withMessage("Contraseña muy corta"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ error: "Datos inválidos", detalles: errors.array() });

    try {
      const { token, password } = req.body;

      const entry = await PasswordResetToken.findOne({ token, used: false });
      if (!entry || entry.expiresAt < new Date())
        return res.status(400).json({ error: "Token inválido o expirado" });

      const user = await User.findById(entry.userId);
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

      user.password = await bcrypt.hash(password, 10);
      await user.save();

      entry.used = true;
      await entry.save();

      return res.json({ ok: true, message: "Contraseña actualizada" });
    } catch (err) {
      console.error("❌ Error en /password/reset:", err);
      return res.status(500).json({ error: "Error del servidor" });
    }
  }
);

module.exports = router;
