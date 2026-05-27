const { EmailJob } = require('../models');

// Bulk-enqueue many jobs in a single round-trip. Each job is just the
// payload the worker will hand to mailer.send; status defaults to 'queued'
// via the model and next_attempt_at defaults to NOW(), so the next worker
// tick picks them up immediately.
//
// Caller passes `{ to, subject, html, batchId?, userId? }`. Empty `to` is
// dropped silently (callers can hand us a list that includes students
// missing an email address without having to filter first).
async function enqueueMany(jobs) {
    const cleaned = (Array.isArray(jobs) ? jobs : [])
        .filter((j) => j && j.to && j.subject && j.html)
        .map((j) => ({
            to_email: String(j.to).trim(),
            subject: String(j.subject),
            html: String(j.html),
            batch_id: j.batchId == null ? null : Number(j.batchId) || null,
            user_id: j.userId == null ? null : String(j.userId),
        }));
    if (!cleaned.length) return { enqueued: 0 };
    await EmailJob.bulkCreate(cleaned);
    return { enqueued: cleaned.length };
}

async function enqueue(job) {
    return enqueueMany([job]);
}

module.exports = { enqueue, enqueueMany };
