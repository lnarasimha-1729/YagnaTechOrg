/**
 * Zoom provider integration — Server-to-Server OAuth + Meeting CRUD +
 * meeting status sync + Web SDK signature.
 *
 * Mirrors the reference port at lms-cp/mern-lineclass/backend/src/modules/zoom/zoom.service.js,
 * adapted to the admin-service's existing infrastructure:
 *   - Settings are read via repositories/SettingRepository (same store the
 *     existing LiveClassService uses for zoom_account_id / zoom_client_id /
 *     zoom_client_secret / zoom_account_email / timezone).
 *
 * Failure shape: `{ code, message }` — consumers detect via
 * `if (result && result.code)`. Successful responses return raw Zoom JSON
 * (createMeeting / updateMeeting) or `{ ok: true }` for 204 responses.
 *
 * The Web SDK signature endpoint is server-side so the SDK secret never
 * reaches the browser.
 */

const crypto = require('crypto');
const settingRepo = require('../repositories/SettingRepository');

const ZOOM_OAUTH_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_BASE = 'https://api.zoom.us/v2';
const DEFAULT_DURATION_MIN = 60;

const fail = (op, code, message) => ({
    code: code || 'ZOOM_ERROR',
    message: `Zoom ${op} failed: ${message}`,
});

// Zoom expects a local-naive timestamp string: YYYY-MM-DDTHH:mm:ss
const toZoomDate = (value) => {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
        `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    );
};

const base64Url = (input) => {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return buf.toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

const getAccessToken = async () => {
    const [accountId, clientId, clientSecret] = await Promise.all([
        settingRepo.get('zoom_account_id'),
        settingRepo.get('zoom_client_id'),
        settingRepo.get('zoom_client_secret'),
    ]);
    if (!accountId || !clientId || !clientSecret) {
        return { error: fail('auth', 'ZOOM_NOT_CONFIGURED', 'provider is not configured') };
    }

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const url = `${ZOOM_OAUTH_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`;

    let resp;
    try {
        resp = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${basic}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    } catch (err) {
        return { error: fail('auth', 'ZOOM_NETWORK_ERROR', err.message) };
    }

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.access_token) {
        return {
            error: fail(
                'auth',
                json.error || 'ZOOM_OAUTH_FAILED',
                json.reason || 'Failed to obtain Zoom token'
            ),
        };
    }
    return { token: json.access_token };
};

const createMeeting = async (title, startTimestamp, durationMinutes = DEFAULT_DURATION_MIN) => {
    const tokenRes = await getAccessToken();
    if (tokenRes.error) return tokenRes.error;

    const [scheduleFor, timezone] = await Promise.all([
        settingRepo.get('zoom_account_email'),
        settingRepo.get('timezone'),
    ]);

    const startTime = toZoomDate(
        typeof startTimestamp === 'number' ? startTimestamp * 1000 : startTimestamp
    );
    if (!startTime) return fail('createMeeting', 'ZOOM_INVALID_DATE', 'Invalid start_time');

    const body = {
        topic: title,
        schedule_for: scheduleFor,
        type: 2,
        start_time: startTime,
        duration: Math.max(1, Math.round(durationMinutes || DEFAULT_DURATION_MIN)),
        timezone: timezone || 'UTC',
        settings: { approval_type: 2, join_before_host: true, jbh_time: 0 },
    };

    let resp;
    try {
        resp = await fetch(`${ZOOM_API_BASE}/users/me/meetings`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenRes.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch (err) {
        return fail('createMeeting', 'ZOOM_NETWORK_ERROR', err.message);
    }

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        return fail(
            'createMeeting',
            json.code || 'ZOOM_API_ERROR',
            json.message || 'Failed to create meeting'
        );
    }
    return json;
};

const updateMeeting = async (title, startTime, meetingId) => {
    if (!meetingId) return fail('updateMeeting', 'ZOOM_INVALID_ID', 'Missing meeting id');
    const tokenRes = await getAccessToken();
    if (tokenRes.error) return tokenRes.error;

    const startStr = toZoomDate(typeof startTime === 'number' ? startTime * 1000 : startTime);
    if (!startStr) return fail('updateMeeting', 'ZOOM_INVALID_DATE', 'Invalid start_time');

    let resp;
    try {
        resp = await fetch(`${ZOOM_API_BASE}/meetings/${meetingId}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${tokenRes.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: title, start_time: startStr }),
        });
    } catch (err) {
        return fail('updateMeeting', 'ZOOM_NETWORK_ERROR', err.message);
    }

    if (resp.status === 204) return { ok: true };
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        return fail(
            'updateMeeting',
            json.code || 'ZOOM_API_ERROR',
            json.message || 'Failed to update meeting'
        );
    }
    return json;
};

const deleteMeeting = async (meetingId) => {
    if (!meetingId) return fail('deleteMeeting', 'ZOOM_INVALID_ID', 'Missing meeting id');
    const tokenRes = await getAccessToken();
    if (tokenRes.error) return tokenRes.error;

    let resp;
    try {
        resp = await fetch(`${ZOOM_API_BASE}/meetings/${meetingId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${tokenRes.token}` },
        });
    } catch (err) {
        return fail('deleteMeeting', 'ZOOM_NETWORK_ERROR', err.message);
    }

    if (resp.status === 204) return { ok: true };
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        return fail(
            'deleteMeeting',
            json.code || 'ZOOM_API_ERROR',
            json.message || 'Failed to delete meeting'
        );
    }
    return json;
};

const getMeetingStatus = async (meetingId) => {
    if (!meetingId) return fail('getMeetingStatus', 'ZOOM_INVALID_ID', 'Missing meeting id');
    const tokenRes = await getAccessToken();
    if (tokenRes.error) return tokenRes.error;

    let resp;
    try {
        resp = await fetch(`${ZOOM_API_BASE}/meetings/${meetingId}`, {
            headers: { Authorization: `Bearer ${tokenRes.token}` },
        });
    } catch (err) {
        return fail('getMeetingStatus', 'ZOOM_NETWORK_ERROR', err.message);
    }

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        return fail(
            'getMeetingStatus',
            json.code || 'ZOOM_API_ERROR',
            json.message || 'Failed to fetch meeting'
        );
    }
    return { status: json.status || 'waiting', meeting: json };
};

// role: 0 = attendee, 1 = host
const generateSdkSignature = async (meetingNumber, role) => {
    const [sdkKey, sdkSecret] = await Promise.all([
        settingRepo.get('zoom_sdk_client_id'),
        settingRepo.get('zoom_sdk_client_secret'),
    ]);
    if (!sdkKey || !sdkSecret) {
        return fail('generateSdkSignature', 'ZOOM_SDK_NOT_CONFIGURED', 'Web SDK keys are missing');
    }

    const iat = Math.floor(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60 * 2;
    const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64Url(
        JSON.stringify({
            sdkKey,
            appKey: sdkKey,
            mn: String(meetingNumber),
            role: Number(role) === 1 ? 1 : 0,
            iat,
            exp,
            tokenExp: exp,
        })
    );
    const signature = base64Url(
        crypto.createHmac('sha256', sdkSecret).update(`${header}.${payload}`).digest()
    );

    return { signature: `${header}.${payload}.${signature}`, sdkKey };
};

const isConfigured = async () => {
    const [a, b, c] = await Promise.all([
        settingRepo.get('zoom_account_id'),
        settingRepo.get('zoom_client_id'),
        settingRepo.get('zoom_client_secret'),
    ]);
    return Boolean(a && b && c);
};

const webSdkEnabled = async () => (await settingRepo.get('zoom_web_sdk')) === 'active';

module.exports = {
    createMeeting,
    updateMeeting,
    deleteMeeting,
    getMeetingStatus,
    generateSdkSignature,
    isConfigured,
    webSdkEnabled,
};
