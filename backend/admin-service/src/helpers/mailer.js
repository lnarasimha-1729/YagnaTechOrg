const nodemailer = require('nodemailer');
const env = require('../config/env');

// Lazy singleton transport — building one per send is wasteful when the
// worker can fire many in a row. createTransport is sync; the verify happens
// on the first sendMail.
let transport = null;
const getTransport = () => {
    if (transport) return transport;
    if (!env.mail.host) return null;
    transport = nodemailer.createTransport({
        host: env.mail.host,
        port: env.mail.port,
        // Gmail/SES/Outlook all want STARTTLS on 587 — leave `secure` false.
        // Port 465 callers would need `secure: true` set explicitly; we don't
        // surface that since the codebase defaults to 587.
        auth: { user: env.mail.user, pass: env.mail.pass },
    });
    return transport;
};

// Throws on transport / SMTP errors so the queue worker can record them.
// `if (!host) return` is preserved (older callers like live-class.notifier
// rely on email being optional in dev) — they get a no-op as before, while
// the email_jobs worker explicitly probes env.mail.host before claiming jobs.
const send = async ({ to, subject, html, from }) => {
    const t = getTransport();
    if (!t) return { skipped: true };
    const info = await t.sendMail({
        from: from || env.mail.from,
        to,
        subject,
        html,
    });
    return { messageId: info.messageId, response: info.response };
};

// Exposed so the worker can decide whether to drain the queue at all (no
// point claiming jobs if SMTP isn't configured — they'd just fail-loop).
const isConfigured = () => Boolean(env.mail.host);

module.exports = { send, isConfigured };
