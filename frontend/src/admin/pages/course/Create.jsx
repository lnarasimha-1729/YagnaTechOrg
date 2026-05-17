import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { createMeta, storeCourse } from '../../api/course';
import { listInstructors } from '../../api/instructor';
import { listLanguages } from '../../api/language';

const flatCats = (tree) => {
    const flat = [];
    tree.forEach((p) => {
        flat.push({ id: p.id, title: p.title, depth: 0 });
        p.childs?.forEach((c) => flat.push({ id: c.id, title: c.title, depth: 1 }));
    });
    return flat;
};

const STATUS_RADIOS = [
    { id: 'status_active', value: 'active', label: 'Active', color: 'text-success', ring: 'focus:ring-success' },
    { id: 'status_private', value: 'private', label: 'Private', color: 'text-skin', ring: 'focus:ring-skin' },
    { id: 'status_upcoming', value: 'upcoming', label: 'Upcoming', color: 'text-sky-500', ring: 'focus:ring-sky-500' },
    { id: 'status_pending', value: 'pending', label: 'Pending', color: 'text-danger', ring: 'focus:ring-danger' },
    { id: 'status_draft', value: 'draft', label: 'Draft', color: 'text-gray', ring: 'focus:ring-gray' },
    { id: 'status_inactive', value: 'inactive', label: 'Inactive', color: 'text-dark', ring: 'focus:ring-dark' },
];

function Radio({ id, name, value, checked, onChange, label }) {
    return (
        <label htmlFor={id} className="inline-flex items-center gap-2 cursor-pointer">
            <input
                id={id}
                name={name}
                type="radio"
                value={value}
                checked={checked}
                onChange={onChange}
                className="w-4 h-4 accent-skin cursor-pointer"
            />
            <span className="text-[14px] text-dark">{label}</span>
        </label>
    );
}

export default function CourseCreate() {
    const nav = useNavigate();
    const [cats, setCats] = useState([]);
    const [form, setForm] = useState({
        title: '',
        short_description: '',
        description: '',
        status: 'active',
        category_id: '',
        level: '',
        language: '',
        is_paid: '1',
        price: '',
        discount_flag: '',
        discounted_price: '',
        expiry_period: 'lifetime',
        number_of_month: '',
        enable_drip_content: '0',
        // Auth-service userId of the instructor selected from the dropdown.
        // Sent as instructors[] on submit so the backend stores it in
        // course.instructor_ids (CourseService.create line 181).
        instructor_id: '',
    });
    const [thumbnail, setThumbnail] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Instructor dropdown source — admin instructors API
    // (GET /api/admin/manage/instructors). Loaded once on mount; small list,
    // so we pull everything in a single request.
    const [instructors, setInstructors] = useState([]);
    const [instructorsLoading, setInstructorsLoading] = useState(true);
    const [instructorsError, setInstructorsError] = useState(null);

    const [languages, setLanguages] = useState([]);
    const [languagesLoading, setLanguagesLoading] = useState(true);

    const loadInstructors = () => {
        setInstructorsLoading(true);
        setInstructorsError(null);
        listInstructors({ per_page: 1000 })
            .then((r) => setInstructors(r?.instructors || []))
            .catch((e) =>
                setInstructorsError(
                    e?.response?.data?.error || e?.message || 'Failed to load instructors'
                )
            )
            .finally(() => setInstructorsLoading(false));
    };

    useEffect(() => {
        createMeta()
            .then((r) => setCats(flatCats(r.categories || [])))
            .catch(() => setCats([]));
        loadInstructors();
        setLanguagesLoading(true);
        listLanguages()
            .then((r) => setLanguages(r?.languages || []))
            .catch(() => setLanguages([]))
            .finally(() => setLanguagesLoading(false));
    }, []);

    const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.instructor_id) {
            toast.error('Please select an instructor');
            return;
        }
        setSubmitting(true);
        const fd = new FormData();
        // instructor_id is the form-state key; we send it on the wire as
        // instructors[] (CourseService expects body.instructors as an array
        // and JSON-stringifies it into course.instructor_ids).
        Object.entries(form).forEach(([k, v]) => {
            if (k === 'instructor_id') return;
            fd.append(k, v);
        });
        fd.append('course_type', 'general');
        fd.append('instructors[]', form.instructor_id);
        if (thumbnail) fd.append('thumbnail', thumbnail);

        try {
            const res = await storeCourse(fd);
            toast.success(res.success || 'Course created');
            nav(`/admin/course/edit/${res.course_id}`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={submit} encType="multipart/form-data" className="mb-5">
            <div className="ol-card rounded-ol-8 mb-3">
                <div className="ol-card-body py-12px px-20px my-3 py-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h4 className="text-[16px] font-semibold text-dark m-0 flex items-center gap-2">
                            <i className="fi-rr-settings-sliders" />
                            Add new Course
                        </h4>
                    </div>
                </div>
            </div>

            <div className="ol-card p-3">
                <div className="ol-card-body">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left column */}
                        <div>
                            <div className="mb-3">
                                <label className="ol-form-label" htmlFor="title">
                                    Title<span className="text-danger ml-1">*</span>
                                </label>
                                <input
                                    id="title"
                                    className="ol-form-control"
                                    name="title"
                                    type="text"
                                    placeholder="Enter Course Title"
                                    required
                                    value={form.title}
                                    onChange={(e) => set('title', e.target.value)}
                                />
                            </div>

                            <div className="mb-3">
                                <label className="ol-form-label" htmlFor="short_description">Short Description</label>
                                <textarea
                                    id="short_description"
                                    className="ol-form-control"
                                    name="short_description"
                                    rows="5"
                                    placeholder="Enter Short Description"
                                    value={form.short_description}
                                    onChange={(e) => set('short_description', e.target.value)}
                                />
                            </div>

                            <div className="mb-3">
                                <label className="ol-form-label" htmlFor="description">Description</label>
                                <textarea
                                    id="description"
                                    className="ol-form-control"
                                    name="description"
                                    rows="6"
                                    placeholder="Enter Description"
                                    value={form.description}
                                    onChange={(e) => set('description', e.target.value)}
                                />
                            </div>

                            <div className="mb-2">
                                <label className="ol-form-label">
                                    Create as<span className="text-danger ml-1">*</span>
                                </label>
                                <div className="flex flex-wrap gap-x-5 gap-y-2">
                                    {STATUS_RADIOS.map((r) => (
                                        <Radio
                                            key={r.id}
                                            id={r.id}
                                            name="status"
                                            value={r.value}
                                            checked={form.status === r.value}
                                            onChange={() => set('status', r.value)}
                                            label={r.label}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right column */}
                        <div>
                            <div className="mb-3">
                                <label className="ol-form-label" htmlFor="category_id">
                                    Category<span className="text-danger ml-1">*</span>
                                </label>
                                <select
                                    id="category_id"
                                    className="ol-form-control"
                                    name="category_id"
                                    required
                                    value={form.category_id}
                                    onChange={(e) => set('category_id', e.target.value)}
                                >
                                    <option value="">Select a category</option>
                                    {cats.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.depth ? '-- ' : ''}{c.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mb-3">
                                <label className="ol-form-label" htmlFor="level">
                                    Course level<span className="text-danger ml-1">*</span>
                                </label>
                                <select
                                    id="level"
                                    className="ol-form-control"
                                    name="level"
                                    required
                                    value={form.level}
                                    onChange={(e) => set('level', e.target.value)}
                                >
                                    <option value="">Select your course level</option>
                                    <option value="beginner">Beginner</option>
                                    <option value="intermediate">Intermediate</option>
                                    <option value="advanced">Advanced</option>
                                </select>
                            </div>

                            <div className="mb-3">
                                <label className="ol-form-label" htmlFor="language">
                                    Made in<span className="text-danger ml-1">*</span>
                                </label>
                                <select
                                    id="language"
                                    className="ol-form-control"
                                    name="language"
                                    required
                                    disabled={languagesLoading}
                                    value={form.language}
                                    onChange={(e) => set('language', e.target.value)}
                                >
                                    <option value="">
                                        {languagesLoading
                                            ? 'Loading languages…'
                                            : languages.length === 0
                                                ? 'No languages — add one in Manage Language'
                                                : 'Select your course language'}
                                    </option>
                                    {languages.map((l) => (
                                        <option key={l.id} value={l.name.toLowerCase()} className="capitalize">
                                            {l.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Instructor — sourced from the admin instructor API
                                (auth-service users with role='instructor'). Required:
                                a course must have an assigned instructor. Disabled
                                while loading / on fetch error so the form can't be
                                submitted with an invalid value. */}
                            <div className="mb-3">
                                <label className="ol-form-label" htmlFor="instructor_id">
                                    Instructor<span className="text-danger ml-1">*</span>
                                </label>
                                <select
                                    id="instructor_id"
                                    className="ol-form-control"
                                    name="instructor_id"
                                    required
                                    disabled={instructorsLoading || !!instructorsError}
                                    value={form.instructor_id}
                                    onChange={(e) => set('instructor_id', e.target.value)}
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
                                            <option key={ins.id} value={ins.id}>
                                                {label}{sub}
                                            </option>
                                        );
                                    })}
                                </select>
                                {instructorsError && (
                                    <div className="text-[13px] text-danger mt-1">
                                        {instructorsError}{' '}
                                        <button
                                            type="button"
                                            onClick={loadInstructors}
                                            className="text-skin underline ml-1"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="mb-3">
                                <label className="ol-form-label">
                                    Pricing type<span className="text-danger ml-1">*</span>
                                </label>
                                <div className="flex flex-wrap gap-x-5 gap-y-2 mb-2">
                                    <Radio
                                        id="paid"
                                        name="is_paid"
                                        value="1"
                                        checked={form.is_paid === '1'}
                                        onChange={() => set('is_paid', '1')}
                                        label="Paid"
                                    />
                                    <Radio
                                        id="free"
                                        name="is_paid"
                                        value="0"
                                        checked={form.is_paid === '0'}
                                        onChange={() => set('is_paid', '0')}
                                        label="Free"
                                    />
                                </div>

                                {form.is_paid === '1' && (
                                    <div className="pt-1">
                                        <div className="mb-3">
                                            <label className="ol-form-label" htmlFor="price">
                                                Price <small className="text-gray">($)</small>
                                                <span className="text-danger ml-1">*</span>
                                            </label>
                                            <input
                                                id="price"
                                                className="ol-form-control"
                                                name="price"
                                                type="number"
                                                min="1"
                                                step="0.01"
                                                placeholder="Enter your course price ($)"
                                                value={form.price}
                                                onChange={(e) => set('price', e.target.value)}
                                            />
                                        </div>

                                        <div className="mb-3 flex items-center gap-2">
                                            <input
                                                id="discount_flag"
                                                type="checkbox"
                                                className="w-4 h-4 accent-skin cursor-pointer"
                                                checked={form.discount_flag === '1'}
                                                onChange={(e) => set('discount_flag', e.target.checked ? '1' : '')}
                                            />
                                            <label htmlFor="discount_flag" className="text-[14px] text-dark cursor-pointer">
                                                Check if this course has discount
                                            </label>
                                        </div>

                                        {form.discount_flag === '1' && (
                                            <div className="mb-3">
                                                <label className="ol-form-label" htmlFor="discounted_price">Discounted price</label>
                                                <input
                                                    id="discounted_price"
                                                    className="ol-form-control"
                                                    name="discounted_price"
                                                    type="number"
                                                    min="1"
                                                    step="0.01"
                                                    placeholder="Enter your discount price ($)"
                                                    value={form.discounted_price}
                                                    onChange={(e) => set('discounted_price', e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="mb-3">
                                <label className="ol-form-label">Expiry period</label>
                                <div className="flex flex-wrap gap-x-5 gap-y-2">
                                    <Radio
                                        id="lifetime_expiry_period"
                                        name="expiry_period"
                                        value="lifetime"
                                        checked={form.expiry_period === 'lifetime'}
                                        onChange={() => set('expiry_period', 'lifetime')}
                                        label="Lifetime"
                                    />
                                    <Radio
                                        id="limited_expiry_period"
                                        name="expiry_period"
                                        value="limited_time"
                                        checked={form.expiry_period === 'limited_time'}
                                        onChange={() => set('expiry_period', 'limited_time')}
                                        label="Limited time"
                                    />
                                </div>
                            </div>

                            {form.expiry_period === 'limited_time' && (
                                <div className="mb-3">
                                    <label className="ol-form-label" htmlFor="number_of_month">Number of month</label>
                                    <input
                                        id="number_of_month"
                                        className="ol-form-control"
                                        name="number_of_month"
                                        type="number"
                                        min="1"
                                        placeholder="After purchase, students can access the course until your selected month."
                                        value={form.number_of_month}
                                        onChange={(e) => set('number_of_month', e.target.value)}
                                    />
                                </div>
                            )}

                            <div className="mb-3">
                                <label className="ol-form-label">
                                    Enable drip content<span className="text-danger ml-1">*</span>
                                </label>
                                <div className="flex flex-wrap gap-x-5 gap-y-2">
                                    <Radio
                                        id="drip_off"
                                        name="enable_drip_content"
                                        value="0"
                                        checked={form.enable_drip_content === '0'}
                                        onChange={() => set('enable_drip_content', '0')}
                                        label="Off"
                                    />
                                    <Radio
                                        id="drip_on"
                                        name="enable_drip_content"
                                        value="1"
                                        checked={form.enable_drip_content === '1'}
                                        onChange={() => set('enable_drip_content', '1')}
                                        label="On"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="ol-form-label" htmlFor="thumbnail">Thumbnail</label>
                                <input
                                    id="thumbnail"
                                    className="ol-form-control"
                                    name="thumbnail"
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setThumbnail(e.target.files[0] || null)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button type="submit" className="ol-btn-primary" disabled={submitting}>
                            {submitting ? 'Submitting…' : 'Submit'}
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );
}
