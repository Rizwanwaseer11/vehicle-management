const axios = require('axios');

exports.sendPushNotification = async (tokens, title, body) => {
  if (!tokens || !tokens.length) return;
  const payload = {
    registration_ids: tokens,
    notification: { title, body }
  };
  const FCM_KEY = process.env.FCM_SERVER_KEY;
  if (!FCM_KEY) return;
  await axios.post('https://fcm.googleapis.com/fcm/send', payload, {
    headers: { Authorization: `key=${FCM_KEY}`, 'Content-Type': 'application/json' }
  });
};
