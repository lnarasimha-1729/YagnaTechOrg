import Course from '../db/models/Course.js';
import { validateCollegeIds, getCollegesByIds } from '../utils/collegeClient.js';
import { validateAddCourse, validateUpdateCourse } from '../validators/course.validator.js';

// Add a new course
export const addCourse = async (req, res) => {
  const parsed = validateAddCourse(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.errors });
  }
  const data = parsed.value;

  const existingCourse = await Course.findByPk(data.courseId);
  if (existingCourse) {
    return res.status(409).json({ error: 'Course with this ID already exists' });
  }

  try {
    const { ok, unknown } = await validateCollegeIds(data.clgIds);
    if (!ok) {
      return res.status(400).json({
        error: 'Unknown clgId(s) — not found in college-service',
        unknown,
      });
    }
  } catch (err) {
    console.error('[course] college validation failed:', err.message);
    return res.status(503).json({ error: 'College service unreachable; cannot validate clgIds' });
  }

  try {
    const newCourse = await Course.create(data);
    console.log(`[course] created ${data.courseId} for clgIds=${data.clgIds.join(',')}`);
    res.status(201).json(newCourse);
  } catch (error) {
    console.error('[course] create failed:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all courses
export const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.findAll();
    res.status(200).json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get course by ID
export const getCourseById = async (req, res) => {
  const { courseId } = req.params;
  try {
    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const colleges = await getCollegesByIds(course.clgIds || []);
    res.status(200).json({ ...course.toJSON(), colleges });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all courses offered at a given college. Uses Sequelize's JSON_CONTAINS
// helper for MySQL so we let the DB do the filtering instead of pulling every
// row over the wire.
export const getCoursesByCollege = async (req, res) => {
  const { clgId } = req.params;
  if (!clgId) {
    return res.status(400).json({ error: 'clgId is required' });
  }
  try {
    const { Sequelize } = await import('sequelize');
    const courses = await Course.findAll({
      where: Sequelize.literal(
        `JSON_CONTAINS(clgIds, ${Course.sequelize.escape(JSON.stringify(clgId))})`
      ),
    });
    res.status(200).json(courses);
  } catch (error) {
    console.error('Error fetching courses by college:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update course
export const updateCourse = async (req, res) => {
  const { courseId } = req.params;
  const parsed = validateUpdateCourse(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.errors });
  }
  const patch = parsed.value;

  try {
    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (patch.clgIds !== undefined) {
      try {
        const { ok, unknown } = await validateCollegeIds(patch.clgIds);
        if (!ok) {
          return res.status(400).json({
            error: 'Unknown clgId(s) — not found in college-service',
            unknown,
          });
        }
      } catch (err) {
        console.error('[course] college validation failed:', err.message);
        return res.status(503).json({ error: 'College service unreachable; cannot validate clgIds' });
      }
    }

    await course.update(patch);
    console.log(`[course] updated ${courseId}; fields=${Object.keys(patch).join(',')}`);
    res.status(200).json(course);
  } catch (error) {
    console.error('[course] update failed:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete course
export const deleteCourse = async (req, res) => {
  const { courseId } = req.params;
  try {
    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    await course.destroy();
    res.status(204).send({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
