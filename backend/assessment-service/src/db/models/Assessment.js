import { DataTypes } from "sequelize";
import sequelize from "../index.js";

const Assessment = sequelize.define("Assessment", {
  assessmentId: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  type: {
    type: DataTypes.ENUM("pre", "post"),
    allowNull: false
  },
  setId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: "questionsets",  // points to QuestionSet
      key: "setId"
    }
  },
  startAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  score: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  timer: {
    type: DataTypes.INTEGER,  // in seconds or minutes
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM("not-started", "available", "in-progress", "completed", "expired"),
    defaultValue: "not-started",
    allowNull: false
  },
  // Colleges this assessment is offered to (array of clgId strings).
  // Persisted as JSON for the same reason QuestionSet.questions is JSON —
  // unbounded list, no FK joins needed at read time.
  clgIds: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  // Courses this assessment is bundled with (array of course id strings).
  // Same shape contract as Program.course_ids — admin builds assessments
  // against the same course pool.
  courseIds: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  }
}, {
  tableName: "assessments",
  timestamps: true
});

export default Assessment;
