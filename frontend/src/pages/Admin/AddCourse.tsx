import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCourse } from "@/hooks/useCourse";
import { useCollege } from "@/hooks/useCollege";
import { listInstructors } from "@/admin/api/instructor";

interface AddCourseProps {
  onClose: () => void;
}

// Row shape returned by GET /api/admin/manage/instructors. Only the fields we
// actually render in the dropdown are required here; the API returns more.
interface InstructorRow {
  id: string;
  name?: string | null;
  email?: string | null;
  expertise?: string | null;
}

const AddCourse: React.FC<AddCourseProps> = ({ onClose }) => {
  const { addCourse } = useCourse();
  const { colleges, loading: collegesLoading, error: collegesError, refresh } = useCollege();

  const [form, setForm] = useState({
    courseId: "",
    title: "",
    description: "",
    duration: "",
    isPreAssessmentNeeded: false,
    instructorId: "",
  });
  const [selectedClgIds, setSelectedClgIds] = useState<string[]>([]);
  const [clgIdInput, setClgIdInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Instructor dropdown is sourced from the admin instructor API (auth-service
  // users with role='instructor'). Kept local to this modal — no provider —
  // because the list is small and only needed while the form is open.
  const [instructors, setInstructors] = useState<InstructorRow[]>([]);
  const [instructorsLoading, setInstructorsLoading] = useState(true);
  const [instructorsError, setInstructorsError] = useState<string | null>(null);

  const loadInstructors = async () => {
    setInstructorsLoading(true);
    setInstructorsError(null);
    try {
      const res = await listInstructors({ per_page: 1000 });
      setInstructors(res?.instructors || []);
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setInstructorsError(
        err?.response?.data?.error || err?.message || "Failed to load instructors"
      );
    } finally {
      setInstructorsLoading(false);
    }
  };

  useEffect(() => {
    loadInstructors();
  }, []);

  // Dropdown UI state — closed by default, click-outside closes it.
  const [collegeOpen, setCollegeOpen] = useState(false);
  const [collegeSearch, setCollegeSearch] = useState("");
  const collegeBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!collegeOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!collegeBoxRef.current) return;
      if (!collegeBoxRef.current.contains(e.target as Node)) setCollegeOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [collegeOpen]);

  const filteredColleges = useMemo(() => {
    const q = collegeSearch.trim().toLowerCase();
    if (!q) return colleges;
    return colleges.filter(
      (c) =>
        c.clgName.toLowerCase().includes(q) ||
        c.clgId.toLowerCase().includes(q)
    );
  }, [colleges, collegeSearch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const toggleCollege = (clgId: string) => {
    setSelectedClgIds((ids) =>
      ids.includes(clgId) ? ids.filter((x) => x !== clgId) : [...ids, clgId]
    );
  };

  const handleAddTypedClgId = () => {
    const id = clgIdInput.trim();
    if (!id) return;
    setSelectedClgIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setClgIdInput("");
  };

  const handleSelectAll = () => {
    if (selectedClgIds.length === colleges.length) {
      setSelectedClgIds([]);
    } else {
      setSelectedClgIds(colleges.map((c) => c.clgId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (selectedClgIds.length === 0) {
      setSubmitError("Select at least one college.");
      return;
    }
    if (!form.instructorId) {
      setSubmitError("Select an instructor.");
      return;
    }

    setSubmitting(true);
    try {
      await addCourse({
        courseId: form.courseId.trim(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        duration: Number(form.duration),
        isPreAssessmentNeeded: form.isPreAssessmentNeeded,
        clgIds: selectedClgIds,
        instructorId: form.instructorId,
      });
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; unknown?: string[] } } };
      const apiErr = e?.response?.data?.error;
      const unknown = e?.response?.data?.unknown;
      setSubmitError(
        apiErr
          ? unknown?.length
            ? `${apiErr}: ${unknown.join(", ")}`
            : apiErr
          : "Failed to add course. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 md:p-8 relative max-h-[90vh] overflow-y-auto">
        <button
          className="absolute top-6 right-6 text-2xl font-bold text-gray-700 hover:text-black"
          aria-label="Close"
          onClick={onClose}
          type="button"
        >
          &times;
        </button>
        <h2 className="text-3xl font-bold mb-4 text-gray-900">Add New Course</h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium text-gray-700">Course ID</label>
              <input
                type="text"
                name="courseId"
                value={form.courseId}
                onChange={handleChange}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#219A85]"
                required
              />
            </div>
            <div>
              <label className="block mb-1 font-medium text-gray-700">Title</label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#219A85]"
                required
              />
            </div>
            <div>
              <label className="block mb-1 font-medium text-gray-700">Duration (hours)</label>
              <input
                type="number"
                min={1}
                name="duration"
                value={form.duration}
                onChange={handleChange}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#219A85]"
                required
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-gray-700">
                <input
                  type="checkbox"
                  name="isPreAssessmentNeeded"
                  checked={form.isPreAssessmentNeeded}
                  onChange={handleChange}
                  className="h-4 w-4 text-[#219A85] focus:ring-[#219A85]"
                />
                <span>Pre-assessment required</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block mb-1 font-medium text-gray-700">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#219A85]"
            />
          </div>

          {/* Instructor — list comes from /api/admin/manage/instructors
              (auth-service users with role='instructor'). Required: every
              course must have an assigned instructor. Disabled while
              loading or on fetch failure so the form can't be submitted
              with an empty/invalid value. */}
          <div>
            <label className="block mb-1 font-medium text-gray-700">
              Instructor <span className="text-rose-500">*</span>
            </label>
            <select
              name="instructorId"
              value={form.instructorId}
              onChange={(e) =>
                setForm((f) => ({ ...f, instructorId: e.target.value }))
              }
              disabled={instructorsLoading || !!instructorsError}
              required
              className="w-full border rounded-lg px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#219A85] disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">
                {instructorsLoading
                  ? "Loading instructors…"
                  : instructorsError
                    ? "Failed to load instructors"
                    : instructors.length === 0
                      ? "No instructors available — add one first"
                      : "Select instructor…"}
              </option>
              {instructors.map((ins) => {
                const label = ins.name || ins.email || ins.id;
                const sub = ins.expertise ? ` — ${ins.expertise}` : "";
                return (
                  <option key={ins.id} value={ins.id}>
                    {label}{sub}
                  </option>
                );
              })}
            </select>
            {instructorsError && (
              <div className="text-sm text-rose-600 mt-1">
                {instructorsError}{" "}
                <button
                  type="button"
                  onClick={loadInstructors}
                  className="text-[#219A85] underline ml-1"
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* College segment */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block font-medium text-gray-700">
                Offered at colleges <span className="text-rose-500">*</span>
              </label>
              {colleges.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sm text-[#219A85] hover:underline"
                >
                  {selectedClgIds.length === colleges.length ? "Clear all" : "Select all"}
                </button>
              )}
            </div>

            {/* Manual College ID entry */}
            <div className="mb-3">
              <label className="block mb-1 text-sm font-medium text-gray-700">
                College ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clgIdInput}
                  onChange={(e) => setClgIdInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTypedClgId();
                    }
                  }}
                  placeholder="e.g. clg_cnmsph6e7"
                  className="flex-1 border rounded-lg px-4 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#219A85]"
                />
                <button
                  type="button"
                  onClick={handleAddTypedClgId}
                  disabled={!clgIdInput.trim()}
                  className="bg-[#219A85] hover:bg-[#177385] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  Add ID
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Type a college ID and press Enter, or pick from the list below.
              </p>
            </div>

            {collegesLoading ? (
              <div className="text-sm text-gray-500">Loading colleges…</div>
            ) : collegesError ? (
              <div className="text-sm text-rose-600">
                {collegesError}{" "}
                {refresh && (
                  <button
                    type="button"
                    onClick={() => refresh()}
                    className="text-[#219A85] underline ml-1"
                  >
                    Retry
                  </button>
                )}
              </div>
            ) : colleges.length === 0 ? (
              <div className="text-sm text-gray-500">
                No colleges available. Add a college first.
              </div>
            ) : (
              <div className="relative" ref={collegeBoxRef}>
                {/* Trigger */}
                <button
                  type="button"
                  onClick={() => setCollegeOpen((o) => !o)}
                  className="w-full flex items-center justify-between border rounded-lg px-4 py-2 bg-white text-left focus:outline-none focus:ring-2 focus:ring-[#219A85]"
                  aria-haspopup="listbox"
                  aria-expanded={collegeOpen}
                >
                  <span className="text-sm text-gray-700 truncate">
                    {selectedClgIds.length === 0
                      ? "Select colleges…"
                      : `${selectedClgIds.length} college${selectedClgIds.length === 1 ? "" : "s"} selected`}
                  </span>
                  <svg
                    className={`w-4 h-4 ml-2 text-gray-500 transition-transform ${collegeOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Panel */}
                {collegeOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg">
                    <div className="p-2 border-b">
                      <input
                        type="text"
                        value={collegeSearch}
                        onChange={(e) => setCollegeSearch(e.target.value)}
                        placeholder="Search by name or ID…"
                        className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#219A85]"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y">
                      {filteredColleges.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500">No matches.</div>
                      ) : (
                        filteredColleges.map((c) => (
                          <label
                            key={c.clgId}
                            className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedClgIds.includes(c.clgId)}
                              onChange={() => toggleCollege(c.clgId)}
                              className="h-4 w-4 mt-0.5 text-[#219A85] focus:ring-[#219A85]"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {c.clgName}
                              </span>
                              <span className="text-xs font-mono text-gray-600">
                                ID: {c.clgId}
                              </span>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedClgIds.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-gray-600 mb-1">
                  {selectedClgIds.length} selected
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedClgIds.map((id) => {
                    const match = colleges.find((c) => c.clgId === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#E6F4F1] text-[#177385] text-xs font-mono"
                      >
                        {match ? `${match.clgName} (${id})` : id}
                        <button
                          type="button"
                          onClick={() => toggleCollege(id)}
                          className="text-[#177385] hover:text-rose-600 font-bold"
                          aria-label={`Remove ${id}`}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {submitError && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="bg-[#219A85] hover:bg-[#177385] disabled:opacity-60 text-white font-semibold px-6 py-2 rounded-lg transition-colors mt-2"
          >
            {submitting ? "Saving…" : "Add Course"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddCourse;
