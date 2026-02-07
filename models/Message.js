// const mongoose = require('mongoose');

// const messageSchema = new mongoose.Schema({
//   sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
//   // ⚠️ FIX: Removed 'required: true'. 
//   // If null, it means it's a broadcast to the whole Trip.
//   receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
  
//   // Trip is required for context (which trip did this happen in?)
//   trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  
//   text: { type: String, required: true },
//   read: { type: Boolean, default: false }
// }, { timestamps: true });

// module.exports = mongoose.model('Message', messageSchema);

// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },

    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // If null => group message to trip chat
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    text: { type: String, required: true, trim: true, maxlength: 2000 },

    // For reliability: client generates uuid. Server enforces idempotency.
    clientMessageId: { type: String, required: true },

    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Prevent duplicates per sender (same message retried)
messageSchema.index({ sender: 1, clientMessageId: 1 }, { unique: true });

// Useful for fetching trip chat fast
messageSchema.index({ trip: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
