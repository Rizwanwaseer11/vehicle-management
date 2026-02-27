const formatTime = (date = new Date()) =>
  new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const baseTemplate = ({ title, preheader, bodyHtml, footerNote }) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="display:none;max-height:0;overflow:hidden;color:transparent;font-size:1px;line-height:1px;">
        ${preheader || ''}
      </div>
      <div style="background:#ffffff;border-radius:16px;padding:28px;border:1px solid #e6e9f2;box-shadow:0 10px 25px rgba(16,24,40,0.06);">
        <div style="margin-bottom:20px;">
          <h1 style="margin:0;font-size:22px;color:#101828;">${title}</h1>
          <p style="margin:6px 0 0;color:#667085;font-size:14px;">${formatTime()}</p>
        </div>
        ${bodyHtml}
      </div>
      <p style="text-align:center;color:#98a2b3;font-size:12px;margin-top:16px;">
        ${footerNote || 'If you didn’t request this, please contact support immediately.'}
      </p>
    </div>
  </body>
</html>
`;

const otpEmail = ({ name, code, minutes = 10 }) => {
  const bodyHtml = `
    <p style="color:#344054;font-size:15px;margin:0 0 16px;">
      Hi ${name || 'there'}, use the verification code below to reset your password.
    </p>
    <div style="background:#f2f4f7;border-radius:12px;padding:16px;text-align:center;margin-bottom:16px;">
      <div style="font-size:28px;letter-spacing:6px;font-weight:700;color:#101828;">${code}</div>
      <div style="font-size:13px;color:#667085;margin-top:6px;">Valid for ${minutes} minutes</div>
    </div>
    <p style="color:#667085;font-size:14px;margin:0;">
      For security, do not share this code with anyone.
    </p>
  `;

  return baseTemplate({
    title: 'Password Reset Code',
    preheader: `Your reset code is ${code}`,
    bodyHtml,
  });
};

const profileChangedEmail = ({ name, changes = [] }) => {
  const list = changes
    .map((item) => `<li style="margin-bottom:6px;color:#344054;">${item}</li>`)
    .join('');

  const bodyHtml = `
    <p style="color:#344054;font-size:15px;margin:0 0 16px;">
      Hi ${name || 'there'}, your account details were updated.
    </p>
    <div style="background:#f9fafb;border:1px solid #eaecf0;border-radius:12px;padding:16px;margin-bottom:16px;">
      <p style="margin:0 0 8px;font-size:14px;color:#667085;">Changes:</p>
      <ul style="padding-left:18px;margin:0;font-size:14px;">${list}</ul>
    </div>
    <p style="color:#667085;font-size:14px;margin:0;">
      If this wasn’t you, please reset your password immediately.
    </p>
  `;

  return baseTemplate({
    title: 'Account Updated',
    preheader: 'Your account details were updated.',
    bodyHtml,
  });
};

const passwordChangedEmail = ({ name }) => {
  const bodyHtml = `
    <p style="color:#344054;font-size:15px;margin:0 0 16px;">
      Hi ${name || 'there'}, your password was changed successfully.
    </p>
    <p style="color:#667085;font-size:14px;margin:0;">
      If you did not make this change, please contact support right away.
    </p>
  `;

  return baseTemplate({
    title: 'Password Changed',
    preheader: 'Your password was changed successfully.',
    bodyHtml,
  });
};

module.exports = {
  otpEmail,
  profileChangedEmail,
  passwordChangedEmail,
};
