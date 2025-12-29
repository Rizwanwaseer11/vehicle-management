const Trip = require('../models/Trip');
const User = require('../models/User');

// ---------------- CREATE TRIP ----------------
exports.createTrip = async (req, res) => {
  try {
    const { driver, routeName, stops, totalKm, startTime, endTime, bus, routePolyline } = req.body;

    // --------- Validations ---------
    if (!driver || typeof driver !== 'string') {
      return res.status(400).json({ error: "Driver is required." });
    }

    if (!routeName || typeof routeName !== 'string') {
      return res.status(400).json({ error: "Route name is required." });
    }

    if (!Array.isArray(stops) || stops.length === 0) {
      return res.status(400).json({ error: "At least one stop is required." });
    }

    stops.forEach((stop, i) => {
      const { name, latitude, longitude, order } = stop;
      if (!name) throw { message: `Stop ${i + 1}: name is required.` };
      if (latitude === undefined || longitude === undefined) throw { message: `Stop ${i + 1}: latitude & longitude are required.` };
      if (isNaN(Number(latitude)) || isNaN(Number(longitude))) throw { message: `Stop ${i + 1}: latitude & longitude must be numbers.` };
      if (order === undefined || isNaN(Number(order))) throw { message: `Stop ${i + 1}: order is required and must be a number.` };
    });

    if (totalKm === undefined || isNaN(Number(totalKm))) {
      return res.status(400).json({ error: "Total kilometers are required and must be a number." });
    }

    if (!startTime || isNaN(Date.parse(startTime))) {
      return res.status(400).json({ error: "Valid startTime is required." });
    }

    if (!endTime || isNaN(Date.parse(endTime))) {
      return res.status(400).json({ error: "Valid endTime is required." });
    }

    if (new Date(endTime) <= new Date(startTime)) {
      return res.status(400).json({ error: "End time must be after start time." });
    }

    // --------- Create Trip ---------
    const trip = await Trip.create({
      driver,
      routeName,
      stops: stops.map(s => ({
        name: s.name,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        order: Number(s.order),
        passengers: s.passengers || []
      })),
      totalKm: Number(totalKm),
      startTime,
      endTime,
      bus: bus || null,
      routePolyline: routePolyline || ''
    });

    return res.status(201).json({
      success: true,
      trip,
      message: "Trip created successfully."
    });

  } catch (error) {
    console.error("Error creating trip:", error);
    return res.status(500).json({ error: error.message || "Something went wrong while creating the trip." });
  }
};

// ---------------- GET ALL TRIPS ----------------
exports.getAllTrips = async (req, res) => {
  try {
    const trips = await Trip.find()
      .populate("driver", "name email profilePic")
      .populate("stops.passengers", "name email profilePic")
      .populate("bus", "number model seatingCapacity isActive");

    res.status(200).json({
      success: true,
      count: trips.length,
      trips,
      message: trips.length ? "Trips fetched successfully" : "No trips found"
    });
  } catch (error) {
    console.error("Get trips error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch trips" });
  }
};

// ---------------- GET TRIP BY ID ----------------
exports.getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate("driver", "name email profilePic")
      .populate("stops.passengers", "name email profilePic")
      .populate("bus", "number model seatingCapacity isActive");

    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });

    res.json({ success: true, trip });
  } catch (error) {
    console.error("Get trip by ID error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch trip" });
  }
};

// ---------------- UPDATE TRIP ----------------
exports.updateTrip = async (req, res) => {
  try {
    const trip = await Trip.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    res.json({ success: true, trip, message: "Trip updated successfully." });
  } catch (error) {
    console.error("Update trip error:", error);
    res.status(500).json({ success: false, message: "Failed to update trip" });
  }
};

// ---------------- DELETE TRIP ----------------
exports.deleteTrip = async (req, res) => {
  try {
    const trip = await Trip.findByIdAndDelete(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    res.json({ success: true, message: "Trip deleted successfully" });
  } catch (error) {
    console.error("Delete trip error:", error);
    res.status(500).json({ success: false, message: "Failed to delete trip" });
  }
};

// ---------------- FIND AVAILABLE DRIVERS ----------------
exports.findAvailableDrivers = async (req, res) => {
  try {
    // Drivers already assigned to active trips
    const activeTripDrivers = await Trip.find({ isActive: true }).distinct("driver");

    // Drivers NOT assigned
    const availableDrivers = await User.find({
      role: "driver",
      isActive: true,
      status: "approved",
      _id: { $nin: activeTripDrivers }
    }).select("_id name email phone");

    res.status(200).json({
      success: true,
      count: availableDrivers.length,
      drivers: availableDrivers
    });
  } catch (error) {
    console.error("Available drivers error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch available drivers" });
  }
};
