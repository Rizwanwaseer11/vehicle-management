const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { sendNotification, getNotifications } = require('../controllers/notificationController');

router.use(protect);

router.post('/', sendNotification);
router.get('/', getNotifications);

module.exports = router;
