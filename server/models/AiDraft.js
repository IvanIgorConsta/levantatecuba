// server/models/AiDraft.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * AiDraft
 * Borrador generado por IA a partir de un topic.
 *
 * Cambios clave:
 * - generatedBy: ahora es opcional (default: null) para permitir generación automática por el sistema.
 * - generationType: 'manual' | 'auto' para distinguir el origen de la creación del borrador.
 * - reviewedBy, reviewedAt, reviewStatus, reviewNotes: campos de revisión editorial (opcionales).
 */

const VerificationSchema = new Schema(
  {
    hecho: { type: String, trim: true },
    found_in: [{ type: String, trim: true }],
    confidence: { type: Number, min: 0, max: 100 },
  },
  { _id: false }
);

const FuenteSchema = new Schema(
  {
    medio: { type: String, trim: true },
    titulo: { type: String, trim: true },
    url: { type: String, trim: true },
    fecha: { type: String, trim: true },
    imageUrl: { type: String, trim: true }, // URL de imagen de la fuente original
  },
  { _id: false }
);

const AiDraftSchema = new Schema(
  {
    tenantId: { type: String, index: true, required: true },
    topicId: { type: String, index: true, required: true },

    titulo: { type: String, required: true, trim: true },
    bajada: { type: String, default: '', trim: true },

    categoria: { type: String, default: '', index: true },
    etiquetas: [{ type: String, trim: true }],

    contenidoMarkdown: { type: String, default: '' },
    contenidoHTML: { type: String, default: '' },

    fuentes: { type: [FuenteSchema], default: [] },
    verifications: { type: [VerificationSchema], default: [] },

    promptsImagen: {
      principal: { type: String, default: '' },
      opcional: { type: String, default: '' },
    },

    generatedImages: {
      principal: { type: String, default: '' },
      opcional: { type: String, default: '' },
    },

    // URL pública permanente de la portada persistida
    coverImageUrl: { type: String, default: '' },
    
    // URLs específicas de cover con formatos modernos
    coverUrl: { type: String, default: '' }, // AVIF o WebP
    coverFallbackUrl: { type: String, default: '' }, // JPG universal
    coverHash: { type: String, default: '' }, // SHA-256 para cache busting
    
    // Tipo de imagen generada: 'processed' (de fuente), 'ai' (IA), 'editorial' (foto real) o 'placeholder'
    imageKind: { 
      type: String, 
      enum: ['processed', 'ai', 'placeholder', 'external', 'internal', 'editorial'], 
      default: null 
    },
    
    // Proveedor real que generó la imagen (trackea el proveedor efectivo usado)
    imageProvider: {
      type: String,
      enum: ['dall-e-3', 'dall-e-2', 'hailuo', 'internal', 'stable-diffusion', 'midjourney'],
      default: 'dall-e-3'
    },
    
    // Estado del proceso de generación de imagen: 'processing', 'ready', 'error'
    imageStatus: {
      type: String,
      enum: ['processing', 'ready', 'error', null],
      default: null
    },
    
    // Metadatos finos de la imagen generada
    imageMeta: {
      variant: { type: String, default: '' }, // 'likeness' | 'context' | 'editorial'
      provider: { type: String, default: '' }, // 'dall-e-3', 'gettyimages.com', etc.
      reference: { type: String, default: '' }, // URL de referencia si hay
      context: { type: String, default: '' }, // contextId seleccionado
      likeness: { type: Boolean, default: false }, // Si usa semejanza de persona
      contextKeywords: [{ type: String }], // Keywords que dispararon el contexto
      country: { type: String, default: null }, // País detectado
      economicLevel: { type: String, default: 'neutral' }, // 'rich' | 'moderate' | 'poor' | 'neutral'
      
      // Metadatos específicos de imagen editorial
      editorialPerson: { type: String, default: null }, // Nombre de la persona si es editorial
      editorialSource: { type: String, default: null }, // URL de la página fuente
      editorialLicense: { type: String, default: null }, // Tipo de licencia (Public, Share, etc.)
      editorialProvider: { type: String, default: null }, // Dominio del proveedor (gettyimages.com, etc.)
    },
    
    // Control de persistencia de imágenes generadas
    generatedImagesPersisted: {
      principal: { type: Boolean, default: false },
    },

    // Cambio: ahora opcional; null cuando lo genera el sistema
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // Para distinguir el origen de la creación del borrador
    generationType: {
      type: String,
      enum: ['manual', 'auto'],
      default: 'manual',
      index: true,
    },

    // Campos de revisión editorial (opcionales)
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    reviewedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null, index: true }, // Fecha de aprobación específica
    reviewStatus: {
      type: String,
      enum: ['pending', 'approved', 'changes_requested', 'changes_in_progress', 'changes_completed', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewNotes: { type: String, default: '' },
    
    // Sistema de seguimiento de cambios
    changesRequested: [{ type: String }], // Lista de cambios solicitados por el revisor
    lastApprovedContent: { type: String, default: '' }, // HTML de la última versión aprobada
    previousContent: { type: String, default: '' }, // Snapshot de versión inmediatamente anterior

    // Referencia a la noticia publicada (si el borrador fue convertido a noticia)
    publishedAs: { type: Schema.Types.ObjectId, ref: 'News', default: null, index: true },
    
    // Fecha de aprobación/publicación
    publishedAt: { type: Date, default: null },
    
    // Sistema de programación de publicaciones
    scheduledAt: { type: Date, default: null, index: true }, // Fecha programada para publicación automática
    publishStatus: { 
      type: String, 
      enum: ['pendiente', 'programado', 'publicado'], 
      default: 'pendiente',
      index: true 
    },

    mode: { type: String, enum: ['factual', 'opinion'], default: 'factual' },

    status: {
      type: String,
      enum: ['draft', 'published', 'archived', 'rejected'],
      default: 'draft',
      index: true,
    },

    // Sistema de revisión asistida por IA
    review: {
      requestedNotes: { type: String, default: '' },
      requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      requestedAt: { type: Date, default: null },
      proposed: { type: String, default: '' },
      diff: { type: String, default: '' },
      status: {
        type: String,
        enum: ['pending', 'ready', 'error', 'applied', null],
        default: null
      },
      errorMsg: { type: String, default: '' },
      errorAt: { type: Date, default: null },
      appliedAt: { type: Date, default: null },
      appliedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      model: { type: String, default: '' },
      generationTime: { type: Number, default: 0 },
      finishedAt: { type: Date, default: null },
      history: [{
        content: { type: String },
        appliedAt: { type: Date },
        appliedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        notes: { type: String }
      }]
    },

    aiMetadata: {
      model: { type: String, default: '' },
      tokensUsed: { type: Number, default: 0 },
      generationTime: { type: Number, default: 0 },
      confidence: { type: Number, min: 0, max: 100, default: 0 },
      imageGenerationEnabled: { type: Boolean, default: false },
      imageProvider: { type: String, default: '' },
      rawResponse: { type: String, default: '' },
      originalityScore: { type: Number, min: 0, max: 1, default: 0.5 },
      contentOrigin: { 
        type: String, 
        enum: ['ai_synthesized', 'source_derived'], 
        default: 'source_derived' 
      },
      categoryConfidence: { type: Number, min: 0, max: 1, default: 0.5 },
      categoryLowConfidence: { type: Boolean, default: false },
      categoryDetail: { type: String, default: '' },
      // Pipeline encadenado (extraer→referenciar→DALL-E)
      usedSource: { type: Boolean, default: false },
      referenceUrl: { type: String, default: null },
    },
  },
  { timestamps: true }
);

/** @fix Claude 4.5 – Corrección flujo de imágenes procesadas Redactor IA (2025-10) */
/**
 * Validación suave:
 * - Si generationType === 'manual', recomendamos (no requerimos duro) que haya generatedBy.
 *   Usamos una validación personalizada que solo lanza warning en consola para no romper flujos.
 * - No muestra warning si es generación automática o si la imagen es procesada internamente.
 */
AiDraftSchema.pre('validate', function (next) {
  if (this.generationType === 'manual' && !this.generatedBy) {
    // Solo mostrar warning si no es un proceso automático de imagen
    const isInternalImage = this.aiMetadata?.imageProvider === 'internal';
    if (!isInternalImage) {
      console.warn(
        '[AiDraft] Advertencia: borrador marcado como "manual" sin generatedBy. Considera asignar el usuario.'
      );
    }
  }
  next();
});

// Índices adicionales para consultas de revisión y publicación (añadidos 2025-11)
AiDraftSchema.index({ reviewStatus: 1, approvedAt: -1 }); // Consultas de revisión
AiDraftSchema.index({ publishStatus: 1, scheduledAt: 1 }); // Borradores programados
AiDraftSchema.index({ status: 1, createdAt: -1 }); // Búsqueda por estado
AiDraftSchema.index({ tenantId: 1, status: 1, reviewStatus: 1 }); // Queries combinadas multi-tenant

module.exports = mongoose.models.AiDraft || mongoose.model('AiDraft', AiDraftSchema);
