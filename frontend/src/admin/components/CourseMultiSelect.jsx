import { useEffect, useMemo, useRef, useState } from 'react';
import { listCourses } from '../api/course';
import { useCollege } from '@/hooks/useCollege';

// Multi-select course picker styled like CollegeMultiSelect:
// a clickable trigger that shows chosen courses as chips (with × to remove),
// plus a popover with a search input and a scrollable checkbox list. Each
// row renders the course title followed by "— <college name>" so the admin
// always sees which college each course belongs to.
//
// Props:
//   value     — array of selected course ids (strings; numeric ids OK too)
//   onChange  — receives the next array (always strings)
//   required  — show the red asterisk on the label (validation is caller's)
//   label     — defaults to 'Courses'
//   hideLabel — render without the internal label
//   clgIds    — optional array of clgId strings; when non-empty, only courses
//               whose clg_ids include at least one of these ids are listed
export default function CourseMultiSelect({
    value = [],
    onChange,
    required = false,
    label = 'Courses',
    hideLabel = false,
    clgIds = [],
}) {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const boxRef = useRef(null);

    // clgId → clgName so each row + chip can render "Course — College".
    const { colleges } = useCollege();
    const collegeNameById = useMemo(() => {
        const map = {};
        (colleges || []).forEach((c) => { map[c.clgId] = c.clgName; });
        return map;
    }, [colleges]);

    // Best college label for a course given the current scope: prefer the
    // first selected college the course belongs to, else its first clg_id.
    const collegeLabelFor = (course) => {
        const ids = Array.isArray(course?.clg_ids) ? course.clg_ids.map(String) : [];
        if (ids.length === 0) return '';
        let pickedId = ids[0];
        if (Array.isArray(clgIds) && clgIds.length > 0) {
            const selected = new Set(clgIds.map(String));
            const match = ids.find((id) => selected.has(id));
            if (match) pickedId = match;
        }
        return collegeNameById[pickedId] || pickedId;
    };

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        listCourses({})
            .then((r) => {
                if (!alive) return;
                const rows = Array.isArray(r?.courses?.data) ? r.courses.data : [];
                setCourses(rows);
            })
            .catch((e) => {
                if (alive) setError(
                    e?.response?.data?.error || e?.message || 'Failed to load courses',
                );
            })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => {
            if (!boxRef.current) return;
            if (!boxRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    // Scope by selected colleges if provided; else show everything.
    const scoped = useMemo(() => {
        if (!Array.isArray(clgIds) || clgIds.length === 0) return courses;
        const selected = new Set(clgIds.map(String));
        return courses.filter((c) => {
            const ids = Array.isArray(c.clg_ids) ? c.clg_ids : [];
            return ids.some((id) => selected.has(String(id)));
        });
    }, [courses, clgIds]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return scoped;
        return scoped.filter((c) => {
            if (String(c.title || '').toLowerCase().includes(q)) return true;
            const collegeLabel = collegeLabelFor(c);
            return collegeLabel.toLowerCase().includes(q);
        });
    }, [scoped, search, collegeNameById, clgIds]);

    const valueStrs = useMemo(() => value.map(String), [value]);
    const courseById = useMemo(() => {
        const map = {};
        courses.forEach((c) => { map[String(c.id)] = c; });
        return map;
    }, [courses]);

    // Drop ids that no longer match the current scope (e.g. admin removed
    // the colleges that backed them). Runs after `scoped` updates.
    useEffect(() => {
        if (valueStrs.length === 0) return;
        const inScope = new Set(scoped.map((c) => String(c.id)));
        const next = valueStrs.filter((id) => inScope.has(id));
        if (next.length !== valueStrs.length) onChange(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scoped]);

    const toggle = (id) => {
        const s = String(id);
        onChange(valueStrs.includes(s) ? valueStrs.filter((x) => x !== s) : [...valueStrs, s]);
    };

    const remove = (id, e) => {
        e.stopPropagation();
        const s = String(id);
        onChange(valueStrs.filter((x) => x !== s));
    };

    const placeholder = clgIds.length > 0 && scoped.length === 0
        ? 'No courses available for the chosen college(s)'
        : 'Select courses…';

    return (
        <div>
            {!hideLabel && (
                <label className="ol-form-label">
                    {label}{required && <span className="text-danger ml-1">*</span>}
                </label>
            )}

            {loading ? (
                <div className="text-[13px] text-gray">Loading courses…</div>
            ) : error ? (
                <div className="text-[13px] text-danger">{error}</div>
            ) : courses.length === 0 ? (
                <div className="text-[13px] text-gray">
                    No courses available. Add a course first.
                </div>
            ) : (
                <div className="relative" ref={boxRef}>
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setOpen((o) => !o)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setOpen((o) => !o);
                            }
                        }}
                        className="ol-form-control flex flex-wrap items-center gap-1.5 min-h-[42px] cursor-pointer"
                        aria-haspopup="listbox"
                        aria-expanded={open}
                    >
                        {valueStrs.length === 0 ? (
                            <span className="text-[14px] text-gray">{placeholder}</span>
                        ) : (
                            valueStrs.map((id) => {
                                const c = courseById[id];
                                const title = c ? c.title : `#${id}`;
                                const collegeLabel = c ? collegeLabelFor(c) : '';
                                return (
                                    <span
                                        key={id}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[13px]"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <span className="truncate max-w-[260px]">
                                            {title}
                                            {collegeLabel && (
                                                <span className="text-emerald-700/80"> — {collegeLabel}</span>
                                            )}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => remove(id, e)}
                                            className="text-emerald-700 hover:text-rose-600 font-bold leading-none"
                                            aria-label={`Remove ${title}`}
                                        >
                                            ×
                                        </button>
                                    </span>
                                );
                            })
                        )}
                        <svg
                            className={`w-4 h-4 ml-auto text-gray transition-transform ${open ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>

                    {open && (
                        <div className="absolute z-20 mt-1 w-full bg-white border rounded-md shadow-lg">
                            <div className="p-2 border-b">
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by course or college…"
                                    className="ol-form-control"
                                    autoFocus
                                />
                            </div>
                            <div className="max-h-56 overflow-y-auto divide-y">
                                {filtered.length === 0 ? (
                                    <div className="px-3 py-2 text-[13px] text-gray">No matches.</div>
                                ) : (
                                    filtered.map((c) => {
                                        const id = String(c.id);
                                        const checked = valueStrs.includes(id);
                                        const collegeLabel = collegeLabelFor(c);
                                        return (
                                            <label
                                                key={id}
                                                className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggle(id)}
                                                    className="w-4 h-4 mt-0.5 accent-skin cursor-pointer"
                                                />
                                                <div className="flex items-baseline gap-1.5 min-w-0">
                                                    <span className="text-[14px] font-medium text-dark truncate">
                                                        {c.title}
                                                    </span>
                                                    {collegeLabel && (
                                                        <span className="text-[13px] text-gray truncate">
                                                            — {collegeLabel}
                                                        </span>
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {required && <input type="hidden" required value={valueStrs.length ? '1' : ''} readOnly />}
        </div>
    );
}
