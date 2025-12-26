const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const {createBus , getAllBuses , getAvailableBuses , editBus , deleteBus } = require('../controllers/busController');


router.use(protect);
router.use(authorizeRoles('admin', 'employee'))


router.post("/createBus", createBus)

router.get("/", getAllBuses );

router.get("/available-buses", getAvailableBuses );


router.put('/:id', editBus);

router.delete('/:id', deleteBus);


module.exports = router;