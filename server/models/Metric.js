const mongoose = require('mongoose');

const metricSchema = new mongoose.Schema({
  path: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  ip: {
    type: String,
    default: '',
  }
}, { timestamps: true });

module.exports = mongoose.model('Metric', metricSchema);
