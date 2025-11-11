const Trip = require('../models/Trip');
const User = require('../models/User');
const Message = require('../models/Message');
const Notification = require('../models/Notification');

// Get assigned vehicle/trip for passenger
exports.getAssignedTrip = async (req, res) => {
  const trips = await Trip.find({ 'stops.passengers': req.user._id }).populate('driver', 'name email profilePic');
  res.json(trips);
};

// Track driver real-time location
exports.trackDriver = async (req, res) => {
  const DriverLocation = require('../models/DriverLocation');
  const location = await DriverLocation.find({ trip: req.params.tripId });
  res.json(location);
};

// Get passenger notifications
exports.getNotifications = async (req, res) => {
  const notifications = await Notification.find({ receivers: req.user._id }).sort({ createdAt: -1 });
  res.json(notifications);
};

// Chat with driver
exports.getMessagesWithDriver = async (req, res) => {
  const driverId = req.params.driverId;
  const messages = await Message.find({
    $or: [
      { sender: req.user._id, receiver: driverId },
      { sender: driverId, receiver: req.user._id }
    ]
  }).sort({ createdAt: 1 });
  res.json(messages);
};
