const router = require('express').Router();
const ctrl = require('../controllers/ProgramController');

router.get('/programs', ctrl.index);
// Lookup helper — programs linked to a (college, batch) tuple. Powers the
// Manage Students program dropdowns. Mounted before the :id routes so the
// path stays unambiguous.
router.get('/programs/for-college-batch', ctrl.forCollegeBatch);
router.get('/program/edit/:id', ctrl.show);
router.post('/program/store', ctrl.store);
router.post('/program/update/:id', ctrl.update);
router.delete('/program/delete/:id', ctrl.delete);

module.exports = router;
