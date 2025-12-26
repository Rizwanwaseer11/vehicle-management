const express = require('express');
const router = express.Router();
const Bus = require('../models/Bus');
const Trip = require('../models/Trip');


// =====================
// CREATE BUS
// =====================
exports.createBus = async (req, res) => {
  try {
    const { number, model, seatingCapacity } = req.body;

    // Manual validation
    if (!number || typeof number !== 'string' || number.trim() === '') {
      return res.status(400).json({ message: 'Bus number is required and must be a string' });
    }
    if (!model || typeof model !== 'string' || model.trim() === '') {
      return res.status(400).json({ message: 'Bus model is required and must be a string' });
    }
    if (seatingCapacity === undefined || seatingCapacity === null || typeof seatingCapacity !== 'number' || seatingCapacity < 1) {
      return res.status(400).json({ message: 'Seating capacity is required and must be a number greater than 0' });
    }

    // Check if bus number exists
    const existingBus = await Bus.findOne({ number: number.trim() });
    if (existingBus) {
      return res.status(400).json({ message: 'Bus with this number already exists' });
    }

    // Check if this bus is assigned to any active trip
    const assignedTrip = await Trip.findOne({ bus: existingBus?._id, isActive: true });
    if (assignedTrip) {
      return res.status(400).json({ message: 'This bus is already assigned to an active trip' });
    }

    // Create bus
    const bus = await Bus.create({ number: number.trim(), model: model.trim(), seatingCapacity });
    res.status(201).json({ message: 'Bus created successfully', bus });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

//gell All Buses
exports.getAllBuses = async (req, res) => {
  try {
    // Fetch all buses from DB
    const buses = await Bus.find().select("_id number model seatingCapacity isActive");

    // Send directly as an array
    res.status(200).json(buses);
  } catch (error) {
    console.error("Get all buses error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch buses",
    });
  }
};

//get available buses
exports.getAvailableBuses = async (req, res) => {
  try {
    // 1️⃣ Find all active trips and get assigned bus IDs
    const activeTripBuses = await Trip.find({ isActive: true }).distinct("bus");

    // 2️⃣ Find buses NOT assigned to active trips
    const availableBuses = await Bus.find({
      isActive: true,          // Bus should be active (not under maintenance)
      _id: { $nin: activeTripBuses }, // Exclude buses already in active trips
    }).select("_id number model seatingCapacity");

    res.status(200).json({
      success: true,
      count: availableBuses.length,
      buses: availableBuses,
      message: availableBuses.length
        ? "Available buses fetched successfully"
        : "No available buses at the moment",
    });
  } catch (error) {
    console.error("Available buses error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available buses",
    });
  }
}
// =====================
// EDIT BUS
// =====================
exports.editBus =  async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: 'Bus not found' });

    const { number, model, seatingCapacity } = req.body;

    if (number && typeof number === 'string' && number.trim() !== '') bus.number = number.trim();
    if (model && typeof model === 'string' && model.trim() !== '') bus.model = model.trim();
    if (seatingCapacity && typeof seatingCapacity === 'number' && seatingCapacity > 0) bus.seatingCapacity = seatingCapacity;

    await bus.save();
    res.json({ message: 'Bus updated successfully', bus });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// =====================
// DELETE BUS
// =====================
exports.deleteBus = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: 'Bus not found' });

    // Check if bus is assigned to any active trip
    const trips = await Trip.find({ bus: bus._id, isActive: true });
    if (trips.length > 0) {
      return res.status(400).json({
        message: 'This bus is assigned to active trips. Please assign another bus to those trips first.'
      });
    }

    await bus.deleteOne();
    res.json({ message: 'Bus deleted successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};


