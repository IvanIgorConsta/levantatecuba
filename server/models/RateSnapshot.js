const mongoose = require("mongoose");

const rateSnapshotSchema = new mongoose.Schema(
  {
    fuente: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    tasas: [
      {
        moneda: {
          type: String,
          required: true,
          trim: true,
        },
        cup: {
          type: String,
          required: false,
          trim: true,
          default: "-",
        },
        mlc: {
          type: String,
          required: false,
          trim: true,
          default: "-",
        },
        usd: {
          type: String,
          required: false,
          trim: true,
          default: "-",
        },
      }
    ],
    norm: [
      {
        code: {
          type: String,
          required: true,
          trim: true,
        },
        cup: {
          type: Number,
          required: false,
        },
        mlc: {
          type: Number,
          required: false,
        },
        usd: {
          type: Number,
          required: false,
        },
      }
    ],
    fetchedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.models.RateSnapshot || mongoose.model("RateSnapshot", rateSnapshotSchema);
