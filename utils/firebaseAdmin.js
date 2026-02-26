const admin = require('firebase-admin');

let app = null;

const getServiceAccount = () => {
  const b64 = process.env.FCM_SERVICE_ACCOUNT_B64;
  if (!b64) return null;
  const json = Buffer.from(b64, 'base64').toString('utf8');
  return JSON.parse(json);
};

const initFirebase = () => {
  if (app) return app;
  if (admin.apps.length) {
    app = admin.app();
    return app;
  }

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    throw new Error('Missing FCM_SERVICE_ACCOUNT_B64');
  }

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  return app;
};

const getMessaging = () => {
  initFirebase();
  return admin.messaging();
};

module.exports = { admin, initFirebase, getMessaging };
