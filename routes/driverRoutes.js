const express = require('express');
const router = express.Router();

// Controllers
const driverController = require('../controllers/driverController');
const bookingController = require('../controllers/bookingController');

// Middleware
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');

// Global Middleware for this Router
router.use(protect);
router.use(authorizeRoles('driver'));

// 1. The Main "Boot Up" Endpoint
router.get('/dashboard', driverController.getDriverDashboard);

// 2. Action Endpoints
router.put('/trip/:tripId/start', driverController.startTrip);
router.put('/trip/:tripId/end', driverController.endTrip);
router.post('/trip/arrive', driverController.arriveAtStop); // Driver pressed "Arrived" button
router.get('/trip/:tripId/manifest', driverController.getTripManifest); // Get List
router.put('/passenger/status', driverController.updatePassengerStatus); // Action Button

module.exports = router;