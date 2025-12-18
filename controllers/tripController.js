const Trip = require('../models/Trip');
const User= require(../models/User");
exports.createTrip = async (req, res) => {
  try {
    const { driver, routeName, stops, totalKm, starttime, endtime } = req.body;

    // Validation
    if (!driver || typeof driver !== 'string') {
      return res.status(400).json({ error: "Driver is required and should be a string." });
    }

    if (!routeName || typeof routeName !== 'string') {
      return res.status(400).json({ error: "Route name is required and should be a string." });
    }

    if (!Array.isArray(stops) || stops.length === 0) {
      return res.status(400).json({ error: "Stops are required and should be a non-empty array." });
    } else {
      // Optional: Validate each stop object
      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        if (!stop.name || !stop.latitude || !stop.longitude) {
          return res.status(400).json({ error: `Each stop must have name, latitude, and longitude. Error at stop index ${i}` });
        }
      }
    }

    if (!totalKm || typeof totalKm !== 'number') {
      return res.status(400).json({ error: "Total kilometers are required and should be a number." });
    }

    if (!starttime || isNaN(Date.parse(starttime))) {
      return res.status(400).json({ error: "Start time is required and should be a valid date/time." });
    }

    if (!endtime || isNaN(Date.parse(endtime))) {
      return res.status(400).json({ error: "End time is required and should be a valid date/time." });
    }

    // Create the trip
    const trip = await Trip.create({ driver, routeName, stops, totalKm, starttime, endtime });

    return res.status(201).json(trip);
  } catch (error) {
    console.error("Error creating trip:", error);
    return res.status(500).json({ error: "Something went wrong while creating the trip." });
  }
};


exports.getAllTrips = async (req, res) => {
  const trips = await Trip.find().populate('driver stops.passengers', 'name email profilePic');
  res.json(trips);
};

// ----------------- FIND AVAILABLE DRIVERS -----------------
exports.findAvailableDrivers = async (req, res) => {
  try {
    // 1️⃣ Find all active trips
    const activeTripDrivers = await Trip.find({ isActive: true }).distinct("driver");

    // 2️⃣ Find drivers NOT assigned to active trips
    const availableDrivers = await User.find({
      role: "driver",
      isActive: true,
      status: "approved",
      _id: { $nin: activeTripDrivers },
    }).select("_id name email phone");

    res.status(200).json({
      success: true,
      count: availableDrivers.length,
      drivers: availableDrivers,
    });
  } catch (error) {
    console.error("Available drivers error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch available drivers" });
  }
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


