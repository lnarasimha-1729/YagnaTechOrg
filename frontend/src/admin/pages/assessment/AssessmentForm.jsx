import { useEffect, useState } from 'react';
import { listQuestionSets } from '../../api/assessment';
import CollegeMultiSelect from '../../components/CollegeMultiSelect';
import CourseMultiSelect from '../../components/CourseMultiSelect';

const STATUS_OPTIONS = ['not-started', 'available', 'in-progress', 'completed', 'expired'];
const TYPE_OPTIONS = ['pre', 'post'];

// Timer is stored as seconds on the backend, but admins think in minutes —
// we accept minutes from the form and convert on submit / display.
export default function AssessmentForm({ initial, onSubmit, submitting, mode = 'create' }) {
    const [assessmentId, setAssessmentId] = useState('');
    const [type, setType] = useState('pre');
    const [setId, setSetId] = useState('');
    const [timerMinutes, setTimerMinutes] = useState(30);
    const [score, setScore] = useState(100);
    const [status, setStatus] = useState('available');
    const [startAt, setStartAt] = useState('');
    // Same audience model as Add New Program: colleges scope the available
    // courses, and the admin picks one or more courses the assessment is
    // bundled with.
    const [selectedClgIds, setSelectedClgIds] = useState([]);
    const [selectedCourseIds, setSelectedCourseIds] = useState([]);

    const [sets, setSets] = useState([]);
    const [setsLoading, setSetsLoading] = useState(true);
    const [setsError, setSetsError] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!initial) return;
        setAssessmentId(initial.assessmentId || '');
        setType(initial.type || 'pre');
        setSetId(initial.setId || '');
        setTimerMinutes(
            initial.timer ? Math.round(Number(initial.timer) / 60) : 30
        );
        setScore(initial.score ?? 100);
        setStatus(initial.status || 'available');
        setSelectedClgIds(
            Array.isArray(initial.clgIds) ? initial.clgIds.map(String) : []
        );
        setSelectedCourseIds(
            Array.isArray(initial.courseIds) ? initial.courseIds.map(String) : []
        );
        // sequelize returns ISO; <input type="datetime-local"> wants YYYY-MM-DDTHH:mm.
        if (initial.startAt) {
            try {
                const d = new Date(initial.startAt);
                const pad = (n) => String(n).padStart(2, '0');
                setStartAt(
                    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                );
            } catch {
                setStartAt('');
            }
        }
    }, [initial]);

    useEffect(() => {
        let alive = true;
        setSetsLoading(true);
        listQuestionSets()
            .then((data) => {
                if (!alive) return;
                setSets(Array.isArray(data) ? data : []);
            })
            .catch((e) => {
                if (!alive) return;
                setSetsError(e?.response?.data?.message || 'Failed to load question sets');
            })
            .finally(() => {
                if (alive) setSetsLoading(false);
            });
        return () => { alive = false; };
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!assessmentId.trim()) return setError('Assessment ID is required');
        if (!TYPE_OPTIONS.includes(type)) return setError('Pick a type');
        if (!setId) return setError('Pick a question set');
        if (selectedClgIds.length === 0) return setError('Pick at least one college');
        if (selectedCourseIds.length === 0) return setError('Pick at least one course');

        const minutes = Number(timerMinutes);
        if (!Number.isFinite(minutes) || minutes <= 0) return setError('Timer must be a positive number of minutes');

        const totalScore = Number(score);
        if (!Number.isFinite(totalScore) || totalScore <= 0) return setError('Score must be a positive number');

        onSubmit({
            assessmentId: assessmentId.trim(),
            type,
            setId,
            timer: Math.round(minutes * 60),
            score: totalScore,
            status,
            startAt: startAt ? new Date(startAt).toISOString() : null,
            clgIds: selectedClgIds,
            courseIds: selectedCourseIds,
        });
    };

    const selectedSet = sets.find((s) => s.setId === setId);

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
                        Assessment ID <span className="text-danger">*</span>
                    </label>
                    <input
                        type="text"
                        className="ol-form-control w-full"
                        placeholder="e.g. A3"
                        value={assessmentId}
                        onChange={(e) => setAssessmentId(e.target.value)}
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
                        Type <span className="text-danger">*</span>
                    </label>
                    <select
                        className="ol-form-control w-full"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                    >
                        {TYPE_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                                {t === 'pre' ? 'Pre-assessment' : 'Post-assessment'}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-[13px] font-semibold text-dark mb-1">
                    Question Set <span className="text-danger">*</span>
                </label>
                {setsLoading ? (
                    <p className="text-[12px] text-gray">Loading question sets…</p>
                ) : setsError ? (
                    <p className="text-[12px] text-danger">{setsError}</p>
                ) : (
                    <select
                        className="ol-form-control w-full"
                        value={setId}
                        onChange={(e) => setSetId(e.target.value)}
                    >
                        <option value="">— Select a question set —</option>
                        {sets.map((qs) => (
                            <option key={qs.setId} value={qs.setId}>
                                {qs.setId} — {qs.setName}
                                {Array.isArray(qs.questions) ? ` (${qs.questions.length} questions)` : ''}
                            </option>
                        ))}
                    </select>
                )}
                {selectedSet && (
                    <p className="text-[11px] text-gray mt-1">
                        {selectedSet.setName} contains{' '}
                        {Array.isArray(selectedSet.questions) ? selectedSet.questions.length : 0}{' '}
                        question(s).
                    </p>
                )}
            </div>

            {/* Audience: which colleges/courses this assessment belongs to. */}
            <div>
                <CollegeMultiSelect
                    value={selectedClgIds}
                    onChange={setSelectedClgIds}
                    required
                />
            </div>

            <div>
                <CourseMultiSelect
                    value={selectedCourseIds}
                    onChange={setSelectedCourseIds}
                    clgIds={selectedClgIds}
                    required
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-[13px] font-semibold text-dark mb-1">
                        Timer (minutes) <span className="text-danger">*</span>
                    </label>
                    <input
                        type="number"
                        min="1"
                        step="1"
                        className="ol-form-control w-full"
                        value={timerMinutes}
                        onChange={(e) => setTimerMinutes(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[13px] font-semibold text-dark mb-1">
                        Total Score <span className="text-danger">*</span>
                    </label>
                    <input
                        type="number"
                        min="1"
                        step="1"
                        className="ol-form-control w-full"
                        value={score}
                        onChange={(e) => setScore(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[13px] font-semibold text-dark mb-1">
                        Status
                    </label>
                    <select
                        className="ol-form-control w-full"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-[13px] font-semibold text-dark mb-1">
                    Scheduled Start (optional)
                </label>
                <input
                    type="datetime-local"
                    className="ol-form-control w-full md:w-1/2"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                />
                <p className="text-[11px] text-gray mt-1">
                    Leave blank if the assessment is open immediately.
                </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <button type="submit" className="ol-btn-primary" disabled={submitting}>
                    {submitting
                        ? 'Saving…'
                        : mode === 'edit'
                        ? 'Update Assessment'
                        : 'Create Assessment'}
                </button>
            </div>
        </form>
    );
}
