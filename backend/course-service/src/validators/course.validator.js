// Centralized request validation for course endpoints.
//
// Why a hand-written validator instead of Zod/Joi: the rest of this repo does
// not depend on a schema library, and adding one just for course-service would
// fragment conventions. The shape here is intentionally similar to a Zod
// `safeParse` — return `{ ok, value, errors }` so controllers stay terse.

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isPositiveInt = (v) => Number.isInteger(Number(v)) && Number(v) > 0;

// clgIds may arrive as either a JSON array or a comma-separated string (some
// admin tools send form-data). Normalize once at the edge so the controller
// only ever sees `string[]`.
export function normalizeClgIds(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    return raw.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return null;
}

export function validateAddCourse(body) {
  const errors = {};
  const value = {};

  if (!isNonEmptyString(body.courseId)) {
    errors.courseId = 'courseId is required';
  } else {
    value.courseId = body.courseId.trim();
  }

  if (!isNonEmptyString(body.title)) {
    errors.title = 'title is required';
  } else {
    value.title = body.title.trim();
  }

  if (body.duration === undefined || body.duration === null || body.duration === '') {
    errors.duration = 'duration is required';
  } else if (!isPositiveInt(body.duration)) {
    errors.duration = 'duration must be a positive integer';
  } else {
    value.duration = Number(body.duration);
  }

  if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
    errors.description = 'description must be a string';
  } else if (typeof body.description === 'string') {
    value.description = body.description.trim();
  }

  if (body.isPreAssessmentNeeded !== undefined) {
    if (typeof body.isPreAssessmentNeeded !== 'boolean') {
      errors.isPreAssessmentNeeded = 'isPreAssessmentNeeded must be a boolean';
    } else {
      value.isPreAssessmentNeeded = body.isPreAssessmentNeeded;
    }
  }

  if (body.modules !== undefined && body.modules !== null && !Array.isArray(body.modules)) {
    errors.modules = 'modules must be an array';
  } else if (Array.isArray(body.modules)) {
    value.modules = body.modules;
  }

  const clgIds = normalizeClgIds(body.clgIds);
  if (!clgIds || clgIds.length === 0) {
    errors.clgIds = 'clgIds is required (at least one college)';
  } else {
    value.clgIds = clgIds;
  }

  // instructorId is optional at the schema level (legacy callers may omit
  // it) but if present must be a non-empty string — it's the auth userId
  // of an instructor, sourced from the admin instructor dropdown.
  if (body.instructorId !== undefined && body.instructorId !== null && body.instructorId !== '') {
    if (!isNonEmptyString(body.instructorId)) {
      errors.instructorId = 'instructorId must be a non-empty string';
    } else {
      value.instructorId = body.instructorId.trim();
    }
  }

  return Object.keys(errors).length
    ? { ok: false, errors }
    : { ok: true, value };
}

// Update is partial: every field is optional, but each provided field must be
// valid. `clgIds`, if present, must still be a non-empty array (preserves the
// invariant that a course is always offered at >= 1 college).
export function validateUpdateCourse(body) {
  const errors = {};
  const value = {};

  if (body.title !== undefined) {
    if (!isNonEmptyString(body.title)) errors.title = 'title cannot be empty';
    else value.title = body.title.trim();
  }
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      errors.description = 'description must be a string';
    } else if (typeof body.description === 'string') {
      value.description = body.description.trim();
    } else {
      value.description = body.description;
    }
  }
  if (body.duration !== undefined) {
    if (!isPositiveInt(body.duration)) errors.duration = 'duration must be a positive integer';
    else value.duration = Number(body.duration);
  }
  if (body.isPreAssessmentNeeded !== undefined) {
    if (typeof body.isPreAssessmentNeeded !== 'boolean') {
      errors.isPreAssessmentNeeded = 'isPreAssessmentNeeded must be a boolean';
    } else {
      value.isPreAssessmentNeeded = body.isPreAssessmentNeeded;
    }
  }
  if (body.modules !== undefined) {
    if (body.modules !== null && !Array.isArray(body.modules)) {
      errors.modules = 'modules must be an array';
    } else {
      value.modules = body.modules;
    }
  }
  if (body.clgIds !== undefined) {
    const clgIds = normalizeClgIds(body.clgIds);
    if (!clgIds || clgIds.length === 0) {
      errors.clgIds = 'clgIds cannot be empty';
    } else {
      value.clgIds = clgIds;
    }
  }
  if (body.instructorId !== undefined) {
    // Allow clearing the instructor by sending null or "".
    if (body.instructorId === null || body.instructorId === '') {
      value.instructorId = null;
    } else if (!isNonEmptyString(body.instructorId)) {
      errors.instructorId = 'instructorId must be a non-empty string';
    } else {
      value.instructorId = body.instructorId.trim();
    }
  }

  return Object.keys(errors).length
    ? { ok: false, errors }
    : { ok: true, value };
}
