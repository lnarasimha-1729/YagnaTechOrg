import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { readSettings, writeSettings } from './liveClassApi';

/**
 * Zoom Live Class settings page. Drop-in standalone admin page — register a
 * route to it in App.tsx if you want it discoverable from the sidebar.
 *
 * Uses the same form/button conventions as the rest of the admin pages
 * (ol-form-control, ol-btn-primary, react-toastify).
 */

const FIELDS = [
    { name: 'zoom_account_email', label: 'Account email', type: 'email', required: true },
    { name: 'zoom_account_id', label: 'Account ID', required: true },
    { name: 'zoom_client_id', label: 'Client ID', required: true },
    { name: 'zoom_client_secret', label: 'Client secret', required: true },
];

const SDK_FIELDS = [
    { name: 'zoom_sdk_client_id', label: 'Meeting SDK Client ID', required: true },
    { name: 'zoom_sdk_client_secret', label: 'Meeting SDK Client secret', required: true },
];

// A short, opinionated list — covers the common regions for this project plus
// "Browser default" which detects the admin's local zone. The full IANA list
// has ~600 entries which would be overkill for a settings dropdown.
const TIMEZONES = [
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Europe/London',
    'Europe/Berlin',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'UTC',
];

const browserTimezone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
};

const blank = {
    zoom_account_email: '',
    zoom_account_id: '',
    zoom_client_id: '',
    zoom_client_secret: '',
    zoom_web_sdk: 'inactive',
    zoom_sdk_client_id: '',
    zoom_sdk_client_secret: '',
    // Default — admin can change. Used by zoom.service.js when creating meetings.
    timezone: 'Asia/Kolkata',
};

export default function LiveClassSettings() {
    const [values, setValues] = useState(blank);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        readSettings()
            .then((r) => {
                const s = r.settings || {};
                setValues({
                    ...blank,
                    ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v ?? ''])),
                    zoom_web_sdk: s.zoom_web_sdk === 'active' ? 'active' : 'inactive',
                });
            })
            .catch(() => { /* leave blanks */ })
            .finally(() => setLoading(false));
    }, []);

    const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));

    const webSdk = values.zoom_web_sdk === 'active';

    const submit = async (e) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
            await writeSettings(values);
            toast.success('Live class settings saved successfully');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="text-center py-10 text-[14px] text-gray">Loading…</div>;
    }

    return (
        <div className="ol-card">
            <div className="ol-card-body p-20px">
                <h5 className="text-[16px] font-semibold text-dark mb-1">Live Class Settings</h5>
                <p className="text-[13px] text-gray mb-4">
                    Configure Zoom Server-to-Server OAuth credentials. Required to create
                    and host Zoom meetings from the course player.
                </p>

                <form onSubmit={submit} className="max-w-2xl">
                    {FIELDS.map((f) => (
                        <div className="mb-3" key={f.name}>
                            <label className="ol-form-label">
                                {f.label} {f.required && <span className="text-danger">*</span>}
                            </label>
                            <input
                                type={f.type || 'text'}
                                className="ol-form-control"
                                value={values[f.name] || ''}
                                onChange={(e) => set(f.name, e.target.value)}
                                required={f.required}
                            />
                        </div>
                    ))}

                    <div className="mb-3">
                        <label className="ol-form-label">
                            Timezone <span className="text-danger">*</span>
                        </label>
                        <select
                            className="ol-form-control"
                            value={values.timezone || 'UTC'}
                            onChange={(e) => set('timezone', e.target.value)}
                            required
                        >
                            {/* Include the current value at the top even if it's
                                not in the canned list, so existing settings
                                survive a round-trip. */}
                            {values.timezone && !TIMEZONES.includes(values.timezone) && (
                                <option value={values.timezone}>{values.timezone}</option>
                            )}
                            {TIMEZONES.map((tz) => (
                                <option key={tz} value={tz}>{tz}</option>
                            ))}
                        </select>
                        <div className="flex items-center justify-between mt-1 text-[12px] text-gray">
                            <span>
                                Used when creating Zoom meetings. Times you enter for live
                                classes are interpreted in this zone.
                            </span>
                            <button
                                type="button"
                                className="text-skin font-semibold ml-2 shrink-0"
                                onClick={() => set('timezone', browserTimezone())}
                                title="Use your browser's detected timezone"
                            >
                                Use mine ({browserTimezone()})
                            </button>
                        </div>
                    </div>

                    <hr className="my-4 border-border" />

                    <div className="mb-3">
                        <label className="ol-form-label">
                            Use Web SDK in course player? <span className="text-danger">*</span>
                        </label>
                        <div className="flex items-center gap-4">
                            <label className="inline-flex items-center gap-2 text-[14px]">
                                <input
                                    type="radio"
                                    name="zoom_web_sdk"
                                    value="active"
                                    checked={webSdk}
                                    onChange={() => set('zoom_web_sdk', 'active')}
                                />
                                Yes
                            </label>
                            <label className="inline-flex items-center gap-2 text-[14px]">
                                <input
                                    type="radio"
                                    name="zoom_web_sdk"
                                    value="inactive"
                                    checked={!webSdk}
                                    onChange={() => set('zoom_web_sdk', 'inactive')}
                                />
                                No
                            </label>
                        </div>
                        <p className="text-[12px] text-gray mt-1">
                            When enabled, students join Zoom inside the course player. Otherwise
                            the join button opens Zoom in a new tab.
                        </p>
                    </div>

                    {webSdk && SDK_FIELDS.map((f) => (
                        <div className="mb-3" key={f.name}>
                            <label className="ol-form-label">
                                {f.label} {f.required && <span className="text-danger">*</span>}
                            </label>
                            <input
                                className="ol-form-control"
                                value={values[f.name] || ''}
                                onChange={(e) => set(f.name, e.target.value)}
                                required={f.required}
                            />
                        </div>
                    ))}

                    <button type="submit" className="ol-btn-primary mt-2" disabled={saving}>
                        {saving ? 'Saving…' : 'Save changes'}
                    </button>
                </form>
            </div>
        </div>
    );
}
