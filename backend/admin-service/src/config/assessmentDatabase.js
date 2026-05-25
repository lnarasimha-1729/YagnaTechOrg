const { Sequelize } = require('sequelize');
const env = require('./env');

/**
 * Read-only Sequelize handle for the assessment-service database.
 * Used by Manage Students to surface the selectedProgram value the student
 * picked on the pre-assessment onboarding form. Schema lives in
 * `pre_assessment_registrations` (camelCase columns by convention).
 *
 * We don't define models here — raw SQL via `query()` is enough for the
 * single lookup the listing needs and avoids re-declaring the registration
 * schema in two services.
 */
const assessmentSequelize = new Sequelize(
    env.assessmentDb.name,
    env.assessmentDb.user,
    env.assessmentDb.pass,
    {
        host: env.assessmentDb.host,
        port: env.assessmentDb.port,
        dialect: env.assessmentDb.dialect,
        logging: false,
        define: { underscored: false, freezeTableName: true },
        pool: { max: 5, min: 0, acquire: 60000, idle: 10000 },
        retry: {
            max: 2,
            match: [/ECONNRESET/, /ETIMEDOUT/, /SequelizeConnectionError/],
        },
        dialectOptions: {
            connectTimeout: 60000,
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000,
        },
    }
);

module.exports = assessmentSequelize;
