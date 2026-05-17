import { useState } from 'react';
import { Link } from 'react-router-dom';

const VIDEO_TYPES = ['video-url', 'system-video', 'vimeo-url', 'html5', 'google_drive'];

// The lesson-type icon shown inside the tile. Video lessons use a camera glyph;
// quizzes (and any non-video / document) use the file glyph.
const TypeIcon = ({ type }) => {
    if (VIDEO_TYPES.includes(type)) return <i className="fa fa-video" />;
    if (type === 'image') return <i className="fa fa-image" />;
    // quiz, text, document, anything else → file glyph (matches the
    // round gray badge in the design).
    return <i className="fa fa-file" />;
};

// Video lessons sit in a rounded SQUARE tile; everything else (quizzes,
// documents…) sits in a ROUND tile, matching the approved design.
const isVideoType = (type) => VIDEO_TYPES.includes(type);

const PLAY_BASE = '/courses/programs/course-details/play';

export default function PlayerSidebar({ course, currentLessonId, completedIds, lockedIds, progress, completedCount }) {
    const [openSections, setOpenSections] = useState(() => {
        const m = {};
        course.sections.forEach((s) => {
            m[s.id] = s.lessons.some((l) => l.id === currentLessonId);
        });
        if (Object.values(m).every((v) => !v) && course.sections[0]) m[course.sections[0].id] = true;
        return m;
    });

    const toggle = (sid) => setOpenSections((m) => ({ ...m, [sid]: !m[sid] }));

    return (
        <aside className="bg-white border border-gray-200 rounded-xl overflow-hidden text-gray-900 shadow-[0_4px_40px_rgba(0,0,0,0.08)]">
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-[15px] font-semibold mb-2 text-gray-900">Course curriculum</h2>
                <p className="text-[12px] text-gray-600 text-center">
                    {progress}% Completed ({completedCount}/{course.lesson_count})
                </p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-skin transition-all" style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                {course.sections.map((section) => {
                    const isOpen = openSections[section.id];
                    return (
                        <div key={section.id} className="border-b border-gray-200">
                            <button
                                type="button"
                                onClick={() => toggle(section.id)}
                                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                            >
                                <span className="font-semibold text-[15px] text-skin">{section.title}</span>
                                <i className={`fa fa-chevron-up text-[12px] text-gray-500 transition-transform ${isOpen ? '' : 'rotate-180'}`} />
                            </button>
                            {isOpen && (
                                <ul className="bg-white pb-2">
                                    {section.lessons.map((lesson) => {
                                        const isCurrent = lesson.id === currentLessonId;
                                        const isCompleted = completedIds.includes(lesson.id);
                                        const isLocked = lockedIds.includes(lesson.id);

                                        // Active row is a full teal pill with white content; inactive
                                        // rows are normal text with a muted icon tile. Locked items
                                        // are dimmed and non-clickable.
                                        const rowCls = isCurrent
                                            ? 'bg-skin text-white rounded-lg'
                                            : isLocked
                                                ? 'text-gray-400 cursor-not-allowed pointer-events-none'
                                                : 'text-gray-500 hover:bg-gray-100 rounded-lg';
                                        // Video → rounded square; everything else (quiz, document) → round.
                                        const tileShape = isVideoType(lesson.lesson_type) ? 'rounded-md' : 'rounded-full';
                                        const tileCls = isCurrent
                                            ? 'bg-white/20 text-white'
                                            : 'bg-gray-100 text-gray-400';
                                        const durationCls = isCurrent ? 'text-white/90' : 'text-gray-400';

                                        return (
                                            <li key={lesson.id} className="px-2 py-0.5">
                                                <Link
                                                    to={`${PLAY_BASE}/${course.slug}/${lesson.id}`}
                                                    className={`flex items-center gap-3 px-3 py-2 text-[13px] transition-colors ${rowCls}`}
                                                >
                                                    {/* Left: completion indicator (circle check) */}
                                                    <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                                        {isLocked ? (
                                                            <i className="fa fa-lock text-amber-500 text-[14px]" title="Locked" />
                                                        ) : isCompleted ? (
                                                            <span
                                                                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                                                    isCurrent
                                                                        ? 'border-2 border-white text-white'
                                                                        : 'bg-skin text-white'
                                                                }`}
                                                                title="Completed"
                                                            >
                                                                <i className="fa fa-check text-[10px]" />
                                                            </span>
                                                        ) : (
                                                            <span
                                                                className={`w-5 h-5 rounded-full border-2 ${
                                                                    isCurrent ? 'border-white/70' : 'border-gray-300'
                                                                }`}
                                                                title="Not watched yet"
                                                            />
                                                        )}
                                                    </span>

                                                    {/* Square icon tile (video / quiz / file) */}
                                                    <span className={`w-7 h-7 flex-shrink-0 flex items-center justify-center ${tileShape} ${tileCls}`}>
                                                        <TypeIcon type={lesson.lesson_type} />
                                                    </span>

                                                    {/* Title */}
                                                    <span className="flex-1 truncate font-bold">{lesson.title}</span>

                                                    {/* Right-aligned duration */}
                                                    {lesson.duration && lesson.duration !== '00:00:00' && (
                                                        <span className={`text-[12px] flex-shrink-0 tabular-nums font-bold ${durationCls}`}>
                                                            {lesson.duration}
                                                        </span>
                                                    )}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
