import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import InstructorForm from './InstructorForm';
import { createInstructor } from '../../api/instructor';

export default function InstructorCreate() {
    const nav = useNavigate();

    const onSubmit = async (fd) => {
        try {
            await createInstructor(fd);
            toast.success('Instructor add successfully');
            nav('/admin/instructors');
        } catch (e) {
            console.error('Create instructor failed:', e);
            const message = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed';
            toast.error(message);
        }
    };

    return (
        <div>
            <div className="ol-card">
                <div className="ol-card-body py-3 px-5 my-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h4 className="text-[16px] font-semibold text-dark">Create Instructor</h4>
                        <Link to="/admin/instructors" className="ol-btn-outline-secondary">← Back</Link>
                    </div>
                </div>
            </div>
            <div className="ol-card p-4">
                <h4 className="text-[16px] font-semibold text-dark mb-5">Instructor Info</h4>
                <div className="ol-card-body">
                    <InstructorForm onSubmit={onSubmit} submitLabel="Create Instructor" />
                </div>
            </div>
        </div>
    );
}
