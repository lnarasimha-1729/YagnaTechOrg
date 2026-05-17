import StudentDashboard from "./StudentDashboard";
import ProgramsPage from "./Programspage";

// /courses/programs (e.g. the player's "Back to courses" button) now renders
// the same admin-driven program list as the dashboard's My Courses tab.
// The old ProgramsGrid showed three hardcoded programsData cards and linked
// to courses by array index — replaced so every entry point shows only the
// categories/courses an admin actually configured.
const CoursePrograms = () => (
  <StudentDashboard
    contentOverride={{
      title: "Programs",
      node: <ProgramsPage />,
    }}
  />
);

export default CoursePrograms;
