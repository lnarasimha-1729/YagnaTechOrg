const languageRepo = require('../repositories/LanguageRepository');
const { HttpError } = require('../middlewares/error');

const normalizeDirection = (d) => {
    const v = String(d || '').toLowerCase();
    return v === 'rtl' ? 'rtl' : 'ltr';
};

const list = async () => {
    try {
        const rows = await languageRepo.findAll();
        return { languages: rows };
    } catch (err) {
        console.warn('[languages] DB query failed:', err.message);
        return { languages: [] };
    }
};

const create = async ({ body }) => {
    const name = String(body.name || '').trim();
    if (!name) throw new HttpError(422, 'Language name is required');

    if (await languageRepo.isNameTaken(name)) {
        throw new HttpError(400, 'Language already exists');
    }

    const lang = await languageRepo.create({
        name,
        code: body.code ? String(body.code).trim() : null,
        direction: normalizeDirection(body.direction),
        is_default: Boolean(body.is_default),
    });
    return { success: 'Language has been added successfully.', language: lang };
};

const updateDirection = async ({ id, direction }) => {
    const lang = await languageRepo.findOne({ id });
    if (!lang) throw new HttpError(404, 'Language not found.');
    await lang.update({ direction: normalizeDirection(direction) });
    return { success: 'Direction updated.', language: lang };
};

const remove = async ({ id }) => {
    const lang = await languageRepo.findOne({ id });
    if (!lang) throw new HttpError(404, 'Language not found.');
    if (lang.is_default) throw new HttpError(400, 'Cannot delete the default language.');
    await lang.destroy();
    return { success: 'Language has been deleted successfully.' };
};

module.exports = { list, create, updateDirection, remove };
