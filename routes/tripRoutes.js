const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const { createTrip, getAllTrips, getTripById, updateTrip, deleteTrip } = require('../controllers/tripController');

router.use(protect);
router.use(authorizeRoles('admin'));

router.post('/', createTrip);
router.get('/', getAllTrips);
router.get('/:id', getTripById);
router.put('/:id', updateTrip);
router.delete('/:id', deleteTrip);

module.exports = router;
