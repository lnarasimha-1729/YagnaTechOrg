const { Op } = require('sequelize');
const { EmailJob, sequelize } = require('../models');
const mailer = require('../helpers/mailer');

// DB-backed email worker. Polls `email_jobs` every POLL_INTERVAL_MS, claims
// queued rows whose next_attempt_at has passed, sends them via the shared
// nodemailer transport, and writes the result back. No external infra —
// jobs survive restarts because they live in MySQL.
//
// Retry policy: up to MAX_ATTEMPTS tries with exponential backoff. A row
// that exhausts attempts lands in `failed` and stays there for inspection
// (no auto-purge — admins should be able to see why mail was lost).

const POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 10;            // Max jobs claimed per tick.
const MAX_ATTEMPTS = 5;
// Backoff = base * attempt^2 — 60s, 4m, 9m, 16m, 25m. Caps the noise on a
// truly dead SMTP without hammering it every 5s.
const BACKOFF_BASE_SECONDS = 60;

let timer = null;
let running = false;

// Atomically claim up to BATCH_SIZE queued rows whose next_attempt_at is in
// the past, flipping them to 'sending'. The UPDATE-then-SELECT pattern
// guarantees one worker (or even multiple, if scaled later) can't double-
// process the same row — the second updater sees status='sending' and the
// WHERE clause excludes it.
async function claimBatch() {
    const claimedAt = new Date();
    // ORDER BY id keeps oldest-first; LIMIT trims to BATCH_SIZE. Sequelize
    // supports orderBy/limit on UPDATE for MySQL.
    const [, affected] = await sequelize.query(
        `UPDATE email_jobs
            SET status = 'sending',
                updated_at = :claimedAt
          WHERE status = 'queued'
            AND next_attempt_at <= :claimedAt
          ORDER BY id ASC
          LIMIT :limit`,
        {
            replacements: { claimedAt, limit: BATCH_SIZE },
        }
    );
    // The actual rows haven't been returned yet — we know exactly the set we
    // just flipped because we filtered identically below.
    if (!affected || affected.affectedRows === 0) return [];
    const rows = await EmailJob.findAll({
        where: {
            status: 'sending',
            // updated_at was set to claimedAt above; a small window of
            // tolerance handles any clock skew.
            updated_at: { [Op.gte]: new Date(claimedAt.getTime() - 1000) },
        },
        order: [['id', 'ASC']],
        limit: BATCH_SIZE,
    });
    return rows;
}

async function processOne(job) {
    const attempts = (job.attempts || 0) + 1;
    try {
        const result = await mailer.send({
            to: job.to_email,
            subject: job.subject,
            html: job.html,
        });
        // mailer.send returns { skipped: true } when SMTP isn't configured —
        // treat that as a soft failure so the row stays in the queue rather
        // than being marked sent without actually delivering.
        if (result && result.skipped) {
            await job.update({
                status: 'queued',
                attempts,
                last_error: 'SMTP not configured',
                next_attempt_at: new Date(Date.now() + 5 * 60 * 1000),
            });
            return;
        }
        await job.update({
            status: 'sent',
            attempts,
            sent_at: new Date(),
            last_error: null,
        });
    } catch (err) {
        const message = String(err?.message || err).slice(0, 500);
        if (attempts >= MAX_ATTEMPTS) {
            await job.update({
                status: 'failed',
                attempts,
                failed_at: new Date(),
                last_error: message,
            });
            console.warn(`[email-worker] job ${job.id} -> failed (${attempts} attempts): ${message}`);
        } else {
            const delaySec = BACKOFF_BASE_SECONDS * attempts * attempts;
            await job.update({
                status: 'queued',
                attempts,
                last_error: message,
                next_attempt_at: new Date(Date.now() + delaySec * 1000),
            });
            console.warn(`[email-worker] job ${job.id} -> retry in ${delaySec}s (attempt ${attempts}): ${message}`);
        }
    }
}

async function tick() {
    if (running) return; // Skip overlapping ticks if the previous batch is slow.
    if (!mailer.isConfigured()) return;
    running = true;
    try {
        const jobs = await claimBatch();
        for (const j of jobs) {
            // Serial inside a tick — Gmail/SMTP servers throttle hard on
            // parallel connections from the same account. Cheap enough at
            // batch sizes this small.
            await processOne(j);
        }
    } catch (err) {
        console.warn('[email-worker] tick failed:', err.message);
    } finally {
        running = false;
    }
}

function start() {
    if (timer) return;
    timer = setInterval(tick, POLL_INTERVAL_MS);
    // Don't pin the event loop on shutdown.
    if (timer.unref) timer.unref();
    console.log('[email-worker] started');
}

function stop() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

module.exports = { start, stop, tick };
