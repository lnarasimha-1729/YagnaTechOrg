const categoryRepo = require('../repositories/CategoryRepository');
const slugify = require('../helpers/slugify');
const { upload, removeFile, niceFileName } = require('../helpers/fileUploader');
const { HttpError } = require('../middlewares/error');

// clgIds can arrive as `clgIds[]=a&clgIds[]=b` (multi-value form fields,
// which express parses as an array), as a single string `clgIds=a`, or as
// `clgIds[]` already coerced to an array — normalize to a deduped string[].
const normalizeClgIds = (raw) => {
    if (raw == null) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return Array.from(new Set(arr.map((v) => String(v).trim()).filter(Boolean)));
};

// `clgId` gates the public student view: when absent we return an empty list
// (the spec says "show nothing until the student picks a college") flagged
// with no_college so the UI can prompt them. When present, only categories
// mapped to that college are returned — never another college's.
//
// Admin-side callers (CourseService.createMeta) call list() with no arg and
// still get the full unfiltered tree, preserving existing behaviour.
const list = async (clgId = undefined) => {
    try {
        if (clgId === undefined) {
            const categories = await categoryRepo.findRootWithChildren();
            return { categories };
        }

        const trimmed = typeof clgId === 'string' ? clgId.trim() : '';
        if (!trimmed) {
            return { categories: [], no_college: true };
        }

        const categories = await categoryRepo.findRootWithChildrenForCollege(trimmed);
        return { categories };
    } catch (err) {
        console.warn('[categories] DB query failed:', err.message);
        return { categories: [] };
    }
};

const create = async (body, files = {}) => {
    const { title, parent_id, icon, keywords, description } = body;
    if (!title || !icon) throw new HttpError(422, 'title and icon are required');

    const slug = slugify(title);
    if (await categoryRepo.isSlugTaken(slug)) {
        throw new HttpError(400, 'There cannot be more than one category with the same name. Please change your category name');
    }

    const data = {
        parent_id: parent_id || null,
        title,
        slug,
        icon,
        sort: 0,
        keywords: keywords || null,
        description: description || null,
        // Persist the college IDs picked in the Add Category form. Stored as
        // JSON (column type DataTypes.JSON) so we can query them later with
        // JSON_CONTAINS when filtering "categories at college X".
        clg_ids: normalizeClgIds(body.clgIds ?? body['clgIds[]']),
    };

    if (files.thumbnail?.[0]) {
        const f = files.thumbnail[0];
        data.thumbnail = `uploads/category-thumbnail/${niceFileName(title, f.originalname.split('.').pop())}`;
        await upload(f, data.thumbnail, 500, 500);
    }
    if (files.category_logo?.[0]) {
        const f = files.category_logo[0];
        data.category_logo = `uploads/category-logo/${niceFileName(`${title} logo`, f.originalname.split('.').pop())}`;
        await upload(f, data.category_logo, 400, 400);
    }

    const category = await categoryRepo.create(data);
    return { success: 'Category added successfully', category };
};

const update = async (id, body, files = {}) => {
    const pre = await categoryRepo.findById(id);
    if (!pre) throw new HttpError(404, 'Not found');

    const { title, parent_id, icon, keywords, description } = body;
    if (!title || !icon) throw new HttpError(422, 'title and icon are required');

    const slug = slugify(title);
    if (await categoryRepo.isSlugTaken(slug, id)) {
        throw new HttpError(400, 'There cannot be more than one category with the same name. Please change your category name');
    }

    const data = {
        parent_id: parent_id || null,
        title,
        slug,
        icon,
        keywords: keywords || null,
        description: description || null,
    };

    // Only overwrite clg_ids if the edit form actually sent it — otherwise an
    // edit that doesn't touch colleges would silently wipe the mapping.
    if (body.clgIds !== undefined || body['clgIds[]'] !== undefined) {
        data.clg_ids = normalizeClgIds(body.clgIds ?? body['clgIds[]']);
    }

    if (files.thumbnail?.[0]) {
        const f = files.thumbnail[0];
        data.thumbnail = `uploads/category-thumbnail/${niceFileName(title, f.originalname.split('.').pop())}`;
        await upload(f, data.thumbnail, 500, 500);
        removeFile(pre.thumbnail);
    }
    if (files.category_logo?.[0]) {
        const f = files.category_logo[0];
        data.category_logo = `uploads/category-logo/${niceFileName(`${title}-logo`, f.originalname.split('.').pop())}`;
        await upload(f, data.category_logo, 400, 400);
        removeFile(pre.category_logo);
    }

    await pre.update(data);
    return { success: 'Category updated successfully' };
};

const remove = async (id) => {
    const cat = await categoryRepo.findById(id);
    if (!cat) throw new HttpError(404, 'Not found');

    if (cat.parent_id) {
        removeFile(cat.thumbnail);
        await cat.destroy();
    } else {
        const children = await categoryRepo.findChildrenOf(cat.id);
        for (const c of children) {
            removeFile(c.thumbnail);
            await c.destroy();
        }
        removeFile(cat.thumbnail);
        await cat.destroy();
    }
    return { success: 'Category deleted successfully' };
};

module.exports = { list, create, update, remove };
