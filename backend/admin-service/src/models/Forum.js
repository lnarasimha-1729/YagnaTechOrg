const { DataTypes } = require('sequelize');

/**
 * `forums` — course Q&A / discussion threads + replies.
 *
 * Mirrors the Laravel migration 2026_02_21_000051_create_forums_table.php
 * (lms-cp reference). Same column shape so the Blade view's API contract is
 * preserved 1:1.
 *
 * Schema notes vs the reference:
 *   - `user_id` is BIGINT with NO FK. The Laravel migration FK-binds it to
 *     `users`, but in this project instructors/students live in the auth-DB
 *     (lucy_devdb.users) — not lms_admin.users. Same pattern live_classes
 *     uses for the same reason.
 *   - `parent_id` self-references: NULL = root question; set = reply to that
 *     question's id.
 *   - `likes` / `dislikes` are JSON arrays of user-id strings stored as TEXT
 *     (matching the PHP `as_array` / `json_encode` round-trip). Read/write
 *     parsing lives in forum.service.js.
 *   - `title` for a reply is literally the string "reply" (the reference's
 *     discriminator). For a question it's the real title.
 */
module.exports = (sequelize) => {
    const Forum = sequelize.define('Forum', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        course_id: { type: DataTypes.INTEGER, allowNull: true },
        // 11-digit auth-service userId — same shape live_classes.user_id uses.
        user_id: { type: DataTypes.BIGINT, allowNull: true },
        parent_id: { type: DataTypes.INTEGER, allowNull: true },
        title: { type: DataTypes.STRING(255), allowNull: true },
        description: { type: DataTypes.TEXT('long'), allowNull: true },
        likes: { type: DataTypes.TEXT('long'), allowNull: true },
        dislikes: { type: DataTypes.TEXT('long'), allowNull: true },
    }, {
        tableName: 'forums',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    });

    Forum.associate = (models) => {
        Forum.belongsTo(models.Course, { foreignKey: 'course_id' });
        Forum.belongsTo(models.Forum, { as: 'parent', foreignKey: 'parent_id' });
        Forum.hasMany(models.Forum, { as: 'children', foreignKey: 'parent_id' });
    };

    return Forum;
};
