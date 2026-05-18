/**
 * Thin handlers — wrap service calls with asyncHandler so errors flow through
 * the existing errorHandler middleware (same pattern as LiveClassController.js).
 *
 * Response shape mirrors the existing admin-service convention:
 *   - list endpoints:    { live_classes: [...] }, { instructors: [...] }
 *   - mutations:         { message, live_class }
 *   - join/sync/sdk:     raw decision object (no wrapping)
 *   - settings:          { settings } / { settings, message }
 */

const { asyncHandler } = require('../middlewares/error');
const service = require('./live-class.service');
const zoomLive = require('./zoom.live-class');

exports.list_by_course = asyncHandler(async (req, res) => {
    const live_classes = await service.listByCourse(req.params.course_id);
    res.json({ live_classes });
});

exports.instructors_for_course = asyncHandler(async (req, res) => {
    const instructors = await service.listInstructors(req.params.course_id);
    res.json({ instructors });
});

exports.store = asyncHandler(async (req, res) => {
    const live_class = await service.create({
        courseId: req.params.course_id,
        body: req.body,
        user: req.user,
    });
    res.status(201).json({ message: 'Live class added successfully', live_class });
});

exports.update = asyncHandler(async (req, res) => {
    const live_class = await service.update({
        id: req.params.id,
        body: req.body,
        user: req.user,
    });
    res.json({ message: 'Live class updated successfully', live_class });
});

exports.destroy = asyncHandler(async (req, res) => {
    const result = await service.remove({ id: req.params.id, user: req.user });
    res.json({ message: 'Live class deleted successfully', ...result });
});

exports.resolve_join = asyncHandler(async (req, res) => {
    const decision = await service.resolveJoin({ id: req.params.id, user: req.user });
    res.json(decision);
});

exports.sdk_signature = asyncHandler(async (req, res) => {
    const auth = await zoomLive.buildSdkAuth({ id: req.params.id, user: req.user });
    res.json(auth);
});

exports.sync_status = asyncHandler(async (req, res) => {
    const status = await zoomLive.syncStatus({ id: req.params.id });
    res.json(status);
});

exports.read_settings = asyncHandler(async (_req, res) => {
    res.json({ settings: await service.readSettings() });
});

exports.write_settings = asyncHandler(async (req, res) => {
    const settings = await service.writeSettings(req.body);
    res.json({ message: 'Live class settings saved successfully', settings });
});
