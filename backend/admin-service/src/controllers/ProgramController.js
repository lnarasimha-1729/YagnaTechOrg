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

// Used by Manage Students bulk + per-row dropdown: programs the admin
// already linked to this (college, batch). Names or ids both accepted so
// the page can call with whatever it already has on hand.
exports.forCollegeBatch = asyncHandler(async (req, res) => {
    res.json(await programService.listForCollegeBatch({
        clgId: req.query.clgId,
        clgName: req.query.clgName,
        batchId: req.query.batchId,
        batchName: req.query.batchName,
    }));
});
