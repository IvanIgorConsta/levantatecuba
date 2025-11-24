const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    noticia: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "News",
      required: true,
    },
    // Campo para el nombre visible del usuario (string)
    usuario: {
      type: String,
      required: true,
      trim: true,
    },
    // Campo para el ID del usuario en la BD (referencia)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Soporte para ambos nombres de campo (texto/contenido)
    texto: {
      type: String,
      required: true,
      trim: true,
    },
    contenido: {
      type: String,
      required: false,
      trim: true,
    },
    // Campo para comentarios anidados
    padre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    respuestas: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      }
    ],
  },
  { timestamps: true }
);

// Virtual para manejar contenido/texto de forma intercambiable
commentSchema.virtual('content').get(function() {
  return this.contenido || this.texto;
});

// Pre-save hook para sincronizar campos
commentSchema.pre('save', function(next) {
  // Sincronizar texto y contenido
  if (!this.texto && this.contenido) {
    this.texto = this.contenido;
  }
  if (!this.contenido && this.texto) {
    this.contenido = this.texto;
  }
  
  // Sincronizar padre y parentId
  if (!this.padre && this.parentId) {
    this.padre = this.parentId;
  }
  if (!this.parentId && this.padre) {
    this.parentId = this.padre;
  }
  
  next();
});

// Índices CRÍTICOS para performance (añadidos 2025-11)
// Sin estos índices, cada query hace table scan completo
commentSchema.index({ noticia: 1, createdAt: -1 }); // Más usado: comentarios por noticia
commentSchema.index({ noticia: 1, padre: 1, createdAt: -1 }); // Comentarios raíz
commentSchema.index({ userId: 1, createdAt: -1 }); // Comentarios por usuario

module.exports = mongoose.model("Comment", commentSchema);
