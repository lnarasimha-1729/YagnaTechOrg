const { QueryTypes } = require('sequelize');
const programRepo = require('../repositories/ProgramRepository');
const { Program, Batch, BatchMember } = require('../models');
const authDb = require('../config/authDatabase');
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

// batchIds use the same numeric PK shape as courseIds. Form sends `batchIds`
// from the Batch picker (cascades off selected colleges). Reuses the
// course-ids normalisation pattern to keep behaviour consistent.
const normalizeBatchIds = (raw) => {
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
        batch_ids: normalizeBatchIds(body.batchIds ?? body['batchIds[]']),
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
    // Only overwrite batch_ids when the form actually sent the field — same
    // guard the other arrays use so a partial save doesn't wipe the mapping.
    if (body.batchIds !== undefined || body['batchIds[]'] !== undefined) {
        data.batch_ids = normalizeBatchIds(body.batchIds ?? body['batchIds[]']);
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

// Returns the admin-created programs a student is eligible for at pre-
// assessment time: clg_ids includes the student's collegeId AND batch_ids
// overlaps a batch the student is a member of. The course_ids dimension is
// intentionally NOT applied here — the student hasn't enrolled in any course
// at this point in the flow (enrollment happens after they pick a program),
// so requiring enrolled-course overlap would always return an empty list.
//
// Only is_active programs surface. Empty userId / unknown user / missing
// collegeId / no batch membership all return an empty list so the modal
// renders the empty hint.
const listEligible = async (userId) => {
    if (!userId) return { programs: [] };

    // Read the student row from the shared auth DB (admin-service has no
    // duplicate User model). collation/case is preserved as stored.
    const [userRow] = await authDb.query(
        'SELECT collegeId FROM users WHERE userId = :userId LIMIT 1',
        { replacements: { userId: String(userId) }, type: QueryTypes.SELECT }
    );
    const collegeId = userRow?.collegeId || null;
    if (!collegeId) return { programs: [] };

    // Batches the student belongs to. BatchMember.user_id is STRING so the
    // 11-digit auth userIds don't overflow INT.
    const memberRows = await BatchMember.findAll({
        where: { user_id: String(userId) },
        attributes: ['batch_id'],
        raw: true,
    }).catch(() => []);
    const memberBatchIds = new Set(memberRows.map((r) => Number(r.batch_id)).filter(Boolean));

    // Pull every active program, then filter in JS — the JSON-column overlap
    // would need DB-specific JSON_OVERLAPS / JSON_CONTAINS_PATH calls and the
    // program count stays small enough that an in-memory filter is fine.
    const all = await Program.findAll({ where: { is_active: true }, order: [['sort', 'ASC'], ['id', 'ASC']] });
    const matches = all
        .map((p) => p.toJSON())
        .filter((p) => {
            const clgIds = Array.isArray(p.clg_ids) ? p.clg_ids.map(String) : [];
            if (!clgIds.includes(String(collegeId))) return false;

            const programBatchIds = Array.isArray(p.batch_ids) ? p.batch_ids.map(Number) : [];
            if (programBatchIds.length === 0) return false;
            if (!programBatchIds.some((id) => memberBatchIds.has(id))) return false;

            return true;
        });

    return { programs: matches };
};

// Programs linked by root admin to a specific (college, batch). Powers the
// Bulk Request modal + per-row Program dropdown on Manage Students. Names
// are resolved to ids server-side so the frontend can hand over what it
// already displays without a second round-trip. Empty inputs → empty list.
const listForCollegeBatch = async ({ clgId = '', clgName = '', batchId = '', batchName = '' } = {}) => {
    // Resolve clgId from name when only the name was supplied (Manage Students
    // dropdown stores the display name in the URL).
    let resolvedClgId = String(clgId || '').trim();
    if (!resolvedClgId && clgName) {
        const rows = await authDb.query(
            'SELECT clgId FROM colleges WHERE clgName = :name LIMIT 1',
            { replacements: { name: String(clgName).trim() }, type: QueryTypes.SELECT }
        ).catch(() => []);
        resolvedClgId = rows[0]?.clgId || '';
    }

    // Same for batch: resolve by name within the resolved college so two
    // colleges with same-named batches don't collide.
    let resolvedBatchId = Number(batchId) || null;
    if (!resolvedBatchId && batchName && resolvedClgId) {
        const batch = await Batch.findOne({
            where: { name: String(batchName).trim(), clg_id: resolvedClgId },
            attributes: ['id'],
            raw: true,
        }).catch(() => null);
        resolvedBatchId = batch?.id || null;
    }

    if (!resolvedClgId || !resolvedBatchId) return { programs: [] };

    // Filter in JS — JSON-column overlap differs across MySQL versions and
    // the program count is small. Same approach as listEligible.
    const all = await Program.findAll({
        where: { is_active: true },
        order: [['sort', 'ASC'], ['id', 'ASC']],
    });
    const matches = all
        .map((p) => p.toJSON())
        .filter((p) => {
            const clgIds = Array.isArray(p.clg_ids) ? p.clg_ids.map(String) : [];
            if (!clgIds.includes(String(resolvedClgId))) return false;
            const batchIds = Array.isArray(p.batch_ids) ? p.batch_ids.map(Number) : [];
            return batchIds.includes(Number(resolvedBatchId));
        });

    return { programs: matches };
};

module.exports = { list, get, create, update, remove, listEligible, listForCollegeBatch };
