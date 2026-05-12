import { Op } from "sequelize";
import PreAssessmentRegistration from "../db/models/PreAssessmentRegistration.js";

const buildRegistrationId = () =>
  `PAR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

// Returns the existing registration that should block a fresh submission, or
// null if the user is free to register. Looks up by userId first, then falls
// back to email — that way an authenticated re-submission is caught even if
// the user changed the email field, and an anonymous submission can't reuse
// an email that was already registered under another session.
export async function findBlockingRegistration({ userId, email }) {
  const orClauses = [];
  if (userId) orClauses.push({ userId });
  if (email) orClauses.push({ email });
  if (orClauses.length === 0) return null;
  return PreAssessmentRegistration.findOne({ where: { [Op.or]: orClauses } });
}

export async function createRegistration(payload) {
  const registrationId = buildRegistrationId();
  return PreAssessmentRegistration.create({ registrationId, ...payload });
}

export async function getRegistrationById(registrationId) {
  return PreAssessmentRegistration.findByPk(registrationId);
}

export async function listRegistrations({ limit = 50, offset = 0, program } = {}) {
  const where = {};
  if (program) where.selectedProgram = program;
  return PreAssessmentRegistration.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });
}

export async function markAssessmentStarted(registrationId) {
  const reg = await PreAssessmentRegistration.findByPk(registrationId);
  if (!reg) return null;
  if (reg.assessmentStatus === "registered") {
    await reg.update({
      assessmentStatus: "in-progress",
      assessmentStartedAt: new Date(),
    });
  }
  return reg;
}
