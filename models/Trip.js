const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  order: { type: Number, required: true }
});

const tripSchema = new mongoose.Schema({
  // 1. Core Route Info
  routeName: { type: String, required: true, index: true }, 
  
  // ✅ MAP DATA: Must be provided by Frontend (Admin Panel)
  polyline: { type: String, required: true }, 
  
  totalKm: { type: Number, default: 0, required: true },
  
  // 2. Resources (Driver & Bus)
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
  
  // 3. The Plan
  stops: [stopSchema], 

  // 4. Status Flow
  isActive: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'],
    default: 'SCHEDULED'
  },
  
  // 5. Time (Only Start Time needed)
  startTime: { type: Date, required: true }, 
  
  // 6. Real-time Tracking
  currentStopIndex: { type: Number, default: 0 }

}, { timestamps: true });

module.exports = mongoose.model('Trip', tripSchema);