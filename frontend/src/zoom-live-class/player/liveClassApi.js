import axios from 'axios';

/**
 * Public (course-player) API client for the Zoom Live Class module.
 * Mirrors @/api/course/courseApi (same baseURL pattern, same x-user-id header
 * so backend optionalAuth can detect the current student).
 */

const BASE = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:4000';

const api = axios.create({
    baseURL: `${BASE}/api/public`,
    timeout: 15000,
});

api.interceptors.request.use((config) => {
    const id = localStorage.getItem('userId');
    if (id) config.headers.set('x-user-id', String(id));
    const token = localStorage.getItem('admin_token');
    // Forward an admin/instructor token if present so the server can upgrade
    // the role to host. Students without a token are anonymous attendees.
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    return config;
});

export const listLiveClasses = (courseId) =>
    api.get(`/zoom-live-class/course/${courseId}`).then((r) => r.data);

export const resolveJoin = (id) =>
    api.get(`/zoom-live-class/${id}/join`).then((r) => r.data);

export const getSdkSignature = (id) =>
    api.post(`/zoom-live-class/${id}/sdk-signature`).then((r) => r.data);

export const syncStatus = (id) =>
    api.get(`/zoom-live-class/${id}/status`).then((r) => r.data);
