const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const { sendNotification, getNotifications } = require('../controllers/notificationController');

router.use(protect);

router.post('/', authorizeRoles('admin', 'employee'), sendNotification);
router.get('/', getNotifications);

module.exports = router;
