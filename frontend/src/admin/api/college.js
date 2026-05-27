import api from './client';

export const listColleges = (params) => api.get('/colleges', { params }).then((r) => r.data);
export const getCollege = (id) => api.get(`/colleges/${id}`).then((r) => r.data);
export const createCollege = (body) => api.post('/colleges', body).then((r) => r.data);
export const updateCollege = (id, body) => api.post(`/colleges/${id}`, body).then((r) => r.data);
export const deleteCollege = (id) => api.delete(`/colleges/${id}`).then((r) => r.data);
export const setCollegeAccess = (id, isActive) =>
    api.post(`/colleges/${id}/access`, { isActive }).then((r) => r.data);
