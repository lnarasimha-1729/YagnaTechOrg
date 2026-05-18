import api from '@/admin/api/client';

/**
 * Admin API client for the Zoom Live Class module.
 * Mounted under /api/admin/zoom-live-class/* (the admin axios baseURL is
 * already /api/admin — so paths are relative).
 *
 * Naming and response-shape mirror the existing admin/api/liveclass.js client.
 */

export const listLiveClasses = (courseId) =>
    api.get(`/zoom-live-class/course/${courseId}`).then((r) => r.data);

export const listInstructors = (courseId) =>
    api.get(`/zoom-live-class/course/${courseId}/instructors`).then((r) => r.data);

export const storeLiveClass = (courseId, body) =>
    api.post(`/zoom-live-class/course/${courseId}`, body).then((r) => r.data);

export const updateLiveClass = (id, body) =>
    api.post(`/zoom-live-class/${id}`, body).then((r) => r.data);

export const deleteLiveClass = (id) =>
    api.delete(`/zoom-live-class/${id}`).then((r) => r.data);

export const resolveJoin = (id) =>
    api.get(`/zoom-live-class/${id}/join`).then((r) => r.data);

export const syncStatus = (id) =>
    api.get(`/zoom-live-class/${id}/status`).then((r) => r.data);

export const readSettings = () =>
    api.get('/zoom-live-class/settings').then((r) => r.data);

export const writeSettings = (body) =>
    api.post('/zoom-live-class/settings', body).then((r) => r.data);
