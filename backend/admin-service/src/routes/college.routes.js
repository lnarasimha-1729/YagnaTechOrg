const router = require('express').Router();
const ctrl = require('../controllers/CollegeController');

router.get('/colleges', ctrl.index);
router.get('/colleges/:id', ctrl.show);
router.post('/colleges', ctrl.store);
// POST-on-update mirrors admin.routes.js so the frontend can use one
// multipart-friendly verb across CRUD pages. (No file uploads here yet, but
// keeping the verb consistent avoids special-casing the API client.)
router.post('/colleges/:id', ctrl.update);
router.delete('/colleges/:id', ctrl.destroy);

module.exports = router;
