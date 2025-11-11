const Trip = require('../models/Trip');

exports.createTrip = async (req, res) => {
  const { driver, routeName, stops } = req.body;
  const trip = await Trip.create({ driver, routeName, stops });
  res.status(201).json(trip);
};

exports.getAllTrips = async (req, res) => {
  const trips = await Trip.find().populate('driver stops.passengers', 'name email profilePic');
  res.json(trips);
};

exports.getTripById = async (req, res) => {
  const trip = await Trip.findById(req.params.id).populate('driver stops.passengers', 'name email profilePic');
  if (!trip) return res.status(404).json({ message: 'Trip not found' });
  res.json(trip);
};

exports.updateTrip = async (req, res) => {
  const trip = await Trip.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!trip) return res.status(404).json({ message: 'Trip not found' });
  res.json(trip);
};

exports.deleteTrip = async (req, res) => {
  const trip = await Trip.findByIdAndDelete(req.params.id);
  if (!trip) return res.status(404).json({ message: 'Trip not found' });
  res.json({ message: 'Trip deleted successfully' });
};
