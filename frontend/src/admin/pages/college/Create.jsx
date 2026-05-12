import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import CollegeForm from './CollegeForm';
import { createCollege } from '../../api/college';

export default function CollegeCreate() {
    const nav = useNavigate();

    const onSubmit = async (body) => {
        try {
            await createCollege(body);
            toast.success('College added successfully');
            nav('/admin/colleges');
        } catch (e) {
            const message = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed';
            toast.error(message);
        }
    };

    return (
        <div>
            <div className="ol-card">
                <div className="ol-card-body py-3 px-5 my-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h4 className="text-[16px] font-semibold text-dark">Create College</h4>
                        <Link to="/admin/colleges" className="ol-btn-outline-secondary">← Back</Link>
                    </div>
                </div>
            </div>
            <div className="ol-card p-4">
                <h4 className="text-[16px] font-semibold text-dark mb-5">College Info</h4>
                <div className="ol-card-body">
                    <CollegeForm onSubmit={onSubmit} submitLabel="Create College" />
                </div>
            </div>
        </div>
    );
}
