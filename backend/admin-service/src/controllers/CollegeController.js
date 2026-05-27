const collegeService = require('../services/CollegeService');
const { asyncHandler } = require('../middlewares/error');

exports.index = asyncHandler(async (req, res) => {
    res.json(await collegeService.list(req.query));
});

exports.show = asyncHandler(async (req, res) => {
    res.json(await collegeService.get(req.params.id));
});

exports.store = asyncHandler(async (req, res) => {
    res.status(201).json(await collegeService.create(req.body));
});

exports.update = asyncHandler(async (req, res) => {
    res.json(await collegeService.update(req.params.id, req.body));
});

exports.destroy = asyncHandler(async (req, res) => {
    res.json(await collegeService.remove(req.params.id));
});

exports.setAccess = asyncHandler(async (req, res) => {
    res.json(await collegeService.setAccess(req.params.id, req.body?.isActive));
});
