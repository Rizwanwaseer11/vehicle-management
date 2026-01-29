const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const { createTrip, getAllTrips, getTripById, updateTrip, deleteTrip,findAvailableDrivers,toggleTripStatus } = require('../controllers/tripController');

router.use(protect);
router.use(authorizeRoles('admin', 'employee'))

// Routes
router.post('/', createTrip);
router.get('/', getAllTrips);
router.get('/available-drivers', findAvailableDrivers);
router.get('/:id', getTripById);
router.put('/:id', updateTrip);
router.put('/:id/toggle', toggleTripStatus); // ✅ Fixed: Frontend calls this
router.delete('/:id', deleteTrip);


module.exports = router;
