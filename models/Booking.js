const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  passenger: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  trip: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Trip', 
    required: true 
  },

  // ✅ SNAPSHOTS (The Receipt)
  groupName: { type: String, required: true },
  driverName: { type: String, required: true },
  
  // Stores value from Bus.number (e.g., "ABC-1234")
  busNumber: { type: String, required: true }, 

  // ✅ NEW: Stores value from Bus.model (e.g., "Toyota Coaster")
  busModel: { type: String, required: true },

  // ✅ LOCATION DATA
  pickupLocation: {
    stopId: { type: mongoose.Schema.Types.ObjectId, required: true }, 
    name: { type: String, default: "Map Pin" },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },

  status: {
    type: String,
    enum: ['WAITING', 'BOARDED', 'NO_SHOW', 'CANCELLED'],
    default: 'WAITING'
  },

  date: { type: Date, default: Date.now }
}, { timestamps: true });

bookingSchema.index({ passenger: 1, date: -1 });
bookingSchema.index({ status: 1, date: -1 });
bookingSchema.index({ busNumber: 1, date: -1 });
bookingSchema.index({ groupName: 1, date: -1 });
bookingSchema.index({ driverName: 1, date: -1 });
bookingSchema.index({ "pickupLocation.name": 1, date: -1 });
bookingSchema.index({ trip: 1, date: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
