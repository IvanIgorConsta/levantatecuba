const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  usuario: {
    type: String,
    trim: true,
    default: "Anónimo",
  },
  mensaje: {
    type: String,
    required: true,
    trim: true,
  },
  fecha: {
    type: Date,
    default: Date.now,
  },
  respuestas: [] // ← lo definimos como array por ahora
});

// Definir respuestas recursivamente
CommentSchema.add({
  respuestas: [CommentSchema] // ahora sí es válido
});

const ReportSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      trim: true,
    },
    contenido: {
      type: String,
      required: [true, "El contenido es obligatorio."],
      trim: true,
    },
    // Campo legacy para compatibilidad (se migrará gradualmente)
    media: {
      type: String,
      default: "",
    },
    // Nuevo campo para múltiples adjuntos con metadatos
    attachments: [{
      url: {
        type: String,
        required: true
      },
      type: {
        type: String, // 'image' o 'video'
        required: true
      },
      mimeType: {
        type: String,
        required: true
      },
      size: {
        type: Number, // en bytes
        required: true
      },
      originalName: {
        type: String,
        required: true
      },
      uploadDate: {
        type: Date,
        default: Date.now
      }
    }],
    fecha: {
      type: Date,
      default: Date.now,
    },
    aprobada: {
      type: Boolean,
      default: false,
    },
    likes: {
      type: Number,
      default: 0,
    },
    likesIPs: {
      type: [String],
      default: [],
    },
    destacada: {
      type: Boolean,
      default: false,
    },
    comentarios: {
      type: [CommentSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.models.Report || mongoose.model("Report", ReportSchema);
