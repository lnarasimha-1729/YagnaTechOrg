/**
 * Routers for the Zoom Live Class module.
 *
 * Exposes two routers — one for the admin tree (authenticated, role-gated)
 * and one for the course-player tree (public, with optional auth so the
 * server can detect hosts and upgrade their role).
 *
 * Mounted from server.js:
 *   app.use('/api/admin',  adminOnly, zoomLiveRoutes.admin);
 *   app.use('/api/public',             zoomLiveRoutes.public);
 *
 * URL surface:
 *   ADMIN  (require admin token; middleware is applied at mount-point)
 *     GET    /api/admin/zoom-live-class/settings
 *     POST   /api/admin/zoom-live-class/settings
 *     GET    /api/admin/zoom-live-class/course/:course_id
 *     GET    /api/admin/zoom-live-class/course/:course_id/instructors
 *     POST   /api/admin/zoom-live-class/course/:course_id
 *     POST   /api/admin/zoom-live-class/:id
 *     DELETE /api/admin/zoom-live-class/:id
 *     GET    /api/admin/zoom-live-class/:id/join
 *     POST   /api/admin/zoom-live-class/:id/sdk-signature
 *     GET    /api/admin/zoom-live-class/:id/status
 *
 *   PUBLIC (course-player; tries JWT but doesn't require it)
 *     GET    /api/public/zoom-live-class/course/:course_id
 *     GET    /api/public/zoom-live-class/:id/join
 *     POST   /api/public/zoom-live-class/:id/sdk-signature
 *     GET    /api/public/zoom-live-class/:id/status
 *
 * Naming: the URL prefix /zoom-live-class deliberately differs from the
 * existing /live-class so both implementations co-exist without collision.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const c = require('./live-class.controller');
const { adminOnly, adminOrInstructor } = require('../middlewares/auth');

// Optional-auth: decode the token if present so req.user is populated for
// host-detection, but do NOT 401 when absent. Mirrors the reference's
// shared/middleware/auth.middleware.optionalAuth.
const optionalAuth = (req, _res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
        if (!token) return next();
        const decoded = jwt.verify(token, env.jwt.secret);
        req.user = decoded;
    } catch {
        // Bad token — treat as anonymous, don't reject.
    }
    next();
};

/* ============================== Admin router ============================== */
// Mounted under /api/admin with `auth` applied at the mount point (server.js).
// Each route picks its own gate:
//   - settings              → admin only (instructors don't manage Zoom creds)
//   - per-course CRUD/join  → admin OR instructor (the service further scopes
//                             writes to courses the instructor is assigned to)
const adminRouter = express.Router();

adminRouter.get('/zoom-live-class/settings', adminOnly, c.read_settings);
adminRouter.post('/zoom-live-class/settings', adminOnly, c.write_settings);

adminRouter.get('/zoom-live-class/course/:course_id', adminOrInstructor, c.list_by_course);
adminRouter.get('/zoom-live-class/course/:course_id/instructors', adminOrInstructor, c.instructors_for_course);
adminRouter.post('/zoom-live-class/course/:course_id', adminOrInstructor, c.store);

adminRouter.post('/zoom-live-class/:id', adminOrInstructor, c.update);
adminRouter.delete('/zoom-live-class/:id', adminOrInstructor, c.destroy);

adminRouter.get('/zoom-live-class/:id/join', adminOrInstructor, c.resolve_join);
adminRouter.post('/zoom-live-class/:id/sdk-signature', adminOrInstructor, c.sdk_signature);
adminRouter.get('/zoom-live-class/:id/status', adminOrInstructor, c.sync_status);

/* ============================== Public router ============================== */
// Mounted under /api/public — no global auth, optionalAuth on the join/sdk
// endpoints so the server can detect hosts.
const publicRouter = express.Router();

publicRouter.get('/zoom-live-class/course/:course_id', c.list_by_course);
publicRouter.get('/zoom-live-class/:id/join', optionalAuth, c.resolve_join);
publicRouter.post('/zoom-live-class/:id/sdk-signature', optionalAuth, c.sdk_signature);
publicRouter.get('/zoom-live-class/:id/status', optionalAuth, c.sync_status);

module.exports = { admin: adminRouter, public: publicRouter };
