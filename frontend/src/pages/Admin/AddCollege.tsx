import React, { useState } from "react";
import { addCollege } from "../../api/collegeApi";

interface AddCollegeProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const AddCollege: React.FC<AddCollegeProps> = ({ onClose, onSuccess }) => {
  const [form, setForm] = useState({
    name: "",
    location: "",
    email: "",
    phone: "",
    students: "1563",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await addCollege({
        clgName: form.name.trim(),
        clgAddress: form.location.trim(),
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to add college";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8 relative">
        {/* Close Button */}
        <button
          className="absolute top-6 right-6 text-2xl font-bold text-gray-700 hover:text-black"
          aria-label="Close"
          onClick={onClose}
        >
          &times;
        </button>
        <h2 className="text-3xl font-bold mb-8 text-gray-900">Add New College</h2>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block mb-2 font-medium text-gray-700">College Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#219A85]"
                required
              />
            </div>
            <div>
              <label className="block mb-2 font-medium text-gray-700">Location</label>
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={handleChange}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#219A85]"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block mb-2 font-medium text-gray-700">Email Address</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#219A85]"
                required
              />
            </div>
            <div>
              <label className="block mb-2 font-medium text-gray-700">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#219A85]"
                required
              />
            </div>
          </div>
          {/* <div>
            <label className="block mb-2 font-medium text-gray-700">Students</label>
            <input
              type="text"
              name="students"
              value={form.students}
              onChange={handleChange}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#219A85]"
              required
            />
          </div> */}
          <div>
              <label className="block mb-2 font-medium text-gray-700">Students</label>
              <input
                type="text"
                name="students"
                value={form.students}
                onChange={handleChange}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#219A85]"
                required
              />
            </div>
          <div>
            <label className="block mb-2 font-medium text-gray-700">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#219A85]"
            />
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="bg-[#219A85] hover:bg-[#177385] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded-lg transition-colors mt-4"
          >
            {submitting ? "Adding..." : "Add College"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddCollege;