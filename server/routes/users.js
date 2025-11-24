const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const User = require("../models/User");

const verifyToken = require("../middleware/verifyToken");
const verifyRole = require("../middleware/verifyRole");
const { body, validationResult, param } = require("express-validator");

// Configuración de almacenamiento para imágenes de perfil
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// 🔐 Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "Datos inválidos", details: errors.array() });
  }
  next();
};

//
// ✅ RUTAS DE PERFIL (AUTENTICADO)
// Estas deben ir antes de cualquier ruta con :id
//

// Obtener perfil del usuario autenticado
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener perfil." });
  }
});

// Actualizar perfil del usuario autenticado (con imagen opcional)
router.put(
  "/profile",
  verifyToken,
  upload.single("profileImage"),
  async (req, res) => {
    try {
      const { firstName, lastName, nickname } = req.body;
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "Usuario no encontrado." });

      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (nickname !== undefined) user.nickname = nickname;
      if (req.file) {
        user.profileImage = `/uploads/${req.file.filename}`;
      }

      await user.save();

      res.json({ message: "✅ Perfil actualizado correctamente.", user });
    } catch (err) {
      console.error("❌ Error al actualizar perfil:", err);
      res.status(500).json({ error: "Error al actualizar perfil." });
    }
  }
);

//
// ✅ RUTAS ADMIN: LISTAR, CREAR, ACTUALIZAR Y ELIMINAR USUARIOS
//

// Obtener todos los usuarios (solo admin/editor)
router.get("/", verifyToken, verifyRole(["admin", "editor"]), async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener los usuarios." });
  }
});

// Crear nuevo usuario (solo admin)
router.post(
  "/",
  verifyToken,
  verifyRole("admin"),
  [
    body("name").trim().notEmpty().withMessage("El nombre es obligatorio."),
    body("email").isEmail().normalizeEmail().withMessage("Correo inválido."),
    body("password").isLength({ min: 6 }).withMessage("Contraseña muy corta."),
    body("role").isIn(["admin", "editor"]).withMessage("Rol no válido."),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, email, password, role } = req.body;
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ error: "Ese correo ya está registrado." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({ name, email, password: hashedPassword, role });
      const saved = await newUser.save();
      res.status(201).json(saved);
    } catch (err) {
      res.status(400).json({ error: "No se pudo crear el usuario.", details: err.message });
    }
  }
);

// Obtener un usuario por ID
router.get(
  "/:id",
  verifyToken,
  [param("id").isMongoId().withMessage("ID inválido.")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id).select("-password");
      if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
      res.json(user);
    } catch (err) {
      res.status(400).json({ error: "ID inválido." });
    }
  }
);

// Actualizar un usuario por ID (solo admin)
router.put(
  "/:id",
  verifyToken,
  verifyRole("admin"),
  [
    param("id").isMongoId().withMessage("ID inválido."),
    body("name").optional().trim().notEmpty().withMessage("Nombre inválido."),
    body("email").optional().isEmail().normalizeEmail().withMessage("Correo inválido."),
    body("role").optional().isIn(["admin", "editor"]).withMessage("Rol inválido."),
    body("password").optional().isLength({ min: 6 }).withMessage("Contraseña muy corta."),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, email, role, password } = req.body;
      
      // ✅ Protección: no permitir degradar al último admin
      if (role && role !== "admin") {
        const currentUser = await User.findById(req.params.id);
        if (currentUser && currentUser.role === "admin") {
          const adminCount = await User.countDocuments({ role: "admin" });
          if (adminCount <= 1) {
            return res.status(400).json({ 
              error: "No se puede cambiar el rol del último administrador del sistema." 
            });
          }
        }
      }
      
      const updateFields = {};
      if (name) updateFields.name = name;
      if (email) updateFields.email = email;
      if (role) updateFields.role = role;
      if (password) {
        const hashed = await bcrypt.hash(password, 10);
        updateFields.password = hashed;
      }

      const updated = await User.findByIdAndUpdate(req.params.id, updateFields, {
        new: true,
        runValidators: true,
      }).select("-password");

      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: "Error al actualizar el usuario.", details: err.message });
    }
  }
);

// Eliminar un usuario (solo admin)
router.delete(
  "/:id",
  verifyToken,
  verifyRole("admin"),
  [param("id").isMongoId().withMessage("ID inválido.")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const userToDelete = await User.findById(req.params.id);
      if (!userToDelete) return res.status(404).json({ error: "Usuario no encontrado." });
      
      // ✅ Protección: no permitir eliminar al último admin
      if (userToDelete.role === "admin") {
        const adminCount = await User.countDocuments({ role: "admin" });
        if (adminCount <= 1) {
          return res.status(400).json({ 
            error: "No se puede eliminar al último administrador del sistema." 
          });
        }
      }
      
      const deleted = await User.findByIdAndDelete(req.params.id);
      res.json({ message: "Usuario eliminado correctamente." });
    } catch (err) {
      res.status(400).json({ error: "Error al eliminar el usuario." });
    }
  }
);

// Cambiar contraseña por email (admin o editor)
router.post(
  "/reset-password",
  verifyToken,
  verifyRole(["admin", "editor"]),
  [
    body("email").isEmail().normalizeEmail().withMessage("Correo inválido."),
    body("newPassword").isLength({ min: 6 }).withMessage("Contraseña muy corta."),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { email, newPassword } = req.body;
    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ error: "Usuario no encontrado." });

      const hashed = await bcrypt.hash(newPassword, 10);
      user.password = hashed;
      await user.save();

      res.json({ message: "✅ Contraseña actualizada correctamente." });
    } catch (err) {
      res.status(500).json({ error: "Error del servidor al cambiar contraseña." });
    }
  }
);

module.exports = router;
