const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('QuizSubmission', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        quiz_id: { type: DataTypes.INTEGER },
        user_id: { type: DataTypes.INTEGER },
        correct_answer: { type: DataTypes.TEXT('long') },
        wrong_answer: { type: DataTypes.TEXT('long') },
        submits: { type: DataTypes.TEXT('long') },
        // Raw attempt result, persisted as first-class columns so the player
        // can restore "your last score" without parsing the submits JSON.
        score: { type: DataTypes.INTEGER, allowNull: true },
        total: { type: DataTypes.INTEGER, allowNull: true },
    }, { tableName: 'quiz_submissions', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });
};
