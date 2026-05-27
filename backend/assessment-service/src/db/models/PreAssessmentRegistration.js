import { DataTypes } from "sequelize";
import sequelize from "../index.js";
import {
  GENDERS,
  ASSESSMENT_STATUSES,
} from "../../utils/preAssessmentConstants.js";

// Registration captured by the onboarding modal *before* a student is allowed
// to attempt the pre-assessment. One row per (userId, email) — duplicate
// submissions are rejected at the controller level so a returning student
// can't accidentally re-register and overwrite their proof.
const PreAssessmentRegistration = sequelize.define(
  "PreAssessmentRegistration",
  {
    registrationId: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    // Optional — populated when the request comes from an authenticated
    // session. Kept nullable so the form can also be filled by walk-in users
    // who are not yet logged in (admin-driven flows).
    userId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    fullName: {
      type: DataTypes.STRING(120),
      allowNull: false,
      validate: { notEmpty: true, len: [2, 120] },
    },
    email: {
      type: DataTypes.STRING(160),
      allowNull: false,
      validate: { isEmail: true },
    },
    phoneNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { is: /^[0-9+\-\s()]{7,20}$/ },
    },
    gender: {
      type: DataTypes.ENUM(...GENDERS),
      allowNull: false,
    },
    // Admin-created program the student picked. Stored as id + frozen title
    // snapshot so historic registrations survive renames / deletes of the
    // source program row. selectedProgramId is null only for legacy rows
    // created before admin programs were wired in.
    selectedProgramId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Widened from ENUM to free-text — admin-created program titles aren't
    // a fixed set. The legacy values ("AI Frontier" etc.) still pass through
    // this column as plain strings. Auto-migration in app.js drops the ENUM
    // constraint on existing tables.
    selectedProgram: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    // File metadata — stored as a JSON blob so we can extend the structure
    // (e.g. add S3 keys or virus-scan results) without a migration.
    uploadedCollegeProof: {
      type: DataTypes.JSON,
      allowNull: false,
      // Shape: { fileName, originalName, mimeType, size, url, storedAt }
    },
    declarationAccepted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      validate: {
        mustBeAccepted(value) {
          if (value !== true) {
            throw new Error("Declaration must be accepted");
          }
        },
      },
    },
    assessmentStatus: {
      type: DataTypes.ENUM(...ASSESSMENT_STATUSES),
      allowNull: false,
      defaultValue: "registered",
    },
    assessmentStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Audit-friendly tracking fields. Captured at submission time so admins
    // can later trace which IP / agent registered an entry.
    submittedFromIp: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    submittedUserAgent: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "pre_assessment_registrations",
    timestamps: true,
    indexes: [
      { fields: ["userId"] },
      { fields: ["email"] },
      { fields: ["selectedProgram"] },
      { fields: ["assessmentStatus"] },
    ],
  }
);

export default PreAssessmentRegistration;
