import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FaTrash } from 'react-icons/fa';
import {
    listLanguages,
    storeLanguage,
    updateLanguageDirection,
    deleteLanguage,
} from '../../api/language';

const TABS = [
    { key: 'list', label: 'Language list' },
    { key: 'add', label: 'Add Language' },
];

export default function ManageLanguagePage() {
    const [tab, setTab] = useState('list');
    const [languages, setLanguages] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const { languages } = await listLanguages();
            setLanguages(languages || []);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed to load languages');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleDirectionChange = async (id, direction) => {
        const prev = languages;
        setLanguages((ls) => ls.map((l) => (l.id === id ? { ...l, direction } : l)));
        try {
            await updateLanguageDirection(id, direction);
        } catch (e) {
            setLanguages(prev);
            toast.error(e.response?.data?.error || 'Failed to update direction');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this language?')) return;
        try {
            await deleteLanguage(id);
            toast.success('Language deleted');
            load();
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed to delete');
        }
    };

    return (
        <div>
            <div className="ol-card rounded-ol-8 mb-3">
                <div className="ol-card-body py-12px px-20px my-3">
                    <h4 className="text-[16px] font-semibold text-dark m-0 flex items-center gap-2">
                        <i className="fi-rr-settings-sliders" />
                        Manage Language
                    </h4>
                </div>
            </div>

            <div className="ol-card rounded-ol-8">
                <div className="border-b border-ebordermuted px-5 pt-4">
                    <div className="flex items-center gap-6">
                        {TABS.map((t) => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setTab(t.key)}
                                className={`relative pb-3 text-[14px] font-semibold transition-colors ${
                                    tab === t.key ? 'text-skin' : 'text-gray hover:text-dark'
                                }`}
                            >
                                {t.label}
                                {tab === t.key && (
                                    <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-skin rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-5">
                    {tab === 'list' && (
                        <LanguageList
                            languages={languages}
                            loading={loading}
                            onChangeDirection={handleDirectionChange}
                            onDelete={handleDelete}
                        />
                    )}
                    {tab === 'add' && (
                        <AddLanguageForm
                            onCreated={() => {
                                load();
                                setTab('list');
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

function LanguageList({ languages, loading, onChangeDirection, onDelete }) {
    if (loading && languages.length === 0) {
        return <p className="text-[14px] text-gray m-0">Loading…</p>;
    }
    if (!loading && languages.length === 0) {
        return <p className="text-[14px] text-gray m-0">No languages yet.</p>;
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-1/2 text-left">
                <thead>
                    <tr className="border-b border-ebordermuted">
                        <th className="py-3 pr-4 text-[13px] font-semibold text-dark w-[120px]">
                            Serial Number
                        </th>
                        <th className="py-3 pr-4 text-[13px] font-semibold text-dark">
                            Language
                        </th>
                        <th className="py-3 pr-4 text-[13px] font-semibold text-dark w-[200px]">
                            Direction
                        </th>
                        <th className="py-3 pr-4 text-[13px] font-semibold text-dark w-[120px]">
                            Option
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {languages.map((l, idx) => (
                        <tr key={l.id} className="border-b border-ebordermuted last:border-b-0">
                            <td className="py-3 pr-4 text-[13px] text-gray">{idx + 1}</td>
                            <td className="py-3 pr-4 text-[13px] text-dark font-medium">
                                {l.name}
                                {l.is_default && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px]">
                                        default
                                    </span>
                                )}
                            </td>
                            <td className="py-3 pr-4">
                                <label className="inline-flex items-center gap-2 mr-4 text-[13px] text-dark">
                                    <input
                                        type="radio"
                                        name={`dir-${l.id}`}
                                        value="ltr"
                                        checked={l.direction === 'ltr'}
                                        onChange={() => onChangeDirection(l.id, 'ltr')}
                                    />
                                    LTR
                                </label>
                                <label className="inline-flex items-center gap-2 text-[13px] text-dark">
                                    <input
                                        type="radio"
                                        name={`dir-${l.id}`}
                                        value="rtl"
                                        checked={l.direction === 'rtl'}
                                        onChange={() => onChangeDirection(l.id, 'rtl')}
                                    />
                                    RTL
                                </label>
                            </td>
                            <td className="py-3 pr-4">
                                {l.is_default ? (
                                    <span className="text-[12px] text-gray">—</span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onDelete(l.id)}
                                        className="inline-flex items-center gap-1 text-danger hover:text-red-700 text-[13px]"
                                        title="Delete language"
                                    >
                                        <FaTrash className="text-[12px]" />
                                        <span>Delete</span>
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function AddLanguageForm({ onCreated }) {
    const [name, setName] = useState('');
    const [direction, setDirection] = useState('ltr');
    const [submitting, setSubmitting] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Language name is required');
            return;
        }
        setSubmitting(true);
        try {
            await storeLanguage({ name: name.trim(), direction });
            toast.success('Language added');
            setName('');
            setDirection('ltr');
            onCreated?.();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add language');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={onSubmit} className="max-w-[520px] flex flex-col gap-4">
            <div>
                <label className="block text-[13px] font-semibold text-dark mb-1">
                    Language name <span className="text-danger">*</span>
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="ol-form-control w-full"
                    placeholder="e.g. English"
                />
            </div>

            <div>
                <label className="block text-[13px] font-semibold text-dark mb-2">
                    Direction
                </label>
                <div className="flex items-center gap-6">
                    <label className="inline-flex items-center gap-2 text-[13px] text-dark">
                        <input
                            type="radio"
                            name="new-direction"
                            value="ltr"
                            checked={direction === 'ltr'}
                            onChange={() => setDirection('ltr')}
                        />
                        LTR
                    </label>
                    <label className="inline-flex items-center gap-2 text-[13px] text-dark">
                        <input
                            type="radio"
                            name="new-direction"
                            value="rtl"
                            checked={direction === 'rtl'}
                            onChange={() => setDirection('rtl')}
                        />
                        RTL
                    </label>
                </div>
            </div>

            <div>
                <button
                    type="submit"
                    disabled={submitting}
                    className="ol-btn-outline-secondary disabled:opacity-50"
                >
                    {submitting ? 'Adding…' : 'Add Language'}
                </button>
            </div>
        </form>
    );
}
