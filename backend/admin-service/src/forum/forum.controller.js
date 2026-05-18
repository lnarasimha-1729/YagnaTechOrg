/**
 * Thin handlers — service does the work. Response shape matches the rest of
 * the admin-service (`{ questions: [...] }`, `{ message, post }`, etc.).
 */

const { asyncHandler } = require('../middlewares/error');
const service = require('./forum.service');

exports.index = asyncHandler(async (req, res) => {
    res.json(
        await service.listQuestions({
            courseId: req.query.course_id || req.params.course_id,
            search: req.query.search,
            user: req.user,
        })
    );
});

exports.show = asyncHandler(async (req, res) => {
    res.json(await service.getQuestionWithReplies({ id: req.params.id, user: req.user }));
});

exports.store = asyncHandler(async (req, res) => {
    const result = await service.create({ body: req.body, user: req.user });
    res.status(201).json(result);
});

exports.update = asyncHandler(async (req, res) => {
    res.json(await service.update({ id: req.params.id, body: req.body, user: req.user }));
});

exports.destroy = asyncHandler(async (req, res) => {
    res.json(await service.destroy({ id: req.params.id, user: req.user }));
});

exports.like = asyncHandler(async (req, res) => {
    res.json(await service.toggleVote({ id: req.params.id, user: req.user, kind: 'like' }));
});

exports.dislike = asyncHandler(async (req, res) => {
    res.json(await service.toggleVote({ id: req.params.id, user: req.user, kind: 'dislike' }));
});

exports.report = asyncHandler(async (req, res) => {
    res.json(await service.reportPost({ id: req.params.id, user: req.user, reason: req.body.reason }));
});
