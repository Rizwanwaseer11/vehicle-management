const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    token: { type: String, required: true, unique: true, index: true },
    provider: { type: String, enum: ['fcm'], default: 'fcm', index: true },
    platform: { type: String, enum: ['android', 'ios', 'unknown'], default: 'unknown' },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
