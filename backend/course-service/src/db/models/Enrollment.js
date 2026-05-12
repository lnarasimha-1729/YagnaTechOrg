import { DataTypes } from 'sequelize';
import sequelize from '../index.js';
import Course from './Course.js';

const Enrollment = sequelize.define('Enrollment', {
  enrollmentId: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    // No DB-level FK — users table lives in a separate database (auth-service).
    // Referential integrity is enforced at the application layer.
  },
  courseId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: Course,
      key: 'courseId'
    }
  },
  status: {
    type: DataTypes.ENUM('enrolled', 'in-progress', 'completed', 'dropped'),
    defaultValue: 'enrolled',
    allowNull: false
  },
  enrolledAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'enrollments',
  timestamps: true // automatically adds createdAt and updatedAt
});

// Add association
Enrollment.belongsTo(Course, { foreignKey: 'courseId' });

export default Enrollment;
