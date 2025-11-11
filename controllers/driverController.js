const Trip = require('../models/Trip');
const DriverLocation = require('../models/DriverLocation');
const Message = require('../models/Message');
const User = require('../models/User');

// Get all assigned trips for the driver
exports.getAssignedTrips = async (req, res) => {
  const trips = await Trip.find({ driver: req.user._id }).populate('stops.passengers', 'name email profilePic');
  res.json(trips);
};

// Start a trip
exports.startTrip = async (req, res) => {
  const trip = await Trip.findById(req.params.tripId);
  if (!trip || trip.driver.toString() !== req.user._id.toString())
    return res.status(403).json({ message: 'Not authorized' });

  trip.status = 'running';
  trip.startedAt = new Date();
  await trip.save();
  res.json(trip);
};

// End a trip
exports.endTrip = async (req, res) => {
  const trip = await Trip.findById(req.params.tripId);
  if (!trip || trip.driver.toString() !== req.user._id.toString())
    return res.status(403).json({ message: 'Not authorized' });

  trip.status = 'completed';
  trip.endedAt = new Date();
  await trip.save();
  res.json(trip);
};

// Get next stop of the trip
exports.getNextStop = async (req, res) => {
  const trip = await Trip.findById(req.params.tripId).populate('stops.passengers', 'name');
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  const nextStop = trip.stops.find(stop => !stop.completed);
  res.json(nextStop || { message: 'All stops completed' });
};

// Get passengers count per stop
exports.getPassengersCount = async (req, res) => {
  const trip = await Trip.findById(req.params.tripId).populate('stops.passengers', 'name');
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  const stop = trip.stops.id(req.params.stopId);
  if (!stop) return res.status(404).json({ message: 'Stop not found' });

  res.json({ stopName: stop.name, passengersCount: stop.passengers.length });
};
