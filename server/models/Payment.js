const mongoose = require("mongoose");

/**
 * Modelo de Payment para registrar donaciones de Stripe
 * Almacena información completa de transacciones para auditoría y análisis
 */
const paymentSchema = new mongoose.Schema(
  {
    // Identificadores de Stripe
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      description: "ID de la sesión de Stripe Checkout"
    },
    stripeCustomerId: {
      type: String,
      trim: true,
      index: true,
      description: "ID del customer en Stripe"
    },
    
    // Información del pago
    amount: {
      type: Number,
      required: true,
      min: 100, // Mínimo $1.00 USD
      max: 1000000, // Máximo $10,000 USD
      description: "Monto en centavos"
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      enum: ["USD"],
      default: "USD",
      description: "Moneda del pago"
    },
    
    // Estado del pago
    status: {
      type: String,
      required: true,
      enum: ["pending", "completed", "failed", "refunded", "disputed"],
      default: "pending",
      index: true,
      description: "Estado actual del pago"
    },
    
    // Información del donante
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
      description: "Email del donante (si proporcionado)"
    },
    
    // Metadata adicional
    metadata: {
      source: {
        type: String,
        default: "web",
        description: "Origen de la donación (web, mobile, etc.)"
      },
      environment: {
        type: String,
        enum: ["development", "production"],
        default: "production"
      },
      publicOrigin: {
        type: String,
        description: "Dominio desde donde se originó la donación"
      },
      userAgent: {
        type: String,
        description: "User agent del navegador"
      },
      // Metadata personalizada del cliente
      custom: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
        description: "Metadata adicional personalizada"
      }
    },
    
    // Datos específicos de Stripe (para auditoría)
    stripeData: {
      paymentIntent: {
        type: String,
        index: true,
        description: "ID del PaymentIntent de Stripe"
      },
      chargeId: {
        type: String,
        index: true,
        description: "ID del Charge de Stripe"
      },
      paymentStatus: {
        type: String,
        description: "Estado del pago según Stripe"
      },
      mode: {
        type: String,
        enum: ["payment", "subscription", "setup"],
        default: "payment"
      },
      failureCode: {
        type: String,
        description: "Código de error si el pago falló"
      },
      failureMessage: {
        type: String,
        description: "Mensaje de error si el pago falló"
      },
      createdAt: {
        type: Date,
        description: "Fecha de creación en Stripe"
      }
    },
    
    // Información de reembolso (si aplica)
    refund: {
      refundId: {
        type: String,
        description: "ID del reembolso en Stripe"
      },
      amount: {
        type: Number,
        description: "Monto reembolsado en centavos"
      },
      reason: {
        type: String,
        enum: ["duplicate", "fraudulent", "requested_by_customer", "expired_uncaptured_charge"],
        description: "Razón del reembolso"
      },
      refundedAt: {
        type: Date,
        description: "Fecha del reembolso"
      }
    },
    
    // Campos de auditoría
    processedAt: {
      type: Date,
      description: "Fecha cuando se procesó completamente el pago"
    },
    
    // Notas internas (para administración)
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      description: "Notas internas sobre esta donación"
    },
    
    // Flag para donaciones anónimas
    isAnonymous: {
      type: Boolean,
      default: false,
      description: "Si el donante prefiere permanecer anónimo"
    }
  },
  {
    timestamps: true, // Añade createdAt y updatedAt automáticamente
    versionKey: false,
    
    // Configuración de toJSON para APIs
    toJSON: {
      transform: function(doc, ret) {
        // No exponer datos sensibles en APIs públicas
        delete ret.stripeData;
        delete ret.notes;
        return ret;
      }
    }
  }
);

// ============================================================================
// ÍNDICES PARA PERFORMANCE
// ============================================================================

// Índices compuestos para consultas comunes
paymentSchema.index({ status: 1, createdAt: -1 }); // Pagos por estado y fecha
paymentSchema.index({ email: 1, createdAt: -1 }); // Pagos por donante
paymentSchema.index({ amount: -1, createdAt: -1 }); // Pagos por monto
paymentSchema.index({ "metadata.source": 1, createdAt: -1 }); // Pagos por origen

// Índice para búsquedas de texto en notas
paymentSchema.index({ notes: "text" });

// ============================================================================
// MÉTODOS VIRTUALES
// ============================================================================

// Monto en dólares (virtual)
paymentSchema.virtual('amountUSD').get(function() {
  return this.amount / 100;
});

// Estado legible (virtual)
paymentSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    pending: 'Pendiente',
    completed: 'Completado',
    failed: 'Fallido',
    refunded: 'Reembolsado',
    disputed: 'En disputa'
  };
  return statusMap[this.status] || this.status;
});

// ============================================================================
// MÉTODOS DE INSTANCIA
// ============================================================================

/**
 * Marcar pago como completado
 */
paymentSchema.methods.markAsCompleted = function() {
  this.status = 'completed';
  this.processedAt = new Date();
  return this.save();
};

/**
 * Marcar pago como fallido
 */
paymentSchema.methods.markAsFailed = function(failureCode, failureMessage) {
  this.status = 'failed';
  if (failureCode) this.stripeData.failureCode = failureCode;
  if (failureMessage) this.stripeData.failureMessage = failureMessage;
  return this.save();
};

/**
 * Añadir información de reembolso
 */
paymentSchema.methods.addRefund = function(refundId, amount, reason) {
  this.status = 'refunded';
  this.refund = {
    refundId,
    amount,
    reason,
    refundedAt: new Date()
  };
  return this.save();
};

// ============================================================================
// MÉTODOS ESTÁTICOS
// ============================================================================

/**
 * Obtener estadísticas de donaciones
 */
paymentSchema.statics.getStats = async function(dateFrom, dateTo) {
  const match = { status: 'completed' };
  
  if (dateFrom || dateTo) {
    match.createdAt = {};
    if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
    if (dateTo) match.createdAt.$lte = new Date(dateTo);
  }
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalDonations: { $sum: 1 },
        avgAmount: { $avg: '$amount' },
        maxAmount: { $max: '$amount' },
        minAmount: { $min: '$amount' }
      }
    }
  ]);
  
  const result = stats[0] || {
    totalAmount: 0,
    totalDonations: 0,
    avgAmount: 0,
    maxAmount: 0,
    minAmount: 0
  };
  
  // Convertir a dólares
  return {
    totalAmountUSD: result.totalAmount / 100,
    totalDonations: result.totalDonations,
    avgAmountUSD: result.avgAmount / 100,
    maxAmountUSD: result.maxAmount / 100,
    minAmountUSD: result.minAmount / 100
  };
};

/**
 * Buscar pagos por email
 */
paymentSchema.statics.findByEmail = function(email) {
  return this.find({ email: email.toLowerCase() })
    .sort({ createdAt: -1 })
    .select('-stripeData -notes');
};

/**
 * Obtener donaciones recientes
 */
paymentSchema.statics.getRecent = function(limit = 10) {
  return this.find({ status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('amount currency email createdAt metadata.source isAnonymous');
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Pre-save: Validaciones adicionales
paymentSchema.pre('save', function(next) {
  // Asegurar que el email esté en minúsculas
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
  
  // Validar que el monto sea positivo
  if (this.amount <= 0) {
    return next(new Error('El monto debe ser mayor a 0'));
  }
  
  // Si se marca como completado, establecer processedAt
  if (this.status === 'completed' && !this.processedAt) {
    this.processedAt = new Date();
  }
  
  next();
});

// Post-save: Log para auditoría
paymentSchema.post('save', function(doc) {
  console.log(`[Payment] ${doc.isNew ? 'Creado' : 'Actualizado'}: ${doc.sessionId} - $${doc.amountUSD} ${doc.currency} - ${doc.status}`);
});

module.exports = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);

