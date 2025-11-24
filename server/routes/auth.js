const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");
const verifyToken = require("../middleware/verifyToken");
const { generateJWT } = require("../utils/jwtUtils");
const emailService = require("../services/emailService");
const { rateLimitForgotPassword } = require("../middleware/rateLimitForgotPassword");

// ============================================================================
// RATE LIMITING PARA REGISTRO
// ============================================================================
const rateLimitRegister = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 registros por IP cada 15 min
  message: { error: "Demasiados intentos de registro. Intenta de nuevo en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit excedido para registro desde IP: ${req.ip}`);
    res.status(429).json({ error: "Demasiados intentos. Intenta de nuevo más tarde." });
  }
});

// 📌 Registro de usuario externo
router.post(
  "/register",
  rateLimitRegister, // Protección contra abuso
  [
    body("name").trim().notEmpty().withMessage("El nombre es obligatorio"),
    body("email").isEmail().normalizeEmail().withMessage("Email inválido"),
    body("password").isLength({ min: 6 }).withMessage("La contraseña debe tener al menos 6 caracteres"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Datos inválidos", details: errors.array() });
    }

    const { name, email, password } = req.body;

    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ error: "El correo ya está registrado" });

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const nuevoUsuario = new User({
        name,
        email,
        password: hashedPassword,
        role: "user", // 🔐 por defecto son "user"
      });

      await nuevoUsuario.save();

      const token = generateJWT(nuevoUsuario);

      // Enviar email de bienvenida (opcional, no bloquea el registro si falla)
      try {
        await emailService.sendWelcomeEmail(nuevoUsuario);
        console.log(`✅ Welcome email sent to: ${nuevoUsuario.email}`);
      } catch (emailError) {
        console.error(`⚠️ Failed to send welcome email to ${nuevoUsuario.email}:`, emailError.message);
        // No fallar el registro por error de email
      }

      // Respuesta segura (sin password ni datos sensibles)
      const userResponse = {
        _id: nuevoUsuario._id,
        name: nuevoUsuario.name,
        email: nuevoUsuario.email,
        role: nuevoUsuario.role,
        avatar: nuevoUsuario.avatar || "",
        createdAt: nuevoUsuario.createdAt
      };

      res.status(201).json({ token, user: userResponse });
    } catch (err) {
      console.error("❌ Error al registrar usuario:", err);
      res.status(500).json({ error: "Error al registrar" });
    }
  }
);

// ✅ Login
router.post(
  "/login",
  [
    body("email").trim().isEmail().normalizeEmail().withMessage("Email inválido"),
    body("password").trim().isLength({ min: 6 }).withMessage("Contraseña demasiado corta"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Datos inválidos", details: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ error: "Usuario no encontrado" });

      const validPass = await bcrypt.compare(password, user.password);
      if (!validPass) return res.status(400).json({ error: "Contraseña incorrecta" });

      const token = generateJWT(user);
      
      console.debug('[AUTH] login exitoso', { userId: user._id, role: user.role, hasToken: !!token });

      // Respuesta segura (sin password)
      const userResponse = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || "",
        profileImage: user.profileImage || ""
      };

      res.header("Authorization", `Bearer ${token}`).json({ token, user: userResponse });
    } catch (err) {
      console.error("❌ Error en login:", err);
      res.status(500).json({ error: "Error en el servidor" });
    }
  }
);

// ✅ Ruta para obtener el usuario actual si tiene token
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);
  } catch (err) {
    console.error("❌ Error al obtener usuario:", err);
    res.status(500).json({ error: "Error al obtener usuario" });
  }
});

// ============================================================================
// 🔐 FORGOT PASSWORD - Enviar enlace de recuperación
// ============================================================================
router.post(
  "/forgot",
  rateLimitForgotPassword, // Rate limiting: máximo 5 por hora
  [body("email").isEmail().normalizeEmail().withMessage("Email inválido")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: "Email inválido", 
        details: errors.array() 
      });
    }

    try {
      const { email } = req.body;
      
      // Buscar usuario (pero no revelar si existe o no)
      const user = await User.findOne({ email });
      
      // SIEMPRE responder lo mismo por seguridad
      const genericResponse = {
        message: "Si existe una cuenta asociada a este email, te hemos enviado instrucciones para restablecer tu contraseña."
      };

      // Si no existe el usuario, responder igual pero no enviar email
      if (!user) {
        console.log(`🔍 Forgot password request for non-existent email: ${email}`);
        return res.status(200).json(genericResponse);
      }

      // Generar token seguro
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      
      // TTL en minutos (por defecto 30)
      const ttlMinutes = parseInt(process.env.PASSWORD_RESET_TTL_MIN) || 30;
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

      // Guardar solo el hash del token
      user.resetTokenHash = hashedToken;
      user.resetTokenExpires = expiresAt;
      user.resetTokenUsed = false;
      await user.save();

      // Construir enlace de reset
      const baseUrl = process.env.PUBLIC_ORIGIN || 'https://levantatecuba.com';
      const resetLink = `${baseUrl}/reset?token=${rawToken}&email=${encodeURIComponent(email)}`;

      // Enviar email con enlace
      const emailResult = await emailService.sendPasswordResetEmail(email, resetLink);
      
      if (emailResult.success) {
        console.log(`✅ Password reset email sent to: ${email}`);
      } else {
        console.error(`❌ Failed to send reset email to ${email}:`, emailResult.error);
        // No revelar el error al usuario por seguridad
      }

      return res.status(200).json(genericResponse);
    } catch (error) {
      console.error("❌ Error en /auth/forgot:", error);
      return res.status(500).json({ error: "Error del servidor" });
    }
  }
);

// ============================================================================
// 🔄 RESET PASSWORD - Validar token y cambiar contraseña
// ============================================================================
router.post(
  "/reset",
  [
    body("email").isEmail().normalizeEmail().withMessage("Email inválido"),
    body("token").trim().notEmpty().withMessage("Token requerido"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("La contraseña debe tener al menos 8 caracteres")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage("La contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número")
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Datos inválidos",
        details: errors.array()
      });
    }

    try {
      const { email, token, newPassword } = req.body;

      // Buscar usuario
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ error: "Token inválido o expirado" });
      }

      // Verificar que tenga token de reset
      if (!user.resetTokenHash || !user.resetTokenExpires) {
        return res.status(400).json({ error: "Token inválido o expirado" });
      }

      // Verificar que no esté vencido
      if (user.resetTokenExpires < new Date()) {
        // Limpiar token vencido
        user.resetTokenHash = null;
        user.resetTokenExpires = null;
        user.resetTokenUsed = false;
        await user.save();
        
        return res.status(400).json({ error: "Token inválido o expirado" });
      }

      // Verificar que no haya sido usado
      if (user.resetTokenUsed) {
        return res.status(400).json({ error: "Token inválido o expirado" });
      }

      // Verificar token (comparar hash)
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      if (user.resetTokenHash !== hashedToken) {
        return res.status(400).json({ error: "Token inválido o expirado" });
      }

      // Todo válido - cambiar contraseña
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      user.password = hashedPassword;
      
      // Marcar token como usado y limpiar
      user.resetTokenHash = null;
      user.resetTokenExpires = null;
      user.resetTokenUsed = true;
      
      await user.save();

      console.log(`✅ Password reset successful for: ${email}`);
      
      return res.status(200).json({
        message: "Contraseña actualizada exitosamente"
      });
    } catch (error) {
      console.error("❌ Error en /auth/reset:", error);
      return res.status(500).json({ error: "Error del servidor" });
    }
  }
);

module.exports = router;
