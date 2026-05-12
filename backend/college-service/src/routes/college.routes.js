import { Router } from 'express';
import * as controller from '../controllers/college.controller.js';
import isLoggedIn from '../middlewares/isLoggedin.js';
import authRoles from '../middlewares/authRoles.js';

const router = Router();

router.post('/add', isLoggedIn, authRoles(['admin']), controller.addCollege);
// Students need to read the list to pick their college on the profile page —
// the College Admin dashboard keys aggregations on the clgId they choose,
// so a free-text college name would never aggregate. Read access only;
// add/update/delete remain admin-only below.
// Public — the dropdown on the student profile page needs to load this
// before the user picks a college, and gating it on the access-token
// interceptor caused the dropdown to be empty whenever the token race
// lost (cookie didn't survive the cross-service hop through Bastion).
// The list contains only clgId / clgName / address — no sensitive fields.
router.get('/all', controller.getAllColleges);
router.get('/:clgId', isLoggedIn, authRoles(['admin', 'user']), controller.getCollegeById);
router.put('/update/:clgId', isLoggedIn, authRoles(['admin', 'user']), controller.updateCollege);
router.delete('/delete/:clgId', isLoggedIn, authRoles(['admin']), controller.deleteCollege);

export default router;
