import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import CollegeForm from './CollegeForm';
import { getCollege, updateCollege } from '../../api/college';

export default function CollegeEdit() {
    const { id } = useParams();
    const nav = useNavigate();
    const [college, setCollege] = useState(null);
    const [loadError, setLoadError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getCollege(id)
            .then((r) => { if (!cancelled) setCollege(r.college); })
            .catch((e) => {
                if (cancelled) return;
                setLoadError(e.response?.data?.error || e.message || 'Failed to load');
            });
        return () => { cancelled = true; };
    }, [id]);

    const onSubmit = async (body) => {
        try {
            await updateCollege(id, body);
            toast.success('College updated successfully');
            nav('/admin/colleges');
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed');
        }
    };

    if (loadError) {
        return (
            <div className="ol-card rounded-ol-8">
                <div className="ol-card-body py-10 px-6 text-center">
                    <p className="text-[16px] font-semibold text-danger mb-2">Couldn’t load college</p>
                    <p className="text-[13px] text-gray mb-4">{loadError}</p>
                    <Link to="/admin/colleges" className="ol-btn-outline-secondary">← Back</Link>
                </div>
            </div>
        );
    }

    if (!college) return <div className="text-gray">Loading…</div>;

    return (
        <div>
            <div className="ol-card">
                <div className="ol-card-body py-3 px-5 my-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h4 className="text-[16px] font-semibold text-dark">Edit College</h4>
                        <Link to="/admin/colleges" className="ol-btn-outline-secondary">← Back</Link>
                    </div>
                </div>
            </div>
            <div className="ol-card p-4">
                <h4 className="text-[16px] font-semibold text-dark mb-5">College Info</h4>
                <div className="ol-card-body">
                    <CollegeForm college={college} onSubmit={onSubmit} submitLabel="Update College" />
                </div>
            </div>
        </div>
    );
}
