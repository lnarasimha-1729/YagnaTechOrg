const { Op, QueryTypes } = require('sequelize');
const courseRepo = require('../repositories/CourseRepository');
const categoryRepo = require('../repositories/CategoryRepository');
const authDb = require('../config/authDatabase');
const sectionRepo = require('../repositories/SectionRepository');
const lessonRepo = require('../repositories/LessonRepository');
const seoRepo = require('../repositories/SeoFieldRepository');
const questionRepo = require('../repositories/QuestionRepository');
const submissionRepo = require('../repositories/QuizSubmissionRepository');
const { Lesson, Section, User, Category } = require('../models');
const slugify = require('../helpers/slugify');
const { upload, removeFile, niceFileName } = require('../helpers/fileUploader');
const mailer = require('../helpers/mailer');
const { HttpError } = require('../middlewares/error');

const DEFAULT_DRIP = JSON.stringify({
    lesson_completion_role: 'percentage',
    minimum_duration: 15,
    minimum_percentage: '30',
    locked_lesson_message: '<h3 style="text-align:center"><strong>Permission denied!</strong></h3><p style="text-align:center">This course supports drip content, so you must complete the previous lessons.</p>',
});

const filterEmpty = (arr) =>
    Array.isArray(arr) ? arr.filter((v) => v !== null && v !== undefined && v !== '') : [];

// Build the Sequelize `where` fragment that scopes a query to an instructor's
// own courses (they own the row OR appear in instructor_ids). Returns null for
// admins / when no scoping applies. `instructor_ids` is a TEXT column (JSON
// array, CSV, or single value) — delimiter-aware LIKE matchers avoid a short
// id false-matching inside a longer one (123 inside 1234).
const buildInstructorScope = (user) => {
    if (user?.role !== 'instructor' || user.id == null) return null;
    const uid = String(user.id);
    return {
        [Op.or]: [
            { user_id: uid },
            { instructor_ids: { [Op.like]: `%"${uid}"%` } }, // JSON array element
            { instructor_ids: uid },                          // exact whole value
            { instructor_ids: { [Op.like]: `${uid},%` } },    // CSV: first
            { instructor_ids: { [Op.like]: `%,${uid},%` } },  // CSV: middle
            { instructor_ids: { [Op.like]: `%,${uid}` } },    // CSV: last
        ],
    };
};

// Merge a base `where` with the instructor scope so a count reflects only the
// instructor's courses. For admins (scope null) the base `where` is returned
// as-is.
const scopedWhere = (base, scope) =>
    scope ? { ...base, [Op.and]: [...(base[Op.and] || []), scope] } : base;

// Parse a course's `instructor_ids` (TEXT — JSON array, CSV, or single value)
// into an array of id strings. Unlike zoom-live-class.courseInstructorIds this
// does NOT fold in user_id — we want the *assigned* instructors only.
const parseInstructorIds = (raw) => {
    if (raw == null || raw === '') return [];
    if (Array.isArray(raw)) return raw.map((v) => String(v)).filter(Boolean);
    const s = String(raw).trim();
    try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean);
        if (parsed) return [String(parsed)];
    } catch {
        if (s.includes(',')) return s.split(',').map((v) => v.trim()).filter(Boolean);
        return [s];
    }
    return [];
};

// Batch-resolve instructor profiles from the auth-service DB (lucy_devdb.users)
// — instructors are auth-service users, not lms_admin.users. Returns a map
// keyed by userId string. Best-effort: a DB failure yields an empty map so the
// course list still renders.
const fetchInstructorsByIds = async (ids) => {
    const unique = [...new Set(ids.map((v) => String(v)).filter(Boolean))];
    if (!unique.length) return {};
    try {
        const rows = await authDb.query(
            `SELECT u.userId AS id, u.name, u.email, u.instructorPhoto AS photo
               FROM users u
              WHERE u.userId IN (:ids)`,
            { replacements: { ids: unique }, type: QueryTypes.SELECT }
        );
        const byId = {};
        for (const r of rows) byId[String(r.id)] = r;
        return byId;
    } catch (err) {
        console.warn('[courses] instructor lookup failed:', err.message);
        return {};
    }
};

const emptyResponse = (query = {}) => ({
    status: query.status || 'all',
    instructor: query.instructor || 'all',
    price: query.price || 'all',
    courses: { data: [], total: 0, per_page: 20, current_page: Number(query.page) || 1, last_page: 1 },
    pending_courses: 0,
    active_courses: 0,
    upcoming_courses: 0,
    paid_courses: 0,
    free_courses: 0,
});

const list = async (query, user = null) => {
    try {
        return await dbList(query, user);
    } catch (err) {
        console.warn('[courses] DB query failed:', err.message);
        return emptyResponse(query);
    }
};

const dbList = async (query, user = null) => {
    const { category, search, price, instructor, status, page = 1 } = query;
    const where = {};
    const parent = {};

    if (category && category !== 'all') {
        const cat = await categoryRepo.findBySlug(category);
        if (cat) {
            if (cat.parent_id) {
                parent.child_cat = category;
                where.category_id = cat.id;
            } else {
                const subs = await categoryRepo.findChildrenIds(cat.id);
                where.category_id = { [Op.in]: [cat.id, ...subs] };
                parent.parent_cat = category;
            }
        }
    }
    if (search) where.title = { [Op.like]: `%${search}%` };
    if (price && price !== 'all') where.is_paid = price === 'paid' ? 1 : price === 'free' ? 0 : 2;
    if (instructor && instructor !== 'all') where.user_id = instructor;
    if (status && status !== 'all') where.status = status;

    // Instructors only see their own courses — either they own the course
    // (user_id matches) or they're listed in instructor_ids. Admins see all.
    // `instructorScope` is reused below so the stat-card counts (active,
    // pending, upcoming, …) reflect the SAME scoped set as the course list,
    // not global totals.
    const instructorScope = buildInstructorScope(user);
    if (instructorScope) {
        where[Op.and] = [
            ...(Array.isArray(where[Op.and]) ? where[Op.and] : []),
            instructorScope,
        ];
    }

    const limit = 20;
    const offset = (Number(page) - 1) * limit;
    const { count, rows } = await courseRepo.paginate({
        where,
        order: [['id', 'DESC']],
        limit,
        offset,
        include: [
            { model: User, as: 'creator', attributes: ['id', 'name', 'email', 'photo'] },
            { model: Category, attributes: ['id', 'title', 'slug'] },
        ],
    });

    const courseIds = rows.map((r) => r.id);
    const [lessonCounts, sectionCounts] = await Promise.all([
        courseIds.length ? Lesson.findAll({
            where: { course_id: { [Op.in]: courseIds } },
            attributes: ['course_id', [Lesson.sequelize.fn('COUNT', Lesson.sequelize.col('id')), 'count']],
            group: ['course_id'],
            raw: true,
        }) : [],
        courseIds.length ? Section.findAll({
            where: { course_id: { [Op.in]: courseIds } },
            attributes: ['course_id', [Section.sequelize.fn('COUNT', Section.sequelize.col('id')), 'count']],
            group: ['course_id'],
            raw: true,
        }) : [],
    ]);

    const lessonCountByCourse = Object.fromEntries(lessonCounts.map((r) => [r.course_id, Number(r.count) || 0]));
    const sectionCountByCourse = Object.fromEntries(sectionCounts.map((r) => [r.course_id, Number(r.count) || 0]));

    // Resolve the *assigned* instructor for each course from `instructor_ids`
    // (auth-service users). `creator` (the FK-bound user_id) is the admin who
    // owns the row, not the teaching instructor — so the list must show the
    // instructor_ids person. One batched auth-DB lookup for all rows.
    const allInstructorIds = rows.flatMap((r) => parseInstructorIds(r.instructor_ids));
    const instructorsById = await fetchInstructorsByIds(allInstructorIds);

    const enrichedRows = rows.map((row) => {
        const json = row.toJSON();
        const assignedIds = parseInstructorIds(json.instructor_ids);
        // First resolvable assigned instructor drives the list's Instructor
        // cell. Fall back to `creator` only when no instructor is assigned.
        const assigned = assignedIds
            .map((id) => instructorsById[String(id)])
            .find(Boolean);
        return {
            ...json,
            instructor: assigned
                ? { id: assigned.id, name: assigned.name, email: assigned.email, photo: assigned.photo }
                : json.creator || null, // frontend reads c.instructor.name / .email
            category: json.Category || json.category || null, // frontend reads c.category?.title
            lesson_count: lessonCountByCourse[json.id] || 0,
            section_count: sectionCountByCourse[json.id] || 0,
            enrolled: 0, // TODO: wire up once an Enrollment model exists
        };
    });

    // Stat-card counts. For an instructor these are scoped to their own
    // courses (same instructorScope as the list) so the cards match the list
    // below them. For admins the counts are global.
    const [pending_courses, active_courses, upcoming_courses, paid_courses, free_courses] = await Promise.all([
        courseRepo.count(scopedWhere({ status: 'pending' }, instructorScope)),
        courseRepo.count(scopedWhere({ status: 'active' }, instructorScope)),
        courseRepo.count(scopedWhere({ status: 'upcoming' }, instructorScope)),
        courseRepo.count(scopedWhere({ is_paid: 1 }, instructorScope)),
        courseRepo.count(scopedWhere({ is_paid: 0 }, instructorScope)),
    ]);

    return {
        ...parent,
        status: status || 'all',
        instructor: instructor || 'all',
        price: price || 'all',
        courses: { data: enrichedRows, total: count, per_page: limit, current_page: Number(page), last_page: Math.ceil(count / limit) },
        pending_courses, active_courses, upcoming_courses, paid_courses, free_courses,
    };
};

const createMeta = async () => {
    const categories = await categoryRepo.findRootWithChildren();
    return { categories };
};

const create = async ({ body, files = {}, userId }) => {
    const b = body;
    const finalUserId = userId || b.user_id || 1;

    const data = {
        title: b.title,
        slug: slugify(b.title),
        user_id: finalUserId,
        category_id: b.category_id,
        course_type: b.course_type || 'general',
        status: b.status,
        level: b.level,
        language: String(b.language || '').toLowerCase(),
        is_paid: b.is_paid,
        price: b.price || 0,
        discount_flag: b.discount_flag || 0,
        discounted_price: b.discounted_price || 0,
        enable_drip_content: b.enable_drip_content || 0,
        drip_content_settings: DEFAULT_DRIP,
        short_description: b.short_description,
        description: b.description,
        meta_description: b.meta_description,
    };

    const metaKeywords = Array.isArray(b.meta_keywords)
        ? b.meta_keywords.map((k) => (typeof k === 'object' ? k.value : k)).join(',')
        : (b.meta_keywords || '');
    data.meta_keywords = metaKeywords;

    data.expiry_period =
        b.expiry_period === 'limited_time' && Number(b.number_of_month) > 0
            ? Number(b.number_of_month)
            : null;

    if (b.requirements) data.requirements = JSON.stringify(filterEmpty(b.requirements));
    if (b.outcomes) data.outcomes = JSON.stringify(filterEmpty(b.outcomes));

    if (b.faq_title) {
        const titles = Array.isArray(b.faq_title) ? b.faq_title : [b.faq_title];
        const descs = Array.isArray(b.faq_description) ? b.faq_description : [b.faq_description];
        data.faqs = JSON.stringify(
            titles.map((t, i) => ({ title: t, description: descs[i] })).filter((f) => f.title)
        );
    }

    data.instructor_ids = JSON.stringify(b.instructors || [finalUserId]);

    if (files.thumbnail?.[0]) {
        const f = files.thumbnail[0];
        data.thumbnail = `uploads/course-thumbnail/${niceFileName(b.title, f.originalname.split('.').pop())}`;
        await upload(f, data.thumbnail, 400, 400);
    }
    if (files.banner?.[0]) {
        const f = files.banner[0];
        data.banner = `uploads/course-banner/${niceFileName(b.title, f.originalname.split('.').pop())}`;
        await upload(f, data.banner, 1400, 1400);
    }
    if (files.preview?.[0]) {
        const f = files.preview[0];
        data.preview = `uploads/course-preview/${niceFileName(b.title, f.originalname.split('.').pop())}`;
        await upload(f, data.preview);
    }

    const course = await courseRepo.create(data);
    await course.update({ slug: slugify(`${b.title}-${course.id}`) });
    return { success: 'Course added successfully', course_id: course.id };
};

// Predicate: instructor is allowed to act on this course only if they own it
// (course.user_id) or they're listed in course.instructor_ids. Mirrors the
// LIKE-match the list endpoint uses; tighter parsing happens for
// zoom-live-class via that module's courseInstructorIds().
const instructorCanTouch = (course, user) => {
    if (!course || !user) return false;
    const uid = String(user.id);
    if (String(course.user_id || '') === uid) return true;
    const raw = course.instructor_ids;
    if (!raw) return false;
    return String(raw).includes(uid);
};

const edit = async (id, user = null) => {
    const course_details = await courseRepo.findById(id);
    if (!course_details) throw new HttpError(404, 'Not found');
    if (user?.role === 'instructor' && !instructorCanTouch(course_details, user)) {
        throw new HttpError(403, 'Forbidden');
    }
    const sections = await sectionRepo.findByCourse(id);
    return { course_details, sections };
};

const update = async ({ id, body, files = {} }) => {
    const course = await courseRepo.findById(id);
    if (!course) throw new HttpError(404, 'Data not found.');

    const b = body;
    if (!b.tab) throw new HttpError(400, 'Data not found.');

    const data = {};

    if (b.tab === 'basic') {
        data.title = b.title;
        data.slug = slugify(`${b.title}-${id}`);
        data.short_description = b.short_description;
        data.description = b.description;
        data.category_id = b.category_id;
        data.level = b.level;
        data.language = String(b.language || '').toLowerCase();
        data.status = b.status;
        data.instructor_ids = JSON.stringify(b.instructors || []);
    } else if (b.tab === 'pricing') {
        data.is_paid = b.is_paid;
        data.price = b.price || 0;
        data.discount_flag = b.discount_flag || 0;
        data.discounted_price = b.discounted_price || 0;
        data.expiry_period =
            b.expiry_period === 'limited_time' && Number(b.number_of_month) > 0
                ? Number(b.number_of_month)
                : null;
    } else if (b.tab === 'info') {
        data.requirements = JSON.stringify(filterEmpty(b.requirements));
        data.outcomes = JSON.stringify(filterEmpty(b.outcomes));
        const titles = Array.isArray(b.faq_title) ? b.faq_title : b.faq_title ? [b.faq_title] : [];
        const descs = Array.isArray(b.faq_description)
            ? b.faq_description
            : b.faq_description
                ? [b.faq_description]
                : [];
        data.faqs = JSON.stringify(
            titles.map((t, i) => ({ title: t, description: descs[i] })).filter((f) => f.title)
        );
    } else if (b.tab === 'media') {
        if (files.thumbnail?.[0]) {
            const f = files.thumbnail[0];
            data.thumbnail = `uploads/course-thumbnail/${niceFileName(b.title || course.title, f.originalname.split('.').pop())}`;
            await upload(f, data.thumbnail, 400, 400);
            removeFile(course.thumbnail);
        }
        if (files.banner?.[0]) {
            const f = files.banner[0];
            data.banner = `uploads/course-banner/${niceFileName(b.title || course.title, f.originalname.split('.').pop())}`;
            await upload(f, data.banner, 1400, 1400);
            removeFile(course.banner);
        }
        if (b.preview_video_provider === 'link') {
            data.preview = b.preview_link;
        } else if (b.preview_video_provider === 'file' && files.preview?.[0]) {
            const f = files.preview[0];
            data.preview = `uploads/course-preview/${niceFileName(b.title || course.title, f.originalname.split('.').pop())}`;
            await upload(f, data.preview);
            removeFile(course.preview);
        }
    } else if (b.tab === 'seo') {
        const seo = await seoRepo.findOne({ name_route: 'course.details', course_id: id });
        const metaKeywords = Array.isArray(b.meta_keywords)
            ? b.meta_keywords.map((k) => (typeof k === 'object' ? k.value : k)).join(', ')
            : (b.meta_keywords || '');

        const seoData = {
            course_id: id,
            route: 'Course Details',
            name_route: 'course.details',
            meta_title: b.meta_title,
            meta_description: b.meta_description,
            meta_robot: b.meta_robot,
            canonical_url: b.canonical_url,
            custom_url: b.custom_url,
            json_ld: b.json_ld,
            og_title: b.og_title,
            og_description: b.og_description,
            meta_keywords: metaKeywords,
        };

        if (files.og_image?.[0]) {
            const f = files.og_image[0];
            const dest = `uploads/seo-og-images/${id}-${f.originalname}`;
            await upload(f, dest, 600);
            seoData.og_image = dest;
            if (seo) removeFile(seo.og_image);
        }
        if (seo) await seo.update(seoData);
        else await seoRepo.create(seoData);
    } else if (b.tab === 'drip-content') {
        data.enable_drip_content = b.enable_drip_content;
        const [h, m, s] = String(b.minimum_duration || '00:00:00').split(':').map(Number);
        data.drip_content_settings = JSON.stringify({
            lesson_completion_role: b.lesson_completion_role,
            minimum_duration: h * 3600 + m * 60 + s,
            minimum_percentage: b.minimum_percentage,
            locked_lesson_message: b.locked_lesson_message,
        });
    }

    if (Object.keys(data).length) await course.update(data);
    return { success: 'Course updated successfully' };
};

const status = async (type, id) => {
    const allowed = ['active', 'pending', 'inactive', 'upcoming', 'private'];
    const next = allowed.includes(type) ? type : 'draft';
    await courseRepo.updateById(id, { status: next });
    return { success: 'Course status changed successfully' };
};

const remove = async (id) => {
    const course = await courseRepo.findById(id);
    if (!course) throw new HttpError(404, 'Course not found');

    // Order matters: sections.course_id and lessons.section_id both have FKs
    // back to courses/sections. We delete children first so the parent
    // destroy doesn't trip ER_ROW_IS_REFERENCED_2.
    const lessons = await Lesson.findAll({ where: { course_id: id } });
    for (const lesson of lessons) {
        removeFile(lesson.lesson_src);
        removeFile(`uploads/lesson_file/attachment/${lesson.attachment}`);
        if (lesson.lesson_type === 'quiz') {
            await questionRepo.destroyByQuiz(lesson.id);
            await submissionRepo.destroyByQuiz(lesson.id);
        }
        await lesson.destroy();
    }

    // Sections must be removed before the course row itself.
    await Section.destroy({ where: { course_id: id } });

    removeFile(course.thumbnail);
    removeFile(course.banner);
    removeFile(course.preview);
    await course.destroy();
    return { success: 'Course deleted successfully' };
};

const draft = async (id) => {
    const course = await courseRepo.findById(id);
    if (!course) return { error: 'Data not found.' };
    const next = course.status === 'active' ? 'deactivate' : 'active';
    await course.update({ status: next });
    return { success: 'Status has been updated.' };
};

const duplicate = async ({ id, userId, role }) => {
    const where = { id };
    if (role && role !== 'admin') where.user_id = userId;

    const course = await courseRepo.findOne(where);
    if (!course) throw new HttpError(404, 'Data not found.');

    const data = course.toJSON();
    if (role === 'admin') data.user_id = userId;
    delete data.id;
    delete data.created_at;
    delete data.updated_at;

    const created = await courseRepo.create(data);
    await created.update({ slug: `${slugify(data.title)}-${created.id}` });
    return { success: 'Course duplicated.', course_id: created.id };
};

const approval = async ({ id, subject, message }) => {
    await courseRepo.updateById(id, { status: 'active' });
    const course = await courseRepo.findByIdWithCreator(id);
    try {
        if (course?.creator?.email) {
            await mailer.send({ to: course.creator.email, subject, html: message });
        }
    } catch (_e) {
        // swallow mail errors — approval still succeeds
    }
    return { success: 'Course activated successfully' };
};

module.exports = { list, createMeta, create, edit, update, status, remove, draft, duplicate, approval };
