const svc = require('../services/InstructorService');
const { asyncHandler } = require('../middlewares/error');

exports.index = asyncHandler(async (req, res) => {
    res.json(await svc.list(req.query));
});

exports.show = asyncHandler(async (req, res) => {
    res.json(await svc.get(req.params.id));
});

exports.store = asyncHandler(async (req, res) => {
    // req.file is populated by upload.single('photo') in the route. Forward
    // it explicitly so the service can persist the uploaded image without
    // having to read multer internals.
    res.status(201).json(await svc.create(req.body, req.file));
});

exports.update = asyncHandler(async (req, res) => {
    res.json(await svc.update(req.params.id, req.body, req.file));
});

exports.destroy = asyncHandler(async (req, res) => {
    res.json(await svc.remove(req.params.id));
});
