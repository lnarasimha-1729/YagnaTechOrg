import { useEffect, useMemo, useRef, useState } from 'react';
import { useCollege } from '@/hooks/useCollege';

export default function CategoryForm({ initial = {}, parents = [], hiddenParentId, onSubmit }) {
    const [form, setForm] = useState({
        title: initial.title || '',
        icon: initial.icon || '',
        keywords: initial.keywords || '',
        description: initial.description || '',
        parent_id: initial.parent_id ?? 0,
    });
    const [files, setFiles] = useState({});

    const { colleges, loading: collegesLoading, error: collegesError, refresh: refreshColleges } = useCollege();
    const [selectedClgIds, setSelectedClgIds] = useState(
        Array.isArray(initial.clg_ids) ? initial.clg_ids : [],
    );
    const [collegeOpen, setCollegeOpen] = useState(false);
    const [collegeSearch, setCollegeSearch] = useState('');
    const collegeBoxRef = useRef(null);

    // Close the colleges dropdown when clicking outside its container.
    useEffect(() => {
        if (!collegeOpen) return;
        const onDocClick = (e) => {
            if (!collegeBoxRef.current) return;
            if (!collegeBoxRef.current.contains(e.target)) setCollegeOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [collegeOpen]);

    const filteredColleges = useMemo(() => {
        const q = collegeSearch.trim().toLowerCase();
        if (!q) return colleges;
        return colleges.filter(
            (c) => c.clgName.toLowerCase().includes(q) || c.clgId.toLowerCase().includes(q),
        );
    }, [colleges, collegeSearch]);

    const toggleCollege = (clgId) => {
        setSelectedClgIds((ids) =>
            ids.includes(clgId) ? ids.filter((x) => x !== clgId) : [...ids, clgId],
        );
    };

    const handle = (e) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
    const handleFile = (e) => setFiles((s) => ({ ...s, [e.target.name]: e.target.files[0] }));

    const submit = (e) => {
        e.preventDefault();
        if (selectedClgIds.length === 0) {
            alert('Select at least one college');
            return;
        }
        const fd = new FormData();
        const parentId = hiddenParentId !== undefined ? hiddenParentId : form.parent_id;
        if (parentId) fd.append('parent_id', parentId);
        fd.append('title', form.title);
        fd.append('icon', form.icon);
        fd.append('keywords', form.keywords);
        fd.append('description', form.description);
        selectedClgIds.forEach((id) => fd.append('clgIds[]', id));
        if (files.thumbnail) fd.append('thumbnail', files.thumbnail);
        if (files.category_logo) fd.append('category_logo', files.category_logo);
        onSubmit(fd);
    };

    return (
        <form onSubmit={submit} encType="multipart/form-data">
            {hiddenParentId === undefined && parents.length > 0 && (
                <div className="mb-3">
                    <label className="ol-form-label">Parent category</label>
                    <select className="ol-form-control" name="parent_id" value={form.parent_id} onChange={handle}>
                        <option value="0">- Mark it as parent -</option>
                        {parents.map((p) => (
                            <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                    </select>
                </div>
            )}
            <div className="grid grid-cols-1 gap-0">
                <div className="mb-3">
                    <label className="ol-form-label">Category Name<span className="text-danger ml-1">*</span></label>
                    <input className="ol-form-control" name="title" value={form.title} onChange={handle} placeholder="Enter your category name" required />
                </div>
                <div className="mb-3">
                    <label className="ol-form-label">Pick Your Icon</label>
                    <input className="ol-form-control" name="icon" value={form.icon} onChange={handle} placeholder="Pick your category icon" />
                </div>

                {/* Colleges multi-select dropdown */}
                <div className="mb-3">
                    <label className="ol-form-label">
                        Colleges<span className="text-danger ml-1">*</span>
                    </label>

                    {collegesLoading ? (
                        <div className="text-[13px] text-gray">Loading colleges…</div>
                    ) : collegesError ? (
                        <div className="text-[13px] text-danger">
                            {collegesError}{' '}
                            {refreshColleges && (
                                <button
                                    type="button"
                                    onClick={() => refreshColleges()}
                                    className="text-skin underline ml-1"
                                >
                                    Retry
                                </button>
                            )}
                        </div>
                    ) : colleges.length === 0 ? (
                        <div className="text-[13px] text-gray">
                            No colleges available. Add a college first.
                        </div>
                    ) : (
                        <div className="relative" ref={collegeBoxRef}>
                            {/* Trigger box renders selected chips inline (like a standard
                                multi-select). Clicking the box (anywhere not on a chip's ×)
                                opens the dropdown panel. */}
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setCollegeOpen((o) => !o)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setCollegeOpen((o) => !o);
                                    }
                                }}
                                className="ol-form-control flex flex-wrap items-center gap-1.5 min-h-[42px] cursor-pointer"
                                aria-haspopup="listbox"
                                aria-expanded={collegeOpen}
                            >
                                {selectedClgIds.length === 0 ? (
                                    <span className="text-[14px] text-gray">Select colleges…</span>
                                ) : (
                                    selectedClgIds.map((id) => {
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
                                                    onClick={() => toggleCollege(id)}
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
                                    className={`w-4 h-4 ml-auto text-gray transition-transform ${collegeOpen ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>

                            {collegeOpen && (
                                <div className="absolute z-20 mt-1 w-full bg-white border rounded-md shadow-lg">
                                    <div className="p-2 border-b">
                                        <input
                                            type="text"
                                            value={collegeSearch}
                                            onChange={(e) => setCollegeSearch(e.target.value)}
                                            placeholder="Search by name or ID…"
                                            className="ol-form-control"
                                        />
                                    </div>
                                    <div className="max-h-56 overflow-y-auto divide-y">
                                        {filteredColleges.length === 0 ? (
                                            <div className="px-3 py-2 text-[13px] text-gray">No matches.</div>
                                        ) : (
                                            filteredColleges.map((c) => (
                                                <label
                                                    key={c.clgId}
                                                    className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedClgIds.includes(c.clgId)}
                                                        onChange={() => toggleCollege(c.clgId)}
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

                <div className="mb-3">
                    <label className="ol-form-label">Keywords <small className="text-muted font-normal">(optional)</small></label>
                    <input className="ol-form-control" name="keywords" value={form.keywords} onChange={handle} placeholder="Enter your Keywords" />
                </div>
                <div className="mb-3">
                    <label className="ol-form-label">Category Description <small className="text-muted font-normal">(optional)</small></label>
                    <textarea className="ol-form-control" name="description" value={form.description} onChange={handle} rows="4" placeholder="Enter your description" />
                </div>
                <div className="mb-3">
                    <label className="ol-form-label">Thumbnail <small className="text-muted font-normal">(optional)</small></label>
                    <input className="ol-form-control file:mr-3 file:rounded file:border-0 file:bg-lightgreen file:px-3 file:py-1.5 file:text-skin file:text-[13px]" type="file" name="thumbnail" accept="image/*" onChange={handleFile} />
                </div>
                <div className="mb-4">
                    <label className="ol-form-label">Category logo <small className="text-muted font-normal">(optional)</small></label>
                    <input className="ol-form-control file:mr-3 file:rounded file:border-0 file:bg-lightgreen file:px-3 file:py-1.5 file:text-skin file:text-[13px]" type="file" name="category_logo" accept="image/*" onChange={handleFile} />
                </div>
                <div>
                    <button className="ol-btn-primary">Submit</button>
                </div>
            </div>
        </form>
    );
}
