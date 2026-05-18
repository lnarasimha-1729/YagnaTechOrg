const router = require('express').Router();
const ctrl = require('../controllers/CourseController');
const upload = require('../middlewares/multer');
const { adminOnly, adminOrInstructor } = require('../middlewares/auth');

const mediaFields = upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
    { name: 'preview', maxCount: 1 },
    { name: 'og_image', maxCount: 1 },
]);

// Mounted via `app.use('/api/admin', auth, courseRoutes)` in server.js — the
// `auth` middleware decodes the JWT, then each route applies its own role gate:
//   - read endpoints (list, edit-meta)          → admin OR instructor
//     (CourseService.list/edit scope to the instructor's own courses)
//   - everything else (create, update, delete,
//     duplicate, status, approval)              → admin only

router.get('/courses', adminOrInstructor, ctrl.index);
router.get('/course/create', adminOnly, ctrl.create);
router.post('/course/store', adminOnly, mediaFields, ctrl.store);
router.get('/course/edit/:id', adminOrInstructor, ctrl.edit);
// `update` handles the per-tab admin form (Basic, Pricing, etc). Instructors
// don't see those tabs (Edit.jsx filters them) and have no need to call this —
// keep it admin-only.
router.post('/course/update/:id', adminOnly, mediaFields, ctrl.update);
router.get('/course/duplicate/:id', adminOnly, ctrl.duplicate);
router.get('/course/status/:type/:id', adminOnly, ctrl.status);
router.delete('/course/delete/:id', adminOnly, ctrl.delete);
router.get('/course/draft/:id', adminOnly, ctrl.draft);
router.post('/course/approval/:id', adminOnly, ctrl.approval);

module.exports = router;
