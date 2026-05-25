const programRepo = require('../repositories/ProgramRepository');
const { HttpError } = require('../middlewares/error');

// Features arrive from the form as either an array (when the admin's submit
// builds JSON) or as repeated `features[]` multipart fields (which express
// parses as an array, or a single string for one row). Normalise to a clean
// string[] with empty entries trimmed away.
const normalizeFeatures = (raw) => {
    if (raw == null || raw === '') return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr
        .map((v) => (typeof v === 'string' ? v.trim() : String(v ?? '').trim()))
        .filter(Boolean);
};

// clgIds arrive as `clgIds[]=a&clgIds[]=b` (multi-value form fields, parsed
// as an array), a single string, or already-coerced array. Dedupe + trim
// — same shape Course's normalizeClgIds uses, so admin filters stay
// consistent between the two entities.
const normalizeClgIds = (raw) => {
    if (raw == null) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return Array.from(new Set(arr.map((v) => String(v).trim()).filter(Boolean)));
};

// Coerce a course_id from the form. Empty strings + invalid numbers => null
// so the column stays nullable instead of storing 0 (which would FK-fail
// against courses.id).
const normalizeCourseId = (raw) => {
    if (raw === undefined || raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
};

// courseIds arrive the same way clgIds do (`courseIds[]=1&courseIds[]=2`, a
// single string, or already-coerced array). Dedupe + cast to positive ints —
// returns an array of NUMBERS (not strings) since course PKs are numeric.
const normalizeCourseIds = (raw) => {
    if (raw == null) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    const ids = arr
        .map((v) => Number(String(v).trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
    return Array.from(new Set(ids));
};

const toBool = (v, fallback = true) => {
    if (v === undefined || v === null || v === '') return fallback;
    if (typeof v === 'boolean') return v;
    const s = String(v).trim().toLowerCase();
    if (['1', 'true', 'on', 'yes'].includes(s)) return true;
    if (['0', 'false', 'off', 'no'].includes(s)) return false;
    return fallback;
};

const list = async () => {
    const rows = await programRepo.list();
    return { programs: rows };
};

const get = async (id) => {
    const row = await programRepo.findById(id);
    if (!row) throw new HttpError(404, 'Program not found');
    return { program: row };
};

const create = async (body = {}) => {
    if (!body.title || !String(body.title).trim()) {
        throw new HttpError(422, 'Title is required');
    }
    const courseIds = normalizeCourseIds(body.courseIds ?? body['courseIds[]']);
    const data = {
        title: String(body.title).trim(),
        tagline: body.tagline ? String(body.tagline).trim() : '',
        icon: body.icon ? String(body.icon).trim() : 'Globe2',
        features: normalizeFeatures(body.features ?? body['features[]']),
        sort: Number.isFinite(Number(body.sort)) ? Number(body.sort) : 0,
        is_active: toBool(body.is_active, true),
        clg_ids: normalizeClgIds(body.clgIds ?? body['clgIds[]']),
        course_ids: courseIds,
        // Keep the legacy single-course column in sync with the first selected
        // id so older callers (and the Manage Programs table's fallback render)
        // still resolve a name. Falls back to body.course_id if no array was
        // sent — supports legacy clients that haven't switched yet.
        course_id: courseIds[0] ?? normalizeCourseId(body.course_id),
    };
    const program = await programRepo.create(data);
    return { success: 'Program added successfully', program };
};

const update = async (id, body = {}) => {
    const program = await programRepo.findById(id);
    if (!program) throw new HttpError(404, 'Program not found');

    const data = {};
    if (body.title !== undefined) {
        const t = String(body.title).trim();
        if (!t) throw new HttpError(422, 'Title is required');
        data.title = t;
    }
    if (body.tagline !== undefined) data.tagline = String(body.tagline ?? '').trim();
    if (body.icon !== undefined) data.icon = String(body.icon || 'Globe2').trim();
    if (body.features !== undefined || body['features[]'] !== undefined) {
        data.features = normalizeFeatures(body.features ?? body['features[]']);
    }
    if (body.sort !== undefined && Number.isFinite(Number(body.sort))) {
        data.sort = Number(body.sort);
    }
    if (body.is_active !== undefined) data.is_active = toBool(body.is_active, program.is_active);
    // Only overwrite clg_ids when the form actually sent the field — same
    // guard CourseService uses so partial saves don't wipe the mapping.
    if (body.clgIds !== undefined || body['clgIds[]'] !== undefined) {
        data.clg_ids = normalizeClgIds(body.clgIds ?? body['clgIds[]']);
    }
    if (body.courseIds !== undefined || body['courseIds[]'] !== undefined) {
        const ids = normalizeCourseIds(body.courseIds ?? body['courseIds[]']);
        data.course_ids = ids;
        // Mirror onto the legacy single-id column so listings that still read
        // course_id keep working without a second round-trip.
        data.course_id = ids[0] ?? null;
    } else if (body.course_id !== undefined) {
        // Legacy single-id payload (older clients) — write both columns so
        // course_ids stays consistent.
        const one = normalizeCourseId(body.course_id);
        data.course_id = one;
        data.course_ids = one ? [one] : [];
    }

    await program.update(data);
    return { success: 'Program updated successfully', program };
};

const remove = async (id) => {
    const program = await programRepo.findById(id);
    if (!program) throw new HttpError(404, 'Program not found');
    await program.destroy();
    return { success: 'Program deleted successfully' };
};

module.exports = { list, get, create, update, remove };
