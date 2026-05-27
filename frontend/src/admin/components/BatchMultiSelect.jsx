import { useEffect, useMemo, useRef, useState } from 'react';
import { listBatchesByColleges } from '../api/batch';
import { useCollege } from '@/hooks/useCollege';

// Batches dropdown for Add/Edit Course. Mirrors CollegeMultiSelect's chips +
// searchable list so the form has one consistent multi-select pattern.
//
// The set of batches depends on which colleges the admin has selected, so
// this component re-fetches whenever `clgIds` changes. When no colleges are
// selected the dropdown is disabled with a helpful hint.
//
// Props:
//   clgIds          — selected college IDs (drives which batches load)
//   value           — selected batch ids (numbers)
//   onChange        — receives the next array of numeric ids
//   required        — shows the red asterisk (validation is caller's responsibility)
//   allowedBatchIds — optional Set<number> | array of batch ids to restrict to.
//                     When provided, the dropdown narrows to only these batches
//                     (in addition to the college filter). Used by the Add/Edit
//                     Program form to also narrow by selected courses' batch_ids.
//                     `null` / undefined = no narrowing. An empty Set/array
//                     means "narrowing is in effect but matches nothing" — the
//                     dropdown then shows zero batches (only meaningful when
//                     `requireCourses` is set; legacy callers still pass null).
//   requireCourses    — when true, an empty `allowedBatchIds` set is honored as
//                       "no batches" instead of being treated as "no narrowing".
//                       Pair with `hasCourseSelection` so the empty-state copy
//                       can distinguish "pick courses first" from "those
//                       courses have no batches".
//   hasCourseSelection — only meaningful with `requireCourses`. Drives the
//                        "Select a course first…" placeholder.
export default function BatchMultiSelect({
    clgIds = [],
    value = [],
    onChange,
    required = false,
    allowedBatchIds = null,
    requireCourses = false,
    hasCourseSelection = false,
}) {
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const boxRef = useRef(null);

    // Resolve clgId → clgName for the group headers. Same source CollegeMultiSelect
    // uses, so headers always match the chip labels above.
    const { colleges } = useCollege();
    const collegeNameById = useMemo(
        () => Object.fromEntries((colleges || []).map((c) => [c.clgId, c.clgName])),
        [colleges]
    );

    // Stable key so the effect only re-fires when the set actually changes,
    // not on every parent re-render that hands us a new array reference.
    const clgKey = useMemo(() => [...clgIds].sort().join(','), [clgIds]);

    useEffect(() => {
        if (!clgKey) {
            setBatches([]);
            setError(null);
            return;
        }
        let alive = true;
        setLoading(true);
        setError(null);
        listBatchesByColleges(clgKey.split(','))
            .then((res) => {
                if (!alive) return;
                setBatches(res?.batches || []);
            })
            .catch((err) => {
                if (!alive) return;
                setError(err?.response?.data?.error || err?.message || 'Failed to load batches');
            })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [clgKey]);

    // Drop any selected batch_ids whose college is no longer selected — keeps
    // the form honest when the admin removes a college after picking batches.
    useEffect(() => {
        if (value.length === 0 || batches.length === 0) return;
        const valid = new Set(batches.map((b) => Number(b.id)));
        const filtered = value.filter((id) => valid.has(Number(id)));
        if (filtered.length !== value.length) onChange(filtered);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batches]);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => {
            if (!boxRef.current) return;
            if (!boxRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    // Optional narrowing set passed by the parent (e.g. Program form unions
    // batch_ids across the admin's selected courses). Behavior:
    //  - null/undefined        → no narrowing (legacy callers).
    //  - empty Set/array       → "narrowing matches nothing" when
    //                            requireCourses is on (strict college→course
    //                            →batch flow); otherwise treated as no
    //                            narrowing so legacy callers are unaffected.
    const allowedSet = useMemo(() => {
        if (allowedBatchIds == null) return null;
        const arr = allowedBatchIds instanceof Set
            ? [...allowedBatchIds]
            : Array.isArray(allowedBatchIds) ? allowedBatchIds : [];
        if (!arr.length) return requireCourses ? new Set() : null;
        return new Set(arr.map((v) => Number(v)).filter((n) => Number.isFinite(n)));
    }, [allowedBatchIds, requireCourses]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const bySearch = q
            ? batches.filter((b) => (b.name || '').toLowerCase().includes(q))
            : batches;
        if (!allowedSet) return bySearch;
        return bySearch.filter((b) => allowedSet.has(Number(b.id)));
    }, [batches, search, allowedSet]);

    // When the narrowing set changes (e.g. admin removes a course), drop any
    // currently-selected batch that no longer qualifies. Mirrors the existing
    // batch-pruning effect that runs when colleges change.
    useEffect(() => {
        if (!allowedSet || value.length === 0) return;
        const next = value.filter((id) => allowedSet.has(Number(id)));
        if (next.length !== value.length) onChange(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allowedSet]);

    // Group filtered batches by clg_id so the list renders with college headers.
    // Insertion order matches the user's college-pick order — first clgId in
    // clgIds shows first. Colleges that have no batches are skipped (header
    // would be empty).
    const groupedFiltered = useMemo(() => {
        const byClg = new Map();
        for (const b of filtered) {
            const key = String(b.clg_id);
            if (!byClg.has(key)) byClg.set(key, []);
            byClg.get(key).push(b);
        }
        // Preserve the order from clgIds; fall back to the natural Map order
        // for ids that aren't in clgIds (defensive — shouldn't happen).
        const orderedKeys = [
            ...clgIds.filter((id) => byClg.has(String(id))),
            ...[...byClg.keys()].filter((k) => !clgIds.map(String).includes(k)),
        ];
        return orderedKeys.map((k) => ({ clgId: k, items: byClg.get(k) }));
    }, [filtered, clgIds]);

    const toggle = (id) => {
        const n = Number(id);
        const next = value.map(Number).includes(n)
            ? value.filter((x) => Number(x) !== n)
            : [...value, n];
        onChange(next);
    };

    // Toggle every batch in one college group at once. If any batch in the
    // group is unselected, the action selects all (so partial → full). If all
    // are selected, the action clears them.
    const toggleGroup = (groupItems) => {
        const selectedSet = new Set(value.map(Number));
        const groupIds = groupItems.map((b) => Number(b.id));
        const allSelected = groupIds.every((id) => selectedSet.has(id));
        if (allSelected) {
            const removed = groupIds.filter((id) => selectedSet.has(id));
            onChange(value.map(Number).filter((id) => !removed.includes(id)));
        } else {
            const next = new Set([...value.map(Number), ...groupIds]);
            onChange([...next]);
        }
    };

    const noColleges = clgIds.length === 0;
    const needsCourse = requireCourses && !hasCourseSelection;
    // requireCourses + non-empty selection but the courses contributed no
    // batch_ids — filtered will be empty even before search narrows it.
    const coursesHaveNoBatches =
        requireCourses && hasCourseSelection && allowedSet && allowedSet.size === 0;

    return (
        <div>
            <label className="ol-form-label">
                Batches{required && <span className="text-danger ml-1">*</span>}
            </label>

            {noColleges ? (
                <div className="ol-form-control flex items-center text-[14px] text-gray bg-gray-50">
                    Select a college first to load its batches.
                </div>
            ) : needsCourse ? (
                <div className="ol-form-control flex items-center text-[14px] text-gray bg-gray-50">
                    Select a course first to load its batches.
                </div>
            ) : loading ? (
                <div className="text-[13px] text-gray">Loading batches…</div>
            ) : error ? (
                <div className="text-[13px] text-danger">{error}</div>
            ) : coursesHaveNoBatches ? (
                <div className="text-[13px] text-gray">
                    No batches are assigned to the selected course(s).
                </div>
            ) : batches.length === 0 ? (
                <div className="text-[13px] text-gray">
                    No batches exist for the selected college{clgIds.length > 1 ? 's' : ''}.
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
                        {value.length === 0 ? (
                            <span className="text-[14px] text-gray">Select batches…</span>
                        ) : (
                            value.map((id) => {
                                const match = batches.find((b) => Number(b.id) === Number(id));
                                // Selected chips appear together regardless of which
                                // college each batch belongs to, so the college name
                                // has to live on the chip itself — otherwise two
                                // "Batch - 1" chips from different colleges look
                                // identical and the admin can't tell them apart.
                                const collegeLabel = match
                                    ? (collegeNameById[match.clg_id] || match.clg_id)
                                    : '';
                                return (
                                    <span
                                        key={id}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-skin/10 text-skin text-[13px]"
                                        onClick={(e) => e.stopPropagation()}
                                        title={match ? `${match.name} · ${collegeLabel}` : `Batch #${id}`}
                                    >
                                        <span className="truncate max-w-[220px]">
                                            {match ? (
                                                <>
                                                    {match.name}
                                                    <span className="text-gray ml-1">· {collegeLabel}</span>
                                                </>
                                            ) : `Batch #${id}`}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => toggle(id)}
                                            className="text-skin hover:text-rose-600 font-bold leading-none"
                                            aria-label={`Remove ${id}`}
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
                                    placeholder="Search batches…"
                                    className="ol-form-control"
                                />
                            </div>
                            <div className="max-h-72 overflow-y-auto">
                                {groupedFiltered.length === 0 ? (
                                    <div className="px-3 py-2 text-[13px] text-gray">No matches.</div>
                                ) : (
                                    groupedFiltered.map((group) => {
                                        const selectedSet = new Set(value.map(Number));
                                        const groupIds = group.items.map((b) => Number(b.id));
                                        const selectedInGroup = groupIds.filter((id) => selectedSet.has(id)).length;
                                        const allSelected = selectedInGroup === group.items.length && group.items.length > 0;
                                        const someSelected = selectedInGroup > 0 && !allSelected;
                                        const clgName = collegeNameById[group.clgId] || group.clgId;
                                        return (
                                            <div key={group.clgId} className="border-b last:border-b-0">
                                                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 sticky top-0">
                                                    <div className="text-[12px] font-semibold text-dark truncate" title={group.clgId}>
                                                        {clgName}
                                                        <span className="ml-2 text-[11px] font-normal text-gray">
                                                            {selectedInGroup}/{group.items.length}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="text-[12px] text-skin hover:underline whitespace-nowrap"
                                                        onClick={() => toggleGroup(group.items)}
                                                    >
                                                        {allSelected ? 'Clear all' : someSelected ? 'Select rest' : 'Select all'}
                                                    </button>
                                                </div>
                                                {group.items.map((b) => (
                                                    <label
                                                        key={b.id}
                                                        className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedSet.has(Number(b.id))}
                                                            onChange={() => toggle(b.id)}
                                                            className="w-4 h-4 mt-0.5 accent-skin cursor-pointer"
                                                        />
                                                        <span className="text-[14px] text-dark truncate">
                                                            {b.name}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
