const DeviceToken = require('../models/DeviceTokens');
const { sendPushNotification } = require('./fcmHelper');

const normalizeIds = (ids) =>
  Array.from(
    new Set(
      (ids || [])
        .filter(Boolean)
        .map((id) => String(id))
    )
  );

const sendToUsers = async ({ userIds, title, body, data = {}, priority = 'high' }) => {
  const receivers = normalizeIds(userIds);
  if (!receivers.length) {
    return { ok: false, reason: 'no-receivers', invalidTokens: [] };
  }

  const tokens = await DeviceToken.find({ userId: { $in: receivers }, provider: 'fcm' })
    .select('token -_id')
    .lean();
  const tokenList = tokens.map((t) => t.token);

  const pushResult = await sendPushNotification(tokenList, title, body, data, {
    androidPriority: priority === 'normal' ? 'normal' : 'high',
    apnsPriority: priority === 'normal' ? '5' : '10'
  });

  if (pushResult?.invalidTokens?.length) {
    await DeviceToken.deleteMany({ token: { $in: pushResult.invalidTokens } });
  }

  return pushResult;
};

module.exports = { sendToUsers };
