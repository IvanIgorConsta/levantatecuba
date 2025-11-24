const mongoose = require("mongoose");

const passwordRequestSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  resolved: {
    type: Boolean,
    default: false,
  }
}, { timestamps: true });

// ✅ Exportar usando CommonJS (para que funcione con require)
module.exports = mongoose.model("PasswordRequest", passwordRequestSchema);
