import { useEffect, useMemo, useRef, useState } from 'react';
import { listCourses } from '../api/course';
import { useCollege } from '@/hooks/useCollege';

// Single-select course picker styled like CollegeMultiSelect:
// a clickable trigger that shows the chosen course as a chip (or placeholder
// text), plus a popover with a search input and a scrollable result list.
//
// Why not a plain <select>? The Program form requires the chip-with-search
// UX so the College and Course fields look the same — picking through
// hundreds of course titles in a native dropdown is rough.
//
// Props:
//   value     — selected course id (string or number), '' / null when empty
//   onChange  — receives the next id as a STRING (matches form-state habits)
//   required  — show the red asterisk on the label (validation is caller's)
//   label     — defaults to 'Course'
//   hideLabel — render without the internal label (when a parent already provides one)
//   clgIds    — optional array of clgId strings; when non-empty, only courses
//               whose clg_ids include at least one of these ids are listed
export default function CourseSingleSelect({
    value = '',
    onChange,
    required = false,
    label = 'Course',
    hideLabel = false,
    clgIds = [],
}) {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const boxRef = useRef(null);

    // Resolve clgId → clgName so each row can render "Course — College".
    // useCollege() is shared across the admin so the hit is usually cached.
    const { colleges } = useCollege();
    const collegeNameById = useMemo(() => {
        const map = {};
        (colleges || []).forEach((c) => { map[c.clgId] = c.clgName; });
        return map;
    }, [colleges]);

    // Pick the best college label for a course given the current scoping:
    //   - if scoping by clgIds, prefer the first selected college that the
    //     course belongs to (so the label matches the admin's lens)
    //   - else fall back to the course's first clg_id
    // Returns an empty string when nothing resolves; callers render the
    // course title alone in that case.
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

    // Scope by colleges if clgIds was passed; otherwise show everything.
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
            // Also let the admin search by college name — the visible label
            // includes it, so it would be confusing if it didn't match.
            const collegeLabel = collegeLabelFor(c);
            return collegeLabel.toLowerCase().includes(q);
        });
    }, [scoped, search, collegeNameById, clgIds]);

    const selectedCourse = useMemo(
        () => (value ? courses.find((c) => String(c.id) === String(value)) : null),
        [courses, value],
    );

    // When the selected course drops out of scope (e.g. colleges removed),
    // clear it so the form doesn't submit a stale id.
    useEffect(() => {
        if (!value) return;
        if (scoped.some((c) => String(c.id) === String(value))) return;
        onChange('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scoped]);

    const pick = (id) => {
        onChange(String(id));
        setOpen(false);
    };
    const clear = (e) => {
        e.stopPropagation();
        onChange('');
    };

    const placeholder = clgIds.length === 0 && !loading && !error && courses.length > 0
        ? 'Select a course…'
        : clgIds.length > 0 && scoped.length === 0
            ? 'No courses available for the chosen college(s)'
            : 'Select a course…';

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
                        {selectedCourse ? (
                            (() => {
                                const collegeLabel = collegeLabelFor(selectedCourse);
                                return (
                                    <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[13px]"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <span className="truncate max-w-[320px]">
                                            {selectedCourse.title}
                                            {collegeLabel && (
                                                <span className="text-emerald-700/80"> — {collegeLabel}</span>
                                            )}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={clear}
                                            className="text-emerald-700 hover:text-rose-600 font-bold leading-none"
                                            aria-label="Clear selection"
                                        >
                                            ×
                                        </button>
                                    </span>
                                );
                            })()
                        ) : (
                            <span className="text-[14px] text-gray">{placeholder}</span>
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
                                        const active = String(c.id) === String(value);
                                        const collegeLabel = collegeLabelFor(c);
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => pick(c.id)}
                                                className={`w-full text-left flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 ${active ? 'bg-emerald-50' : ''}`}
                                            >
                                                <span className={`w-4 h-4 mt-0.5 rounded-full border flex-shrink-0 ${active ? 'border-skin bg-skin' : 'border-gray-300'}`} />
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
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {required && <input type="hidden" required value={value || ''} readOnly />}
        </div>
    );
}
