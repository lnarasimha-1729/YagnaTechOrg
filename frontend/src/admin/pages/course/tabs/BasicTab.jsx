import { useEffect, useState } from 'react';
import { listInstructors } from '../../../api/instructor';
import CollegeMultiSelect from '../../../components/CollegeMultiSelect';

// Mirrors the backend parseInstructorIds — instructor_ids comes off the
// course row as a TEXT column that may hold a JSON array, a CSV string, or a
// single bare value. Always returns an array of id strings.
const parseInstructorIds = (raw) => {
    if (raw == null || raw === '') return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    const s = String(raw).trim();
    try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        if (parsed) return [String(parsed)];
    } catch {
        if (s.includes(',')) return s.split(',').map((v) => v.trim()).filter(Boolean);
        return [s];
    }
    return [];
};

// `categories` prop is kept in the destructure for backwards compatibility
// with Edit.jsx, but it's no longer used — courses are mapped to colleges
// via clg_ids instead of category_id.
export default function BasicTab({ course, onSave, formId }) {
    const currentInstructorId = parseInstructorIds(course.instructor_ids)[0] || '';
    const [f, setF] = useState({
        title: course.title || '',
        short_description: course.short_description || '',
        description: course.description || '',
        // category_id removed — see CollegeMultiSelect below.
        level: course.level || 'beginner',
        language: course.language || 'english',
        // The screenshot offers only Active / Private. Treat everything else as the closer of the two.
        status: course.status === 'private' ? 'private' : 'active',
        // Whether completing the course issues a certificate. Defaults to
        // true for new courses and for legacy rows where the column was
        // missing (the backend payload normalises null to true).
        has_certificate: course.has_certificate === undefined || course.has_certificate === null
            ? true
            : !!course.has_certificate,
        instructor_id: String(currentInstructorId),
    });
    const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

    // Colleges this course is offered at — pre-selected from course.clg_ids
    // (the JSON column on the courses table). Backend's update path only
    // overwrites the column when clgIds[] is present on the request, so
    // partial saves elsewhere don't wipe the mapping.
    const [selectedClgIds, setSelectedClgIds] = useState(
        Array.isArray(course.clg_ids) ? course.clg_ids : [],
    );

    // Instructor dropdown source — admin instructors API (auth-service users
    // with role='instructor'). Same loader the Create page uses. We pull the
    // full list in one request; the count is small.
    const [instructors, setInstructors] = useState([]);
    const [instructorsLoading, setInstructorsLoading] = useState(true);
    const [instructorsError, setInstructorsError] = useState(null);

    useEffect(() => {
        let alive = true;
        setInstructorsLoading(true);
        setInstructorsError(null);
        listInstructors({ per_page: 1000 })
            .then((r) => { if (alive) setInstructors(r?.instructors || []); })
            .catch((e) => {
                if (alive) setInstructorsError(
                    e?.response?.data?.error || e?.message || 'Failed to load instructors'
                );
            })
            .finally(() => { if (alive) setInstructorsLoading(false); });
        return () => { alive = false; };
    }, []);

    const submit = (e) => {
        e.preventDefault();
        const fd = new FormData();
        Object.entries(f).forEach(([k, v]) => {
            // instructor_id is sent on the wire as instructors[] (see below).
            if (k === 'instructor_id') return;
            // FormData stringifies booleans to 'true'/'false'; send '1'/'0'
            // so the backend's toBool() reads them as numbers consistently
            // with the other on/off flags (is_paid etc.).
            if (typeof v === 'boolean') fd.append(k, v ? '1' : '0');
            else fd.append(k, v);
        });
        // Prefer the value the admin picked in the dropdown; fall back to
        // whatever was already on the course so a partial save can't wipe
        // the assignment (e.g. instructors list failed to load).
        const chosen = String(f.instructor_id || '').trim();
        const ids = chosen ? [chosen] : parseInstructorIds(course.instructor_ids);
        ids.forEach((id) => fd.append('instructors[]', id));
        // Send clgIds[] when at least one college is selected so the backend
        // replaces the column with the visible state. If the admin cleared
        // every college we send a single empty sentinel so the backend can
        // distinguish "explicitly cleared" from "field not touched" — its
        // normalize step filters falsy values, ending up with `[]` either way.
        if (selectedClgIds.length > 0) {
            selectedClgIds.forEach((id) => fd.append('clgIds[]', id));
        } else {
            fd.append('clgIds[]', '');
        }
        onSave(fd);
    };

    return (
        <form id={formId} onSubmit={submit}>
            <Row label="Course title" required>
                <input
                    className="ol-form-control w-full"
                    value={f.title}
                    onChange={(e) => set('title', e.target.value)}
                    required
                />
            </Row>

            <Row label="Short Description">
                <textarea
                    className="ol-form-control w-full"
                    rows="3"
                    value={f.short_description}
                    onChange={(e) => set('short_description', e.target.value)}
                />
            </Row>

            <Row label="Description">
                <textarea
                    className="ol-form-control w-full"
                    rows="8"
                    value={f.description}
                    onChange={(e) => set('description', e.target.value)}
                />
            </Row>

            <Row label="Instructor" required>
                <select
                    className="ol-form-control w-full"
                    value={f.instructor_id}
                    onChange={(e) => set('instructor_id', e.target.value)}
                    disabled={instructorsLoading || !!instructorsError}
                    required
                >
                    <option value="">
                        {instructorsLoading
                            ? 'Loading instructors…'
                            : instructorsError
                                ? 'Failed to load instructors'
                                : instructors.length === 0
                                    ? 'No instructors available — add one first'
                                    : 'Select an instructor'}
                    </option>
                    {instructors.map((ins) => {
                        const label = ins.name || ins.email || ins.id;
                        const sub = ins.expertise ? ` — ${ins.expertise}` : '';
                        return (
                            <option key={ins.id} value={String(ins.id)}>
                                {label}{sub}
                            </option>
                        );
                    })}
                </select>
                {instructorsError && (
                    <div className="text-[13px] text-danger mt-1">{instructorsError}</div>
                )}
                {!instructorsLoading && !instructorsError && currentInstructorId && !instructors.some((i) => String(i.id) === String(currentInstructorId)) && (
                    <div className="text-[12px] text-gray mt-1">
                        Currently assigned id <code>{currentInstructorId}</code> isn't in the instructors list — selecting a new one will replace it.
                    </div>
                )}
            </Row>

            <Row label="Colleges" required>
                <CollegeMultiSelect
                    value={selectedClgIds}
                    onChange={setSelectedClgIds}
                    hideLabel
                />
            </Row>

            <Row label="Course level" required>
                <select
                    className="ol-form-control w-full"
                    value={f.level}
                    onChange={(e) => set('level', e.target.value)}
                    required
                >
                    <option value="everyone">Everyone</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                </select>
            </Row>

            <Row label="Made in" required>
                <select
                    className="ol-form-control w-full"
                    value={f.language}
                    onChange={(e) => set('language', e.target.value)}
                    required
                >
                    <option value="english">English</option>
                    <option value="hindi">Hindi</option>
                    <option value="telugu">Telugu</option>
                    <option value="tamil">Tamil</option>
                    <option value="spanish">Spanish</option>
                    <option value="french">French</option>
                    <option value="german">German</option>
                </select>
            </Row>

            <Row label="Create as" required>
                <div className="flex items-center gap-6 pt-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="status"
                            value="active"
                            checked={f.status === 'active'}
                            onChange={() => set('status', 'active')}
                            className="accent-skin"
                        />
                        <span className="text-[14px]">Active</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="status"
                            value="private"
                            checked={f.status === 'private'}
                            onChange={() => set('status', 'private')}
                            className="accent-skin"
                        />
                        <span className="text-[14px]">Private</span>
                    </label>
                </div>
            </Row>

            <Row label="Provides certificate">
                <div className="flex items-center gap-6 pt-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="has_certificate"
                            checked={f.has_certificate === true}
                            onChange={() => set('has_certificate', true)}
                            className="accent-skin"
                        />
                        <span className="text-[14px]">Yes</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="has_certificate"
                            checked={f.has_certificate === false}
                            onChange={() => set('has_certificate', false)}
                            className="accent-skin"
                        />
                        <span className="text-[14px]">No</span>
                    </label>
                </div>
            </Row>
        </form>
    );
}

function Row({ label, required, children }) {
    return (
        <div className="grid grid-cols-12 gap-4 mb-4 items-start">
            <label className="col-span-12 md:col-span-3 ol-form-label pt-2">
                {label}
                {required && <span className="text-danger ml-1">*</span>}
            </label>
            <div className="col-span-12 md:col-span-9">
                {children}
            </div>
        </div>
    );
}
