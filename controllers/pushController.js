const DeviceToken = require('../models/DeviceTokens');

exports.registerToken = async (req, res) => {
  try {
    const { token, platform, provider } = req.body;
    if (!token) return res.status(400).json({ ok: false, message: 'token required' });

    await DeviceToken.updateOne(
      { token },
      {
        $set: {
          userId: req.user?._id || null,
          provider: provider || 'fcm',
          platform: platform || 'unknown',
          lastSeenAt: new Date()
        }
      },
      { upsert: true }
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

exports.unregisterToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ ok: false, message: 'token required' });

    await DeviceToken.deleteOne({ token, userId: req.user?._id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};
