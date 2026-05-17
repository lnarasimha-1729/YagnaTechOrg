const languageService = require('../services/LanguageService');
const { asyncHandler } = require('../middlewares/error');

exports.index = asyncHandler(async (_req, res) => {
    res.json(await languageService.list());
});

exports.store = asyncHandler(async (req, res) => {
    res.json(await languageService.create({ body: req.body }));
});

exports.updateDirection = asyncHandler(async (req, res) => {
    res.json(await languageService.updateDirection({ id: req.params.id, direction: req.body?.direction }));
});

exports.delete = asyncHandler(async (req, res) => {
    res.json(await languageService.remove({ id: req.params.id }));
});
