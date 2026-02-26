const { getMessaging } = require('./firebaseAdmin');

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const toStringMap = (obj) => {
  if (!obj || typeof obj !== 'object') return {};
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    if (typeof value === 'string') {
      acc[key] = value;
      return acc;
    }
    acc[key] = JSON.stringify(value);
    return acc;
  }, {});
};

const normalizePriority = (val, fallback) => {
  const allowed = ['high', 'normal'];
  return allowed.includes(val) ? val : fallback;
};

const normalizeApnsPriority = (val, fallback) => {
  const allowed = ['10', '5'];
  return allowed.includes(String(val)) ? String(val) : fallback;
};

exports.sendPushNotification = async (tokens, title, body, data = {}, options = {}) => {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return { ok: false, reason: 'no-tokens', invalidTokens: [] };
  }

  const messaging = getMessaging();
  const invalidTokens = [];
  const responses = [];

  const androidPriority = normalizePriority(options.androidPriority, 'high');
  const apnsPriority = normalizeApnsPriority(options.apnsPriority, '10');

  for (const batch of chunk(tokens, 500)) {
    const message = {
      tokens: batch,
      notification: {
        title,
        body
      },
      data: toStringMap(data),
      android: {
        priority: androidPriority
      },
      apns: {
        headers: {
          'apns-priority': apnsPriority
        }
      }
    };

    const res = await messaging.sendEachForMulticast(message);
    responses.push(res);

    res.responses.forEach((r, idx) => {
      if (r.success) return;
      const code = r.error?.code || '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        invalidTokens.push(batch[idx]);
      }
    });
  }

  return {
    ok: true,
    responses,
    invalidTokens: Array.from(new Set(invalidTokens))
  };
};
