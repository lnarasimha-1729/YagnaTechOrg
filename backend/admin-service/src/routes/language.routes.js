const router = require('express').Router();
const ctrl = require('../controllers/LanguageController');

router.get('/languages', ctrl.index);
router.post('/language/store', ctrl.store);
router.post('/language/direction/:id', ctrl.updateDirection);
router.delete('/language/delete/:id', ctrl.delete);

module.exports = router;
