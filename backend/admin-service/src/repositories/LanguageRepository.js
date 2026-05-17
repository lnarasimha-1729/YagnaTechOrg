const { Op } = require('sequelize');
const { Language } = require('../models');

const findAll = () => Language.findAll({ order: [['id', 'ASC']] });

const findOne = (where) => Language.findOne({ where });

const create = (data) => Language.create(data);

const isNameTaken = async (name, excludeId = null) => {
    const where = excludeId
        ? { name, id: { [Op.ne]: excludeId } }
        : { name };
    return Boolean(await Language.count({ where }));
};

module.exports = { findAll, findOne, create, isNameTaken };
