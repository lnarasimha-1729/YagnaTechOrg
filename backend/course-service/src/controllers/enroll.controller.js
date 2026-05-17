import Enrollment from '../db/models/Enrollment.js';
import {generateEnrollmentId} from '../utils/uidGeneration.js';
import Course from '../db/models/Course.js';
import sequelize from '../db/index.js';
import { Op, QueryTypes } from 'sequelize';

// Look up the calling student's current collegeId. We hit the shared
// users table directly (auth-service writes it, course-service reads it)
// rather than baking it into the JWT, so a freshly-saved college on the
// Profile page takes effect on the very next request — no token refresh
// dance required.
async function lookupCollegeId(userId) {
  const rows = await sequelize.query(
    'SELECT collegeId FROM users WHERE userId = :userId LIMIT 1',
    { replacements: { userId }, type: QueryTypes.SELECT }
  );
  return rows?.[0]?.collegeId || null;
}


// Enroll a user in a course
export const enrollInCourse = async (req, res) => {
  const userId = req.user.id;
  const { courseId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  if (!courseId) {
    return res.status(400).json({ error: 'Course ID is required' });
  }

  // College gate. A student must have a college on their profile, and the
  // course must be offered at that college. Fail-closed for both cases.
  const collegeId = await lookupCollegeId(userId);
  if (!collegeId) {
    return res.status(403).json({
      error: 'Set your college in Profile before enrolling.',
      no_college: true,
    });
  }

  const course = await Course.findByPk(courseId);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }
  const courseClgIds = Array.isArray(course.clgIds) ? course.clgIds : [];
  if (!courseClgIds.includes(collegeId)) {
    return res.status(403).json({ error: 'Course not available for your college.' });
  }

  try {
    const enrollment = await Enrollment.create({
      enrollmentId: generateEnrollmentId(),
      userId,
      courseId,
    });
    res.status(201).json(enrollment);
  } catch (error) {
    console.error('Error enrolling in course:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all courses a user is enrolled in. Gated by the student's collegeId:
// if the profile has no college set we return an empty list with a flag so
// the UI can prompt them to pick one in Profile. Enrollments that point at
// courses NOT offered at the student's college are filtered out — this is
// the second layer of defense against cross-college access (the first is
// admin-service's /api/public/courses college filter).
export const getMyCourses = async (req, res) => {
  const userId = req.user.id;
  const collegeId = await lookupCollegeId(userId);

  if (!collegeId) {
    return res.status(200).json({
      enrollments: [],
      no_college: true,
      message: 'Set your college in Profile to see your courses.',
    });
  }

  try {
    const enrollments = await Enrollment.findAll({
      where: { userId },
      include: [{ model: Course }],
    });

    // Keep only enrollments whose course is offered at the student's college.
    // We filter in JS (rather than via JSON_CONTAINS in the SQL) because the
    // `include` shape makes a literal-based where awkward and the result set
    // per user is small.
    const visible = (enrollments || []).filter((e) => {
      const ids = Array.isArray(e.Course?.clgIds) ? e.Course.clgIds : [];
      return ids.includes(collegeId);
    });

    res.status(200).json(visible);
  } catch (error) {
    console.error('Error fetching user courses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
