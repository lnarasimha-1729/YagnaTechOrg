import axiosInstance from '@/api/axiosInstance';

// The assessment service lives behind Bastion at /api/v1/assessment.
// axiosInstance already carries the accessToken (JWT signed with the same
// secret as admin-service), so admin role checks pass on the backend.

// ── Assessments ──────────────────────────────────────────────────────────────
export const listAssessments = () =>
    axiosInstance.get('/assessment/all').then((r) => r.data);

export const getAssessment = (id) =>
    axiosInstance.get(`/assessment/${id}`).then((r) => r.data);

export const createAssessment = (data) =>
    axiosInstance.post('/assessment/add', data).then((r) => r.data);

export const updateAssessment = (id, data) =>
    axiosInstance.put(`/assessment/${id}`, data).then((r) => r.data);

export const deleteAssessment = (id) =>
    axiosInstance.delete(`/assessment/${id}`).then((r) => r.data);

// ── Question Sets ────────────────────────────────────────────────────────────
export const listQuestionSets = () =>
    axiosInstance.get('/assessment/question-set/all').then((r) => r.data);

export const getQuestionSet = (id) =>
    axiosInstance.get(`/assessment/question-set/${id}`).then((r) => r.data);

export const createQuestionSet = (data) =>
    axiosInstance.post('/assessment/question-set/add', data).then((r) => r.data);

export const updateQuestionSet = (id, data) =>
    axiosInstance.put(`/assessment/question-set/${id}`, data).then((r) => r.data);

export const deleteQuestionSet = (id) =>
    axiosInstance.delete(`/assessment/question-set/${id}`).then((r) => r.data);

// ── Questions ────────────────────────────────────────────────────────────────
export const listQuestions = () =>
    axiosInstance.get('/assessment/question/all').then((r) => r.data);

export const getQuestion = (id) =>
    axiosInstance.get(`/assessment/question/${id}`).then((r) => r.data);

export const createQuestion = (data) =>
    axiosInstance.post('/assessment/question/add', data).then((r) => r.data);

export const updateQuestion = (id, data) =>
    axiosInstance.put(`/assessment/question/${id}`, data).then((r) => r.data);

export const deleteQuestion = (id) =>
    axiosInstance.delete(`/assessment/question/${id}`).then((r) => r.data);
