/**
 * Router for the course discussion forum.
 *
 * The Course Player is the primary consumer, so the bulk of the routes live
 * on the PUBLIC tree with optional auth (the service decodes the JWT and
 * scopes by user.id where present). Mutating endpoints reject anonymous
 * callers via the service's assertCanParticipate/Moderate helpers.
 *
 * Mount points (added in server.js):
 *   app.use('/api/public', forumRoutes.public);
 *   app.use('/api/admin', auth, forumRoutes.admin);
 *
 * URL surface (player):
 *   GET    /api/public/forum/course/:course_id          # list questions
 *   GET    /api/public/forum/question/:id               # question + replies
 *   POST   /api/public/forum/question                   # new question / reply
 *   POST   /api/public/forum/question/:id               # update
 *   DELETE /api/public/forum/question/:id               # delete (cascades replies)
 *   POST   /api/public/forum/like/:id                   # toggle like
 *   POST   /api/public/forum/dislike/:id                # toggle dislike
 *   POST   /api/public/forum/report/:id                 # report a post
 *
 * Admin tree mirrors the player tree — used by future admin moderation UI.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const c = require('./forum.controller');

// Optional auth — decodes the token if present (so req.user.id and role are
// populated for permission checks) but doesn't 401 when absent. Matches the
// zoom-live-class public router pattern.
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

/* ============================== Public router ============================== */
const publicRouter = express.Router();

publicRouter.get('/forum/course/:course_id', optionalAuth, c.index);
publicRouter.get('/forum/question/:id', optionalAuth, c.show);
publicRouter.post('/forum/question', optionalAuth, c.store);
publicRouter.post('/forum/question/:id', optionalAuth, c.update);
publicRouter.delete('/forum/question/:id', optionalAuth, c.destroy);
publicRouter.post('/forum/like/:id', optionalAuth, c.like);
publicRouter.post('/forum/dislike/:id', optionalAuth, c.dislike);
publicRouter.post('/forum/report/:id', optionalAuth, c.report);

/* ============================== Admin router ============================== */
// Mounted under /api/admin with `auth` (JWT decode) at the mount point.
// Same handlers — service-layer permission checks apply uniformly.
const adminRouter = express.Router();

adminRouter.get('/forum/course/:course_id', c.index);
adminRouter.get('/forum/question/:id', c.show);
adminRouter.post('/forum/question', c.store);
adminRouter.post('/forum/question/:id', c.update);
adminRouter.delete('/forum/question/:id', c.destroy);
adminRouter.post('/forum/like/:id', c.like);
adminRouter.post('/forum/dislike/:id', c.dislike);
adminRouter.post('/forum/report/:id', c.report);

module.exports = { public: publicRouter, admin: adminRouter };
