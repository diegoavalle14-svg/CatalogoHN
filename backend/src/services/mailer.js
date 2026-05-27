const nodemailer = require('nodemailer');

function getMailerConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || user || 'no-reply@catalogohn.local';

  const enabled = Boolean(host && user && pass);
  return { enabled, host, port, user, pass, from };
}

function createTransporter(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass }
  });
}

async function sendMail({ to, subject, html, text }) {
  const config = getMailerConfig();
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);

  if (recipients.length === 0) {
    return { ok: false, skipped: true, reason: 'no-recipients' };
  }

  if (!config.enabled) {
    // Dev fallback: keep behavior deterministic without SMTP.
    console.log('[mailer] SMTP disabled. Would send:', { to: recipients, subject });
    return { ok: true, skipped: true, reason: 'smtp-disabled' };
  }

  const transporter = createTransporter(config);
  const info = await transporter.sendMail({
    from: config.from,
    to: recipients.join(','),
    subject,
    html: html || undefined,
    text: text || undefined
  });

  return { ok: true, messageId: info.messageId };
}

module.exports = {
  sendMail,
  getMailerConfig
};
