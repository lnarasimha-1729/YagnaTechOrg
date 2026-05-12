// Centralised enums + constants for the pre-assessment onboarding flow.
// Kept in one place so the model, validation middleware, and any future
// reporting code all reference the same canonical values.

export const GENDERS = Object.freeze(["Male", "Female", "Other"]);

export const PROGRAMS = Object.freeze([
  "AI Frontier",
  "AI Frontier Plus",
  "Elite AI Residency",
]);

export const ASSESSMENT_STATUSES = Object.freeze([
  "registered",
  "in-progress",
  "completed",
  "abandoned",
]);

export const ALLOWED_PROOF_MIMES = Object.freeze([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

export const ALLOWED_PROOF_EXTS = Object.freeze([".pdf", ".jpg", ".jpeg", ".png"]);

// 5 MB cap — large enough for a clear photo / scan of a college ID, small
// enough to keep the upload disk footprint under control on a shared box.
export const MAX_PROOF_SIZE_BYTES = 5 * 1024 * 1024;
