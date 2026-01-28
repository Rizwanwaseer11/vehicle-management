const express = require('express');
const router = express.Router();

// Middleware
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');

// Controllers
const passengerController = require('../controllers/passengerController');
const bookingController = require('../controllers/bookingController');

// 🔒 Apply Security: Only Logged-in Passengers can access these routes
router.use(protect);
router.use(authorizeRoles('passenger'));

// ==========================================
// 1. GENERAL PASSENGER ROUTES
// ==========================================
router.get('/assigned-trip', passengerController.getAssignedTrip);
router.get('/track-driver/:tripId', passengerController.trackDriver);
router.get('/notifications', passengerController.getNotifications);
router.get('/messages/:driverId', passengerController.getMessagesWithDriver);

// ==========================================
// 2. BOOKING ROUTES (The Flow You Built)
// ==========================================

// A. Get All Active Routes (Home Screen)
router.get('/routes',  bookingController.getActiveTrips); 

// B. Join a Ride (Book Button) -> Calls createBooking in Controller
router.post('/join',  bookingController.createBooking);

// C. Check Active Ride (Splash Screen) -> Calls getMyCurrentBooking in Controller
router.get('/current',  bookingController.getMyCurrentBooking);

// D. Cancel Ride (Cancel Button)
router.put('/cancel/:bookingId', bookingController.cancelBooking);

// E. Ride History (Profile Screen) -> Calls getMyBookings in Controller
// ⚠️ IMPORTANT: Ensure you added 'getMyBookings' to your controller file!
router.get('/history',  bookingController.getMyBookings);

module.exports = router;