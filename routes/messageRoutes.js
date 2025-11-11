const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { sendMessage, getMessages } = require('../controllers/messageController');

router.use(protect);

router.post('/', sendMessage);
router.get('/:userId', getMessages);

module.exports = router;
