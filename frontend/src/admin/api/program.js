import api from './client';

// Programs are JSON-only (no file uploads) so we send plain objects. The
// backend service handles arrays for `features`.
export const listPrograms = () => api.get('/programs').then((r) => r.data);

export const getProgram = (id) => api.get(`/program/edit/${id}`).then((r) => r.data);

export const storeProgram = (data) => api.post('/program/store', data).then((r) => r.data);

export const updateProgram = (id, data) => api.post(`/program/update/${id}`, data).then((r) => r.data);

export const deleteProgram = (id) => api.delete(`/program/delete/${id}`).then((r) => r.data);

// Programs linked to a (college, batch) — powers Manage Students dropdowns.
// Accepts either ids (clgId/batchId) or display names (clgName/batchName);
// the backend resolves names against the colleges/batches tables.
export const listProgramsForCollegeBatch = (params) =>
    api.get('/programs/for-college-batch', { params }).then((r) => r.data);
