const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { registerToken, unregisterToken } = require('../controllers/pushController');

router.use(protect);

router.post('/register', registerToken);
router.post('/unregister', unregisterToken);

module.exports = router;
