// server/models/CostLog.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * CostLog - Registro de costos por operación (LLM, imagen, scan)
 * Permite calcular métricas de costo promedio y total
 */
const CostLogSchema = new Schema(
  {
    tenantId: {
      type: String,
      default: 'levantatecuba',
      index: true
    },
    
    // Tipo de operación
    type: {
      type: String,
      enum: ['llm', 'image', 'scan', 'other'],
      required: true,
      index: true
    },
    
    // Costo en USD
    costUSD: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    
    // Referencia al draft (si aplica)
    draftId: {
      type: Schema.Types.ObjectId,
      ref: 'AiDraft',
      default: null,
      index: true
    },
    
    // Referencia al topic (si aplica)
    topicId: {
      type: String,
      default: null,
      index: true
    },
    
    // Metadata adicional
    metadata: {
      model: { type: String, default: '' },
      provider: { type: String, default: '' },
      tokensUsed: { type: Number, default: 0 },
      duration: { type: Number, default: 0 }, // ms
      success: { type: Boolean, default: true }
    }
  },
  { timestamps: true }
);

// Índices compuestos para queries frecuentes
CostLogSchema.index({ createdAt: -1 });
CostLogSchema.index({ tenantId: 1, createdAt: -1 });
CostLogSchema.index({ tenantId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.models.CostLog || mongoose.model('CostLog', CostLogSchema);
