const studentService = require('../services/StudentService');
const { asyncHandler } = require('../middlewares/error');

exports.index = asyncHandler(async (req, res) => {
    res.json(await studentService.list(req.query));
});

exports.colleges = asyncHandler(async (req, res) => {
    res.json(await studentService.collegeOptions());
});

exports.show = asyncHandler(async (req, res) => {
    res.json(await studentService.get(req.params.id));
});

exports.store = asyncHandler(async (req, res) => {
    res.status(201).json(await studentService.create(req.body, req.file));
});

exports.update = asyncHandler(async (req, res) => {
    res.json(await studentService.update(req.params.id, req.body, req.file));
});

exports.destroy = asyncHandler(async (req, res) => {
    res.json(await studentService.remove(req.params.id));
});

// "Send" in the Manage Students Program Request column. requested_by is the
// admin from the verified JWT (adminOnly sets req.user).
exports.programRequest = asyncHandler(async (req, res) => {
    const result = await studentService.sendProgramRequest(
        req.params.id,
        req.body.program,
        req.user?.id ?? null,
    );
    res.json(result);
});
