
const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/admin', require('./adminRoutes')); // Admin only
router.use('/trips', require('./tripRoutes')); // Admin only
router.use('/messages', require('./messageRoutes')); // All roles
router.use('/notifications', require('./notificationRoutes')); // Admin send / all read
router.use('/driver', require('./driverRoutes')); // Driver role routes
router.use('/passenger', require('./passengerRoutes')); // Passenger role routes

module.exports = router;
