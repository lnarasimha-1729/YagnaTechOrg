import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FaPen, FaTrash, FaChevronDown, FaChevronRight, FaSort } from 'react-icons/fa';
import Modal from '../../../components/Modal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { listCurriculum, storeSection, updateSection, deleteSection, deleteLesson } from '../../../api/curriculum';
import SectionForm from '../curriculum/SectionForm';
import LessonTypePicker from '../curriculum/LessonTypePicker';
import LessonAddForm from '../curriculum/LessonAddForm';
import LessonEditForm from '../curriculum/LessonEditForm';
import SectionSort from '../curriculum/SectionSort';
import LessonSort from '../curriculum/LessonSort';
import QuizForm from '../curriculum/QuizForm';
import QuestionList from '../curriculum/QuestionList';

export default function CurriculumTab({ course }) {
    const [sections, setSections] = useState([]);
    const [expanded, setExpanded] = useState(new Set());
    const [modal, setModal] = useState(null);
    const [confirm, setConfirm] = useState(null);

    const load = async () => {
        const r = await listCurriculum(course.id);
        setSections(r.sections);
    };
    useEffect(() => { load(); }, [course.id]);

    const toggle = (id) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const closeModal = () => setModal(null);
    const afterChange = () => { closeModal(); load(); };

    const handleAddSection = async (data) => {
        try {
            await storeSection({ course_id: course.id, title: data.title });
            toast.success('Section added successfully');
            afterChange();
        } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    };

    const handleUpdateSection = async (data) => {
        try {
            await updateSection({ section_id: modal.section.id, up_title: data.title });
            toast.success('Updated successfully');
            afterChange();
        } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    };

    const handleDeleteSection = async (id) => {
        try { await deleteSection(id); toast.success('Delete successfully'); setConfirm(null); load(); }
        catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    };

    const handleDeleteLesson = async (id) => {
        try { await deleteLesson(id); toast.success('Deleted successfully'); setConfirm(null); load(); }
        catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    };

    return (
        <div className="w-full">
            <div className="flex items-center mb-3 flex-wrap gap-2">
                <button className="ol-btn-light ol-btn-sm" onClick={() => setModal({ type: 'add-section' })}>Add section</button>
                {sections.length > 0 && (
                    <>
                        <button className="ol-btn-light ol-btn-sm" onClick={() => setModal({ type: 'lesson-type-picker' })}>Add lesson</button>
                        <button className="ol-btn-light ol-btn-sm" onClick={() => setModal({ type: 'add-quiz' })}>Add quiz</button>
                        <button className="ol-btn-light ol-btn-sm" onClick={() => setModal({ type: 'sort-sections' })}>Sort Section</button>
                    </>
                )}
            </div>

            <ul className="flex flex-col gap-2">
                {sections.length === 0 ? (
                    <li>
                        <button
                            type="button"
                            className="w-full md:w-2/3 mt-4 border-2 border-dashed border-border rounded-ol-12 p-10 text-center hover:border-skin hover:text-skin transition-colors"
                            onClick={() => setModal({ type: 'add-section' })}
                        >
                            <p className="text-[24px] text-gray mb-2">+</p>
                            <h3 className="text-[15px] font-medium text-dark">Add a new Section</h3>
                        </button>
                    </li>
                ) : sections.map((s, i) => (
                    // `group/section` lets the inline controls react to the
                    // ROW's hover (not just their own). The Sort Lessons / Edit
                    // / Delete buttons fade in only when the section is hovered;
                    // the expand chevron stays visible so users can always see
                    // and toggle the open/closed state.
                    <li key={s.id} className="ol-card border border-ebordermuted group/section">
                        <div className="flex items-center justify-between px-4 py-3">
                            <button type="button" className="flex items-center gap-2 flex-grow text-left" onClick={() => toggle(s.id)}>
                                <h4 className="text-[15px] font-semibold text-dark m-0">{i + 1}. {s.title}</h4>
                            </button>
                            <div className="flex items-center gap-2">
                                {s.lessons.length > 0 && (
                                    <button
                                        type="button"
                                        className="ol-btn-outline-secondary ol-btn-sm inline-flex items-center gap-1.5 opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 transition-opacity"
                                        onClick={(e) => { e.stopPropagation(); setModal({ type: 'sort-lessons', section: s }); }}
                                    >
                                        <FaSort className="text-[11px] text-gray-400" />
                                        <span>Sort Lessons</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    title="Edit section"
                                    aria-label={`Edit ${s.title}`}
                                    className="text-gray-400 hover:text-gray-600 px-2 opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 transition-opacity"
                                    onClick={(e) => { e.stopPropagation(); setModal({ type: 'edit-section', section: s }); }}
                                ><FaPen className="text-[13px]" /></button>
                                <button
                                    type="button"
                                    title="Delete section"
                                    aria-label={`Delete ${s.title}`}
                                    className="text-gray-400 hover:text-gray-600 px-2 opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 transition-opacity"
                                    onClick={(e) => { e.stopPropagation(); setConfirm({ kind: 'section', id: s.id, label: s.title }); }}
                                ><FaTrash className="text-[13px]" /></button>
                                {/* Chevron stays visible at rest — it's also a
                                    state indicator (down = open, right = closed). */}
                                <button
                                    type="button"
                                    title={expanded.has(s.id) ? 'Collapse' : 'Expand'}
                                    aria-label={expanded.has(s.id) ? `Collapse ${s.title}` : `Expand ${s.title}`}
                                    aria-expanded={expanded.has(s.id)}
                                    className="text-gray-400 hover:text-gray-600 px-2 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); toggle(s.id); }}
                                >
                                    {expanded.has(s.id)
                                        ? <FaChevronDown className="text-[12px]" />
                                        : <FaChevronRight className="text-[12px]" />}
                                </button>
                            </div>
                        </div>
                        {expanded.has(s.id) && (
                            <ul className="border-t border-ebordermuted">
                                {s.lessons.length === 0 ? (
                                    <li className="px-4 py-3 text-[14px] text-gray">No lessons are available.</li>
                                ) : s.lessons.map((l) => (
                                    // `group/lesson` scopes hover to THIS row only.
                                    // Edit / Delete (and the quiz "Questions" pill)
                                    // fade in when the lesson row is hovered.
                                    <li key={l.id} className="flex items-center justify-between px-4 py-3 border-b border-ebordermuted last:border-b-0 group/lesson">
                                        <h4 className="text-[14px] font-medium text-dark m-0 flex items-center gap-2">
                                            {l.lesson_type === 'quiz' && <span className="text-[11px] uppercase bg-lightgreen/60 text-skin px-2 py-[2px] rounded-ol-8">Quiz</span>}
                                            {l.title}
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            {l.lesson_type === 'quiz' ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        title="Manage questions"
                                                        className="ol-btn-outline-secondary ol-btn-sm opacity-0 group-hover/lesson:opacity-100 focus-visible:opacity-100 transition-opacity"
                                                        onClick={() => setModal({ type: 'questions', quizId: l.id })}
                                                    >Questions</button>
                                                    <button
                                                        type="button"
                                                        title="Edit quiz"
                                                        aria-label={`Edit ${l.title}`}
                                                        className="text-gray-400 hover:text-gray-600 px-2 opacity-0 group-hover/lesson:opacity-100 focus-visible:opacity-100 transition-opacity"
                                                        onClick={() => setModal({ type: 'edit-quiz', quizId: l.id })}
                                                    ><FaPen className="text-[12px]" /></button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    title="Edit lesson"
                                                    aria-label={`Edit ${l.title}`}
                                                    className="text-gray-400 hover:text-gray-600 px-2 opacity-0 group-hover/lesson:opacity-100 focus-visible:opacity-100 transition-opacity"
                                                    onClick={() => setModal({ type: 'edit-lesson', lesson: l })}
                                                ><FaPen className="text-[12px]" /></button>
                                            )}
                                            <button
                                                type="button"
                                                title="Delete lesson"
                                                aria-label={`Delete ${l.title}`}
                                                className="text-gray-400 hover:text-gray-600 px-2 opacity-0 group-hover/lesson:opacity-100 focus-visible:opacity-100 transition-opacity"
                                                onClick={() => setConfirm({ kind: 'lesson', id: l.id, label: l.title })}
                                            ><FaTrash className="text-[12px]" /></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                ))}
            </ul>

            {modal?.type === 'add-section' && (
                <Modal title="Add new section" onClose={closeModal}>
                    <SectionForm onSubmit={handleAddSection} submitLabel="Submit" />
                </Modal>
            )}
            {modal?.type === 'edit-section' && (
                <Modal title="Edit section" onClose={closeModal}>
                    <SectionForm section={modal.section} onSubmit={handleUpdateSection} submitLabel="Update" />
                </Modal>
            )}
            {modal?.type === 'lesson-type-picker' && (
                <Modal title="Add new lesson" onClose={closeModal}>
                    <LessonTypePicker
                        course={course}
                        onNext={(lesson_type) => setModal({ type: 'add-lesson', lesson_type })}
                    />
                </Modal>
            )}
            {modal?.type === 'add-lesson' && (
                <Modal title="Add new lesson" onClose={closeModal} size="lg">
                    <LessonAddForm
                        course={course}
                        sections={sections}
                        lessonType={modal.lesson_type}
                        onDone={() => { toast.success('lesson added successfully'); afterChange(); }}
                    />
                </Modal>
            )}
            {modal?.type === 'edit-lesson' && (
                <Modal title="Edit lesson" onClose={closeModal} size="lg">
                    <LessonEditForm
                        lessonId={modal.lesson.id}
                        sections={sections}
                        onDone={() => { toast.success('lesson update successfully'); afterChange(); }}
                    />
                </Modal>
            )}
            {modal?.type === 'add-quiz' && (
                <Modal title="Add new quiz" onClose={closeModal} size="lg">
                    <QuizForm course={course} sections={sections} onDone={() => { toast.success('Quiz has been created.'); afterChange(); }} />
                </Modal>
            )}
            {modal?.type === 'edit-quiz' && (
                <Modal title="Edit quiz" onClose={closeModal} size="lg">
                    <QuizForm course={course} sections={sections} quizId={modal.quizId} onDone={() => { toast.success('Quiz has been updated.'); afterChange(); }} />
                </Modal>
            )}
            {modal?.type === 'questions' && (
                <Modal title="Quiz questions" onClose={closeModal} size="xl">
                    <QuestionList quizId={modal.quizId} onClose={closeModal} />
                </Modal>
            )}
            {modal?.type === 'sort-sections' && (
                <Modal title="Sort sections" onClose={closeModal}>
                    <SectionSort
                        sections={sections}
                        onDone={() => { toast.success('Sections sorted successfully'); afterChange(); }}
                        onClose={closeModal}
                    />
                </Modal>
            )}
            {modal?.type === 'sort-lessons' && (
                <Modal title="Sort lessons" onClose={closeModal}>
                    <LessonSort
                        section={modal.section}
                        onDone={() => { toast.success('Lessons sorted successfully'); afterChange(); }}
                        onClose={closeModal}
                    />
                </Modal>
            )}

            {confirm && (
                <ConfirmDialog
                    title={`Delete ${confirm.kind}`}
                    message={`Are you sure you want to delete ${confirm.label}?`}
                    onCancel={() => setConfirm(null)}
                    onConfirm={() => confirm.kind === 'section' ? handleDeleteSection(confirm.id) : handleDeleteLesson(confirm.id)}
                />
            )}
        </div>
    );
}
