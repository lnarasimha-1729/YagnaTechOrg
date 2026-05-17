import { DataTypes } from 'sequelize';
import sequelize from '../index.js';

const Course = sequelize.define('Course', {
  courseId: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  duration: {
    type: DataTypes.INTEGER, // in hours or minutes, your choice
    allowNull: false,
  },
  isPreAssessmentNeeded: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  modules: {
    type: DataTypes.JSON, // store modules as an array of objects
    allowNull: true,
  },
  clgIds: {
    // Array of college IDs (clgId strings) the course is offered at.
    // No DB-level FK — colleges live in college-service's DB. Validated at the
    // application layer in the controller by hitting GET /college/all.
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  // Instructor assigned to teach this course. Stores the auth-service userId
  // (string) of a user whose role is 'instructor'. No DB-level FK because
  // instructors live in lucy_devdb (auth-service), not this course DB —
  // validation is intentionally application-layer (the admin dropdown is
  // sourced from /api/admin/manage/instructors). Nullable so legacy rows and
  // courses authored before this field existed keep working.
  instructorId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'courses',
  timestamps: true, // adds createdAt & updatedAt automatically
});

export default Course;


// ==============Notes===================
// modules is stored as JSON so you can save an array like:
// [
//   { "moduleId": "M1", "title": "Introduction", "duration": 30 },
//   { "moduleId": "M2", "title": "Advanced Concepts", "duration": 60 }
// ]