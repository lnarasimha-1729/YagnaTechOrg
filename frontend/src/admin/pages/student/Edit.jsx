import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import StudentForm from './StudentForm';
import { getStudent, updateStudent } from '../../api/student';

// Mirrors InstructorEdit — load the student by id, hand the record to the
// shared StudentForm, POST the FormData on submit. The kebab "Edit" action
// in the Manage Students list links here; before this file existed, clicking
// it landed on a blank page because the route wasn't registered.
export default function StudentEdit() {
    const { id } = useParams();
    const nav = useNavigate();
    const [student, setStudent] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;
        getStudent(id)
            .then((r) => { if (alive) setStudent(r.student); })
            .catch((e) => {
                if (alive) {
                    setError(
                        e?.response?.data?.error || e?.message || 'Failed to load student'
                    );
                }
            });
        return () => { alive = false; };
    }, [id]);

    const onSubmit = async (fd) => {
        try {
            await updateStudent(id, fd);
            toast.success('Student updated successfully');
            nav('/admin/students');
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed');
        }
    };

    if (error) return <p className="text-danger p-6">{error}</p>;
    if (!student) return <p className="p-6 text-gray">Loading…</p>;

    return (
        <div>
            <div className="ol-card rounded-ol-8 mb-3">
                <div className="ol-card-body py-12px px-20px my-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h4 className="text-[16px] font-semibold text-dark m-0 flex items-center gap-2">
                            <i className="fi-rr-user" /> Edit Student
                        </h4>
                        <Link to="/admin/students" className="ol-btn-outline-secondary flex items-center gap-10px">
                            <span className="fi-rr-arrow-alt-left" /> <span>Back</span>
                        </Link>
                    </div>
                </div>
            </div>
            <div className="ol-card p-4">
                <h4 className="text-[16px] font-semibold text-dark mb-5">Student Info</h4>
                <div className="ol-card-body">
                    <StudentForm student={student} submitLabel="Update Student" onSubmit={onSubmit} />
                </div>
            </div>
        </div>
    );
}
