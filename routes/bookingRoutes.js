const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const {
  getAllBookingsAdmin,
  updateBookingStatusAdmin
} = require('../controllers/bookingController');

router.use(protect);
router.use(authorizeRoles('admin', 'employee'));

router.get('/', getAllBookingsAdmin);
router.put('/:id/status', updateBookingStatusAdmin);

module.exports = router;
