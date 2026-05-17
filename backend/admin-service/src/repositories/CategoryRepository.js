const { Op } = require('sequelize');
const { Category } = require('../models');

const findRootWithChildren = () =>
    Category.findAll({
        where: { parent_id: null },
        include: [{ model: Category, as: 'childs' }],
        order: [['sort', 'ASC']],
    });

// College-scoped variant. Returns only categories whose clg_ids JSON array
// contains the given clgId — applied to BOTH parents and their children so a
// student never sees another college's category at any level. We use
// JSON_CONTAINS (MySQL) via a sequelize.literal; the value is escaped to
// prevent injection from the query string.
const findRootWithChildrenForCollege = (clgId) => {
    const escaped = Category.sequelize.escape(JSON.stringify(clgId));
    // Parent rows: unqualified column is fine (single base table in the
    // outer WHERE).
    const parentContains = Category.sequelize.literal(
        `JSON_CONTAINS(\`Category\`.\`clg_ids\`, ${escaped})`
    );
    // Child rows: the include is aliased as `childs` by Sequelize, so the
    // JSON_CONTAINS must reference that alias to avoid an ambiguous column.
    const childContains = Category.sequelize.literal(
        `JSON_CONTAINS(\`childs\`.\`clg_ids\`, ${escaped})`
    );
    return Category.findAll({
        where: {
            parent_id: null,
            [Op.and]: [parentContains],
        },
        include: [
            {
                model: Category,
                as: 'childs',
                required: false,
                where: { [Op.and]: [childContains] },
            },
        ],
        order: [['sort', 'ASC']],
    });
};

const findById = (id) => Category.findByPk(id);

const findBySlug = (slug) => Category.findOne({ where: { slug } });

const findChildrenOf = (parentId) => Category.findAll({ where: { parent_id: parentId } });

const findChildrenIds = async (parentId) => {
    const subs = await Category.findAll({ where: { parent_id: parentId }, attributes: ['id'] });
    return subs.map((s) => s.id);
};

const isSlugTaken = async (slug, excludeId = null) => {
    const where = excludeId ? { slug, id: { [Op.ne]: excludeId } } : { slug };
    return Boolean(await Category.count({ where }));
};

const create = (data) => Category.create(data);

module.exports = {
    findRootWithChildren,
    findRootWithChildrenForCollege,
    findById,
    findBySlug,
    findChildrenOf,
    findChildrenIds,
    isSlugTaken,
    create,
};
