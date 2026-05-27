import api from './client';

// Batches live behind /api/admin/batches in admin-service. The backend
// scopes every endpoint by the JWT's college_id, so the client doesn't pass
// it explicitly. 403 means the caller isn't a college admin.

export const listBatches = () =>
    api.get('/batches').then((r) => r.data);

export const getBatch = (id) =>
    api.get(`/batches/${id}`).then((r) => r.data);

export const createBatch = (payload) =>
    api.post('/batches', payload).then((r) => r.data);

export const updateBatch = (id, payload) =>
    api.put(`/batches/${id}`, payload).then((r) => r.data);

export const deleteBatch = (id) =>
    api.delete(`/batches/${id}`).then((r) => r.data);

// Add one-or-many students. Server is idempotent — re-adding existing
// members is a no-op (unique index dedupes).
export const addBatchMembers = (id, userIds) =>
    api.post(`/batches/${id}/members`, { userIds }).then((r) => r.data);

export const removeBatchMember = (id, userId) =>
    api.delete(`/batches/${id}/members/${userId}`).then((r) => r.data);

// Students of the caller's college that can be added to a batch.
export const listEligibleStudents = () =>
    api.get('/batches/eligible-students').then((r) => r.data);

// Lookup-only: batches across the given college IDs. Powers the Batches
// dropdown on Add/Edit Course where the admin first picks colleges.
// Not gated by the JWT's college_id — root admin can call it too.
export const listBatchesByColleges = (clgIds) =>
    api
        .get('/batches/by-colleges', { params: { clgIds: (clgIds || []).join(',') } })
        .then((r) => r.data);
