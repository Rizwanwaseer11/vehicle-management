const axios = require('axios');

const readEnv = (key) =>
  typeof process.env[key] === 'string' ? process.env[key].trim() : '';

const RESEND_API_KEY =
  readEnv('RESEND_API_KEY') || readEnv('Resend_Api_key') || readEnv('RESEND_KEY');

const DEFAULT_FROM =
  readEnv('RESEND_FROM') || 'OneLoveDrive <no-reply@mail.onelovedrive.cloud>';

const RESEND_URL = 'https://api.resend.com/emails';

const sendEmail = async ({ to, subject, html, text }) => {
  if (!RESEND_API_KEY) {
    console.warn('[email] Missing RESEND_API_KEY. Skipping email send.');
    return { ok: false, skipped: true };
  }

  const payload = {
    from: DEFAULT_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  };

  const res = await axios.post(RESEND_URL, payload, {
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  return res.data;
};

module.exports = { sendEmail };
