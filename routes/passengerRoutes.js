const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const passengerController = require('../controllers/passengerController');

router.use(protect);
router.use(authorizeRoles('passenger'));

router.get('/assigned-trip', passengerController.getAssignedTrip);
router.get('/track-driver/:tripId', passengerController.trackDriver);
router.get('/notifications', passengerController.getNotifications);
router.get('/messages/:driverId', passengerController.getMessagesWithDriver);

module.exports = router;
