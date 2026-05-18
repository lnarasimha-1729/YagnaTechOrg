/**
 * Shared validators for the Zoom Live Class module.
 *
 * The reference mern-lineclass implementation uses Zod here; admin-service
 * does NOT use Zod elsewhere, so we keep the same file name but expose plain
 * functions that throw HttpError(422). live-class.service.js calls these
 * inline today (validateBody) — these exports are kept so other modules can
 * re-validate without duplicating the rules.
 */

const { HttpError } = require('../middlewares/error');

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isParseableDate = (v) => v != null && !Number.isNaN(Date.parse(v));

const collect = (errors) => {
    if (!Object.keys(errors).length) return;
    throw new HttpError(422, Object.values(errors)[0]);
};

const validateStore = (body) => {
    const errors = {};
    if (!isNonEmptyString(body.class_topic)) errors.class_topic = 'Class topic is required';
    else if (body.class_topic.length > 255) errors.class_topic = 'Class topic must be at most 255 characters';
    if (!isParseableDate(body.class_date_and_time)) errors.class_date_and_time = 'Class date and time is required';
    if (!body.user_id || !Number(body.user_id)) errors.user_id = 'Instructor is required';
    if (body.provider && body.provider !== 'zoom') errors.provider = 'Only the Zoom provider is supported';
    collect(errors);
};

const validateUpdate = (body) => {
    const errors = {};
    if (!isNonEmptyString(body.class_topic)) errors.class_topic = 'Class topic is required';
    else if (body.class_topic.length > 255) errors.class_topic = 'Class topic must be at most 255 characters';
    if (!isParseableDate(body.class_date_and_time)) errors.class_date_and_time = 'Class date and time is required';
    if (!body.user_id || !Number(body.user_id)) errors.user_id = 'Instructor is required';
    collect(errors);
};

const validateSettings = (body) => {
    const errors = {};
    if (!isNonEmptyString(body.zoom_account_email) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.zoom_account_email)) {
        errors.zoom_account_email = 'A valid account email is required';
    }
    if (!isNonEmptyString(body.zoom_account_id)) errors.zoom_account_id = 'Account ID is required';
    if (!isNonEmptyString(body.zoom_client_id)) errors.zoom_client_id = 'Client ID is required';
    if (!isNonEmptyString(body.zoom_client_secret)) errors.zoom_client_secret = 'Client secret is required';
    if (body.zoom_web_sdk && !['active', 'inactive'].includes(body.zoom_web_sdk)) {
        errors.zoom_web_sdk = 'Invalid Web SDK setting';
    }
    if (body.zoom_web_sdk === 'active') {
        if (!isNonEmptyString(body.zoom_sdk_client_id)) errors.zoom_sdk_client_id = 'SDK Client ID is required';
        if (!isNonEmptyString(body.zoom_sdk_client_secret)) errors.zoom_sdk_client_secret = 'SDK Client secret is required';
    }
    collect(errors);
};

module.exports = { validateStore, validateUpdate, validateSettings };
