const { DataTypes } = require('sequelize');

// Link table joining a Batch to a student (auth-service users.userId, stored
// as string because user ids are 11-digit numerics that overflow INT). A
// (batch_id, user_id) pair is unique — a student can only sit in a given
// batch once.
module.exports = (sequelize) => {
    const BatchMember = sequelize.define('BatchMember', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        batch_id: { type: DataTypes.INTEGER, allowNull: false },
        user_id: { type: DataTypes.STRING(32), allowNull: false },
    }, {
        tableName: 'batch_members',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { unique: true, fields: ['batch_id', 'user_id'] },
            { fields: ['user_id'] },
        ],
    });

    return BatchMember;
};
