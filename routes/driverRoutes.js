const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const driverController = require('../controllers/driverController');

router.use(protect);
router.use(authorizeRoles('driver'));

router.get('/trips', driverController.getAssignedTrips);
router.put('/trip/start/:tripId', driverController.startTrip);
router.put('/trip/end/:tripId', driverController.endTrip);
router.get('/trip/:tripId/next-stop', driverController.getNextStop);
router.get('/trip/:tripId/stop/:stopId/passengers-count', driverController.getPassengersCount);

module.exports = router;
