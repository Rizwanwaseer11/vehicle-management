const Notification = require('../models/Notification');
const { sendPushNotification } = require('../utils/fcmHelper');

exports.sendNotification = async (req, res) => {
  const { title, body, receivers } = req.body;
  const notification = await Notification.create({
    title, body, sender: req.user._id, receivers
  });

  // Send FCM
  await sendPushNotification(receivers, title, body);
  res.status(201).json(notification);
};

exports.getNotifications = async (req, res) => {
  const notifications = await Notification.find({ receivers: req.user._id }).sort({ createdAt: -1 });
  res.json(notifications);
};
