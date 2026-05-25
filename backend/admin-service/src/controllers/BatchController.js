const service = require('../services/BatchService');
const { asyncHandler, HttpError } = require('../middlewares/error');

// All endpoints scope by the JWT's college_id — root admins (no college_id)
// are blocked at the controller boundary so they can't pull/modify another
// college's batches. Same gate the College Dashboard controller uses.
const requireCollege = (req) => {
    const collegeId = req.user?.college_id;
    if (!collegeId) {
        throw new HttpError(403, 'Batches are only available to college admins');
    }
    return collegeId;
};

exports.list = asyncHandler(async (req, res) => {
    const clgId = requireCollege(req);
    res.json(await service.list({ clgId }));
});

exports.show = asyncHandler(async (req, res) => {
    const clgId = requireCollege(req);
    res.json(await service.get({ clgId, id: Number(req.params.id) }));
});

exports.store = asyncHandler(async (req, res) => {
    const clgId = requireCollege(req);
    res.json(await service.create({ clgId, body: req.body }));
});

exports.update = asyncHandler(async (req, res) => {
    const clgId = requireCollege(req);
    res.json(await service.update({ clgId, id: Number(req.params.id), body: req.body }));
});

exports.delete = asyncHandler(async (req, res) => {
    const clgId = requireCollege(req);
    res.json(await service.remove({ clgId, id: Number(req.params.id) }));
});

exports.addMembers = asyncHandler(async (req, res) => {
    const clgId = requireCollege(req);
    res.json(await service.addMembers({ clgId, id: Number(req.params.id), body: req.body }));
});

exports.removeMember = asyncHandler(async (req, res) => {
    const clgId = requireCollege(req);
    res.json(await service.removeMember({
        clgId,
        id: Number(req.params.id),
        userId: req.params.userId,
    }));
});

exports.eligibleStudents = asyncHandler(async (req, res) => {
    const clgId = requireCollege(req);
    res.json(await service.eligibleStudents({ clgId }));
});
