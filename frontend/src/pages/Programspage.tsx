import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { getProfile } from "@/api/authApi";
import { getUserProgress } from "@/api/userProgressApi";

interface Category {
  id: number;
  title: string;
  description?: string | null;
}

// Map of categoryId -> list of course titles an admin added to it.
type CoursesByCategory = Record<number, string[]>;

const ADMIN_BASE = (import.meta.env.VITE_ADMIN_API_URL as string) || "http://localhost:4000";
// Pre-assessment pass threshold. Matches Assesments.jsx so the "Completed" label
// and the Programs unlock stay in sync.
const PRE_ASSESSMENT_PASS = 60;

const ProgramsPage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  // Course titles per category, shown under each category card.
  const [coursesByCategory, setCoursesByCategory] = useState<CoursesByCategory>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Single cached gate status for all programs (existing pre-assessment is global,
  // not per-program). Once the user passes any pre-assessment, every card unlocks.
  const [gatePassed, setGatePassed] = useState<boolean | null>(null);
  // Has the student picked a college on their Profile? Until this is true,
  // My Courses renders an empty-state CTA instead of any program cards —
  // the spec requires zero exposure of catalog content pre-college.
  const [hasCollege, setHasCollege] = useState<boolean | null>(null);
  // Enrolled target (program_id + player_path). When the current student has
  // already enrolled in a program, the matching card swaps "Start Program" for
  // "Continue" and jumps straight back into the player on click.
  const [enrolledTarget, setEnrolledTarget] = useState<{
    program_id: number; player_path: string;
  } | null>(null);
  // Defer rendering the cards until the enrolled-target lookup has resolved
  // (success OR failure). Otherwise the buttons paint as "Start Program" first
  // and flip to "Continue" once the API returns — confusing for returning students.
  const [progressLoading, setProgressLoading] = useState(true);

  // Single mount effect: resolve the student's profile first (preScore +
  // collegeId), then fetch categories SCOPED to that college. Categories are
  // only fetched when a college is set — the spec requires zero catalog
  // exposure before the student picks one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let clgId = "";
      try {
        const res = await getProfile();
        const data = (res.data as any) || {};
        const score = Number(data.preScore);
        clgId = (data.collegeId as string) || "";
        if (!cancelled) {
          setGatePassed(Number.isFinite(score) && score >= PRE_ASSESSMENT_PASS);
          setHasCollege(Boolean(clgId));
        }
      } catch {
        if (!cancelled) {
          setGatePassed(false);
          setHasCollege(false);
        }
        if (!cancelled) setLoading(false);
        return;
      }

      // No college → don't even hit the categories endpoint. The empty-state
      // CTA handles this case.
      if (!clgId) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const { data } = await axios.get(`${ADMIN_BASE}/api/public/categories`, {
          params: { clgId },
          timeout: 30000,
        });
        if (cancelled) return;
        const cats: Category[] = Array.isArray(data?.categories) ? data.categories : [];
        setCategories(cats);

        // For each category, pull the courses an admin assigned to it and
        // keep just the titles. One request per category, run in parallel;
        // a failed lookup degrades to an empty list for that card only.
        const entries = await Promise.all(
          cats.map(async (cat) => {
            try {
              const r = await axios.get(`${ADMIN_BASE}/api/public/courses`, {
                params: { category_id: cat.id },
                timeout: 30000,
              });
              const rows = Array.isArray(r.data?.data) ? r.data.data : [];
              return [cat.id, rows.map((c: any) => String(c.title))] as const;
            } catch {
              return [cat.id, [] as string[]] as const;
            }
          }),
        );
        if (!cancelled) {
          setCoursesByCategory(Object.fromEntries(entries));
        }
      } catch {
        if (!cancelled) setError("Failed to load programs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persistence: pull the enrolled target (program_id + player_path) so the
  // matching card shows "Continue" instead of "Start Program". The page itself
  // stays put — clicking Continue is what jumps into the player.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { target } = await getUserProgress();
        if (!cancelled && target?.player_path && target?.program_id) {
          setEnrolledTarget({ program_id: target.program_id, player_path: target.player_path });
        }
      } catch {
        // No progress yet — render the program list normally.
      } finally {
        if (!cancelled) setProgressLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // "Start Program" goes to the course-selection flow, scoped to the clicked
  // category so the next page shows the courses an admin assigned to it.
  const handleStart = (categoryId: number) =>
    navigate(`/programs/select?category_id=${categoryId}`);
  // "Continue" jumps the student straight back into the player exactly where
  // their enrolled course left off (path built by the backend from last_lesson_id).
  const handleContinue = (path: string) => navigate(path);

  return (
    <section className="section-padding bg-gradient-subtle">
      <div className="container-ngo max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-gray-800">My Courses</h2>

        {/* Wait until we know the college gate state before rendering anything
            below — otherwise the cards flash for one frame on slower networks. */}
        {(loading || progressLoading || hasCollege === null) && (
          <div className="flex justify-center py-10">
            <div className="w-10 h-10 border-4 border-[#177385] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && !loading && <p className="text-red-600">{error}</p>}

        {/* College gate. The spec is "show nothing until the student picks
            a college in Profile." We render an actionable empty state with
            a deep link to the Profile tab instead of a generic message so
            the user knows exactly where to go next. */}
        {!loading && !progressLoading && hasCollege === false && (
          <Card className="rounded-xl shadow-md border-dashed border-2">
            <CardContent className="p-8 text-center space-y-4">
              <h3 className="text-xl font-semibold text-gray-800">
                Select your college to see your courses
              </h3>
              <p className="text-gray-600">
                Your courses are personalised to the college you study at.
                Open your profile and pick your college to unlock this section.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && !progressLoading && hasCollege === true && !error && categories.length === 0 && (
          <p className="text-gray-600">No programs available yet.</p>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {!loading && !progressLoading && hasCollege === true && categories.map((program) => {
            // Default to locked until the pre-assessment gate has been
            // explicitly resolved as passed. While gatePassed is null
            // (initial mount, network in flight) the button stays
            // disabled — otherwise it briefly appears clickable, which
            // let the student through before the gate check returned.
            const locked = gatePassed !== true;
            // Show "Continue" on the card whose program matches the enrolled
            // target. Other cards keep "Start Program" — student can pick a
            // different program later if the flow allows.
            const isEnrolled = enrolledTarget?.program_id === program.id;
            return (
              <Card
                key={program.id}
                className="rounded-xl shadow-md hover:shadow-lg transition"
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-[#177385]">{program.title}</CardTitle>
                    {/* Bare arrow — gated on pre-assessment. Disabled until
                        `locked` flips false; starts the program, or jumps
                        straight back into the player when already enrolled. */}
                    <button
                      type="button"
                      className={
                        locked
                          ? "shrink-0 bg-transparent border-0 p-0 text-gray-400 cursor-not-allowed"
                          : "shrink-0 bg-transparent border-0 p-0 text-[#177385] hover:text-[#135f6e] cursor-pointer"
                      }
                      onClick={
                        locked
                          ? undefined
                          : isEnrolled
                            ? () => handleContinue(enrolledTarget!.player_path)
                            : () => handleStart(program.id)
                      }
                      disabled={locked}
                      aria-label={isEnrolled ? "Continue program" : "Start program"}
                      title={isEnrolled ? "Continue program" : "Start program"}
                    >
                      <ArrowRight className="w-6 h-6" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  {program.description && (
                    <p className="text-gray-600 mb-4">{program.description}</p>
                  )}

                  {/* Course names an admin added to this category. */}
                  {(() => {
                    const courseNames = coursesByCategory[program.id] || [];
                    if (courseNames.length === 0) {
                      return (
                        <p className="text-xs text-gray-400 mb-4">
                          No courses added yet
                        </p>
                      );
                    }
                    return (
                      <ul className="mb-4 space-y-1">
                        {courseNames.map((name, idx) => (
                          <li
                            key={`${program.id}-${idx}`}
                            className="text-sm text-gray-700 flex items-start gap-2"
                          >
                            <span className="text-[#177385] mt-0.5">•</span>
                            <span className="font-semibold">{name}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                  {locked && (
                    <p className="text-xs text-gray-500 mt-2">
                      Complete Pre-Assessment to unlock
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProgramsPage;
