const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Course = sequelize.define('Course', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        title: { type: DataTypes.STRING(255), allowNull: false },
        slug: { type: DataTypes.STRING(255) },
        short_description: { type: DataTypes.TEXT },
        user_id: { type: DataTypes.INTEGER },
        category_id: { type: DataTypes.INTEGER },
        course_type: { type: DataTypes.STRING(50), defaultValue: 'general' },
        status: { type: DataTypes.STRING(50), defaultValue: 'active' },
        level: { type: DataTypes.STRING(50) },
        language: { type: DataTypes.STRING(50) },
        is_paid: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_best: { type: DataTypes.BOOLEAN, defaultValue: false },
        price: { type: DataTypes.FLOAT, defaultValue: 0 },
        discounted_price: { type: DataTypes.FLOAT, defaultValue: 0 },
        discount_flag: { type: DataTypes.BOOLEAN, defaultValue: false },
        enable_drip_content: { type: DataTypes.BOOLEAN, defaultValue: false },
        drip_content_settings: { type: DataTypes.TEXT },
        meta_keywords: { type: DataTypes.TEXT },
        meta_description: { type: DataTypes.TEXT },
        thumbnail: { type: DataTypes.STRING(255) },
        banner: { type: DataTypes.STRING(255) },
        preview: { type: DataTypes.STRING(255) },
        description: { type: DataTypes.TEXT('long') },
        requirements: { type: DataTypes.TEXT },
        outcomes: { type: DataTypes.TEXT },
        faqs: { type: DataTypes.TEXT },
        instructor_ids: { type: DataTypes.TEXT },
        // Array of clgIds (college-service primary key strings) the course is
        // offered at. No FK because colleges live in lucy_devdb, not lms_admin.
        // Validated at the service layer against college-service.
        clg_ids: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
        average_rating: { type: DataTypes.FLOAT, defaultValue: 0 },
        expiry_period: { type: DataTypes.INTEGER, allowNull: true },
        // Whether completion of this course grants a certificate. Surfaced on
        // the public course-details page (the "Includes certificate" line) and
        // gates the certificate-issue flow.
        has_certificate: { type: DataTypes.BOOLEAN, defaultValue: true },
    }, { tableName: 'courses', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

    Course.associate = (models) => {
        Course.belongsTo(models.Category, { foreignKey: 'category_id' });
        Course.belongsTo(models.User, { as: 'creator', foreignKey: 'user_id' });
    };

    return Course;
};
