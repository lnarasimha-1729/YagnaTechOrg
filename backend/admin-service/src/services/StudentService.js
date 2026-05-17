const bcrypt = require('bcryptjs');
const { QueryTypes } = require('sequelize');
const userRepo = require('../repositories/UserRepository');
const { sequelize } = require('../models');
const authDb = require('../config/authDatabase');
const { upload, removeFile, niceFileName } = require('../helpers/fileUploader');
const { HttpError } = require('../middlewares/error');

const sanitize = (u) => {
    const o = u.toJSON ? u.toJSON() : { ...u };
    delete o.password;
    delete o.remember_token;
    return o;
};

// Students sign up through auth-service, which writes to lucy_devdb.users
// (string userId PK, roleId -> roles table). The admin "Manage Students"
// page must therefore read from THAT table, not admin-service's own
// lms_admin.users. We query the auth DB read-only via authDb and map the
// columns to the shape the existing frontend table expects (id, name,
// email, phone, photo, enrolled_count) so no UI change is needed.
const list = async ({ page = 1, per_page = 10, search = '', college = '' }) => {
    const limit = Number(per_page);
    const offset = (Number(page) - 1) * limit;
    try {
        const like = `%${String(search).trim()}%`;
        const searchClause = search
            ? 'AND (u.name LIKE :like OR u.email LIKE :like)'
            : '';

        // Filter by the resolved college name (exact match on what the
        // dropdown shows). Same COALESCE expression as the SELECT so the
        // filter matches exactly what's displayed. The colleges JOIN is
        // always present so the count stays consistent with the rows.
        const collegeName = String(college).trim();
        const collegeClause = collegeName
            ? "AND COALESCE(c.clgName, NULLIF(TRIM(u.collegeName), '')) = :college"
            : '';

        const [{ count }] = await authDb.query(
            `SELECT COUNT(*) AS count
               FROM users u
               JOIN roles r ON r.roleId = u.roleId
               LEFT JOIN colleges c ON c.clgId = u.collegeId
              WHERE r.role = 'student' ${searchClause} ${collegeClause}`,
            { replacements: { like, college: collegeName }, type: QueryTypes.SELECT }
        );

        // Pre-assessment score AND time-taken now live in the student schema
        // itself (users.preScore / users.preScoreDuration), written by the
        // auth-service prescore endpoint. We read them straight off the user
        // row — no cross-DB join needed for the value the UI shows.
        // College the student picked in their profile: ProfilePage saves the
        // chosen clgId into users.collegeId, so we LEFT JOIN the colleges
        // table (same lucy_devdb) to resolve its display name. Fallbacks:
        // matched clgName → any free-text collegeName they typed → null.
        const rows = await authDb.query(
            `SELECT u.userId AS id, u.name, u.email, u.phone,
                    u.createdAt, u.preScore, u.preScoreDuration,
                    u.studentPhoto,
                    COALESCE(c.clgName, NULLIF(TRIM(u.collegeName), '')) AS college,
                    pr.program AS program_request,
                    pr.status  AS program_request_status
               FROM users u
               JOIN roles r ON r.roleId = u.roleId
               LEFT JOIN colleges c ON c.clgId = u.collegeId
               LEFT JOIN program_requests pr ON pr.user_id = u.userId
              WHERE r.role = 'student' ${searchClause} ${collegeClause}
              ORDER BY
                  -- 1. Group same-college students together (A→Z); students
                  --    with no college fall to the very end.
                  (COALESCE(c.clgName, NULLIF(TRIM(u.collegeName), '')) IS NULL) ASC,
                  COALESCE(c.clgName, NULLIF(TRIM(u.collegeName), '')) ASC,
                  -- 2. Within a college: highest pre-assessment score first;
                  --    students who haven't taken it sink below scored ones.
                  (u.preScore IS NULL) ASC,
                  u.preScore DESC,
                  -- 3. Tie-break equal scores by lowest time taken; rows
                  --    without a recorded duration come after timed ones.
                  (u.preScoreDuration IS NULL) ASC,
                  u.preScoreDuration ASC,
                  -- Stable final order for otherwise-identical rows.
                  u.createdAt DESC
              LIMIT :limit OFFSET :offset`,
            { replacements: { like, college: collegeName, limit, offset }, type: QueryTypes.SELECT }
        );

        // Optional enrichment: pre_assessment_results (admin DB) still holds
        // pass/fail + the attempt timestamp, which the student schema doesn't.
        const ids = rows.map((r) => String(r.id));
        let metaByUser = {};
        if (ids.length) {
            const pre = await sequelize.query(
                `SELECT user_id, passed, created_at
                   FROM pre_assessment_results
                  WHERE user_id IN (:ids)
                  ORDER BY created_at ASC`,
                { replacements: { ids }, type: QueryTypes.SELECT }
            );
            metaByUser = pre.reduce((acc, p) => {
                acc[String(p.user_id)] = {
                    passed: Boolean(p.passed),
                    taken_at: p.created_at,
                };
                return acc;
            }, {});
        }

        // Same threshold as PreAssessmentController.PASS_THRESHOLD. We derive
        // passed from the score we actually display so the badge can't
        // disagree with the number next to it (the pre_assessment_results
        // row is only used for taken_at and can lag behind preScore when a
        // student retakes the assessment).
        const PASS_THRESHOLD = 60;
        const students = rows.map((r) => {
            const meta = metaByUser[String(r.id)] || {};
            // A student "has" a pre-assessment if a score is recorded on their
            // schema row (preScore is set on submit alongside the duration).
            const hasPre = r.preScore != null;
            const score = hasPre ? Number(r.preScore) : null;
            // studentPhoto is the relative upload path (e.g.
            // uploads/users/student/foo.jpg) served from admin-service's
            // /uploads mount. The frontend (Index.jsx avatarUrl) prepends
            // VITE_ADMIN_API_URL. null → frontend falls back to initials.
            const { studentPhoto, ...rest } = r;
            return {
                ...rest,
                photo: studentPhoto || null,
                enrolled_count: 0,
                pre_assessment: hasPre
                    ? {
                        score,
                        duration_seconds:
                            r.preScoreDuration == null ? null : Number(r.preScoreDuration),
                        passed: score >= PASS_THRESHOLD,
                        taken_at: meta.taken_at ?? null,
                    }
                    : null,
            };
        });
        return { students, total: Number(count), page: Number(page), per_page: limit };
    } catch (err) {
        console.warn('[students] auth DB query failed:', err.message);
        return { students: [], total: 0, page: Number(page), per_page: limit };
    }
};

const get = async (id) => {
    const rows = await authDb.query(
        `SELECT u.userId AS id, u.name, u.email, u.phone, u.dob, u.gender,
                u.educationLevel, u.branch, u.collegeName, u.graduationYear,
                u.collegeCode, u.programInterested, u.studentPhoto, u.createdAt
           FROM users u
           JOIN roles r ON r.roleId = u.roleId
          WHERE r.role = 'student' AND u.userId = :id
          LIMIT 1`,
        { replacements: { id: String(id) }, type: QueryTypes.SELECT }
    );
    if (!rows.length) throw new HttpError(404, 'Student not found');
    // Same shape as list(): photo is the relative upload path or null.
    // Used by the Edit Student page to preview the current image.
    const { studentPhoto, ...rest } = rows[0];
    return { student: { ...rest, photo: studentPhoto || null } };
};

const create = async (body, file) => {
    if (!body.name || !body.email || !body.password) {
        throw new HttpError(422, 'Name, email, and password are required');
    }
    if (String(body.password).length < 8) {
        throw new HttpError(422, 'Password must be at least 8 characters');
    }
    if (await userRepo.isEmailTaken(body.email)) {
        throw new HttpError(422, 'Email already in use');
    }

    const data = {
        name: body.name,
        about: body.about || null,
        phone: body.phone || null,
        address: body.address || null,
        email: body.email,
        password: await bcrypt.hash(body.password, 10),
        facebook: body.facebook || null,
        twitter: body.twitter || null,
        website: body.website || null,
        linkedin: body.linkedin || null,
        role: 'student',
        status: 1,
    };

    if (file) {
        const ext = file.originalname.split('.').pop() || 'jpg';
        const destPath = `uploads/users/student/${niceFileName(body.name, ext)}`;
        await upload(file, destPath, 200, 200);
        data.photo = destPath;
    }

    const student = await userRepo.create(data);
    return { message: 'Student added successfully', student: sanitize(student) };
};

// Students live in auth-service's lucy_devdb.users (string userId PK,
// passwordHash). We update/delete THERE so the admin page operates on the
// real signed-up accounts. The auth schema only has a subset of the admin
// form's fields — name/email/phone/password map across; about/address/
// social/photo have no auth columns and are intentionally ignored.
const findAuthStudent = async (id) => {
    // Include studentPhoto so update() can delete the previous file when
    // the admin uploads a replacement, and remove() can clean it up on
    // delete.
    const rows = await authDb.query(
        `SELECT u.userId, u.name, u.email, u.phone, u.studentPhoto
           FROM users u
           JOIN roles r ON r.roleId = u.roleId
          WHERE r.role = 'student' AND u.userId = :id
          LIMIT 1`,
        { replacements: { id: String(id) }, type: QueryTypes.SELECT }
    );
    return rows[0] || null;
};

const update = async (id, body, file = null) => {
    const student = await findAuthStudent(id);
    if (!student) throw new HttpError(404, 'Student not found');

    if (!body.name || !body.email) throw new HttpError(422, 'Name and email are required');

    // Email uniqueness within the auth users table, excluding this user.
    const dup = await authDb.query(
        'SELECT 1 FROM users WHERE email = :email AND userId <> :id LIMIT 1',
        { replacements: { email: body.email, id: String(id) }, type: QueryTypes.SELECT }
    );
    if (dup.length) throw new HttpError(422, 'Email already in use');

    const sets = ['name = :name', 'email = :email', 'phone = :phone'];
    const replacements = {
        id: String(id),
        name: body.name,
        email: body.email,
        phone: body.phone ?? student.phone ?? null,
    };

    if (body.password) {
        if (String(body.password).length < 8) {
            throw new HttpError(422, 'Password must be at least 8 characters');
        }
        sets.push('passwordHash = :passwordHash');
        replacements.passwordHash = await bcrypt.hash(body.password, 10);
    }

    // Photo upload — only touch studentPhoto when a new file was actually
    // uploaded. Same pattern as InstructorService.update. Stored under
    // uploads/users/student/ so old admin-DB-side files (different role)
    // don't collide.
    if (file) {
        const ext = (file.originalname || '').split('.').pop() || 'jpg';
        const destPath = `uploads/users/student/${niceFileName(body.name, ext)}`;
        await upload(file, destPath, 400, 400);
        sets.push('studentPhoto = :studentPhoto');
        replacements.studentPhoto = destPath;
    }

    await authDb.query(
        `UPDATE users SET ${sets.join(', ')} WHERE userId = :id`,
        { replacements, type: QueryTypes.UPDATE }
    );

    // Best-effort old-file cleanup after the UPDATE succeeded.
    if (file && student.studentPhoto && student.studentPhoto !== replacements.studentPhoto) {
        try { removeFile(student.studentPhoto); } catch { /* ignore */ }
    }

    const updated = await get(id);
    return { message: 'Student updated successfully', student: updated.student };
};

const remove = async (id) => {
    const student = await findAuthStudent(id);
    if (!student) throw new HttpError(404, 'Student not found');
    await authDb.query(
        'DELETE FROM users WHERE userId = :id',
        { replacements: { id: String(id) }, type: QueryTypes.DELETE }
    );
    // Drop the avatar file too so deleting a student doesn't leave
    // orphaned images in uploads/users/student/.
    if (student.studentPhoto) {
        try { removeFile(student.studentPhoto); } catch { /* ignore */ }
    }
    return { message: 'Student removed successfully' };
};

// Distinct, non-empty college names across all students — powers the
// Manage Students filter dropdown. Uses the same COALESCE resolution as
// list() so the options exactly match the displayed College column.
const collegeOptions = async () => {
    const rows = await authDb.query(
        `SELECT DISTINCT COALESCE(c.clgName, NULLIF(TRIM(u.collegeName), '')) AS college
           FROM users u
           JOIN roles r ON r.roleId = u.roleId
           LEFT JOIN colleges c ON c.clgId = u.collegeId
          WHERE r.role = 'student'
            AND COALESCE(c.clgName, NULLIF(TRIM(u.collegeName), '')) IS NOT NULL
          ORDER BY college ASC`,
        { type: QueryTypes.SELECT }
    );
    return { colleges: rows.map((r) => r.college) };
};

// The three fixed programs an admin can request for a student. Kept in sync
// with the program_requests ENUM and the Manage Students dropdown.
const PROGRAM_OPTIONS = [
    'AI Frontier Program',
    'AI Frontier Plus Program',
    'Elite AI Residency',
];

// "Send" from Manage Students: record (one per student, upsert) that an admin
// requested a program for this student. Resending overwrites the row and
// resets status to 'sent'. Lives in lucy_devdb alongside users.
const sendProgramRequest = async (id, program, requestedBy = null) => {
    const student = await findAuthStudent(id);
    if (!student) throw new HttpError(404, 'Student not found');
    if (!PROGRAM_OPTIONS.includes(program)) {
        throw new HttpError(422, 'Invalid program. Must be one of: ' + PROGRAM_OPTIONS.join(', '));
    }

    await authDb.query(
        `INSERT INTO program_requests (user_id, program, requested_by, status)
         VALUES (:userId, :program, :requestedBy, 'sent')
         ON DUPLICATE KEY UPDATE
            program      = VALUES(program),
            requested_by = VALUES(requested_by),
            status       = 'sent',
            updated_at   = CURRENT_TIMESTAMP`,
        {
            replacements: {
                userId: String(id),
                program,
                requestedBy: requestedBy ? String(requestedBy) : null,
            },
            type: QueryTypes.INSERT,
        }
    );

    // Mirror onto the student schema: a freshly (re)sent request is pending
    // the student's response. Clears any prior responded timestamp.
    await authDb.query(
        `UPDATE users
            SET assignedProgram = :program,
                programResponseStatus = 'pending',
                programRespondedAt = NULL
          WHERE userId = :userId`,
        { replacements: { userId: String(id), program }, type: QueryTypes.UPDATE }
    );

    return { message: 'Program request sent', program, user_id: String(id) };
};

// Student-facing: the program request an admin sent this student that is
// still awaiting their response. Returns null when there's nothing pending
// (no request, or already accepted/rejected/cancelled).
const getStudentProgramRequest = async (userId) => {
    const uid = String(userId || '').trim();
    if (!uid) return { request: null };
    const rows = await authDb.query(
        `SELECT program, status, created_at, updated_at
           FROM program_requests
          WHERE user_id = :uid AND status = 'sent'
          LIMIT 1`,
        { replacements: { uid }, type: QueryTypes.SELECT }
    );
    return { request: rows[0] || null };
};

// Student-facing: the program this student has ACCEPTED (if any). Used by the
// "Choose your program" page to enable only the accepted program's card.
// Separate from getStudentProgramRequest so the dashboard banner (sent-only)
// is unaffected.
const getAcceptedProgram = async (userId) => {
    const uid = String(userId || '').trim();
    if (!uid) return { program: null };
    const rows = await authDb.query(
        `SELECT program, updated_at
           FROM program_requests
          WHERE user_id = :uid AND status = 'accepted'
          LIMIT 1`,
        { replacements: { uid }, type: QueryTypes.SELECT }
    );
    return { program: rows[0]?.program || null };
};

// Student accepts or rejects the pending request. Only a 'sent' row can
// transition; the response is stamped with responded_at.
const respondProgramRequest = async (userId, action) => {
    const uid = String(userId || '').trim();
    if (!uid) throw new HttpError(401, 'Missing student identity');
    const next = action === 'accept' ? 'accepted'
        : action === 'reject' ? 'rejected'
            : null;
    if (!next) throw new HttpError(422, "action must be 'accept' or 'reject'");

    const [, meta] = await authDb.query(
        `UPDATE program_requests
            SET status = :next, responded_at = CURRENT_TIMESTAMP
          WHERE user_id = :uid AND status = 'sent'`,
        { replacements: { uid, next }, type: QueryTypes.UPDATE }
    );
    // mysql2 returns affectedRows on meta; 0 means nothing was pending.
    const affected = meta?.affectedRows ?? meta ?? 0;
    if (!affected) throw new HttpError(404, 'No pending program request to respond to');

    // Mirror the decision onto the student schema.
    await authDb.query(
        `UPDATE users
            SET programResponseStatus = :next,
                programRespondedAt = CURRENT_TIMESTAMP
          WHERE userId = :uid`,
        { replacements: { uid, next }, type: QueryTypes.UPDATE }
    );

    return { message: `Program request ${next}`, status: next };
};

module.exports = {
    list, get, create, update, remove, collegeOptions,
    sendProgramRequest, PROGRAM_OPTIONS,
    getStudentProgramRequest, respondProgramRequest, getAcceptedProgram,
};
