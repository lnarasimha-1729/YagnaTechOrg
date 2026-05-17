import api from './client';

// Instructors live in the auth-service users table (role = 'instructor').
// Path is namespaced under /manage because the live-class feature already
// owns GET /instructors (registered earlier on the server) — without the
// prefix that route shadows these admin CRUD endpoints.
export const listInstructors = (params) =>
    api.get('/manage/instructors', { params }).then((r) => r.data);
export const getInstructor = (id) =>
    api.get(`/manage/instructors/${id}`).then((r) => r.data);
export const createInstructor = (body) =>
    api.post('/manage/instructors', body).then((r) => r.data);
export const updateInstructor = (id, body) =>
    api.post(`/manage/instructors/${id}`, body).then((r) => r.data);
export const deleteInstructor = (id) =>
    api.delete(`/manage/instructors/${id}`).then((r) => r.data);
