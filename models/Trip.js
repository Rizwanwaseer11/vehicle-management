const { required } = require('joi');
const mongoose = require('mongoose');

// const stopSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   latitude: { type: Number, required: true },
//   longitude: { type: Number, required: true },
//   passengers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
// });

const stopSchema = new mongoose.Schema({
   name: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  order: {tyep : Number, required : true},

  passengers: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['WAITING', 'BOARDED', 'MISSED'],
      default: 'WAITING'
    }
  }]
});

const tripSchema = new mongoose.Schema({
   routeName: { type: String, required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
   bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
 
  stops: [stopSchema],
  isActive: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'],
    default: 'SCHEDULED'
  },
    currentStopIndex: { type: Number, default: 0 },
  startTime: { type: Date },
  endTime: { type: Date },
  totalKm: { type: Number, default: 0 ,required: true}
}, { timestamps: true });



module.exports = mongoose.model('Trip', tripSchema);
