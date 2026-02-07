// // const express = require('express');
// // const router = express.Router();
// // const { protect } = require('../middlewares/authMiddleware');
// // const { sendMessage, getMessages } = require('../controllers/messageController');

// // router.use(protect);

// // router.post('/', sendMessage);
// // router.get('/:userId', getMessages);

// // module.exports = router;


// // routes/messageRoutes.js
// const router = require('express').Router();
// const { sendMessage, getTripMessages, getTripDM } = require('../controllers/messageController');
// const auth = require('../middlewares/authMiddleware'); // your JWT auth middleware

// router.use(auth);

// router.post('/', sendMessage);

// // Group chat for trip
// router.get('/trip/:tripId', getTripMessages);

// // Private DM within trip
// router.get('/dm/:tripId/:otherUserId', getTripDM);

// module.exports = router;

const router = require("express").Router();
const { sendMessage, getTripMessages, getTripDM } = require("../controllers/messageController");
const { protect } = require("../middlewares/authMiddleware"); // ✅ correct

router.use(protect);

router.post("/", sendMessage);

// Group chat for trip
router.get("/trip/:tripId", getTripMessages);

// Private DM within trip
router.get("/dm/:tripId/:otherUserId", getTripDM);

module.exports = router;
