import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Assessments from './Assessments';
import QuestionSets from './QuestionSets';
import Questions from './Questions';

const TABS = [
    { key: 'assessments', label: 'Assessments', icon: 'fi-rr-file-edit' },
    { key: 'question-sets', label: 'Question Sets', icon: 'fi-rr-list-check' },
    { key: 'questions', label: 'Questions', icon: 'fi-rr-interrogation' },
];

const VALID_TABS = TABS.map((t) => t.key);

export default function AssessmentIndex() {
    const [params, setParams] = useSearchParams();
    const initialTab = VALID_TABS.includes(params.get('tab')) ? params.get('tab') : 'assessments';
    const [tab, setTab] = useState(initialTab);

    // Keep the URL search param in sync so sidebar deep-links land on the
    // right tab (and a browser back button re-selects the previous one).
    useEffect(() => {
        const fromUrl = VALID_TABS.includes(params.get('tab')) ? params.get('tab') : 'assessments';
        if (fromUrl !== tab) setTab(fromUrl);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params]);

    const switchTab = (key) => {
        setTab(key);
        const next = new URLSearchParams(params);
        if (key === 'assessments') next.delete('tab');
        else next.set('tab', key);
        setParams(next, { replace: true });
    };

    return (
        <div>
            <div className="ol-card rounded-ol-8 mb-3">
                <div className="ol-card-body py-2 px-2">
                    <div className="flex flex-wrap gap-1">
                        {TABS.map((t) => {
                            const active = tab === t.key;
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => switchTab(t.key)}
                                    className={`px-4 py-2 rounded-ol-8 text-[13px] font-semibold flex items-center gap-2 transition-colors ${
                                        active
                                            ? 'bg-lightgreen text-skin'
                                            : 'text-gray hover:bg-lightgreen hover:text-skin'
                                    }`}
                                >
                                    <i className={t.icon} />
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {tab === 'assessments' && <Assessments />}
            {tab === 'question-sets' && <QuestionSets />}
            {tab === 'questions' && <Questions />}
        </div>
    );
}
