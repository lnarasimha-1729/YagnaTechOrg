import { useEffect, useMemo, useState } from 'react';
import CollegeMultiSelect from '../../components/CollegeMultiSelect';
import CourseMultiSelect from '../../components/CourseMultiSelect';
import BatchMultiSelect from '../../components/BatchMultiSelect';
import { listCourses } from '../../api/course';

// Curated icon set to match the existing public ProgramCard renderer
// (frontend/src/components/programs/ProgramCard.tsx uses lucide-react). Any
// string value also works at the API layer — this is just the admin picker.
const ICON_OPTIONS = [
    'Globe2',
    'GraduationCap',
    'Building2',
    'Rocket',
    'BookOpen',
    'Brain',
    'Briefcase',
    'Award',
];

export default function ProgramForm({ initial = {}, onSubmit, submitting = false }) {
    const [form, setForm] = useState({
        title: initial.title || '',
        tagline: initial.tagline || '',
        icon: initial.icon || 'Globe2',
        sort: Number.isFinite(Number(initial.sort)) ? Number(initial.sort) : 0,
        is_active: initial.is_active === undefined ? true : !!initial.is_active,
    });
    const [features, setFeatures] = useState(
        Array.isArray(initial.features) && initial.features.length
            ? initial.features.map(String)
            : [''],
    );
    // Colleges the program is offered at. Multi-select mirrors the Course
    // form so the admin builds programs against the same college pool.
    const [selectedClgIds, setSelectedClgIds] = useState(
        Array.isArray(initial.clg_ids) ? initial.clg_ids.map(String) : [],
    );
    // Courses bundled into the program. Hydrate from course_ids (new column);
    // for legacy rows that still carry only course_id, fall back to a single-
    // element seed so editing a pre-multi row doesn't lose the selection.
    const [selectedCourseIds, setSelectedCourseIds] = useState(() => {
        if (Array.isArray(initial.course_ids) && initial.course_ids.length) {
            return initial.course_ids.map(String);
        }
        if (initial.course_id) return [String(initial.course_id)];
        return [];
    });
    // Batches scoped to selectedClgIds. BatchMultiSelect re-fetches when the
    // college set changes and prunes selections whose college is no longer
    // active, so no extra effect is needed here.
    const [selectedBatchIds, setSelectedBatchIds] = useState(
        Array.isArray(initial.batch_ids) ? initial.batch_ids.map(Number) : [],
    );

    // Pull every course's batch_ids once so we can union them per selection
    // and tell BatchMultiSelect which batches are linked to the chosen courses.
    // Best-effort: a fetch failure leaves the map empty, which falls through
    // to "no narrowing" (admin can still pick freely from the college batches).
    const [coursesById, setCoursesById] = useState({});
    useEffect(() => {
        let alive = true;
        listCourses({})
            .then((r) => {
                if (!alive) return;
                const rows = Array.isArray(r?.courses?.data) ? r.courses.data : [];
                const map = {};
                rows.forEach((c) => { map[String(c.id)] = c; });
                setCoursesById(map);
            })
            .catch(() => { /* best-effort — null map disables course-based narrowing */ });
        return () => { alive = false; };
    }, []);

    // Strict union of batch_ids across the admin's selected courses. Unlike
    // earlier behavior, this NEVER falls back to "all college batches" — the
    // flow is college → course → batch, so batches must come from the courses
    // themselves. Returns an empty Set when no course has batch_ids, which
    // BatchMultiSelect renders as "no batches available".
    const allowedBatchIds = useMemo(() => {
        const union = new Set();
        for (const id of selectedCourseIds) {
            const course = coursesById[String(id)];
            const ids = Array.isArray(course?.batch_ids) ? course.batch_ids : [];
            ids.forEach((b) => union.add(Number(b)));
        }
        return union;
    }, [selectedCourseIds, coursesById]);

    const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

    const updateFeature = (i, value) => {
        setFeatures((arr) => arr.map((v, idx) => (idx === i ? value : v)));
    };
    const addFeature = () => setFeatures((arr) => [...arr, '']);
    const removeFeature = (i) => {
        setFeatures((arr) => (arr.length === 1 ? [''] : arr.filter((_, idx) => idx !== i)));
    };

    const submit = (e) => {
        e.preventDefault();
        const cleanedFeatures = features.map((f) => f.trim()).filter(Boolean);
        // Backend service reads `clgIds` (or `clgIds[]`) and dedupes; sending
        // the array directly is fine because the API client posts JSON.
        onSubmit({
            title: form.title.trim(),
            tagline: form.tagline.trim(),
            icon: form.icon,
            sort: Number(form.sort) || 0,
            is_active: form.is_active ? 1 : 0,
            features: cleanedFeatures,
            clgIds: selectedClgIds,
            courseIds: selectedCourseIds,
            batchIds: selectedBatchIds,
        });
    };

    return (
        <form onSubmit={submit}>
            <div className="mb-3">
                <label className="ol-form-label">
                    Title<span className="text-danger ml-1">*</span>
                </label>
                <input
                    className="ol-form-control"
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    placeholder="e.g. AI Frontier Program"
                    required
                />
            </div>

            <div className="mb-3">
                <label className="ol-form-label">Tagline</label>
                <textarea
                    className="ol-form-control"
                    rows="2"
                    value={form.tagline}
                    onChange={(e) => set('tagline', e.target.value)}
                    placeholder="Short one-line description shown under the title"
                />
            </div>

            <div className="mb-3">
                <CollegeMultiSelect
                    value={selectedClgIds}
                    onChange={setSelectedClgIds}
                    required
                />
            </div>

            <div className="mb-3">
                <CourseMultiSelect
                    value={selectedCourseIds}
                    onChange={setSelectedCourseIds}
                    clgIds={selectedClgIds}
                    required
                />
            </div>

            <div className="mb-3">
                <BatchMultiSelect
                    clgIds={selectedClgIds}
                    value={selectedBatchIds}
                    onChange={setSelectedBatchIds}
                    allowedBatchIds={allowedBatchIds}
                    requireCourses
                    hasCourseSelection={selectedCourseIds.length > 0}
                />
            </div>

            <div className="grid grid-cols-12 gap-3 mb-3">
                <div className="col-span-12 md:col-span-8">
                    <label className="ol-form-label">Icon</label>
                    <select
                        className="ol-form-control"
                        value={form.icon}
                        onChange={(e) => set('icon', e.target.value)}
                    >
                        {ICON_OPTIONS.map((name) => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                    <p className="text-[12px] text-gray mt-1">
                        Lucide icon name. The card on the public site renders this glyph above the title.
                    </p>
                </div>
                <div className="col-span-12 md:col-span-4">
                    <label className="ol-form-label">Sort order</label>
                    <input
                        type="number"
                        className="ol-form-control"
                        value={form.sort}
                        onChange={(e) => set('sort', e.target.value)}
                    />
                </div>
            </div>

            <div className="mb-4">
                <label className="ol-form-label">Features</label>
                {features.map((value, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                        <input
                            className="ol-form-control flex-1"
                            value={value}
                            onChange={(e) => updateFeature(i, e.target.value)}
                            placeholder={`Feature ${i + 1}`}
                        />
                        <button
                            type="button"
                            className="text-gray hover:text-danger px-2 text-[18px] leading-none"
                            onClick={() => removeFeature(i)}
                            title="Remove"
                            aria-label={`Remove feature ${i + 1}`}
                        >
                            ×
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    className="ol-btn-light ol-btn-sm"
                    onClick={addFeature}
                >
                    + Add feature
                </button>
            </div>

            <div className="mb-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        className="w-4 h-4 accent-skin"
                        checked={form.is_active}
                        onChange={(e) => set('is_active', e.target.checked)}
                    />
                    <span className="text-[14px] text-dark">
                        Active (visible on public Programs page)
                    </span>
                </label>
            </div>

            <div className="text-right">
                <button type="submit" className="ol-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Save program'}
                </button>
            </div>
        </form>
    );
}
