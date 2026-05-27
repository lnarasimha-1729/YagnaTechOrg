const { DataTypes } = require('sequelize');

// Durable email queue. One row per outgoing message. The worker
// (src/jobs/emailWorker.js) polls this table, claims jobs in `queued`
// status, attempts the SMTP send, and writes status/attempts/last_error
// back. Lives in the admin DB so it shares the connection that powers the
// rest of admin-service.
//
// Status transitions:
//   queued  → sending (when worker claims the row)
//   sending → sent    (SMTP returned a messageId)
//   sending → failed  (attempts >= MAX, last_error captured)
//   sending → queued  (transient error, attempts < MAX, next_attempt_at
//                       pushed forward via exponential backoff)
module.exports = (sequelize) => {
    const EmailJob = sequelize.define('EmailJob', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        to_email: { type: DataTypes.STRING(255), allowNull: false },
        subject: { type: DataTypes.STRING(255), allowNull: false },
        html: { type: DataTypes.TEXT('long'), allowNull: false },
        // Soft FK to batches.id / users.userId — populated for the batch-add
        // notification so future admin tooling can join "emails sent for
        // this batch" without re-parsing the body. Nullable for ad-hoc sends.
        batch_id: { type: DataTypes.INTEGER, allowNull: true },
        user_id: { type: DataTypes.STRING(32), allowNull: true },
        status: {
            type: DataTypes.ENUM('queued', 'sending', 'sent', 'failed'),
            allowNull: false,
            defaultValue: 'queued',
        },
        attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        last_error: { type: DataTypes.STRING(500), allowNull: true },
        // Worker skips rows whose next_attempt_at is in the future, which is
        // how exponential backoff is implemented without a separate scheduler.
        next_attempt_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        // Audit timestamps separate from sequelize's created_at/updated_at —
        // they describe when SMTP actually accepted/rejected the message
        // rather than when the row last mutated.
        sent_at: { type: DataTypes.DATE, allowNull: true },
        failed_at: { type: DataTypes.DATE, allowNull: true },
    }, {
        tableName: 'email_jobs',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['status', 'next_attempt_at'] },
            { fields: ['batch_id'] },
            { fields: ['user_id'] },
        ],
    });

    return EmailJob;
};
