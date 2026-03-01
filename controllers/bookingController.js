const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const { getIO } = require('../utils/socket');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendToUsers } = require('../utils/pushService');
// const { getIO } = require('../sockets/socketHandler');

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
      isActive: true,
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
      status: { $in: ['WAITING'] }
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
      io.to(`trip:${trip._id}`).emit('new_passenger', {
        message: "New Passenger Added!",
        bookingId: newBooking._id,
        pickupName: selectedStop.name
      });
    } catch (err) { console.log("Socket warning:", err.message); }

    // F. Notify Driver (Push for offline)
    try {
      const driverId = trip.driver?._id;
      if (driverId) {
        const title = 'New Passenger';
        const body = `${selectedStop.name} pickup booked.`;
        await Notification.create({
          title,
          body,
          sender: passengerId,
          receivers: [driverId]
        });
        await sendToUsers({
          userIds: [driverId],
          title,
          body,
          data: {
            type: 'NEW_BOOKING',
            tripId: String(trip._id),
            bookingId: String(newBooking._id)
          },
          priority: 'high'
        });
      }
    } catch (err) {
      console.log('New booking push error:', err.message);
    }

    // G. Notify Admins (Dashboard + Push)
    try {
      const admins = await User.find({
        role: { $in: ['admin', 'employee'] },
        isActive: true,
        status: 'approved'
      }).select('_id').lean();

      const adminIds = admins.map((u) => u._id);
      if (adminIds.length) {
        const title = 'New Booking';
        const body = `${req.user?.name || 'Passenger'} booked ${selectedStop.name} on ${trip.routeName || 'a route'}.`;

        await Notification.create({
          title,
          body,
          sender: passengerId,
          receivers: adminIds
        });

        await sendToUsers({
          userIds: adminIds,
          title,
          body,
          data: {
            type: 'NEW_BOOKING_ADMIN',
            tripId: String(trip._id),
            bookingId: String(newBooking._id),
            routeName: trip.routeName || '',
            busNumber: trip.bus?.number || '',
            stopName: selectedStop.name
          },
          priority: 'normal'
        });
      }
    } catch (err) {
      console.log('New booking admin notify error:', err.message);
    }

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
    if (booking.status !== 'WAITING') {
      return res.status(400).json({ success: false, message: "Only waiting bookings can be cancelled." });
    }

    booking.status = 'CANCELLED';
    await booking.save();

    try {
      const io = getIO();
      io.to(`trip:${booking.trip}`).emit('passenger_cancelled', { bookingId: booking._id });
    } catch (e) {}

    // Notify Driver (Push)
    try {
      const trip = await Trip.findById(booking.trip).select('driver').lean();
      const driverId = trip?.driver;
      if (driverId) {
        const title = 'Booking Cancelled';
        const body = 'A passenger cancelled their ride.';
        await Notification.create({
          title,
          body,
          sender: req.user._id,
          receivers: [driverId]
        });
        await sendToUsers({
          userIds: [driverId],
          title,
          body,
          data: {
            type: 'BOOKING_CANCELLED',
            tripId: String(booking.trip),
            bookingId: String(booking._id)
          },
          priority: 'normal'
        });
      }
    } catch (e) {
      console.log('Cancel booking push error:', e.message);
    }

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
      status: { $in: ['WAITING', 'BOARDED', 'NO_SHOW'] }
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
// 7. ADMIN: GET ALL BOOKINGS (Filters + Paging)
// ==========================================
exports.getAllBookingsAdmin = async (req, res) => {
  try {
    const {
      date,
      startDate,
      endDate,
      busNumber,
      routeName,
      stopName,
      passengerName,
      driverName,
      status,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (busNumber) {
      query.busNumber = { $regex: busNumber.trim(), $options: "i" };
    }

    if (routeName) {
      query.groupName = { $regex: routeName.trim(), $options: "i" };
    }

    if (stopName) {
      query["pickupLocation.name"] = { $regex: stopName.trim(), $options: "i" };
    }

    if (driverName) {
      query.driverName = { $regex: driverName.trim(), $options: "i" };
    }

    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    } else if (startDate || endDate) {
      const range = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        range.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
      if (Object.keys(range).length) {
        query.date = range;
      }
    }

    if (passengerName) {
      const passengers = await User.find({
        name: { $regex: passengerName.trim(), $options: "i" },
        role: "passenger"
      }).select("_id").lean();
      const ids = passengers.map((p) => p._id);
      query.passenger = { $in: ids };
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const [total, data] = await Promise.all([
      Booking.countDocuments(query),
      Booking.find(query)
        .populate("passenger", "name email phone")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum)
    ]);

    res.status(200).json({
      success: true,
      total,
      count: data.length,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==========================================
// 8. ADMIN: UPDATE BOOKING STATUS ONLY
// ==========================================
exports.updateBookingStatusAdmin = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['WAITING', 'BOARDED', 'NO_SHOW', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).populate("passenger", "name");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    try {
      const title = 'Booking Status Updated';
      const body = `Your booking status is now ${status}.`;
      await Notification.create({
        title,
        body,
        sender: req.user._id,
        receivers: [booking.passenger?._id]
      });
      if (booking.passenger?._id) {
        await sendToUsers({
          userIds: [booking.passenger._id],
          title,
          body,
          data: {
            type: 'BOOKING_STATUS_UPDATED',
            bookingId: String(booking._id),
            status
          },
          priority: 'normal'
        });
      }
    } catch (e) {
      console.log('Admin status notify error:', e.message);
    }

    res.status(200).json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      status: { $in: ['WAITING', 'BOARDED', 'NO_SHOW'] }
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
