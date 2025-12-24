const mongoose = require('mongoose');

const busSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true }, // Bus number plate
  model: { type: String, required: true },               // Model name
  seatingCapacity: { type: Number, required: true },
  isActive: { type: Boolean, default: true }             // Optional: to mark maintenance
}, { timestamps: true });

module.exports = mongoose.model('Bus', busSchema);
