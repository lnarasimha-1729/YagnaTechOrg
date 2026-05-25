import { useEffect, useMemo, useRef, useState } from 'react';
import { useCollege } from '@/hooks/useCollege';

// Reusable college multi-select. Drives the same chips-in-trigger + searchable
// dropdown UI Category uses, so course forms behave identically. Caller owns
// the selection state and submits it as `clgIds[]` on the form.
//
// Props:
//   value    — array of selected clgId strings
//   onChange — receives the next array
//   required — when true, shows the red asterisk (validation is the caller's)
export default function CollegeMultiSelect({ value = [], onChange, required = false, label = 'Colleges', hideLabel = false }) {
    const { colleges, loading, error, refresh } = useCollege();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const boxRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => {
            if (!boxRef.current) return;
            if (!boxRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return colleges;
        return colleges.filter(
            (c) => c.clgName.toLowerCase().includes(q) || c.clgId.toLowerCase().includes(q),
        );
    }, [colleges, search]);

    const toggle = (clgId) => {
        const next = value.includes(clgId)
            ? value.filter((x) => x !== clgId)
            : [...value, clgId];
        onChange(next);
    };

    return (
        <div>
            {!hideLabel && (
                <label className="ol-form-label">
                    {label}{required && <span className="text-danger ml-1">*</span>}
                </label>
            )}

            {loading ? (
                <div className="text-[13px] text-gray">Loading colleges…</div>
            ) : error ? (
                <div className="text-[13px] text-danger">
                    {error}{' '}
                    {refresh && (
                        <button type="button" onClick={() => refresh()} className="text-skin underline ml-1">
                            Retry
                        </button>
                    )}
                </div>
            ) : colleges.length === 0 ? (
                <div className="text-[13px] text-gray">
                    No colleges available. Add a college first.
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
                            <span className="text-[14px] text-gray">Select colleges…</span>
                        ) : (
                            value.map((id) => {
                                const match = colleges.find((c) => c.clgId === id);
                                return (
                                    <span
                                        key={id}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[13px]"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <span className="truncate max-w-[180px]">
                                            {match ? match.clgName : id}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => toggle(id)}
                                            className="text-emerald-700 hover:text-rose-600 font-bold leading-none"
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
                                    placeholder="Search by name or ID…"
                                    className="ol-form-control"
                                />
                            </div>
                            <div className="max-h-56 overflow-y-auto divide-y">
                                {filtered.length === 0 ? (
                                    <div className="px-3 py-2 text-[13px] text-gray">No matches.</div>
                                ) : (
                                    filtered.map((c) => (
                                        <label
                                            key={c.clgId}
                                            className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={value.includes(c.clgId)}
                                                onChange={() => toggle(c.clgId)}
                                                className="w-4 h-4 mt-0.5 accent-skin cursor-pointer"
                                            />
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[14px] font-medium text-dark truncate">
                                                    {c.clgName}
                                                </span>
                                                <span className="text-[12px] font-mono text-gray">
                                                    ID: {c.clgId}
                                                </span>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
