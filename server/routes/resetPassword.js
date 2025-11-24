// routes/resetPassword.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");
const verifyRole = require("../middleware/verifyRole");

// ✅ Ruta para resetear la contraseña
router.post("/reset-password", verifyToken, verifyRole(["admin", "editor"]), async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: "Email y nueva contraseña requeridos" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Contraseña actualizada correctamente" });
  } catch (err) {
    console.error("❌ Error al actualizar contraseña:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

module.exports = router;
