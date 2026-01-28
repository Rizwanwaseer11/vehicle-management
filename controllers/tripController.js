const Trip = require('../models/Trip');
const User = require('../models/User');
const Bus = require('../models/Bus'); // Ensure you have this import
const Booking = rquire('../models/Booking')

// ==========================================
// 1. CREATE TRIP (ADMIN)
// ==========================================
exports.createTrip = async (req, res) => {
  try {
    // 1. Extract Data from Frontend
    const { 
        driver, 
        bus, 
        routeName, 
        stops, 
        totalKm, 
        startTime, 
        routePolyline // <--- Frontend MUST send this string
    } = req.body;

    // 2. Strict Validations
    if (!driver || !bus || !routeName || !startTime) {
      return res.status(400).json({ error: "Missing required fields (Driver, Bus, Name, Time)." });
    }

    // ✅ VALIDATION: Ensure Map Data Exists
    if (!routePolyline || typeof routePolyline !== 'string') {
        return res.status(400).json({ 
            error: "Route Polyline is missing! The map cannot be drawn without it." 
        });
    }

    if (!Array.isArray(stops) || stops.length < 2) {
      return res.status(400).json({ error: "A trip must have at least 2 stops." });
    }

    // 3. RESOURCE CHECK: Are they already busy?
    // We check if this Driver or Bus is currently on an ACTIVE trip.
    const conflict = await Trip.findOne({
      $or: [{ driver: driver }, { bus: bus }],
      status: 'ONGOING' // Only blocks if they are currently driving
    });

    if (conflict) {
      return res.status(409).json({ 
        error: "Driver or Bus is currently assigned to an ONGOING trip." 
      });
    }

    // 4. SAVE TRIP TO DATABASE
    const trip = await Trip.create({
      driver,
      bus,
      routeName,
      // Map stops to clean schema
      stops: stops.map(s => ({
        name: s.name,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        order: Number(s.order)
      })),
      totalKm: Number(totalKm),
      startTime: new Date(startTime),
      polyline: routePolyline, // ✅ Saved exactly as Frontend sent it
      status: 'SCHEDULED'
    });

    return res.status(201).json({
      success: true,
      trip,
      message: "Trip created successfully."
    });

  } catch (error) {
    console.error("Error creating trip:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 2. GET ALL TRIPS
// ==========================================
exports.getAllTrips = async (req, res) => {
  try {
    const trips = await Trip.find()
      .populate("driver", "name email profilePic")
      .populate("bus", "number model seatingCapacity isActive")
      .sort({ startTime: 1 }); // Sort by earliest time first

    res.status(200).json({
      success: true,
      count: trips.length,
      trips
    });
  } catch (error) {
    console.error("Get trips error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch trips" });
  }
};

// ==========================================
// 3. GET TRIP BY ID (For Tracking & Editing)
// ==========================================
exports.getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      // ✅ 1. Get Full Driver Details
      .populate("driver", "name email phone profilePic") 
      
      // ✅ 2. Get Full Bus Details (Number, Model, Capacity)
      .populate("bus", "number model seatingCapacity isActive")
      
      // ✅ 3. Lean() speeds up the query for tracking
      .lean(); 

    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    // ✅ 4. Send the complete object
    res.status(200).json({ 
      success: true, 
      trip: {
        _id: trip._id,
        routeName: trip.routeName,
        
        // Map Data
        polyline: trip.polyline,   // Critical for Map Line
        totalKm: trip.totalKm,
        
        // Schedule
        startTime: trip.startTime, // ISO Date format
        status: trip.status,
        isActive: trip.isActive,

        // Resources
        driver: trip.driver,       // Contains name, email, phone
        bus: trip.bus,             // Contains number, model

        // Stops (Sorted by order just to be safe)
        stops: trip.stops.sort((a, b) => a.order - b.order).map(stop => ({
          _id: stop._id,
          name: stop.name,
          latitude: stop.latitude,
          longitude: stop.longitude,
          order: stop.order
        }))
      }
    });

  } catch (error) {
    console.error("Get Trip Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch trip details." });
  }
};

// ==========================================
// 4. UPDATE TRIP (Admin Edit)
// ==========================================
exports.updateTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      driver, 
      bus, 
      routeName, 
      stops, 
      totalKm, 
      startTime, 
      routePolyline,
      status 
    } = req.body;

    // 1. Check if Trip Exists
    const tripToUpdate = await Trip.findById(id);
    if (!tripToUpdate) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    // 2. RESOURCE CONFLICT CHECK (Smart Logic)
    // We check if the Driver or Bus is busy in *another* ONGOING trip.
    // We use ($ne: id) to exclude THIS trip from the check.
    if (status === 'ONGOING' || tripToUpdate.status === 'ONGOING') {
       const conflict = await Trip.findOne({
         _id: { $ne: id }, // <--- Critical: Ignore current trip
         $or: [{ driver: driver }, { bus: bus }],
         status: 'ONGOING'
       });

       if (conflict) {
         return res.status(409).json({ 
           success: false, 
           error: "Conflict: Driver or Bus is already assigned to another ONGOING trip." 
         });
       }
    }

    // 3. Prepare Update Object
    const updateData = {
      driver,
      bus,
      routeName,
      totalKm: Number(totalKm),
      startTime: new Date(startTime),
      polyline: routePolyline, // Update map line if edited
      status
    };

    // 4. Handle Stops Update (Map cleanly)
    if (stops && Array.isArray(stops)) {
      if (stops.length < 2) {
        return res.status(400).json({ error: "Trip must have at least 2 stops." });
      }
      updateData.stops = stops.map(s => ({
        name: s.name,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        order: Number(s.order)
      }));
    }

    // 5. PERFORM UPDATE
    const updatedTrip = await Trip.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true } // Return new doc & validate enum
    )
    .populate("driver", "name email phone profilePic")
    .populate("bus", "number model seatingCapacity");

    res.status(200).json({ 
      success: true, 
      message: "Trip updated successfully.", 
      trip: updatedTrip 
    });

  } catch (error) {
    console.error("Update Trip Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};



// ==========================================
// 5. DELETE TRIP (Safe Delete)
// ==========================================
exports.deleteTrip = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Find the trip first
    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found." });
    }

    // 2. CHECK 1: Is the trip currently live?
    if (trip.status === 'ONGOING') {
      return res.status(400).json({ 
        success: false, 
        message: "Action Blocked: Cannot delete a Live Trip. The driver has started the ride." 
      });
    }

    // 3. CHECK 2: Are there passengers booked?
    // We check if any booking exists for this trip that is not Cancelled or Completed.
    const activeBookingsCount = await Booking.countDocuments({
      trip: id,
      status: { $in: ['WAITING', 'BOARDED'] } // Only active passengers
    });

    if (activeBookingsCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Action Blocked: There are ${activeBookingsCount} active passengers booked on this trip.` 
      });
    }

    // 4. Safe to Delete
    await Trip.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: "Trip deleted successfully." });

  } catch (error) {
    console.error("Delete Trip Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete trip." });
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
