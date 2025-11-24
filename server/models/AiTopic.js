// server/models/AiTopic.js
const mongoose = require('mongoose');

const aiTopicSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    default: 'levantatecuba',
    index: true
  },
  idTema: {
    type: String,
    required: true,
    unique: true,
    default: () => `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  tituloSugerido: {
    type: String,
    required: true,
    trim: true
  },
  resumenBreve: {
    type: String,
    required: true,
    maxlength: 500
  },
  impacto: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  confianza: {
    type: String,
    enum: ['Baja', 'Media', 'Alta'],
    default: 'Media'
  },
  fuentesTop: [{
    medio: { type: String, required: true },
    titulo: { type: String, required: true },
    url: { type: String, required: true },
    fecha: { type: Date, required: true }
  }],
  categoriaSugerida: {
    type: String,
    default: 'General'
  },
  imageUrl: {
    type: String,
    default: null
  },
  detectedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'selected', 'generated', 'archived'],
    default: 'pending'
  },
  selectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  selectedAt: Date,
  archivedAt: {
    type: Date,
    default: null
  },
  metadata: {
    recencia: Number,
    consenso: Number,
    autoridad: Number,
    tendencia: Number,
    relevanciaCuba: Number,
    novedad: Number
  }
}, {
  timestamps: true
});

// Índices para búsquedas eficientes
aiTopicSchema.index({ detectedAt: -1 });
aiTopicSchema.index({ impacto: -1 });
aiTopicSchema.index({ status: 1, detectedAt: -1 });
aiTopicSchema.index({ categoriaSugerida: 1 });

// Índices compuestos para multi-tenant y queries frecuentes
aiTopicSchema.index({ tenantId: 1, createdAt: -1 });
aiTopicSchema.index({ tenantId: 1, status: 1, impacto: -1 });
aiTopicSchema.index({ tenantId: 1, confianza: 1, detectedAt: -1 });

module.exports = mongoose.model('AiTopic', aiTopicSchema);
