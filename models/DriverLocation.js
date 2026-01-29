const mongoose = require('mongoose');

const driverLocationSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, // One active location per driver
  trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  heading: { type: Number, default: 0 }, // 0-360 degrees for map icon rotation
  speed: { type: Number, default: 0 },
  socketId: { type: String }, // To handle disconnects in clusters
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

// Auto-expire old locations after 24 hours to keep DB clean
driverLocationSchema.index({ lastUpdated: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('DriverLocation', driverLocationSchema);