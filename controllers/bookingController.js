const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const { getIO } = require('../sockets/socketHandler');

// ==========================================
// 1. GET AVAILABLE ROUTES (For Home List)
// ==========================================
// ==========================================
// 1. GET AVAILABLE ROUTES (For Home List)
// ==========================================
exports.getActiveTrips = async (req, res) => {
  try {
    // Fetch trips that are Scheduled OR Ongoing
    const trips = await Trip.find({ 
      status: { $in: ['SCHEDULED', 'ONGOING'] }
      // Removed "isActive: true" strict check to prevent hiding trips during testing
      // You can re-enable it if your logic strictly manages this boolean
    })
    .populate('driver', 'name email')
    .populate('bus', 'number seatingCapacity model');

    res.status(200).json({ success: true, count: trips.length, data: trips });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load routes." });
  }
};

// ==========================================
// 2. CREATE BOOKING (Snapshot Logic)
// ==========================================
exports.createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { tripId, stopId } = req.body;
    const passengerId = req.user._id;

    // A. Double Booking Check
    const existingBooking = await Booking.findOne({
      passenger: passengerId,
      status: { $in: ['WAITING', 'BOARDED'] }
    });

    if (existingBooking) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Active booking already exists." });
    }

    // B. Find Trip
    const trip = await Trip.findById(tripId).populate('driver bus');
    if (!trip || !trip.isActive) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Trip unavailable." });
    }

    // C. Validate Stop
    const selectedStop = trip.stops.find(s => s._id.toString() === stopId);
    if (!selectedStop) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Invalid Stop ID." });
    }

    // D. Create Booking
    const newBooking = new Booking({
      passenger: passengerId,
      trip: trip._id,
      
      // ✅ SNAPSHOT BUS DETAILS (Saved permanently)
      busNumber: trip.bus ? trip.bus.number : "Unknown Bus",
      busModel: trip.bus ? trip.bus.model : "Standard Bus", 
      driverName: trip.driver ? trip.driver.name : "Unknown Driver",
      groupName: trip.routeName,
      
      // ✅ SNAPSHOT STOP DETAILS
      pickupLocation: {
        stopId: selectedStop._id, 
        name: selectedStop.name,
        lat: selectedStop.latitude,
        lng: selectedStop.longitude
      },
      status: 'WAITING'
    });

    await newBooking.save({ session });
    await session.commitTransaction();

    // E. Notify Driver (Real-time)
    try {
      const io = getIO();
      io.to(`trip_${trip._id}`).emit('new_passenger', {
        message: "New Passenger Added!",
        bookingId: newBooking._id,
        pickupName: selectedStop.name
      });
    } catch (err) { console.log("Socket warning:", err.message); }

    res.status(201).json({ success: true, booking: newBooking });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    session.endSession();
  }
};

// ==========================================
// 3. CANCEL BOOKING
// ==========================================
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({ 
      _id: req.params.bookingId, 
      passenger: req.user._id 
    });

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
    if (['COMPLETED', 'CANCELLED'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: "Ride already ended." });
    }

    booking.status = 'CANCELLED';
    await booking.save();

    try {
      const io = getIO();
      io.to(`trip_${booking.trip}`).emit('passenger_cancelled', { bookingId: booking._id });
    } catch (e) {}

    res.status(200).json({ success: true, message: "Ride cancelled." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==========================================
// 4. CHECK ACTIVE BOOKING (The Critical One)
// ==========================================
exports.getMyCurrentBooking = async (req, res) => {
  try {
    const currentBooking = await Booking.findOne({
      passenger: req.user._id,
      status: { $in: ['WAITING', 'BOARDED'] }
    })
    .populate({
      path: 'trip',
      // ✅ ADD 'startTime' HERE 👇
      select: 'polyline stops routeName driver bus startTime', 
      populate: { 
        path: 'driver bus',
        select: 'name number model' 
      }
    });

    res.status(200).json({ success: true, booking: currentBooking || null });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==========================================
// 5. RIDE HISTORY
// ==========================================
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ passenger: req.user._id })
      .populate({
        path: 'trip',
        select: 'routeName date startTime', // Added startTime here too just in case
        populate: { path: 'driver', select: 'name' }
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==========================================
// 6. DRIVER MANIFEST (For Driver App Later)
// ==========================================
exports.getDriverManifest = async (req, res) => {
  try {
    const { tripId } = req.params;
    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    const activeBookings = await Booking.find({
      trip: tripId,
      status: { $in: ['WAITING', 'BOARDED'] }
    }).populate('passenger', 'name phone');

    const manifest = trip.stops.map(stop => {
      const passengersAtStop = activeBookings.filter(b => 
        b.pickupLocation.stopId?.toString() === stop._id.toString()
      );
      return {
        stopName: stop.name,
        passengers: passengersAtStop.map(p => ({
            id: p.passenger._id,
            name: p.passenger.name,
            status: p.status
        }))
      };
    });

    res.status(200).json({ success: true, manifest });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};