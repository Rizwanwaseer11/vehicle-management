const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceTokens');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/fcmHelper');

exports.sendNotification = async (req, res) => {
  try {
    const { title, body, receivers, roles, sendToAll, data, priority } = req.body;

    if (!title || !body) {
      return res.status(400).json({ message: 'title and body required' });
    }

    let targetIds = Array.isArray(receivers) ? receivers.filter(Boolean) : [];

    if (!targetIds.length) {
      if (Array.isArray(roles) && roles.length) {
        const users = await User.find({
          role: { $in: roles },
          isActive: true,
          status: 'approved'
        }).select('_id').lean();
        targetIds = users.map((u) => u._id);
      } else if (sendToAll === true) {
        const users = await User.find({
          isActive: true,
          status: 'approved'
        }).select('_id').lean();
        targetIds = users.map((u) => u._id);
      }
    }

    if (!targetIds.length) {
      return res.status(400).json({ message: 'No receivers found' });
    }

    const notification = await Notification.create({
      title,
      body,
      sender: req.user._id,
      receivers: targetIds
    });

    const tokens = await DeviceToken.find({ userId: { $in: targetIds }, provider: 'fcm' })
      .select('token -_id')
      .lean();
    const tokenList = tokens.map((t) => t.token);

    const pushResult = await sendPushNotification(tokenList, title, body, {
      notificationId: notification._id,
      ...(data || {})
    }, {
      androidPriority: priority === 'normal' ? 'normal' : 'high',
      apnsPriority: priority === 'normal' ? '5' : '10'
    });

    if (pushResult?.invalidTokens?.length) {
      await DeviceToken.deleteMany({ token: { $in: pushResult.invalidTokens } });
    }

    res.status(201).json({ notification, push: pushResult });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.getNotifications = async (req, res) => {
  const notifications = await Notification.find({ receivers: req.user._id }).sort({ createdAt: -1 });
  res.json(notifications);
};
