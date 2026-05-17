const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Language = sequelize.define('Language', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
        code: { type: DataTypes.STRING(20), allowNull: true },
        direction: { type: DataTypes.ENUM('ltr', 'rtl'), allowNull: false, defaultValue: 'ltr' },
        is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    }, { tableName: 'languages', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

    return Language;
};
