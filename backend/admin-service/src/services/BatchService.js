const { QueryTypes, Op } = require('sequelize');
const { Batch, BatchMember, sequelize } = require('../models');
const authDb = require('../config/authDatabase');
const { HttpError } = require('../middlewares/error');

// Normalise a member-id list (mirrors normaliseIdList in assessment service):
// trim, dedupe, cast to string. Accepts string|number|array. Students live
// in auth-service users.userId (string PK) — cast everything to string.
const normIds = (raw) => {
    if (raw == null) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    const seen = new Set();
    const out = [];
    for (const v of arr) {
        const s = String(v ?? '').trim();
        if (!s || seen.has(s)) continue;
        seen.add(s);
        out.push(s);
    }
    return out;
};

// Confirm the given user ids actually belong to this college's students,
// so a college admin can't pull users from another college into a batch.
// Returns the subset of ids that are valid.
const filterValidStudents = async ({ clgId, userIds }) => {
    if (userIds.length === 0) return [];
    const rows = await authDb.query(
        `SELECT u.userId
           FROM users u
           JOIN roles r ON r.roleId = u.roleId
          WHERE r.role = 'student'
            AND u.collegeId = :clgId
            AND u.userId IN (:userIds)`,
        { replacements: { clgId, userIds }, type: QueryTypes.SELECT }
    );
    return rows.map((r) => String(r.userId));
};

// List batches owned by this college, with member counts joined in.
const list = async ({ clgId }) => {
    const batches = await Batch.findAll({
        where: { clg_id: clgId },
        order: [['created_at', 'DESC']],
        raw: true,
    });
    if (batches.length === 0) return { batches: [] };

    // Single grouped COUNT instead of N+1.
    const ids = batches.map((b) => b.id);
    const counts = await BatchMember.findAll({
        where: { batch_id: { [Op.in]: ids } },
        attributes: ['batch_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['batch_id'],
        raw: true,
    });
    const byId = Object.fromEntries(counts.map((c) => [Number(c.batch_id), Number(c.count) || 0]));

    return {
        batches: batches.map((b) => ({ ...b, member_count: byId[b.id] || 0 })),
    };
};

// One batch + its student roster (name/email/phone resolved from auth DB).
const get = async ({ clgId, id }) => {
    const batch = await Batch.findOne({ where: { id, clg_id: clgId }, raw: true });
    if (!batch) throw new HttpError(404, 'Batch not found');

    const members = await BatchMember.findAll({
        where: { batch_id: batch.id },
        order: [['created_at', 'ASC']],
        raw: true,
    });

    let students = [];
    if (members.length) {
        const userIds = members.map((m) => String(m.user_id));
        const rows = await authDb.query(
            `SELECT u.userId AS id, u.name, u.email, u.phone, u.graduationYear
               FROM users u
              WHERE u.userId IN (:userIds)`,
            { replacements: { userIds }, type: QueryTypes.SELECT }
        );
        const byId = Object.fromEntries(rows.map((r) => [String(r.id), r]));
        // Preserve insertion order (oldest member first) by walking `members`.
        students = members
            .map((m) => byId[String(m.user_id)])
            .filter(Boolean);
    }

    return { batch: { ...batch, students, member_count: students.length } };
};

const create = async ({ clgId, body }) => {
    const name = String(body?.name ?? '').trim();
    if (!name) throw new HttpError(422, 'Batch name is required');

    // Reject duplicate name within this college so admins don't end up with
    // two "AI Frontier - Jan 2026" rows that confuse the dropdown.
    const dup = await Batch.findOne({ where: { clg_id: clgId, name } });
    if (dup) throw new HttpError(422, 'A batch with this name already exists at your college');

    const batch = await Batch.create({
        clg_id: clgId,
        name,
        description: body?.description ? String(body.description).trim() : null,
        start_date: body?.start_date || null,
        end_date: body?.end_date || null,
        is_active: body?.is_active === undefined ? true : !!body.is_active,
    });

    // Optional roster on create — same shape Manage Batches uses to add later.
    const incoming = normIds(body?.userIds);
    if (incoming.length) {
        const valid = await filterValidStudents({ clgId, userIds: incoming });
        if (valid.length) {
            await BatchMember.bulkCreate(
                valid.map((uid) => ({ batch_id: batch.id, user_id: uid })),
                { ignoreDuplicates: true }
            );
        }
    }

    return { message: 'Batch created', batch };
};

const update = async ({ clgId, id, body }) => {
    const batch = await Batch.findOne({ where: { id, clg_id: clgId } });
    if (!batch) throw new HttpError(404, 'Batch not found');

    const patch = {};
    if (body.name !== undefined) {
        const next = String(body.name).trim();
        if (!next) throw new HttpError(422, 'Batch name is required');
        if (next !== batch.name) {
            const dup = await Batch.findOne({ where: { clg_id: clgId, name: next, id: { [Op.ne]: id } } });
            if (dup) throw new HttpError(422, 'Another batch already has this name');
        }
        patch.name = next;
    }
    if (body.description !== undefined) patch.description = body.description ? String(body.description).trim() : null;
    if (body.start_date !== undefined) patch.start_date = body.start_date || null;
    if (body.end_date !== undefined) patch.end_date = body.end_date || null;
    if (body.is_active !== undefined) patch.is_active = !!body.is_active;

    await batch.update(patch);
    return { message: 'Batch updated', batch };
};

const remove = async ({ clgId, id }) => {
    const batch = await Batch.findOne({ where: { id, clg_id: clgId } });
    if (!batch) throw new HttpError(404, 'Batch not found');
    // Wipe members first — no FK constraint exists, but leaving orphan rows
    // would confuse later counts.
    await BatchMember.destroy({ where: { batch_id: batch.id } });
    await batch.destroy();
    return { message: 'Batch deleted' };
};

// Add students to a batch. Idempotent — existing memberships are kept (the
// unique index dedupes), only new pairs land. Returns the full updated batch
// so the UI doesn't need a second round-trip.
const addMembers = async ({ clgId, id, body }) => {
    const batch = await Batch.findOne({ where: { id, clg_id: clgId } });
    if (!batch) throw new HttpError(404, 'Batch not found');

    const incoming = normIds(body?.userIds);
    if (incoming.length === 0) throw new HttpError(422, 'Pick at least one student');

    const valid = await filterValidStudents({ clgId, userIds: incoming });
    const invalid = incoming.filter((id) => !valid.includes(id));
    if (valid.length === 0) {
        throw new HttpError(422, 'None of the selected users are students of your college');
    }

    await BatchMember.bulkCreate(
        valid.map((uid) => ({ batch_id: batch.id, user_id: uid })),
        { ignoreDuplicates: true }
    );

    const detail = await get({ clgId, id: batch.id });
    return {
        message: invalid.length
            ? `Added ${valid.length} student(s); skipped ${invalid.length} outside this college`
            : `Added ${valid.length} student(s)`,
        ...detail,
    };
};

const removeMember = async ({ clgId, id, userId }) => {
    const batch = await Batch.findOne({ where: { id, clg_id: clgId } });
    if (!batch) throw new HttpError(404, 'Batch not found');
    const deleted = await BatchMember.destroy({ where: { batch_id: batch.id, user_id: String(userId) } });
    if (!deleted) throw new HttpError(404, 'Student is not a member of this batch');
    return { message: 'Student removed from batch' };
};

// Students of this college that can be added to batches. Powers the picker
// in the Add Batch form and the "add students" modal of Manage Batches.
const eligibleStudents = async ({ clgId }) => {
    const rows = await authDb.query(
        `SELECT u.userId AS id, u.name, u.email, u.phone, u.graduationYear
           FROM users u
           JOIN roles r ON r.roleId = u.roleId
          WHERE r.role = 'student' AND u.collegeId = :clgId
          ORDER BY u.name ASC`,
        { replacements: { clgId }, type: QueryTypes.SELECT }
    );
    return { students: rows };
};

module.exports = {
    list,
    get,
    create,
    update,
    remove,
    addMembers,
    removeMember,
    eligibleStudents,
};
