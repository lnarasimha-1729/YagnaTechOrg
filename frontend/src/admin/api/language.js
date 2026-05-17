import api from './client';

export const listLanguages = () => api.get('/languages').then((r) => r.data);

export const storeLanguage = (body) => api.post('/language/store', body).then((r) => r.data);

export const updateLanguageDirection = (id, direction) =>
    api.post(`/language/direction/${id}`, { direction }).then((r) => r.data);

export const deleteLanguage = (id) => api.delete(`/language/delete/${id}`).then((r) => r.data);
