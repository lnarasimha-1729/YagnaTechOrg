import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import InstructorForm from './InstructorForm';
import { getInstructor, updateInstructor } from '../../api/instructor';

export default function InstructorEdit() {
    const { id } = useParams();
    const nav = useNavigate();
    const [instr, setInstr] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;
        getInstructor(id)
            .then((r) => { if (alive) setInstr(r.instructor); })
            .catch((e) => { if (alive) setError(e.response?.data?.error || 'Failed to load'); });
        return () => { alive = false; };
    }, [id]);

    const onSubmit = async (body) => {
        try {
            await updateInstructor(id, body);
            toast.success('Instructor updated successfully');
            nav('/admin/instructors');
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed');
        }
    };

    if (error) return <p className="text-danger p-6">{error}</p>;
    if (!instr) return <p className="p-6 text-gray">Loading…</p>;

    return (
        <div>
            <div className="ol-card rounded-ol-8 mb-3">
                <div className="ol-card-body py-12px px-20px my-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h4 className="text-[16px] font-semibold text-dark m-0 flex items-center gap-2">
                            <i className="fi-rr-graduation-cap" /> Edit Instructor
                        </h4>
                        <Link to="/admin/instructors" className="ol-btn-outline-secondary flex items-center gap-10px">
                            <span className="fi-rr-arrow-alt-left" /> <span>Back</span>
                        </Link>
                    </div>
                </div>
            </div>
            <div className="ol-card p-4">
                <h4 className="text-[16px] font-semibold text-dark mb-5">Instructor Info</h4>
                <div className="ol-card-body">
                    <InstructorForm instructor={instr} submitLabel="Update Instructor" onSubmit={onSubmit} />
                </div>
            </div>
        </div>
    );
}
