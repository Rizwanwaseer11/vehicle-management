const mongoose = require('mongoose');

const driverLocationSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now }
});

driverLocationSchema.index({ driver: 1, trip: 1 }, { unique: true });

module.exports = mongoose.model('DriverLocation', driverLocationSchema);
