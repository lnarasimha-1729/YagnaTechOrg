import { useEffect, useMemo, useState } from 'react';
import { listQuestions } from '../../api/assessment';

export default function QuestionSetForm({ initial, onSubmit, submitting, mode = 'create' }) {
    const [setId, setSetId] = useState('');
    const [setName, setSetName] = useState('');
    const [category, setCategory] = useState('');
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [questionBank, setQuestionBank] = useState([]);
    const [bankLoading, setBankLoading] = useState(true);
    const [bankError, setBankError] = useState(null);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!initial) return;
        setSetId(initial.setId || '');
        setSetName(initial.setName || '');
        setCategory(initial.category || '');
        // Backend's GET /question-set/:id returns `questions` as the joined
        // full Question objects (overriding the raw quesId array). Accept
        // either shape — strings (canonical) or {quesId,...} objects — and
        // normalise to an array of quesId strings.
        const rawIds = Array.isArray(initial.questionIds)
            ? initial.questionIds
            : Array.isArray(initial.questions)
            ? initial.questions.map((q) =>
                  typeof q === 'string' ? q : q?.quesId
              ).filter(Boolean)
            : [];
        setSelectedQuestions(rawIds);
    }, [initial]);

    useEffect(() => {
        let alive = true;
        setBankLoading(true);
        listQuestions()
            .then((data) => {
                if (!alive) return;
                setQuestionBank(Array.isArray(data) ? data : []);
            })
            .catch((e) => {
                if (!alive) return;
                setBankError(e?.response?.data?.message || 'Failed to load question bank');
            })
            .finally(() => {
                if (alive) setBankLoading(false);
            });
        return () => { alive = false; };
    }, []);

    const filteredBank = useMemo(() => {
        if (!search.trim()) return questionBank;
        const s = search.toLowerCase();
        return questionBank.filter((q) =>
            q.quesId?.toLowerCase().includes(s) ||
            q.question?.toLowerCase().includes(s) ||
            q.category?.toLowerCase().includes(s)
        );
    }, [questionBank, search]);

    const toggleQuestion = (quesId) => {
        setSelectedQuestions((prev) =>
            prev.includes(quesId) ? prev.filter((id) => id !== quesId) : [...prev, quesId]
        );
    };

    const move = (idx, direction) => {
        const next = [...selectedQuestions];
        const target = idx + direction;
        if (target < 0 || target >= next.length) return;
        [next[idx], next[target]] = [next[target], next[idx]];
        setSelectedQuestions(next);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!setId.trim()) return setError('Set ID is required');
        if (!setName.trim()) return setError('Set name is required');
        if (selectedQuestions.length === 0) return setError('Pick at least one question');

        onSubmit({
            setId: setId.trim(),
            setName: setName.trim(),
            category: category.trim() || null,
            questions: selectedQuestions,
        });
    };

    const questionById = useMemo(() => {
        const m = {};
        questionBank.forEach((q) => { m[q.quesId] = q; });
        return m;
    }, [questionBank]);

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
                <div className="px-3 py-2 rounded bg-red-50 text-red-700 text-[13px]">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-[13px] font-semibold text-dark mb-1">
                        Set ID <span className="text-danger">*</span>
                    </label>
                    <input
                        type="text"
                        className="ol-form-control w-full"
                        placeholder="e.g. QS-AI-PRE"
                        value={setId}
                        onChange={(e) => setSetId(e.target.value)}
                        disabled={mode === 'edit'}
                    />
                </div>
                <div>
                    <label className="block text-[13px] font-semibold text-dark mb-1">
                        Set Name <span className="text-danger">*</span>
                    </label>
                    <input
                        type="text"
                        className="ol-form-control w-full"
                        placeholder="e.g. AI Pre-Assessment Set"
                        value={setName}
                        onChange={(e) => setSetName(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[13px] font-semibold text-dark mb-1">
                        Category
                    </label>
                    <input
                        type="text"
                        className="ol-form-control w-full"
                        placeholder="e.g. AI"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ── Question bank ─────────────────────────────────────────── */}
                <div className="ol-card rounded-ol-8">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                        <h6 className="text-[13px] font-semibold text-dark m-0">
                            Question Bank{' '}
                            <span className="text-muted font-normal">({filteredBank.length})</span>
                        </h6>
                        <input
                            type="search"
                            placeholder="Search…"
                            className="ol-form-control h-[32px] text-[12px] w-[180px]"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="max-h-[360px] overflow-y-auto">
                        {bankLoading && (
                            <p className="px-4 py-6 text-center text-[12px] text-gray m-0">
                                Loading questions…
                            </p>
                        )}
                        {bankError && (
                            <p className="px-4 py-6 text-center text-[12px] text-danger m-0">
                                {bankError}
                            </p>
                        )}
                        {!bankLoading && !bankError && filteredBank.length === 0 && (
                            <p className="px-4 py-6 text-center text-[12px] text-gray m-0">
                                No questions found.
                            </p>
                        )}
                        {!bankLoading && !bankError && filteredBank.map((q) => {
                            const picked = selectedQuestions.includes(q.quesId);
                            return (
                                <label
                                    key={q.quesId}
                                    className={`flex items-start gap-2 px-4 py-2 border-b border-border cursor-pointer text-[12px] ${
                                        picked ? 'bg-emerald-50' : 'hover:bg-gray-50'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        className="mt-1"
                                        checked={picked}
                                        onChange={() => toggleQuestion(q.quesId)}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-semibold text-dark">
                                                {q.quesId}
                                            </span>
                                            {q.category && (
                                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px]">
                                                    {q.category}
                                                </span>
                                            )}
                                            {q.questionSeverity && (
                                                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px]">
                                                    {q.questionSeverity}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray m-0 line-clamp-2">
                                            {q.question}
                                        </p>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                </div>

                {/* ── Selected order ────────────────────────────────────────── */}
                <div className="ol-card rounded-ol-8">
                    <div className="px-4 py-3 border-b border-border">
                        <h6 className="text-[13px] font-semibold text-dark m-0">
                            Selected Questions{' '}
                            <span className="text-muted font-normal">
                                ({selectedQuestions.length})
                            </span>
                        </h6>
                        <p className="text-[11px] text-gray m-0 mt-1">
                            Use the arrows to reorder. Order is preserved.
                        </p>
                    </div>
                    <div className="max-h-[360px] overflow-y-auto">
                        {selectedQuestions.length === 0 && (
                            <p className="px-4 py-6 text-center text-[12px] text-gray m-0">
                                No questions selected yet.
                            </p>
                        )}
                        {selectedQuestions.map((quesId, idx) => {
                            const q = questionById[quesId];
                            return (
                                <div
                                    key={quesId}
                                    className="flex items-start gap-2 px-4 py-2 border-b border-border text-[12px]"
                                >
                                    <span className="font-mono text-gray text-[11px] w-6 pt-1">
                                        {idx + 1}.
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-semibold text-dark">
                                                {quesId}
                                            </span>
                                            {q?.category && (
                                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px]">
                                                    {q.category}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray m-0 line-clamp-2">
                                            {q?.question || '(question not in bank)'}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-1 items-end">
                                        <div className="flex gap-1">
                                            <button
                                                type="button"
                                                className="w-6 h-6 inline-flex items-center justify-center border border-border rounded text-gray hover:text-skin hover:border-skin disabled:opacity-30"
                                                disabled={idx === 0}
                                                onClick={() => move(idx, -1)}
                                                title="Move up"
                                            >
                                                ↑
                                            </button>
                                            <button
                                                type="button"
                                                className="w-6 h-6 inline-flex items-center justify-center border border-border rounded text-gray hover:text-skin hover:border-skin disabled:opacity-30"
                                                disabled={idx === selectedQuestions.length - 1}
                                                onClick={() => move(idx, 1)}
                                                title="Move down"
                                            >
                                                ↓
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            className="text-[11px] text-danger font-semibold"
                                            onClick={() => toggleQuestion(quesId)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <button type="submit" className="ol-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving…' : mode === 'edit' ? 'Update Question Set' : 'Create Question Set'}
                </button>
            </div>
        </form>
    );
}
