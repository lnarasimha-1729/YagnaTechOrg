const router = require('express').Router();
const ctrl = require('../controllers/CategoryController');
const upload = require('../middlewares/multer');
const { adminOnly, adminOrInstructor } = require('../middlewares/auth');

const fields = upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'category_logo', maxCount: 1 }]);

// Mounted via `app.use('/api/admin', auth, categoryRoutes)` — `auth` decodes
// the JWT, each route picks its own gate. The category LIST is read-only
// reference data the course-management screens need (filter dropdowns), so
// instructors may read it. Creating/editing/deleting categories stays
// admin-only.
router.get('/categories', adminOrInstructor, ctrl.index);
router.post('/category/store', adminOnly, fields, ctrl.store);
router.post('/category/update/:id', adminOnly, fields, ctrl.update);
router.delete('/category/delete/:id', adminOnly, ctrl.delete);

module.exports = router;
