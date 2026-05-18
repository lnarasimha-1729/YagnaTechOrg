const { DataTypes } = require('sequelize');

/**
 * `forum_reports` — a user flagging a forum post (question or reply) as
 * inappropriate. The lms-cp reference has a "Report" link in the kebab menu
 * but it is a dead `href="javascript:void(0)"` — here it is made functional.
 *
 * One row per (post, reporter). The UNIQUE index keeps a user from spamming
 * reports on the same post; re-reporting is a no-op.
 */
module.exports = (sequelize) => {
    const ForumReport = sequelize.define('ForumReport', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        forum_id: { type: DataTypes.INTEGER, allowNull: false },
        // auth-service userId of the reporter — BIGINT, no FK (same reason as
        // forums.user_id; users live in the auth DB).
        user_id: { type: DataTypes.BIGINT, allowNull: false },
        reason: { type: DataTypes.TEXT, allowNull: true },
    }, {
        tableName: 'forum_reports',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [{ unique: true, fields: ['forum_id', 'user_id'] }],
    });

    ForumReport.associate = (models) => {
        ForumReport.belongsTo(models.Forum, { foreignKey: 'forum_id' });
    };

    return ForumReport;
};
