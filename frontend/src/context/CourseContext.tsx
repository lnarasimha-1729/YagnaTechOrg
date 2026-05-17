import { createContext } from "react";

export interface Module {
  moduleId: string;
  title: string;
  content: string;
  // Add other fields as needed
}

export interface Course {
  courseId: string;
  title: string;
  description: string;
  duration: number;
  isPreAssessmentNeeded: boolean;
  modules: Module[];
  clgIds: string[];
  // Auth-service userId of the instructor assigned to teach this course.
  // Optional/nullable: legacy courses created before instructor assignment
  // existed have no value.
  instructorId?: string | null;
}

export interface CourseContextType {
  courses: Course[];
  myCourses: Course[];
  loading: boolean;
  addCourse: (data: Partial<Course>) => Promise<unknown>;
  enrollCourse: (data: { courseId: string }) => Promise<unknown>;
}

export const CourseContext = createContext<CourseContextType | undefined>(undefined);