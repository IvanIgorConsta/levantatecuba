const mongoose = require("mongoose");

const rostroSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    descripcion: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true, // incluye createdAt y updatedAt
  }
);

module.exports = mongoose.model("Rostro", rostroSchema);
