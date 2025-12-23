const Trip = require('../models/Trip');
const User = require('../models/User');

exports.createTrip = async (req, res) => {
  try {
    const { driver, routeName, stops, totalKm, startTime, endTime, bus } = req.body;

    // Driver
    if (!driver || typeof driver !== 'string') {
      return res.status(400).json({ error: "Driver is required." });
    }

    // Route name
    if (!routeName || typeof routeName !== 'string') {
      return res.status(400).json({ error: "Route name is required." });
    }

    // Stops
    if (!Array.isArray(stops) || stops.length === 0) {
      return res.status(400).json({ error: "At least one stop is required." });
    }

    for (let i = 0; i < stops.length; i++) {
      const { name, latitude, longitude } = stops[i];

      if (!name) {
        return res.status(400).json({ error: `Stop ${i + 1}: name is required.` });
      }

      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          error: `Stop ${i + 1}: latitude and longitude are required.`,
        });
      }

      if (isNaN(Number(latitude)) || isNaN(Number(longitude))) {
        return res.status(400).json({
          error: `Stop ${i + 1}: latitude & longitude must be numbers.`,
        });
      }
    }

    // Total KM
    if (totalKm === undefined || totalKm === null || isNaN(Number(totalKm))) {
      return res.status(400).json({
        error: "Total kilometers are required and must be a number.",
      });
    }

    // Time validation
    if (!startTime || isNaN(Date.parse(startTime))) {
      return res.status(400).json({ error: "Valid startTime is required." });
    }

    if (!endTime || isNaN(Date.parse(endTime))) {
      return res.status(400).json({ error: "Valid endTime is required." });
    }

    if (new Date(endTime) <= new Date(startTime)) {
      return res.status(400).json({
        error: "End time must be after start time.",
      });
    }

    // Create trip (✅ USE CORRECT VARIABLE NAMES)
    const trip = await Trip.create({
      driver,
      routeName,
      stops: stops.map(s => ({
        name: s.name,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
      })),
      totalKm: Number(totalKm),
      startTime,
      endTime,
      bus: bus || null,
    });

    return res.status(201).json(trip);

  } catch (error) {
    console.error("Error creating trip:", error);
    return res.status(500).json({
      error: "Something went wrong while creating the trip.",
    });
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