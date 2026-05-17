import { Router } from 'express';
import * as controller from '../controllers/course.controller.js';
import isLoggedIn from '../middlewares/isLoggedin.js';
import authRoles from '../middlewares/authRoles.js';

const router = Router();

router.post('/add', isLoggedIn, authRoles(['admin']), controller.addCourse);
router.get('/all', isLoggedIn, controller.getAllCourses);
// Must be registered before /:courseId — otherwise Express matches the
// generic param route first and treats "by-college" as a courseId.
router.get('/by-college/:clgId', isLoggedIn, controller.getCoursesByCollege);
router.get('/:courseId', isLoggedIn, controller.getCourseById);
router.put('/update/:courseId', isLoggedIn, authRoles(['admin']), controller.updateCourse);
router.delete('/delete/:courseId', isLoggedIn, authRoles(['admin']), controller.deleteCourse);


export default router;