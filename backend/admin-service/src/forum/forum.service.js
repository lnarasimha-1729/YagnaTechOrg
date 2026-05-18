/**
 * Course discussion forum (Q&A).
 *
 * 1:1 port of lms-cp/app/Http/Controllers/ForumController.php — adapted to the
 * admin-service's conventions:
 *   - HttpError from middlewares/error (not AppError)
 *   - Sequelize models from ../models
 *   - User profiles resolved from the auth-DB (auth-service owns users)
 *
 * Schema discriminator (same as the reference): `title === 'reply'` means a
 * reply row; otherwise it's a root question.
 *
 * Permissions: enrolled student / course instructor / admin / root may post.
 * The frontend already passes the JWT, so req.user.id and role are available.
 */

const { Op, QueryTypes } = require('sequelize');
const { Forum, ForumReport, Course, UserProgress } = require('../models');
const { HttpError } = require('../middlewares/error');
const authDb = require('../config/authDatabase');

/* ============================== Helpers ============================== */

// `likes` / `dislikes` are stored as JSON arrays in TEXT columns (matching
// the PHP `json_encode([...])` round-trip). NULL when empty.
const parseVotes = (raw) => {
    if (raw == null || raw === '') return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
        return [];
    }
};

const serializeVotes = (arr) => (arr.length ? JSON.stringify(arr.map(String)) : null);

// Parse a course's `instructor_ids` field — same shape the rest of the project
// uses (JSON array string / CSV / single value).
const parseInstructorIds = (raw) => {
    if (raw == null || raw === '') return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    const s = String(raw).trim();
    try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        if (parsed) return [String(parsed)];
    } catch {
        if (s.includes(',')) return s.split(',').map((v) => v.trim()).filter(Boolean);
        return [s];
    }
    return [];
};

// Batch-resolve user profiles from the auth-DB (lucy_devdb.users). Best-effort —
// a DB failure yields {} so the list still renders without author cards.
const fetchUsersByIds = async (ids) => {
    const unique = [...new Set(ids.map((v) => String(v)).filter(Boolean))];
    if (!unique.length) return {};
    try {
        const rows = await authDb.query(
            `SELECT u.userId AS id, u.name, u.email,
                    COALESCE(u.instructorPhoto, u.studentPhoto) AS photo
               FROM users u
              WHERE u.userId IN (:ids)`,
            { replacements: { ids: unique }, type: QueryTypes.SELECT }
        );
        const byId = {};
        for (const r of rows) byId[String(r.id)] = r;
        return byId;
    } catch (err) {
        console.warn('[forum] user lookup failed:', err.message);
        return {};
    }
};

const loadCourseOrFail = async (courseId) => {
    const course = await Course.findByPk(courseId);
    if (!course) throw new HttpError(404, 'Course not found.');
    return course;
};

// Permission gate. Admins / course instructor / enrolled students may post.
// Throws on failure; resolves silently when allowed.
const assertCanParticipate = async (course, user) => {
    if (!user || !user.id) throw new HttpError(401, 'Authentication required');
    const role = user.role;
    if (role === 'admin' || role === 'root') return;

    const uid = String(user.id);
    if (role === 'instructor') {
        if (parseInstructorIds(course.instructor_ids).includes(uid)) return;
        // Instructors may also be assigned via course.user_id (creator), but
        // for instructor-created courses user_id is the root admin — so this
        // is just a belt-and-braces check.
        if (String(course.user_id || '') === uid) return;
        throw new HttpError(403, 'You are not assigned to this course');
    }

    // Student: must be enrolled. UserProgress.user_id is BIGINT, course_id INT.
    try {
        const enrolled = await UserProgress.findOne({
            where: {
                user_id: Number(uid),
                course_id: course.id,
                enrolled: true,
            },
            attributes: ['id'],
        });
        if (!enrolled) throw new HttpError(403, 'Enroll in this course to participate');
    } catch (err) {
        if (err instanceof HttpError) throw err;
        // If UserProgress is unreachable, deny rather than silently allow.
        throw new HttpError(503, 'Could not verify enrollment');
    }
};

// Edit/delete authority: the row's owner OR a course instructor/admin.
const assertCanModerate = async (row, course, user) => {
    if (!user || !user.id) throw new HttpError(401, 'Authentication required');
    const uid = String(user.id);
    if (String(row.user_id) === uid) return;
    if (user.role === 'admin' || user.role === 'root') return;
    if (user.role === 'instructor' && parseInstructorIds(course.instructor_ids).includes(uid)) return;
    throw new HttpError(403, 'You can only edit or delete your own post');
};

const serializeRow = (row, usersById, currentUserId) => {
    const data = row.toJSON ? row.toJSON() : row;
    const likes = parseVotes(data.likes);
    const dislikes = parseVotes(data.dislikes);
    const author = usersById[String(data.user_id)] || null;
    const uid = currentUserId != null ? String(currentUserId) : null;
    return {
        id: data.id,
        course_id: data.course_id,
        user_id: data.user_id,
        parent_id: data.parent_id,
        title: data.title,
        description: data.description,
        created_at: data.created_at,
        updated_at: data.updated_at,
        likes_count: likes.length,
        dislikes_count: dislikes.length,
        liked_by_me: uid ? likes.includes(uid) : false,
        disliked_by_me: uid ? dislikes.includes(uid) : false,
        user: author
            ? { id: author.id, name: author.name, email: author.email, photo: author.photo }
            : null,
    };
};

/* ============================== Queries ============================== */

// List root questions for a course (parent_id IS NULL) with their replies
// nested inline — matches the lms-cp review.blade.php / child_review.blade.php
// layout (questions + replies rendered on one screen). Newest questions first
// (id DESC), replies oldest-first within each question.
//
// All data comes from 3 queries total (questions, all replies, author
// profiles) — no N+1 regardless of how many questions/replies exist.
const listQuestions = async ({ courseId, search, user }) => {
    await loadCourseOrFail(courseId);

    const where = { course_id: courseId, parent_id: null };
    if (search && String(search).trim() !== '') {
        const like = `%${String(search).trim()}%`;
        where[Op.or] = [
            { title: { [Op.like]: like } },
            { description: { [Op.like]: like } },
        ];
    }

    const questions = await Forum.findAll({ where, order: [['id', 'DESC']] });
    const qIds = questions.map((q) => q.id);

    // All replies for the matched questions, in one query.
    const replies = qIds.length
        ? await Forum.findAll({
            where: { parent_id: { [Op.in]: qIds } },
            order: [['id', 'ASC']],
        })
        : [];

    // One batched author lookup for questions + replies.
    const authorIds = [
        ...questions.map((q) => q.user_id),
        ...replies.map((r) => r.user_id),
    ].filter(Boolean);
    const usersById = await fetchUsersByIds(authorIds);

    // Group replies by parent question id.
    const repliesByQ = {};
    for (const r of replies) {
        const pid = Number(r.parent_id);
        (repliesByQ[pid] ||= []).push(serializeRow(r, usersById, user?.id));
    }

    return {
        questions: questions.map((q) => {
            const childList = repliesByQ[Number(q.id)] || [];
            return {
                ...serializeRow(q, usersById, user?.id),
                replies_count: childList.length,
                replies: childList,
            };
        }),
    };
};

const getQuestionWithReplies = async ({ id, user }) => {
    const q = await Forum.findByPk(id);
    if (!q || q.parent_id != null) throw new HttpError(404, 'Question not found');

    const replies = await Forum.findAll({
        where: { parent_id: q.id },
        order: [['id', 'ASC']],
    });

    const authorIds = [q.user_id, ...replies.map((r) => r.user_id)].filter(Boolean);
    const usersById = await fetchUsersByIds(authorIds);

    return {
        question: serializeRow(q, usersById, user?.id),
        replies: replies.map((r) => serializeRow(r, usersById, user?.id)),
    };
};

/* ============================== Mutations ============================== */

const create = async ({ body, user }) => {
    if (!body.course_id) throw new HttpError(422, 'course_id is required');
    if (!body.title || String(body.title).trim() === '') {
        throw new HttpError(422, 'Title is required');
    }
    if (!body.description || String(body.description).trim() === '') {
        throw new HttpError(422, 'Description is required');
    }

    const course = await loadCourseOrFail(body.course_id);
    await assertCanParticipate(course, user);

    const isReply = body.title === 'reply';
    const description = isReply
        ? String(body.description).replace(/<[^>]*>/g, '') // strip HTML, matches PHP strip_tags
        : String(body.description);

    const row = await Forum.create({
        user_id: user.id,
        course_id: course.id,
        parent_id: body.parent_id || null,
        title: body.title,
        description,
    });

    return {
        message: isReply ? 'Reply added successfully' : 'Question added successfully',
        post: serializeRow(row, await fetchUsersByIds([user.id]), user.id),
    };
};

const update = async ({ id, body, user }) => {
    const row = await Forum.findByPk(id);
    if (!row) throw new HttpError(404, 'Post not found');
    const course = await loadCourseOrFail(row.course_id);
    await assertCanModerate(row, course, user);

    if (!body.title || String(body.title).trim() === '') {
        throw new HttpError(422, 'Title is required');
    }
    if (!body.description || String(body.description).trim() === '') {
        throw new HttpError(422, 'Description is required');
    }

    const isReply = body.title === 'reply';
    const description = isReply
        ? String(body.description).replace(/<[^>]*>/g, '')
        : String(body.description);

    await row.update({ title: body.title, description });
    return {
        message: isReply ? 'Reply updated successfully' : 'Question updated successfully',
        post: serializeRow(row, await fetchUsersByIds([row.user_id]), user.id),
    };
};

const destroy = async ({ id, user }) => {
    const row = await Forum.findByPk(id);
    if (!row) throw new HttpError(404, 'Post not found');
    const course = await loadCourseOrFail(row.course_id);
    await assertCanModerate(row, course, user);

    // Collect every forum id being removed: the post itself, plus its replies
    // when it's a question.
    const idsToRemove = [row.id];
    if (row.parent_id == null) {
        const replies = await Forum.findAll({
            where: { parent_id: row.id },
            attributes: ['id'],
        });
        idsToRemove.push(...replies.map((r) => r.id));
    }

    // Clear forum_reports first — its FK to forums has no ON DELETE CASCADE,
    // so a reported post can't be deleted until its reports are gone.
    await ForumReport.destroy({ where: { forum_id: { [Op.in]: idsToRemove } } });

    // Now remove the replies (if any) and the post.
    if (idsToRemove.length > 1) {
        await Forum.destroy({ where: { parent_id: row.id } });
    }
    await row.destroy();
    return { message: 'Post deleted successfully', id: Number(id) };
};

/* ============================== Likes / Dislikes ============================== */

// Toggle a vote on a post. Adding a like removes a prior dislike (and vice
// versa) — mutually exclusive per the PHP reference.
const toggleVote = async ({ id, user, kind }) => {
    if (kind !== 'like' && kind !== 'dislike') {
        throw new HttpError(400, 'Invalid vote kind');
    }
    const row = await Forum.findByPk(id);
    if (!row) throw new HttpError(404, 'Post not found');
    const course = await loadCourseOrFail(row.course_id);
    await assertCanParticipate(course, user);

    const uid = String(user.id);
    const likes = parseVotes(row.likes);
    const dislikes = parseVotes(row.dislikes);

    const primary = kind === 'like' ? likes : dislikes;
    const other = kind === 'like' ? dislikes : likes;

    const idx = primary.indexOf(uid);
    if (idx >= 0) primary.splice(idx, 1); // toggle off
    else primary.push(uid);                // toggle on

    // Remove the opposing vote when adding a new one.
    const otherIdx = other.indexOf(uid);
    if (otherIdx >= 0) other.splice(otherIdx, 1);

    await row.update({
        likes: serializeVotes(kind === 'like' ? primary : other),
        dislikes: serializeVotes(kind === 'like' ? other : primary),
    });

    return {
        message: 'Vote updated',
        likes_count: (kind === 'like' ? primary : other).length,
        dislikes_count: (kind === 'like' ? other : primary).length,
        liked_by_me: (kind === 'like' ? primary : other).includes(uid),
        disliked_by_me: (kind === 'like' ? other : primary).includes(uid),
    };
};

/* ============================== Report ============================== */

// Flag a post as inappropriate. The lms-cp reference's Report link was a
// dead stub — here it records a forum_reports row. One report per (post,
// user): re-reporting the same post is an idempotent no-op.
const reportPost = async ({ id, user, reason }) => {
    if (!user || !user.id) throw new HttpError(401, 'Authentication required');
    const row = await Forum.findByPk(id);
    if (!row) throw new HttpError(404, 'Post not found');
    const course = await loadCourseOrFail(row.course_id);
    await assertCanParticipate(course, user);

    // Can't report your own post.
    if (String(row.user_id) === String(user.id)) {
        throw new HttpError(422, 'You cannot report your own post');
    }

    const [, created] = await ForumReport.findOrCreate({
        where: { forum_id: row.id, user_id: user.id },
        defaults: {
            forum_id: row.id,
            user_id: user.id,
            reason: reason ? String(reason).slice(0, 1000) : null,
        },
    });

    return {
        message: created
            ? 'Post reported. Our team will review it.'
            : 'You have already reported this post.',
        already_reported: !created,
    };
};

module.exports = {
    listQuestions,
    getQuestionWithReplies,
    create,
    update,
    destroy,
    toggleVote,
    reportPost,
};
