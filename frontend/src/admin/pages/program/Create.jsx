import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ProgramForm from './ProgramForm';
import { storeProgram } from '../../api/program';

export default function ProgramCreate() {
    const nav = useNavigate();
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (data) => {
        setSubmitting(true);
        try {
            await storeProgram(data);
            toast.success('Program added successfully');
            nav('/admin/programs');
        } catch (e) {
            toast.error(e?.response?.data?.error || 'Failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <div className="ol-card rounded-ol-8 mb-3">
                <div className="ol-card-body py-12px px-20px my-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h4 className="text-[16px] font-semibold text-dark m-0 flex items-center gap-2">
                            <i className="fi-rr-graduation-cap" />
                            Add New Program
                        </h4>
                        <Link
                            to="/admin/programs"
                            className="ol-btn-light flex items-center gap-2"
                        >
                            <span className="fi-rr-arrow-left" />
                            <span>Back to Manage Programs</span>
                        </Link>
                    </div>
                </div>
            </div>

            <div className="ol-card rounded-ol-8">
                <div className="ol-card-body p-4">
                    <ProgramForm onSubmit={handleSubmit} submitting={submitting} />
                </div>
            </div>
        </div>
    );
}
