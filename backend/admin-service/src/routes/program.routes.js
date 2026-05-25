const router = require('express').Router();
const ctrl = require('../controllers/ProgramController');

router.get('/programs', ctrl.index);
router.get('/program/edit/:id', ctrl.show);
router.post('/program/store', ctrl.store);
router.post('/program/update/:id', ctrl.update);
router.delete('/program/delete/:id', ctrl.delete);

module.exports = router;
