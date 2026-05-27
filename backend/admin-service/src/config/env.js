require('dotenv').config();

module.exports = {
    port: Number(process.env.PORT || 5000),
    env: process.env.NODE_ENV || 'development',
    appUrl: process.env.APP_URL || 'http://localhost:5000',
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    jwt: {
        secret: process.env.JWT_SECRET || 'change-me-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    db: {
        name: process.env.DB_NAME,
        user: process.env.DB_USER,
        pass: process.env.DB_PASS,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: process.env.DB_DIALECT || 'mysql',
    },
    // Read-only handle to auth-service's DB (lucy_devdb). Used by the College
    // Dashboard endpoint for cross-DB counts. Same RDS host/credentials, different schema.
    authDb: {
        name: process.env.AUTH_DB_NAME || 'lucy_devdb',
        user: process.env.DB_USER,
        pass: process.env.DB_PASS,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: process.env.DB_DIALECT || 'mysql',
    },
    // Read-only handle to assessment-service's DB. Holds the canonical
    // PreAssessmentRegistration rows (selectedProgram, gender, college proof).
    // Manage Students reads selectedProgram from here so the Program Interested
    // column reflects the value the student submitted on the onboarding form.
    assessmentDb: {
        name: process.env.ASSESSMENT_DB_NAME || process.env.DB_NAME,
        user: process.env.DB_USER,
        pass: process.env.DB_PASS,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: process.env.DB_DIALECT || 'mysql',
    },
    mail: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM,
        // Public-facing LMS login URL embedded in transactional emails. Falls
        // back to the SPA dev port; override in .env for staging / prod.
        lmsLoginUrl: process.env.LMS_LOGIN_URL || 'http://localhost:5173/login',
    },
    // Shared secret used by sibling services (assessment-service today, more
    // later) to call admin-service's internal endpoints — currently just
    // /api/internal/email/enqueue. Must match INTERNAL_API_SECRET in each
    // caller's .env. Empty value disables the endpoint entirely (default in
    // dev to avoid an unauthenticated open relay).
    internalSecret: process.env.INTERNAL_API_SECRET || '',
};
