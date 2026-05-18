import axios from 'axios';

// admin-service direct (port 4000). Used for both API calls and static asset
// URLs (uploaded images served by express.static).
const BASE = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:4000';
export const API_BASE = BASE;
const TOKEN_KEY = 'admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const api = axios.create({
    baseURL: `${BASE}/api/admin`,
    timeout: 30000,
});

api.interceptors.request.use((config) => {
    // Admins authenticate against admin-service and store an 'admin_token'.
    // Instructors have no admin-service login — they reach the admin shell
    // (course management only) with their auth-service 'accessToken'. Both
    // services sign JWTs with the same JWT_SECRET, so admin-service's `auth`
    // middleware verifies either token. Fall back to accessToken so the
    // instructor flow works regardless of which key holds the token.
    const token = getToken() || localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// /auth/me is called speculatively during app hydration to detect whether
// an admin token is still valid. A 401 there is expected when the token has
// expired or was never set — it must NOT trigger a hard redirect, because
// AuthProvider/ProtectedRoute will already route the user to /login via
// React Router. Hard-redirecting on top of that caused the whole-app blink.
const SILENT_AUTH_PATHS = ['/auth/me'];

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        const url = error?.config?.url || '';

        // 401 = not authenticated (no/expired/invalid token). The session is
        // genuinely dead — clear the token and route back to /login.
        if (status === 401) {
            const isSilent = SILENT_AUTH_PATHS.some((p) => url.includes(p));
            clearToken();
            if (!isSilent && typeof window !== 'undefined' && window.location.pathname !== '/login') {
                console.warn(`[admin api] 401 on ${url} — clearing token, redirecting to /login`);
                window.location.href = '/login';
            }
            return Promise.reject(error);
        }

        // 403 = authenticated but not permitted for THIS endpoint. The token is
        // still valid — do NOT clear it or redirect. This is normal for an
        // instructor whose restricted role can't reach an admin-only endpoint;
        // the calling component decides how to handle it (e.g. empty dropdown).
        if (status === 403) {
            console.warn(`[admin api] 403 on ${url} — not permitted for this role (token kept)`);
            return Promise.reject(error);
        }

        if (error?.message) {
            console.error(`[admin api] error on ${url}:`, error.message);
        }
        return Promise.reject(error);
    }
);

export default api;
