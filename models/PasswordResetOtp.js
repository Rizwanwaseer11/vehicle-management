const mongoose = require('mongoose');

const passwordResetOtpSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    email: { type: String, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

passwordResetOtpSchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model('PasswordResetOtp', passwordResetOtpSchema);
