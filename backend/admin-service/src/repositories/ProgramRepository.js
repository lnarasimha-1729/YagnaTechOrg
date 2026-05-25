const { Program } = require('../models');

const list = () => Program.findAll({ order: [['sort', 'ASC'], ['id', 'ASC']] });

const findById = (id) => Program.findByPk(id);

const create = (data) => Program.create(data);

module.exports = { list, findById, create };
