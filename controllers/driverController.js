const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const Booking = require('../models/Booking');
const DriverLocation = require('../models/DriverLocation');
const { getIO } = require('../utils/socket'); 
const Notification = require('../models/Notification');
const { sendToUsers } = require('../utils/pushService');

// ==========================================
// 1. SMART DASHBOARD (Crash Recovery & Schedule)
// ==========================================
exports.getDriverDashboard = async (req, res) => {
  try {
    const driverId = req.user._id;
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);

    // A. CRASH CHECK: Is there an unfinished ONGOING trip?
    // This logic allows the driver to reboot their phone and immediately resume.
    const activeTrip = await Trip.findOne({
      driver: driverId,
      status: 'ONGOING'
    })
    .populate('bus', 'number model seatingCapacity')
    .lean();

    // If active trip exists, FORCE the app to Live Screen
    if (activeTrip) {
      // Fetch the full manifest so the UI creates the list immediately
      const manifest = await getPassengerManifest(activeTrip._id);
      
      return res.status(200).json({
        success: true,
        state: 'ONGOING', // Frontend: Switch to Live Map
        trip: { ...activeTrip, manifest }
      });
    }

    // B. SCHEDULE CHECK: Get Assigned Trips
    // We fetch trips for today and the future to keep the schedule populated
    const scheduledTrips = await Trip.find({
      driver: driverId,
      status: 'SCHEDULED',
      startTime: { $gte: todayStart } // Only show future/today trips
    })
    .populate('bus', 'number model')
    .sort({ startTime: 1 }) // Show earliest first
    .lean();

    return res.status(200).json({
      success: true,
      state: 'IDLE', // Frontend: Show Trip List
      trips: scheduledTrips
    });

  } catch (error) {
    console.error("Driver Dashboard Error:", error);
    res.status(500).json({ 
        success: false, 
        message: "Failed to load dashboard. Please try again." 
    });
  }
};

// ==========================================
// 2. START TRIP (With 15-Minute Guard)
// ==========================================
exports.startTrip = async (req, res) => {
  try {
    const { tripId } = req.params;
    
    // 1. Fetch Trip Details
    const tripCheck = await Trip.findById(tripId);
    if (!tripCheck) return res.status(404).json({ message: "Trip not found" });

    // 2. CHECK 1: Is another trip running?
    const conflict = await Trip.findOne({ 
        driver: req.user._id, 
        status: 'ONGOING',
        _id: { $ne: tripId }
    });
    if (conflict) {
        return res.status(400).json({ 
            success: false, 
            message: "You have another ongoing trip. Please finish it first." 
        });
    }

    // 3. CHECK 2: THE 15-MINUTE RULE
    const now = new Date();
    const startTime = new Date(tripCheck.startTime);
    const diffMs = startTime - now;
    const diffMins = Math.ceil(diffMs / (1000 * 60)); 

    // Allow start if within 15 mins OR if the trip is already late (negative diff)
    if (diffMins > 15) {
        return res.status(400).json({ 
            success: false, 
            message: `Too early! You can start this trip in ${diffMins - 15} minutes.` 
        });
    }

    // 4. Proceed to Start
    const trip = await Trip.findByIdAndUpdate(
        tripId,
        { status: 'ONGOING', startTime: new Date(), isActive: true }, 
        { new: true }
    ).populate('bus', 'number model');

    // 5. Notify Passengers
    try {
        const io = getIO();
        io.to(`trip:${tripId}`).emit('trip_status_update', { 
            status: 'ONGOING', 
            message: `Bus ${trip.bus?.number || ''} has started the trip!` 
        });
    } catch (err) { console.log("Socket Error:", err.message); }

    // 6. Push + Store Notification for Booked Passengers
    try {
        const bookings = await Booking.find({
            trip: tripId,
            status: { $in: ['WAITING', 'BOARDED'] }
        }).select('passenger').lean();

        const passengerIds = Array.from(
            new Set(bookings.map((b) => String(b.passenger)))
        );

        if (passengerIds.length) {
            const title = 'Trip Started';
            const body = `Bus ${trip.bus?.number || ''} has started the trip.`;

            await Notification.create({
                title,
                body,
                sender: req.user._id,
                receivers: passengerIds
            });

            await sendToUsers({
                userIds: passengerIds,
                title,
                body,
                data: {
                    type: 'TRIP_STARTED',
                    tripId: String(tripId),
                    busNumber: trip.bus?.number || ''
                },
                priority: 'high'
            });
        }
    } catch (err) {
        console.log('Trip start push error:', err.message);
    }

    res.status(200).json({ success: true, trip });

  } catch (error) {
    console.error("Start Trip Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 3. END TRIP (With Strict Passenger Check)
// ==========================================
exports.endTrip = async (req, res) => {
  try {
    const { tripId } = req.params;

    // 1. 🛑 STRICT CHECK: Are there unprocessed passengers?
    // We count bookings that are still 'WAITING'.
    const pendingPassengers = await Booking.countDocuments({
        trip: tripId,
        status: 'WAITING'
    });

    if (pendingPassengers > 0) {
        return res.status(400).json({ 
            success: false, 
            message: `Cannot end trip yet! You have ${pendingPassengers} passengers waiting. Please mark them as Boarded or No-Show.` 
        });
    }

    // 2. Proceed to End Trip
    const trip = await Trip.findByIdAndUpdate(
        tripId,
        { status: 'COMPLETED', endTime: new Date(), isActive: false },
        { new: true }
    );

    if (!trip) {
        return res.status(404).json({ success: false, message: "Trip not found." });
    }

    // 3. Cleanup Location Data (Save DB space)
    await DriverLocation.deleteOne({ trip: tripId });

    // 4. Notify Passengers & Frontend
    try {
        const io = getIO();
        io.to(`trip:${tripId}`).emit('trip_status_update', { 
            status: 'COMPLETED', 
            message: "Trip Completed. Thank you for riding!" 
        });
    } catch (err) { console.log("Socket Error:", err.message); }

    res.status(200).json({ success: true, trip });

  } catch (error) {
    console.error("End Trip Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 4. ARRIVE AT STOP
// ==========================================
exports.arriveAtStop = async (req, res) => {
    try {
        const { tripId, stopId } = req.body;
        
        const trip = await Trip.findById(tripId);
        if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });

        const stopIndex = trip.stops.findIndex(s => s._id.toString() === stopId);
        if (stopIndex === -1) return res.status(404).json({ success: false, message: "Stop not found" });

        // Update Current Stop Index (Optional, but good for tracking)
        trip.currentStopIndex = stopIndex;
        await trip.save();

        // ⚡ Real-time: Notify Passengers
        try {
            const io = getIO();
            io.to(`trip:${tripId}`).emit('bus_arrival', { 
                stopId, 
                stopName: trip.stops[stopIndex].name,
                message: `Bus is arriving at ${trip.stops[stopIndex].name}`
            });
        } catch (e) {}

        res.status(200).json({ success: true, message: "Arrival recorded" });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// ==========================================
// 5. GET TRIP MANIFEST (For Driver List)
// ==========================================
exports.getTripManifest = async (req, res) => {
  try {
    const { tripId } = req.params;

    // Fetch all relevant bookings (Waiting & Boarded)
    // Boarded allows driver to see who is currently on the bus
    const bookings = await Booking.find({
      trip: tripId,
      status: { $in: ['WAITING', 'BOARDED'] }
    })
    .populate('passenger', 'name phone profilePic')
    .sort({ 'pickupLocation.stopId': 1 }); 

    // Grouping Logic for Frontend UI
    const groupedManifest = bookings.reduce((acc, booking) => {
      const stopName = booking.pickupLocation.name || "Unknown Stop";
      if (!acc[stopName]) acc[stopName] = [];
      acc[stopName].push(booking);
      return acc;
    }, {});

    res.status(200).json({ success: true, manifest: groupedManifest });

  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load passenger list." });
  }
};

// ==========================================
// 6. UPDATE PASSENGER STATUS (The Action Button)
// ==========================================
exports.updatePassengerStatus = async (req, res) => {
  try {
    const { bookingId, status } = req.body; 

    // Strict validation
    if (!['BOARDED', 'NO_SHOW', 'CANCELLED'].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid Status" });
    }

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { status: status },
      { new: true }
    ).populate('passenger', 'name');

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    // ⚡ Real-time Notifications
    try {
        const io = getIO();
        
        // 1. Notify Passenger ("You are Boarded")
        io.to(`user:${booking.passenger._id}`).emit('booking_status_update', {
            status: status,
            message: status === 'BOARDED' ? "Welcome aboard!" : "You were marked as a No-Show."
        });

        // 2. Notify Driver UI (Syncs all driver devices if logged in multiple places)
        io.to(`trip:${booking.trip}`).emit('manifest_update', {
            bookingId: booking._id,
            status: status
        });
    } catch(e) { console.log("Socket Warning:", e.message); }

    res.status(200).json({ success: true, message: "Status updated", booking });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// === HELPER: Get Passenger Counts ===
// Used by Dashboard to show badges (e.g., "5 Waiting")
async function getPassengerManifest(tripId) {
    const bookings = await Booking.find({
        trip: tripId,
        status: { $in: ['WAITING'] } 
    }).select('pickupLocation');

    const counts = {};
    bookings.forEach(b => {
        const stopName = b.pickupLocation.name;
        if (!counts[stopName]) counts[stopName] = 0;
        counts[stopName]++; 
    });
    return counts; 
}
