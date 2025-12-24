const express = require('express');
const router = express.Router();
const Bus = require('../models/Bus');
const Trip = require('../models/Trip');
const { protect, authorizeRoles } = require('../middlewares/auth');

// =====================
// CREATE BUS
// =====================
router.post('/', protect, authorizeRoles('admin'), async (req, res) => {
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
});

// =====================
// EDIT BUS
// =====================
router.put('/:id', protect, authorizeRoles('admin'), async (req, res) => {
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
});

// =====================
// DELETE BUS
// =====================
router.delete('/:id', protect, authorizeRoles('admin'), async (req, res) => {
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
});

module.exports = router;
