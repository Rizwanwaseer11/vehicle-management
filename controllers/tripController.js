const Trip = require('../models/Trip');
const User = require('../models/User');
const Bus = require('../models/Bus');
const Booking = require('../models/Booking');

// ==========================================
// 1. CREATE TRIP (STRICT VALIDATION)
// ==========================================
exports.createTrip = async (req, res) => {
  try {
    const { 
        driver, bus, routeName, stops, totalKm, startTime, routePolyline, recurrence 
    } = req.body;

    // --- 🚨 STEP 1: TOP-LEVEL VALIDATIONS ---
    const missingFields = [];
    if (!driver) missingFields.push("Driver");
    if (!bus) missingFields.push("Bus");
    if (!routeName) missingFields.push("Route Name");
    if (!startTime) missingFields.push("Start Time");
    if (totalKm === undefined || totalKm === null || totalKm === "") missingFields.push("Total KM");
    if (!routePolyline) missingFields.push("Route Map (Polyline)");
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(", ")}` 
      });
    }

    // --- 🚨 STEP 2: STOPS VALIDATION ---
    if (!Array.isArray(stops) || stops.length < 2) {
      return res.status(400).json({ error: "A trip must have at least 2 stops (Start & End)." });
    }

    // Validate EACH stop
    for (let i = 0; i < stops.length; i++) {
        const s = stops[i];
        if (!s.name) return res.status(400).json({ error: `Stop #${i+1} is missing a Name.` });
        if (s.latitude === undefined || s.latitude === null) return res.status(400).json({ error: `Stop '${s.name}' is missing Latitude.` });
        if (s.longitude === undefined || s.longitude === null) return res.status(400).json({ error: `Stop '${s.name}' is missing Longitude.` });
        if (s.order === undefined || s.order === null) return res.status(400).json({ error: `Stop '${s.name}' is missing Order.` });
    }

    // --- 🚨 STEP 3: CONFLICT CHECK (Resources) ---
    // If this is a REAL trip (not a template), check if driver/bus are busy
    const isTemplate = recurrence && recurrence !== 'NONE';
    
    if (!isTemplate) {
        const conflict = await Trip.findOne({
            $or: [{ driver: driver }, { bus: bus }],
            status: 'ONGOING' 
        });
        if (conflict) {
            return res.status(409).json({ error: "Driver or Bus is currently assigned to an ONGOING trip." });
        }
    }

    // --- STEP 4: SAVE ---
    // ✅ LOGIC FIX:
    // 1. If 'Daily/Weekday' (Template) -> isActive: FALSE (Wait for Scheduler)
    // 2. If 'None' (One-Time/Emergency) -> isActive: TRUE (Driver sees it NOW)
    
    const trip = await Trip.create({
      driver,
      bus,
      routeName,
      stops: stops.map(s => ({
        name: s.name,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        order: Number(s.order)
      })),
      totalKm: Number(totalKm),
      startTime: new Date(startTime),
      polyline: routePolyline,
      recurrence: recurrence || 'NONE',
      isTemplate: isTemplate,
      
      // ✅ DYNAMIC ACTIVE STATUS
      isActive: !isTemplate, 
      
      status: 'SCHEDULED'
    });

    return res.status(201).json({
      success: true,
      message: isTemplate ? "Schedule Template Created (Hidden until Midnight)" : "Emergency Trip Created (Active Now)",
      trip
    });

  } catch (error) {
    console.error("Create Trip Error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 2. GET ALL TRIPS
// ==========================================
exports.getAllTrips = async (req, res) => {
  try {
    const trips = await Trip.find()
      .populate("driver", "name email")
      .populate("bus", "number model")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, trips });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 3. GET TRIP BY ID
// ==========================================
exports.getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      // ✅ 1. Populate Driver (Get Name & ID)
      .populate("driver", "name email phone profilePic") 
      
      // ✅ 2. Populate Bus (Get Number & Model)
      .populate("bus", "number model seatingCapacity isActive")
      
      // ✅ 3. Lean() for performance (Returns plain JS object)
      .lean(); 

    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    // ✅ 4. Send ALL fields required for Edit Form & Map
    res.status(200).json({ 
      success: true, 
      trip: {
        _id: trip._id,
        
        // Basic Info
        routeName: trip.routeName,
        totalKm: trip.totalKm,
        status: trip.status,
        isActive: trip.isActive,
        
        // ✅ MAP DATA (Critical for Map Tracking/Editing)
        polyline: trip.polyline,   

        // ✅ SCHEDULING (Critical for Edit Form)
        startTime: trip.startTime, // 24h Date Object
        recurrence: trip.recurrence || 'NONE', // 'DAILY', 'WEEKDAYS', etc.
        isTemplate: trip.isTemplate,

        // Resources
        driver: trip.driver, 
        bus: trip.bus,       

        // Stops (Sorted by order)
        stops: trip.stops ? trip.stops.sort((a, b) => a.order - b.order).map(stop => ({
          _id: stop._id,
          name: stop.name,
          latitude: stop.latitude,
          longitude: stop.longitude,
          order: stop.order
        })) : []
      }
    });

  } catch (error) {
    console.error("Get Trip Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch trip details." });
  }
};

// ==========================================
// 4. UPDATE TRIP (STRICT VALIDATION)
// ==========================================
exports.updateTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
        driver, bus, routeName, stops, totalKm, startTime, routePolyline, recurrence, status 
    } = req.body;

    // --- 🚨 STEP 1: VALIDATIONS ---
    const missingFields = [];
    if (!driver) missingFields.push("Driver");
    if (!bus) missingFields.push("Bus");
    if (!routeName) missingFields.push("Route Name");
    if (!startTime) missingFields.push("Start Time");
    if (!routePolyline) missingFields.push("Route Map (Polyline)");
    
    if (missingFields.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(", ")}` });
    }

    if (!Array.isArray(stops) || stops.length < 2) {
        return res.status(400).json({ error: "A trip must have at least 2 stops." });
    }

    // --- 🚨 STEP 2: CONFLICT CHECK ---
    if (status === 'ONGOING') {
       const conflict = await Trip.findOne({
         _id: { $ne: id }, 
         $or: [{ driver: driver }, { bus: bus }],
         status: 'ONGOING'
       });
       if (conflict) {
         return res.status(409).json({ error: "Driver or Bus is busy in another ONGOING trip." });
       }
    }

    // --- 🚨 STEP 3: PREPARE UPDATE (Fixing Logic Here) ---
    // 1. Determine if it's a template (Daily/Weekdays)
    const isTemplate = recurrence && recurrence !== 'NONE';

    // 2. ✅ CRITICAL FIX: Update 'isActive' based on the new recurrence type
    // If Admin changes it to DAILY/WEEKDAYS -> isActive becomes FALSE (Hidden)
    // If Admin changes it to NONE -> isActive becomes TRUE (Visible)
    const isActive = !isTemplate; 

    const updateData = {
      driver, 
      bus, 
      routeName, 
      totalKm: Number(totalKm), 
      startTime: new Date(startTime),
      polyline: routePolyline,
      recurrence: recurrence || 'NONE',
      isTemplate: isTemplate,
      isActive: isActive, // ✅ Updated Logic applied here
      status: status, 
      stops: stops.map(s => ({
        name: s.name,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        order: Number(s.order)
      }))
    };

    const updatedTrip = await Trip.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedTrip) return res.status(404).json({ message: "Trip not found" });

    res.status(200).json({ 
        success: true, 
        message: isTemplate ? "Schedule Updated (Hidden Template)" : "Trip Updated (Active Now)", 
        trip: updatedTrip 
    });

  } catch (error) {
    console.error("Update Trip Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
// ==========================================
// 5. TOGGLE ACTIVE STATUS
// ==========================================
exports.toggleTripStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body; 

        const trip = await Trip.findByIdAndUpdate(id, { isActive }, { new: true });
        
        if (!trip) return res.status(404).json({ message: "Trip not found" });

        res.status(200).json({ success: true, message: "Status updated", trip });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// 6. DELETE TRIP
// ==========================================
exports.deleteTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    if (trip.status === 'ONGOING') {
        return res.status(400).json({ message: "Cannot delete a Live Trip." });
    }

    // Optional: Check bookings before deleting
    const activeBookings = await Booking.countDocuments({ trip: req.params.id, status: 'WAITING' });
    if (activeBookings > 0) {
        return res.status(400).json({ message: `Cannot delete. ${activeBookings} passengers are waiting.` });
    }

    await Trip.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Trip deleted." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
