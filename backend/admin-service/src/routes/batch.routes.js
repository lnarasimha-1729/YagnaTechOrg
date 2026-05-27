const router = require('express').Router();
const ctrl = require('../controllers/BatchController');

// Mounted under /api/admin (adminOnly). The controller layer additionally
// enforces a college_id on the JWT — root admins are blocked there.
router.get('/batches', ctrl.list);
// Dropdown helper — no college-admin gate, scopes by ?clgIds= query param.
router.get('/batches/by-colleges', ctrl.byColleges);
router.get('/batches/eligible-students', ctrl.eligibleStudents);
router.get('/batches/:id', ctrl.show);
router.post('/batches', ctrl.store);
router.put('/batches/:id', ctrl.update);
router.delete('/batches/:id', ctrl.delete);
router.post('/batches/:id/members', ctrl.addMembers);
router.delete('/batches/:id/members/:userId', ctrl.removeMember);

module.exports = router;
