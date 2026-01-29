const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  order: { type: Number, required: true }
});

const tripSchema = new mongoose.Schema({
  // ==================================================
  // 1. AUTOMATION FIELDS (The "Brain")
  // ==================================================
  // True = This is a Blueprint. False = This is a real trip.
  isTemplate: { type: Boolean, default: false, index: true }, 

  // Frequency: 'NONE' (One-time), 'DAILY', 'WEEKDAYS', 'WEEKENDS'
  recurrence: { 
    type: String, 
    enum: ['NONE', 'DAILY', 'WEEKDAYS', 'WEEKENDS'], 
    default: 'NONE' 
  },

  // Links a daily trip back to its master template
  parentTripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },

  // ==================================================
  // 2. CORE INFO
  // ==================================================
  routeName: { type: String, required: true, index: true }, 
  polyline: { type: String, required: true }, // Encoded Map String
  totalKm: { type: Number, default: 0, required: true },

  // ==================================================
  // 3. RESOURCES
  // ==================================================
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },

  // ==================================================
  // 4. PLAN & STATUS
  // ==================================================
  stops: [stopSchema], 

  // True = Visible to Scheduler/Passengers. False = Disabled/Hidden.
  isActive: { type: Boolean, default: true }, 

  status: {
    type: String,
    enum: ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'],
    default: 'SCHEDULED'
  },
  
  // ==================================================
  // 5. TIME
  // ==================================================
  // Stores the full Date object (e.g. 2026-01-30T08:30:00.000Z)
  startTime: { type: Date, required: true }, 
  
  endTime: { type: Date },
  currentStopIndex: { type: Number, default: 0 }

}, { timestamps: true });

// Indexes for high-performance searching
tripSchema.index({ driver: 1, status: 1 });
tripSchema.index({ isTemplate: 1, isActive: 1 });

module.exports = mongoose.model('Trip', tripSchema);