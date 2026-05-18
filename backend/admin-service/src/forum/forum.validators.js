/**
 * Forum validators — plain HttpError(422) checks. Mirrors the Laravel rules:
 *   store/update → title required, description required.
 *
 * The service does the actual validation inline (so the controller stays
 * thin). These exports exist for reuse if a future endpoint needs to check
 * the same shape without going through the service.
 */

const { HttpError } = require('../middlewares/error');

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

const validateStore = (body) => {
    if (!body.course_id) throw new HttpError(422, 'course_id is required');
    if (!isNonEmptyString(body.title)) throw new HttpError(422, 'Title is required');
    if (!isNonEmptyString(body.description)) throw new HttpError(422, 'Description is required');
};

const validateUpdate = (body) => {
    if (!isNonEmptyString(body.title)) throw new HttpError(422, 'Title is required');
    if (!isNonEmptyString(body.description)) throw new HttpError(422, 'Description is required');
};

module.exports = { validateStore, validateUpdate };
