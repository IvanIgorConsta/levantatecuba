const mongoose = require("mongoose");

/**
 * Genera un slug limpio a partir de un título
 * @param {string} title - Título de la noticia
 * @returns {string} - Slug limpio
 */
function generateSlug(title) {
  if (!title) return '';
  
  return title
    .toLowerCase()
    .trim()
    // Normalizar caracteres acentuados
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Reemplazar ñ por n
    .replace(/ñ/g, 'n')
    // Reemplazar espacios y caracteres especiales por guiones
    .replace(/[^a-z0-9]+/g, '-')
    // Eliminar guiones múltiples
    .replace(/-+/g, '-')
    // Eliminar guiones al inicio y final
    .replace(/^-|-$/g, '')
    // Limitar longitud a 80 caracteres
    .substring(0, 80)
    // Eliminar guión final si quedó por el corte
    .replace(/-$/, '');
}

const newsSchema = new mongoose.Schema(
  {
    titulo: {
      type: String,
      required: [true, "El título es obligatorio"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true, // Permite múltiples null mientras se migran noticias antiguas
      index: true,
      trim: true,
    },
    contenido: {
      type: String,
      required: [true, "El contenido es obligatorio"],
      trim: true,
    },
    bajada: {
      type: String,
      trim: true,
      default: "",
    },
    etiquetas: {
      type: [String],
      default: [],
    },
    imagen: {
      type: String,
      trim: true,
      default: "",
    },
    imagenSecundaria: {
      type: String,
      trim: true,
      default: "",
    },
    imagenOpcional: {
      type: String,
      trim: true,
      default: "",
    },
    imagenes: {
      type: [String],
      default: [],
    },
    fecha: {
      type: Date,
      default: Date.now,
    },
    autor: {
      type: String,
      required: true,
      trim: true,
    },
    categoria: {
      type: String,
      trim: true,
      enum: ["General", "Política", "Economía", "Internacional", "Socio político", "Tecnología", "Tendencia", "Deporte"],
      default: "General",
    },
    destacada: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "published"],
      default: "published",
    },
    publishAt: {
      type: Date,
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    // Estado de compartido en Facebook
    facebook_status: {
      type: String,
      enum: ["not_shared", "sharing", "published", "deleted", "error"],
      default: "not_shared"
    },
    facebook_post_id: {
      type: String,
      default: null
    },
    facebook_permalink_url: {
      type: String,
      default: null
    },
    facebook_last_error: {
      type: String,
      default: null
    },
    facebook_attempt_count: {
      type: Number,
      default: 0
    },
    facebook_published_at: {
      type: Date,
      default: null
    },
    facebook_published_by: {
      type: String,
      default: null
    },
    facebook_last_sync_at: {
      type: Date,
      default: null
    },
    facebook_deleted_at: {
      type: Date,
      default: null
    },
    // Timestamp de cuando se adquirió el lock "sharing" (para expiración)
    facebook_sharing_since: {
      type: Date,
      default: null
    },
    
    // Campos para programación automática en Facebook
    eligibleForFacebook: {
      type: Boolean,
      default: false
    },
    publishedToFacebook: {
      type: Boolean,
      default: false
    },
    facebookPublishedAt: {
      type: Date,
      default: null
    },
    
    // Contenido evergreen (análisis, especiales, atemporales)
    isEvergreen: {
      type: Boolean,
      default: false
    },
    
    // Campo legacy para compatibilidad temporal
    share: {
      wa: {
        status: {
          type: String,
          enum: ["none", "opened", "posted", "confirmed", "error"],
          default: "none"
        },
        lastAt: Date,
        error: String
      },
      fb: {
        status: {
          type: String,
          enum: ["none", "posted", "confirmed", "error"],
          default: "none"
        },
        lastAt: Date,
        postId: String,
        permalink: String,
        error: String
      },
      lastSharedAt: Date
    },
    // Metadatos de IA (copiados desde AiDraft al publicar)
    mode: {
      type: String,
      enum: ["factual", "opinion"],
      default: null,
    },
    aiMetadata: {
      categoryConfidence: { type: Number, min: 0, max: 1, default: null },
      originalityScore: { type: Number, min: 0, max: 1, default: null },
      contentOrigin: { 
        type: String, 
        enum: ["ai_synthesized", "source_derived"], 
        default: null 
      },
      model: { type: String, default: "" },
      generatedFrom: { type: String, default: "" }, // ID del borrador original
    },
    // Procesamiento de imágenes
    imageOriginal: {
      type: String,
      trim: true,
      default: null
    },
    imageProcessed: {
      type: Boolean,
      default: false
    },
    processedAt: {
      type: Date,
      default: null
    },
    // Proveedor real que generó la imagen (trackea el proveedor efectivo usado)
    imageProvider: {
      type: String,
      enum: ['dall-e-3', 'dall-e-2', 'hailuo', 'internal', 'stable-diffusion', 'midjourney'],
      default: 'dall-e-3'
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ============================================================================
// PRE-SAVE HOOK: Generar slug automáticamente
// ============================================================================
newsSchema.pre('save', async function(next) {
  // Solo generar slug si no existe y hay título
  if (!this.slug && this.titulo) {
    let baseSlug = generateSlug(this.titulo);
    let slug = baseSlug;
    let counter = 1;
    
    // Verificar unicidad y añadir sufijo si es necesario
    const News = mongoose.model('News');
    while (true) {
      const existing = await News.findOne({ slug, _id: { $ne: this._id } });
      if (!existing) break;
      
      // Añadir sufijo numérico
      slug = `${baseSlug}-${counter}`;
      counter++;
      
      // Prevenir loop infinito
      if (counter > 100) {
        // Usar parte del ID como fallback
        slug = `${baseSlug}-${this._id.toString().slice(-6)}`;
        break;
      }
    }
    
    this.slug = slug;
  }
  next();
});

// Índices para performance en consultas de publicación programada
newsSchema.index({ status: 1, publishAt: 1 });
newsSchema.index({ status: 1, publishedAt: -1 });
// Índices para consultas de Facebook
newsSchema.index({ facebook_status: 1 });
newsSchema.index({ facebook_published_at: -1 });
// Índice para filtrado por categoría
newsSchema.index({ categoria: 1, createdAt: -1 });

// Índices adicionales para Facebook autopublisher (optimización 2025-11)
newsSchema.index({ status: 1, publishedToFacebook: 1, publishedAt: -1 });
newsSchema.index({ status: 1, facebook_status: 1 });
newsSchema.index({ destacada: 1, publishedAt: -1 });

// ============================================================================
// MÉTODO ESTÁTICO: Buscar por slug o ID
// ============================================================================
newsSchema.statics.findBySlugOrId = async function(slugOrId) {
  // Primero intentar buscar por slug
  let news = await this.findOne({ slug: slugOrId });
  
  if (!news) {
    // Si no encontró por slug, verificar si es un ObjectId válido
    const isObjectId = /^[a-f\d]{24}$/i.test(slugOrId);
    if (isObjectId) {
      news = await this.findById(slugOrId);
    }
  }
  
  return news;
};

// Exportar modelo y utilidad
const News = mongoose.models.News || mongoose.model("News", newsSchema);

module.exports = News;
module.exports.generateSlug = generateSlug;
