import { useEffect, useState } from 'react';

const SEVERITY_OPTIONS = ['easy', 'medium', 'hard'];
const OPTION_KEYS = ['option1', 'option2', 'option3', 'option4'];

const emptyOptions = () => ({ option1: '', option2: '', option3: '', option4: '' });

export default function QuestionForm({ initial, onSubmit, submitting, mode = 'create' }) {
    const [quesId, setQuesId] = useState('');
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(emptyOptions);
    const [correctAns, setCorrectAns] = useState('option1');
    const [category, setCategory] = useState('');
    const [questionSeverity, setQuestionSeverity] = useState('easy');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!initial) return;
        setQuesId(initial.quesId || '');
        setQuestion(initial.question || '');
        setOptions({ ...emptyOptions(), ...(initial.options || {}) });
        setCorrectAns(initial.correctAns || 'option1');
        setCategory(initial.category || '');
        setQuestionSeverity(initial.questionSeverity || 'easy');
    }, [initial]);

    const handleOptionChange = (key, value) => {
        setOptions((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!quesId.trim()) return setError('Question ID is required');
        if (!question.trim()) return setError('Question text is required');
        for (const k of OPTION_KEYS) {
            if (!options[k]?.trim()) return setError(`All four options are required (${k} is empty)`);
        }
        if (!OPTION_KEYS.includes(correctAns)) return setError('Pick a correct answer');

        const payload = {
            quesId: quesId.trim(),
            question: question.trim(),
            options,
            correctAns,
            category: category.trim() || null,
            questionSeverity,
        };

        onSubmit(payload);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
                <div className="px-3 py-2 rounded bg-red-50 text-red-700 text-[13px]">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[13px] font-semibold text-dark mb-1">
                        Question ID <span className="text-danger">*</span>
                    </label>
                    <input
                        type="text"
                        className="ol-form-control w-full"
                        placeholder="e.g. Q41"
                        value={quesId}
                        onChange={(e) => setQuesId(e.target.value)}
                        disabled={mode === 'edit'}
                    />
                    {mode === 'edit' && (
                        <p className="text-[11px] text-gray mt-1">
                            ID cannot be changed after creation.
                        </p>
                    )}
                </div>
                <div>
                    <label className="block text-[13px] font-semibold text-dark mb-1">
                        Category
                    </label>
                    <input
                        type="text"
                        className="ol-form-control w-full"
                        placeholder="e.g. AI, ML, NLP"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    />
                </div>
            </div>

            <div>
                <label className="block text-[13px] font-semibold text-dark mb-1">
                    Question <span className="text-danger">*</span>
                </label>
                <textarea
                    className="ol-form-control w-full"
                    rows={3}
                    placeholder="What does AI stand for?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                />
            </div>

            <div>
                <label className="block text-[13px] font-semibold text-dark mb-2">
                    Options <span className="text-danger">*</span>
                </label>
                <div className="space-y-2">
                    {OPTION_KEYS.map((key, idx) => (
                        <div key={key} className="flex items-start gap-3">
                            <label className="flex items-center gap-2 pt-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="correctAns"
                                    value={key}
                                    checked={correctAns === key}
                                    onChange={() => setCorrectAns(key)}
                                />
                                <span className="text-[12px] font-semibold text-gray w-16">
                                    {String.fromCharCode(65 + idx)}.
                                </span>
                            </label>
                            <input
                                type="text"
                                className="ol-form-control flex-1"
                                placeholder={`Option ${idx + 1}`}
                                value={options[key]}
                                onChange={(e) => handleOptionChange(key, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
                <p className="text-[11px] text-gray mt-2">
                    Select the radio next to the correct option.
                </p>
            </div>

            <div>
                <label className="block text-[13px] font-semibold text-dark mb-1">
                    Severity
                </label>
                <select
                    className="ol-form-control w-full md:w-1/3"
                    value={questionSeverity}
                    onChange={(e) => setQuestionSeverity(e.target.value)}
                >
                    {SEVERITY_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <button
                    type="submit"
                    className="ol-btn-primary"
                    disabled={submitting}
                >
                    {submitting ? 'Saving…' : mode === 'edit' ? 'Update Question' : 'Create Question'}
                </button>
            </div>
        </form>
    );
}
