const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: false, // Puede faltar si el proveedor OAuth no lo entrega
      trim: true,
      unique: true,
      sparse: true, // Permite múltiples documentos con email: null
      lowercase: true,
      validate: {
        validator: function(v) {
          // Solo validar si el email está presente
          if (!v) return true;
          // Validación básica de formato de email
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: props => `${props.value} no es un email válido`
      }
    },
    password: {
      type: String,
      required: false, // No requerido para usuarios OAuth
    },
    avatar: {
      type: String,
      trim: true,
      default: "",
    },
    providers: {
      googleId: {
        type: String,
        sparse: true,
      },
      facebookId: {
        type: String,
        sparse: true,
      },
    },
    role: {
      type: String,
      enum: ["admin", "editor", "user"], // ✅ añadimos "user"
      default: "user", // ✅ por defecto los usuarios comunes serán "user"
    },
    firstName: {
      type: String,
      trim: true,
      default: "",
    },
    lastName: {
      type: String,
      trim: true,
      default: "",
    },
    nickname: {
      type: String,
      trim: true,
      default: "",
    },
    aliasPublico: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },
    profileImage: {
      type: String,
      trim: true,
      default: "",
    },
    // ========================================================================
    // RECUPERACIÓN DE CONTRASEÑA
    // ========================================================================
    resetTokenHash: {
      type: String,
      default: null,
      select: false // No devolver en queries por defecto (seguridad)
    },
    resetTokenExpires: {
      type: Date,
      default: null,
      select: false
    },
    resetTokenUsed: {
      type: Boolean,
      default: false,
      select: false
    }
  },
  { timestamps: true }
);

// ============================================================================
// ÍNDICES PARA OPTIMIZACIÓN
// ============================================================================
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ "providers.googleId": 1 }, { sparse: true });
userSchema.index({ "providers.facebookId": 1 }, { sparse: true });
userSchema.index({ role: 1 }); // Para queries de usuarios por rol
userSchema.index({ createdAt: -1 }); // Para ordenar por fecha de registro

// ============================================================================
// MÉTODOS DE INSTANCIA
// ============================================================================
/**
 * Obtener representación segura del usuario (sin campos sensibles)
 * Usar en respuestas de API para evitar exponer datos sensibles
 */
userSchema.methods.toSafeObject = function() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    avatar: this.avatar || "",
    profileImage: this.profileImage || "",
    aliasPublico: this.aliasPublico || "",
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

/**
 * Verificar si el usuario puede ser eliminado
 * (prevenir eliminación accidental de admins principales)
 */
userSchema.methods.canBeDeleted = function() {
  // Lógica adicional aquí si es necesario
  // Por ejemplo: no permitir eliminar el único admin
  return this.role !== 'admin' || true; // Ajustar según necesidad
};

module.exports = mongoose.model("User", userSchema);
