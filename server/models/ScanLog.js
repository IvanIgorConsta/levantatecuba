// server/models/ScanLog.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * ScanLog - Registro de escaneos realizados
 * Permite calcular promedio de temas por escaneo
 */
const ScanLogSchema = new Schema(
  {
    tenantId: {
      type: String,
      default: 'levantatecuba',
      index: true
    },
    
    // Cantidad de temas encontrados
    topicsFound: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    
    // Tipo de escaneo
    scanType: {
      type: String,
      enum: ['manual', 'scheduled', 'auto', 'cuba_estricto'],
      default: 'scheduled'
    },
    
    // Fuentes escaneadas
    sources: {
      newsapi: { type: Boolean, default: false },
      rss: { type: Boolean, default: false },
      cibercuba: { type: Number },
      eltoque: { type: Number },
      martinoticias: { type: Number }
    },
    
    // Duración en ms
    duration: {
      type: Number,
      default: 0
    },
    
    // Resultado
    status: {
      type: String,
      enum: ['success', 'partial', 'failed'],
      default: 'success'
    },
    
    // Error (si lo hubo)
    error: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

// Índices para queries frecuentes
ScanLogSchema.index({ createdAt: -1 });
ScanLogSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.models.ScanLog || mongoose.model('ScanLog', ScanLogSchema);
