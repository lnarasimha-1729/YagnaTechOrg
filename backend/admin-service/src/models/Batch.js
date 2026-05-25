const { DataTypes } = require('sequelize');

// A Batch is a named cohort of students at a single college. Owned by a
// college (clg_id refers to colleges.clgId in lucy_devdb). Members live in
// the batch_members link table — kept separate so the same student can
// belong to multiple batches over time without rewriting the user row.
module.exports = (sequelize) => {
    const Batch = sequelize.define('Batch', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        clg_id: { type: DataTypes.STRING(64), allowNull: false },
        name: { type: DataTypes.STRING(160), allowNull: false },
        // Free-form label admins use ("AI Frontier - Jan 2026"). Optional —
        // kept distinct from `name` so admins can rename without losing the
        // descriptive note.
        description: { type: DataTypes.STRING(500) },
        start_date: { type: DataTypes.DATEONLY, allowNull: true },
        end_date: { type: DataTypes.DATEONLY, allowNull: true },
        is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    }, {
        tableName: 'batches',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [{ fields: ['clg_id'] }],
    });

    return Batch;
};
