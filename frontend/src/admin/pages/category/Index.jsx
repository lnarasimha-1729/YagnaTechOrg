import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { FaPen, FaTrash } from 'react-icons/fa';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import CategoryForm from './CategoryForm';
import { listCategories, storeCategory, updateCategory, deleteCategory } from '../../api/category';
import { useCollege } from '@/hooks/useCollege';

const API = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:4000';

// Max chips to show inline before collapsing the rest into a "+N more" pill.
const MAX_VISIBLE_COLLEGES = 2;

// Renders the colleges assigned to a category as chips. Resolves clgId ->
// clgName via the colleges map; falls back to the raw id when a name is not
// available (college deleted, or list still loading).
function CollegeChips({ clgIds, nameById }) {
    const ids = Array.isArray(clgIds) ? clgIds.filter(Boolean) : [];
    if (ids.length === 0) {
        return <span className="text-[11px] text-muted">No colleges assigned</span>;
    }
    const visible = ids.slice(0, MAX_VISIBLE_COLLEGES);
    const hiddenCount = ids.length - visible.length;
    const hiddenLabel = ids
        .slice(MAX_VISIBLE_COLLEGES)
        .map((id) => nameById[id] || id)
        .join(', ');

    return (
        <div className="flex flex-wrap items-center gap-1">
            {visible.map((id) => (
                <span
                    key={id}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] max-w-[120px] truncate"
                    title={nameById[id] || id}
                >
                    {nameById[id] || id}
                </span>
            ))}
            {hiddenCount > 0 && (
                <span
                    className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[11px]"
                    title={hiddenLabel}
                >
                    +{hiddenCount} more
                </span>
            )}
        </div>
    );
}

export default function CategoryIndex() {
    const [categories, setCategories] = useState([]);
    const [modal, setModal] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const { colleges } = useCollege();

    const collegeNameById = useMemo(() => {
        const map = {};
        (colleges || []).forEach((c) => { map[c.clgId] = c.clgName; });
        return map;
    }, [colleges]);

    const [collegeQuery, setCollegeQuery] = useState('');

    const load = async () => {
        const { categories } = await listCategories();
        setCategories(categories);
    };

    useEffect(() => { load(); }, []);

    // Filter categories by the colleges assigned to them. We match against
    // both the resolved college name and the raw clgId so the admin can
    // search either way. Empty query => show everything.
    const filteredCategories = useMemo(() => {
        const q = collegeQuery.trim().toLowerCase();
        if (!q) return categories;
        return categories.filter((cat) => {
            const ids = Array.isArray(cat.clg_ids) ? cat.clg_ids : [];
            return ids.some((id) => {
                const name = collegeNameById[id] || '';
                return id.toLowerCase().includes(q) || name.toLowerCase().includes(q);
            });
        });
    }, [categories, collegeQuery, collegeNameById]);

    const handleStore = async (fd) => {
        try { await storeCategory(fd); toast.success('Category added successfully'); setModal(null); load(); }
        catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    };

    const handleUpdate = async (id, fd) => {
        try { await updateCategory(id, fd); toast.success('Category updated successfully'); setModal(null); load(); }
        catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    };

    const handleDelete = async (id) => {
        try { await deleteCategory(id); toast.success('Category deleted successfully'); setConfirm(null); load(); }
        catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    };

    return (
        <div>
            <div className="ol-card rounded-ol-8 mb-3">
                <div className="ol-card-body py-12px px-20px my-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h4 className="text-[16px] font-semibold text-dark m-0 flex items-center gap-2">
                            <i className="fi-rr-settings-sliders" />
                            All Category{' '}
                            <span className="text-muted font-normal">
                                ({filteredCategories.length}
                                {collegeQuery.trim() ? ` / ${categories.length}` : ''})
                            </span>
                        </h4>
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={collegeQuery}
                                    onChange={(e) => setCollegeQuery(e.target.value)}
                                    placeholder="Filter by college…"
                                    className="ol-form-control pr-7 min-w-[220px]"
                                    aria-label="Filter categories by assigned college"
                                />
                                {collegeQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setCollegeQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray hover:text-danger text-[14px] leading-none"
                                        title="Clear"
                                        aria-label="Clear college filter"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                            <button className="ol-btn-outline-secondary flex items-center gap-10px" onClick={() => setModal({ type: 'create', parentId: null })}>
                                <span className="fi-rr-plus" />
                                <span>Add new category</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {filteredCategories.length === 0 && (
                <div className="ol-card rounded-ol-8">
                    <div className="ol-card-body py-10 px-6 text-center">
                        <p className="text-[14px] text-gray m-0">
                            {collegeQuery.trim()
                                ? `No categories assigned to a college matching "${collegeQuery.trim()}".`
                                : 'No categories yet.'}
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredCategories.map((cat) => (
                    <div key={cat.id} className="category-card ol-card rounded-ol-10 h-full">
                        {/* Fixed image area. The thumbnail is contained within
                            this box (object-contain) so it never stretches the
                            card; when absent we show a "No Image" placeholder
                            occupying exactly the same space. */}
                        <div className="w-full h-[180px] bg-gray-100 rounded-t-ol-10 flex items-center justify-center overflow-hidden">
                            {cat.thumbnail ? (
                                <img
                                    className="max-w-full max-h-full object-contain"
                                    src={`${API}/${cat.thumbnail}`}
                                    alt={cat.title}
                                />
                            ) : (
                                <span className="text-gray-400 text-2xl font-semibold select-none">
                                    No Image
                                </span>
                            )}
                        </div>
                        <h6 className="text-[14px] font-semibold text-dark mb-2 flex items-center px-3 pt-3 m-0">
                            <i className={`${cat.icon} mr-1`} />
                            <span className="truncate">{cat.title}</span>
                            <span className="text-muted font-normal ml-2">({cat.childs?.length || 0})</span>
                            {/* Edit / Delete sit immediately after the title (and the child-count
                                pill) on the same row. Using react-icons/fa instead of the project's
                                "fi fi-rr-*" classes — those reference Flowbite Uicons which is not
                                imported anywhere, so every <i className="fi fi-rr-..."/> across the
                                admin renders an empty box. react-icons is already a dependency. */}
                            <span className="ml-auto inline-flex items-center gap-2">
                                <button
                                    type="button"
                                    className="text-gray hover:text-skin px-1"
                                    onClick={() => setModal({ type: 'edit', data: cat })}
                                    title="Edit category"
                                    aria-label={`Edit ${cat.title}`}
                                >
                                    <FaPen className="text-[13px]" />
                                </button>
                                <button
                                    type="button"
                                    className="text-gray hover:text-danger px-1"
                                    onClick={() => setConfirm(cat.id)}
                                    title="Delete category"
                                    aria-label={`Delete ${cat.title}`}
                                >
                                    <FaTrash className="text-[13px]" />
                                </button>
                            </span>
                        </h6>
                        {/* Colleges assigned to this category. Collapses to
                            "+N more" past MAX_VISIBLE_COLLEGES. */}
                        <div className="px-3 pb-2">
                            <CollegeChips clgIds={cat.clg_ids} nameById={collegeNameById} />
                        </div>
                        <div className="ol-card-body py-0 px-0">
                            <ul className="divide-y divide-ebordermuted list-none m-0 p-0">
                                {cat.childs?.map((ch) => (
                                    <li key={ch.id} className="flex items-center px-4 py-2 text-gray text-[13px] group/li">
                                        <div className="flex items-center gap-2">
                                            <i className={ch.icon} />
                                            <span className="text-[12px]">{ch.title}</span>
                                        </div>
                                        <div className="subcategory-actions ml-auto items-center gap-2 hidden group-hover/li:inline-flex">
                                            <button className="text-gray hover:text-skin px-1 mx-1" onClick={() => setModal({ type: 'edit', data: ch })} title="Edit">
                                                <FaPen className="text-[12px]" />
                                            </button>
                                            <button className="text-gray hover:text-danger px-1 mx-1" onClick={() => setConfirm(ch.id)} title="Delete">
                                                <FaTrash className="text-[12px]" />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>

            {modal?.type === 'create' && (
                <Modal title="Add new category" onClose={() => setModal(null)}>
                    <CategoryForm hiddenParentId={modal.parentId} onSubmit={handleStore} />
                </Modal>
            )}
            {modal?.type === 'edit' && (
                <Modal title="Edit category" onClose={() => setModal(null)}>
                    <CategoryForm
                        initial={modal.data}
                        parents={categories.filter((c) => c.id !== modal.data.id)}
                        onSubmit={(fd) => handleUpdate(modal.data.id, fd)}
                    />
                </Modal>
            )}
            {confirm && (
                <ConfirmDialog
                    message="Delete this category?"
                    onCancel={() => setConfirm(null)}
                    onConfirm={() => handleDelete(confirm)}
                />
            )}
        </div>
    );
}
