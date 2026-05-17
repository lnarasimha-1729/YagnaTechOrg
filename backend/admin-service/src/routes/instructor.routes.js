const router = require('express').Router();
const upload = require('../middlewares/multer');
const ctrl = require('../controllers/InstructorController');

// upload.single('photo') parses the multipart FormData (same as admin
// routes) so req.body holds the text fields. The photo file itself is
// accepted but not persisted yet — the auth users table has no photo
// column for instructors; harmless to receive and ignore.
// Namespaced under /manage to avoid colliding with the pre-existing
// liveclass route GET /instructors (the live-class instructor picker),
// which is registered earlier and would otherwise shadow these.
router.get('/manage/instructors', ctrl.index);
router.get('/manage/instructors/:id', ctrl.show);
router.post('/manage/instructors', upload.single('photo'), ctrl.store);
router.post('/manage/instructors/:id', upload.single('photo'), ctrl.update);
router.delete('/manage/instructors/:id', ctrl.destroy);

module.exports = router;
