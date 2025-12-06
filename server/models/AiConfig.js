// server/models/AiConfig.js
const mongoose = require('mongoose');

const aiConfigSchema = new mongoose.Schema({
  // Solo debe existir un documento de configuración
  singleton: {
    type: Boolean,
    default: true,
    unique: true
  },
  
  // Configuración de escaneo
  scanFrequency: {
    type: String,
    enum: ['manual', '2h', '3h', '4h', '6h', '12h', '24h'],
    default: '3h'
  },
  
  autoGenerateImages: {
    type: Boolean,
    default: true
  },
  
  // Captura automática de imágenes del sitio fuente (mutuamente exclusivo con autoGenerateImages)
  autoCaptureImageFromSourceOnCreate: {
    type: Boolean,
    default: false
  },
  
  maxTopicsPerScan: {
    type: Number,
    default: 8,
    min: 1,
    max: 20
  },
  
  minSourcesForHighConfidence: {
    type: Number,
    default: 3,
    min: 1,
    max: 10
  },
  
  suggestOptimalFrequency: {
    type: Boolean,
    default: true
  },
  
  // Whitelist de fuentes RSS
  rssWhitelist: [{
    nombre: String,
    url: String,
    autoridad: { type: Number, default: 50 },
    enabled: { type: Boolean, default: true }
  }],
  
  // Allowlist obligatoria de fuentes confiables sobre Cuba
  trustedSources: {
    type: [String],
    default: [
      // Medios internacionales verificados
      'bbc.com', 'bbc.co.uk', 'reuters.com', 'apnews.com', 'afp.com',
      'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'elpais.com',
      // Medios especializados en Cuba (independientes verificados)
      'cubanet.org', '14ymedio.com', 'diariodecuba.com', 'cibercuba.com',
      'martinoticias.com', 'adncuba.com', 'ddcuba.com',
      'oncubamagazine.com', 'cubanosporelmundo.com',
      // Agencias de noticias
      'efe.com', 'dpa.de', 'france24.com',
      // Medios estatales cubanos (menor prioridad pero permitidos para contraste)
      // EXCLUIDO: cubadebate.cu
      'granma.cu', 'prensa-latina.cu', 'prensalatina.cu',
      'jrebelde.cu', 'trabajadores.cu', 'radiohc.cu', 'cubaperiodistas.cu',
      'ain.cu', 'acn.cu'
    ]
  },
  
  enforceSourceAllowlist: {
    type: Boolean,
    default: false
  },
  
  // Tenant por defecto (multi-tenant preparado)
  defaultTenant: {
    type: String,
    default: 'levantatecuba'
  },
  
  // Configuración de NewsAPI
  newsApiEnabled: {
    type: Boolean,
    default: true
  },
  
  newsApiKey: {
    type: String,
    default: process.env.NEWS_API_KEY || ''
  },
  
  // Keywords de relevancia para Cuba
  cubaKeywords: {
    type: [String],
    default: [
      'Cuba', 'cubano', 'La Habana', 'Díaz-Canel',
      'economía cubana', 'política cubana', 'disidencia',
      'derechos humanos Cuba', 'bloqueo', 'reforma económica'
    ]
  },
  
  // Modo Cuba estricto (filtro duro)
  strictCuba: {
    type: Boolean,
    default: false
  },
  
  // Configuración de Freshness (priorizar noticias recientes)
  freshnessWindowHours: {
    type: Number,
    default: 48, // 2 días por defecto
    min: 12,
    max: 168 // Máximo 7 días
  },
  
  perSourceCap: {
    type: Number,
    default: 5, // Máximo 5 artículos por fuente
    min: 1,
    max: 10
  },
  
  // Configuración de IA
  aiModel: {
    type: String,
    default: 'claude-sonnet-4.5-thinking',
    enum: ['claude-sonnet-4.5-thinking', 'claude-opus', 'gpt-4o', 'gpt-4o-mini']
  },
  
  // Debug: Logging detallado de generación de borradores
  debugGeneration: {
    type: Boolean,
    default: false
  },
  
  imageProvider: {
    type: String,
    default: 'dall-e-3',
    enum: ['dall-e-3', 'dall-e-2', 'hailuo', 'stable-diffusion', 'midjourney']
  },
  
  // Ponderaciones para cálculo de impacto
  impactWeights: {
    recencia: { type: Number, default: 0.2 },
    consenso: { type: Number, default: 0.15 },
    autoridad: { type: Number, default: 0.15 },
    tendencia: { type: Number, default: 0.15 },
    relevanciaCuba: { type: Number, default: 0.2 },
    novedad: { type: Number, default: 0.15 }
  },
  
  // Estadísticas para sugerencias
  statistics: {
    avgTopicsPerScan: Number,
    avgDraftsApproved: Number,
    avgCostPerDraft: Number,
    lastOptimizationSuggestion: Date,
    suggestedFrequency: String
  },
  
  // Control de ejecución
  lastScanAt: Date,
  nextScanAt: Date,
  isScanning: {
    type: Boolean,
    default: false
  },
  
  // Configuración de programación automática de publicaciones
  autoScheduleEnabled: {
    type: Boolean,
    default: false
  },
  autoScheduleInterval: {
    type: Number,
    default: 10, // minutos entre publicaciones
    min: 5,
    max: 120
  },
  autoScheduleStartHour: {
    type: Number,
    default: 7, // 07:00
    min: 0,
    max: 23
  },
  autoScheduleEndHour: {
    type: Number,
    default: 23, // 23:00
    min: 0,
    max: 23
  },
  
  // Configuración de programación automática en Facebook
  facebookScheduler: {
    enabled: {
      type: Boolean,
      default: false
    },
    intervalMinutes: {
      type: Number,
      default: 30, // minutos entre publicaciones en Facebook
      min: 10,
      max: 120
    },
    startHour: {
      type: Number,
      default: 9, // 09:00
      min: 0,
      max: 23
    },
    endHour: {
      type: Number,
      default: 23, // 23:00
      min: 0,
      max: 23
    },
    maxPerDay: {
      type: Number,
      default: 0, // 0 = sin límite
      min: 0,
      max: 50
    },
    lastPublishedAt: Date
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Método estático para obtener o crear configuración
aiConfigSchema.statics.getSingleton = async function() {
  let config = await this.findOne({ singleton: true });
  if (!config) {
    config = await this.create({ singleton: true });
  }
  return config;
};

// Método para calcular sugerencia de frecuencia óptima
// Fórmula: temas_útiles = temas_detectados × tasa_selección × tasa_aprobación
aiConfigSchema.methods.calculateOptimalFrequency = function() {
  const { statistics } = this;
  
  // Si está en modo manual, no sugerir cambios
  if (this.scanFrequency === 'manual') {
    return 'manual';
  }
  
  if (!statistics || !statistics.avgTopicsPerScan) {
    return this.scanFrequency; // Sin datos, mantener actual
  }
  
  const { avgTopicsPerScan, avgDraftsApproved, avgDraftsGenerated } = statistics;
  
  // Calcular tasas
  const selectionRate = avgDraftsGenerated / avgTopicsPerScan || 0; // % de temas seleccionados
  const approvalRate = avgDraftsApproved / avgDraftsGenerated || 0; // % de borradores aprobados
  
  // Temas útiles por ciclo
  const temasUtiles = avgTopicsPerScan * selectionRate * approvalRate;
  
  // Objetivo: 2-4 temas útiles por ciclo
  const objetivo = 3;
  
  // Frecuencias disponibles (ordenadas de mayor a menor frecuencia)
  const frequencies = ['2h', '3h', '4h', '6h'];
  const currentIndex = frequencies.indexOf(this.scanFrequency);
  
  // Si la frecuencia actual no está en la lista (ej: '12h' o '24h'), usar default
  if (currentIndex === -1) {
    return this.scanFrequency;
  }
  
  let suggestedIndex = currentIndex;
  
  // Reglas con histéresis (no cambiar más de 1 nivel)
  if (temasUtiles >= objetivo + 1) {
    // Demasiados temas útiles → reducir frecuencia (índice mayor)
    suggestedIndex = Math.min(currentIndex + 1, frequencies.length - 1);
  } else if (temasUtiles <= objetivo - 1) {
    // Muy pocos temas útiles → aumentar frecuencia (índice menor)
    suggestedIndex = Math.max(currentIndex - 1, 0);
  }
  // Si está en rango [objetivo-1, objetivo+1], mantener actual
  
  return frequencies[suggestedIndex];
};

module.exports = mongoose.model('AiConfig', aiConfigSchema);
