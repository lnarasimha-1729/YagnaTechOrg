const router = require('express').Router();
const upload = require('../middlewares/multer');
const ctrl = require('../controllers/StudentController');

router.get('/students', ctrl.index);
// Distinct college names for the Manage Students filter dropdown. Must be
// declared before '/students/:id' so 'colleges' isn't matched as an :id.
router.get('/students/colleges', ctrl.colleges);
router.get('/students/:id', ctrl.show);
// Manage Students → Program Request column "Send" button.
router.post('/students/:id/program-request', ctrl.programRequest);
router.post('/students', upload.single('photo'), ctrl.store);
router.post('/students/:id', upload.single('photo'), ctrl.update);
router.delete('/students/:id', ctrl.destroy);

module.exports = router;
