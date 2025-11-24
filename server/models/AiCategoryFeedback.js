// server/models/AiCategoryFeedback.js
const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * AiCategoryFeedback
 * Registro de correcciones manuales de categoría para aprendizaje del sistema
 */

const AiCategoryFeedbackSchema = new mongoose.Schema(
  {
    textHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    
    draftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AiDraft',
      index: true
    },
    
    title: {
      type: String,
      required: true,
      trim: true
    },
    
    summary: {
      type: String,
      default: '',
      trim: true
    },
    
    // Categoría asignada automáticamente (original)
    originalCategory: {
      type: String,
      required: true
    },
    
    // Categoría elegida por el editor (corrección)
    chosenCategory: {
      type: String,
      required: true
    },
    
    // Confianza original del sistema
    originalConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    
    // Usuario que hizo la corrección
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    
    // Metadata adicional
    tags: [String],
    contentLength: Number,
    
    // Para análisis posterior
    wasLowConfidence: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Método estático para crear feedback evitando duplicados
AiCategoryFeedbackSchema.statics.createFeedback = async function(data) {
  const { title, summary, draftId, originalCategory, chosenCategory, originalConfidence, createdBy, tags, contentLength, wasLowConfidence } = data;
  
  // Generar hash único para evitar duplicados
  const textHash = crypto
    .createHash('sha1')
    .update(`${title}||${summary}`)
    .digest('hex');
  
  // Intentar crear, si existe actualizar
  const feedback = await this.findOneAndUpdate(
    { textHash },
    {
      draftId,
      title,
      summary,
      originalCategory,
      chosenCategory,
      originalConfidence,
      createdBy,
      tags,
      contentLength,
      wasLowConfidence,
      updatedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  
  return feedback;
};

// Método estático para obtener estadísticas de correcciones
AiCategoryFeedbackSchema.statics.getStats = async function(daysBack = 30) {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: '$chosenCategory',
        count: { $sum: 1 },
        avgOriginalConfidence: { $avg: '$originalConfidence' },
        lowConfidenceCount: { $sum: { $cond: ['$wasLowConfidence', 1, 0] } }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  return stats;
};

module.exports = mongoose.models.AiCategoryFeedback || mongoose.model('AiCategoryFeedback', AiCategoryFeedbackSchema);
