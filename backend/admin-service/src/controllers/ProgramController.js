const programService = require('../services/ProgramService');
const { asyncHandler } = require('../middlewares/error');

exports.index = asyncHandler(async (_req, res) => {
    res.json(await programService.list());
});

exports.show = asyncHandler(async (req, res) => {
    res.json(await programService.get(req.params.id));
});

exports.store = asyncHandler(async (req, res) => {
    res.json(await programService.create(req.body));
});

exports.update = asyncHandler(async (req, res) => {
    res.json(await programService.update(req.params.id, req.body));
});

exports.delete = asyncHandler(async (req, res) => {
    res.json(await programService.remove(req.params.id));
});
