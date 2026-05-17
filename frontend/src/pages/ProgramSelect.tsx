import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ProgramCard, { programIconByIndex } from "@/components/programs/ProgramCard";
import { listCourses } from "@/api/course/courseApi";
import { selectProgram } from "@/api/userProgressApi";
import { getAcceptedProgram } from "@/api/programRequestApi";

interface CourseSummary {
  id: number;
  slug: string;
  title: string;
  short_description: string;
  outcomes: string[];
}

// outcomes come back from the admin catalog as a JSON string (e.g. '["a"]')
// on most paths; normalise to string[] for the card's feature list.
const parseList = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
};

// Display-only content for the three program cards. The backend still drives
// the cards (ids/slugs/click → enroll/navigate are unchanged); we only override
// what each card *shows* by its position, matching the approved design. If the
// API ever returns more than three courses, extra cards fall back to API data.
const CARD_CONTENT = [
  {
    title: "AI Frontier Program",
    tagline:
      "Kickstart your AI career with industry-ready knowledge in neural networks and deep learning.",
    features: [
      "AI expert devised curriculum",
      "Live program delivered by industry experts",
      "Project-based learning approach",
      "Continuous mentor guidance",
      "6 months virtual comprehensive program",
    ],
  },
  {
    title: "AI Frontier Plus Program",
    tagline: "Hybrid learning with corporate experience component",
    features: [
      "All the benefits of AI Frontier Program",
      "2 months of hands-on corporate experience",
      "Personalized guidance with industry experts",
      "Fast-track your career with advanced skills",
    ],
  },
  {
    title: "Elite AI Residency",
    tagline: "Full-time corporate experience for advanced learners",
    features: [
      "All the benefits of AI Frontier Program",
      "6 months on-site corporate engagement",
      "Full time real project responsibilities",
      "Work alongside corporate employees",
      "Fast paced learning experience",
    ],
  },
];

const ProgramSelect = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Programspage's "Start Program" links here as /programs/select?category_id=N.
  // The category path of the catalog returns the real admin courses in that
  // category with no college filter, so we pass it through instead of calling
  // listCourses() bare (which hit the empty→mock path and produced mock slugs
  // that 404'd on the detail page).
  const categoryId = Number(searchParams.get("category_id"));
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  // Track which card is mid-click so only that card's CTA shows "Enrolling…",
  // not all three.
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The program the student accepted (admin sent → student accepted on the
  // dashboard). Only that program's card is enabled; the others are locked.
  const [acceptedProgram, setAcceptedProgram] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAcceptedProgram()
      .then((p) => { if (!cancelled) setAcceptedProgram(p); })
      .catch(() => { /* if it can't load, leave all locked (no accepted) */ });
    return () => { cancelled = true; };
  }, []);

  // Fetch the real courses an admin assigned to this category. The category
  // path of the catalog returns active courses with no college filter, so
  // these are exactly what the admin added under this category.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!categoryId) {
        if (!cancelled) {
          setError("No program selected. Go back and pick a program.");
          setLoading(false);
        }
        return;
      }
      try {
        const res = await listCourses({ category_id: categoryId });
        if (cancelled) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setCourses(
          list.map((c: any) => ({
            id: Number(c.id),
            slug: String(c.slug),
            title: String(c.title),
            short_description: String(c.short_description || ""),
            outcomes: parseList(c.outcomes),
          })),
        );
      } catch {
        if (!cancelled) setError("Failed to load courses for this program.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [categoryId]);

  // Click a course card → record the selection against this category (the
  // program), then land on that course's details page. program_id is the
  // category id so enroll/progress stay consistent with Programspage. We
  // also forward the program *name* (the card's title — e.g. "AI Frontier
  // Plus Program") so the student schema can persist which of the three
  // program cards they actually enrolled through. Without the name, the
  // backend only sees numeric IDs and can't distinguish the cards (all
  // three are backed by the same course).
  const handleView = async (course: CourseSummary, index: number, programName: string) => {
    if (busyIndex !== null) return;
    setError(null);
    setBusyIndex(index);
    try {
      try { await selectProgram(categoryId, course.id, programName); } catch { /* non-fatal */ }
      navigate(
        `/courses/programs/course-details?slug=${encodeURIComponent(course.slug)}&program_id=${categoryId}`,
      );
    } finally {
      setBusyIndex(null);
    }
  };

  return (
    <section className="section-padding bg-gradient-subtle">
      <div className="container-ngo max-w-6xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold mb-2 text-gray-800 text-center">Choose your program</h2>
        <p className="text-gray-600 mb-10 text-center">
          These are the courses available in this program. Pick one to see the full details and enroll.
        </p>

        {error && <p className="text-red-600 mb-4 text-center">{error}</p>}

        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-10 h-10 border-4 border-[#177385] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && !error && courses.length === 0 && (
          <p className="text-gray-600 text-center">No courses have been added to this program yet.</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.length > 0 &&
            CARD_CONTENT.map((content, i) => {
              // All three cards are backed by the SAME single course (no
              // duplicate courses in the DB). Only the displayed content
              // differs per card; selection/navigation always target that
              // one real course.
              const course = courses[0];
              // A card is unlocked only when its program matches the one the
              // student accepted. Until something is accepted, all are locked.
              const isUnlocked = acceptedProgram === content.title;
              return (
                <ProgramCard
                  key={i}
                  program={{
                    id: course.id,
                    title: content.title,
                    tagline: content.tagline,
                    features: content.features,
                    icon: programIconByIndex[i % programIconByIndex.length],
                  }}
                  ctaLabel={busyIndex === i ? "Enrolling…" : "Enroll"}
                  disabled={!isUnlocked}
                  disabledLabel={acceptedProgram ? "Locked" : "Not granted"}
                  onView={() => handleView(course, i, content.title)}
                />
              );
            })}
        </div>
      </div>
    </section>
  );
};

export default ProgramSelect;
