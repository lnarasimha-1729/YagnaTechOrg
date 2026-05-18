import axios from 'axios';

/**
 * Course discussion forum — public/player API client.
 *
 * Mirrors the zoom-live-class/player/liveClassApi.js shape:
 *   - same baseURL pattern (admin-service /api/public)
 *   - forwards admin_token / accessToken so the backend's optionalAuth can
 *     populate req.user for permission checks and per-user vote state.
 */

const BASE = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:4000';

const api = axios.create({
    baseURL: `${BASE}/api/public`,
    timeout: 15000,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('admin_token') || localStorage.getItem('accessToken');
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    const id = localStorage.getItem('userId');
    if (id) config.headers.set('x-user-id', String(id));
    return config;
});

export const listQuestions = (courseId, params = {}) =>
    api.get(`/forum/course/${courseId}`, { params }).then((r) => r.data);

export const getQuestion = (id) =>
    api.get(`/forum/question/${id}`).then((r) => r.data);

// `title` doubles as a discriminator: 'reply' = a reply, otherwise the title.
// Same contract the Laravel reference uses.
export const createPost = (body) =>
    api.post('/forum/question', body).then((r) => r.data);

export const updatePost = (id, body) =>
    api.post(`/forum/question/${id}`, body).then((r) => r.data);

export const deletePost = (id) =>
    api.delete(`/forum/question/${id}`).then((r) => r.data);

export const toggleLike = (id) =>
    api.post(`/forum/like/${id}`).then((r) => r.data);

export const toggleDislike = (id) =>
    api.post(`/forum/dislike/${id}`).then((r) => r.data);

export const reportPost = (id, reason) =>
    api.post(`/forum/report/${id}`, { reason }).then((r) => r.data);
