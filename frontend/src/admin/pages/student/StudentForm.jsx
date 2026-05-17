import { useState } from 'react';
import { API_BASE } from '../../api/client';

// Mirrors AdminForm / InstructorForm: tabbed sidebar (Basic / Login
// Credentials), grid-cols-12 rows, same controls. Intentionally narrower
// than AdminForm — students live in the auth-service users table, which
// doesn't have columns for about/college_id/social, so we don't expose
// fields that would silently be dropped by StudentService.update.
const TABS = [
    { key: 'basic', label: 'Basic' },
    { key: 'login', label: 'Login Credentials' },
];

export default function StudentForm({ student, onSubmit, submitLabel = 'Save' }) {
    const [tab, setTab] = useState(student ? 'basic' : 'login');
    const [f, setF] = useState({
        name: student?.name || '',
        phone: student?.phone || '',
        email: student?.email || '',
        password: '',
    });
    const [photo, setPhoto] = useState(null);
    const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

    const submit = (e) => {
        e.preventDefault();

        if (!student) {
            if (!f.name || !f.email || !f.password) {
                alert('Name, email and password are required for new students.');
                setTab('login');
                return;
            }
            if (String(f.password).length < 8) {
                alert('Password must be at least 8 characters.');
                setTab('login');
                return;
            }
        } else if (f.password && String(f.password).length < 8) {
            alert('Password must be at least 8 characters.');
            setTab('login');
            return;
        }

        const fd = new FormData();
        Object.entries(f).forEach(([k, v]) => {
            // Skip empty optional fields so the backend keeps existing values
            // instead of overwriting with empties. Required fields (name/
            // email) are already validated above.
            if (v !== '' && v != null) fd.append(k, v);
        });
        if (photo) fd.append('photo', photo);
        onSubmit(fd);
    };

    return (
        <form onSubmit={submit} encType="multipart/form-data">
            <div className="flex flex-col md:flex-row gap-3">
                <div className="md:w-[220px]">
                    <div className="ol-sidebar-tab">
                        {TABS.map((t) => (
                            <button
                                key={t.key}
                                type="button"
                                className={`nav-link text-left ${tab === t.key ? 'active' : ''}`}
                                onClick={() => setTab(t.key)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-grow">
                    {tab === 'basic' && (
                        <>
                            <div className="mb-3 grid grid-cols-12 gap-0">
                                <label className="col-span-2 ol-form-label">Name<span className="text-danger ms-1">*</span></label>
                                <div className="col-span-10">
                                    <input className="ol-form-control" value={f.name} onChange={(e) => set('name', e.target.value)} required />
                                </div>
                            </div>
                            <div className="mb-3 grid grid-cols-12 gap-0">
                                <label className="col-span-2 ol-form-label">Phone</label>
                                <div className="col-span-10">
                                    <input className="ol-form-control" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
                                </div>
                            </div>
                            <div className="mb-3 grid grid-cols-12 gap-0">
                                <label className="col-span-2 ol-form-label">User image</label>
                                <div className="col-span-10">
                                    {/* Edit-flow preview: show the current photo so
                                        the admin doesn't have to upload a replacement
                                        just to remember what's set. Hidden once a new
                                        file is staged so the preview matches what will
                                        be saved. */}
                                    {student?.photo && !photo && (
                                        <div className="mb-2">
                                            <img
                                                src={`${API_BASE}/${student.photo}`}
                                                alt=""
                                                className="w-[80px] h-[80px] rounded-full object-cover border border-ebordermuted"
                                            />
                                        </div>
                                    )}
                                    <input className="ol-form-control" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
                                    {student?.photo && (
                                        <p className="text-[12px] text-gray mt-1">
                                            Leave empty to keep the current image.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                    {tab === 'login' && (
                        <>
                            <div className="mb-3 grid grid-cols-12 gap-0">
                                <label className="col-span-2 ol-form-label">Email<span className="text-danger ms-1">*</span></label>
                                <div className="col-span-10">
                                    <input type="email" className="ol-form-control" value={f.email} onChange={(e) => set('email', e.target.value)} required />
                                </div>
                            </div>
                            <div className="mb-3 grid grid-cols-12 gap-0">
                                <label className="col-span-2 ol-form-label">Password{!student && <span className="text-danger ms-1">*</span>}</label>
                                <div className="col-span-10">
                                    <input
                                        type="password"
                                        className="ol-form-control"
                                        value={f.password}
                                        onChange={(e) => set('password', e.target.value)}
                                        placeholder={student ? 'Leave blank to keep current' : 'Minimum 8 characters'}
                                        required={!student}
                                        minLength={student ? undefined : 8}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                    <div className="mt-4">
                        <button className="ol-btn-primary">{submitLabel}</button>
                    </div>
                </div>
            </div>
        </form>
    );
}
