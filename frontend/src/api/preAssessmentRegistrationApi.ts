import axios from "axios";
import axiosInstance from "./axiosInstance";
import { API_BASE } from "@/admin/api/client";

// Programs are now admin-created. The student picks from the eligible list
// returned by /api/public/programs/eligible (matched by college + batch +
// enrolled-course). The legacy hardcoded titles are gone — selectedProgram
// is whatever title the admin gave the program.
export type PreAssessmentProgram = string;

// Shape returned by /api/public/programs/eligible. Mirrors the admin
// programs.* columns the modal needs to render cards (title, tagline, the
// bullet list under it).
export interface EligibleProgram {
  id: number;
  title: string;
  tagline?: string | null;
  icon?: string | null;
  features?: string[];
}

export type PreAssessmentGender = "Male" | "Female" | "Other";

export interface UploadedCollegeProof {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  storedAt: string;
}

export interface PreAssessmentRegistration {
  registrationId: string;
  userId: string | null;
  fullName: string;
  email: string;
  phoneNumber: string;
  gender: PreAssessmentGender;
  selectedProgram: PreAssessmentProgram;
  uploadedCollegeProof: UploadedCollegeProof;
  declarationAccepted: boolean;
  assessmentStatus: "registered" | "in-progress" | "completed" | "abandoned";
  assessmentStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitPreAssessmentRegistrationInput {
  fullName: string;
  email: string;
  phoneNumber: string;
  gender: PreAssessmentGender;
  selectedProgramId: number;
  selectedProgram: PreAssessmentProgram;
  declarationAccepted: boolean;
  collegeProof: File;
}

const RESOURCE = "/assessment/pre-assessment-registration";

// Submits the onboarding form. Uses multipart/form-data because of the file
// upload — axios picks the right content-type when given a FormData payload.
export const submitPreAssessmentRegistration = (
  input: SubmitPreAssessmentRegistrationInput
) => {
  const fd = new FormData();
  fd.append("fullName", input.fullName);
  fd.append("email", input.email);
  fd.append("phoneNumber", input.phoneNumber);
  fd.append("gender", input.gender);
  fd.append("selectedProgram", input.selectedProgram);
  fd.append("selectedProgramId", String(input.selectedProgramId));
  fd.append("declarationAccepted", input.declarationAccepted ? "true" : "false");
  fd.append("collegeProof", input.collegeProof);

  return axiosInstance.post<{ data: PreAssessmentRegistration }>(
    `${RESOURCE}/submit`,
    fd,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
};

export const getMyPreAssessmentRegistration = () =>
  axiosInstance.get<{ data: PreAssessmentRegistration | null }>(`${RESOURCE}/me`);

export const markPreAssessmentRegistrationStarted = (registrationId: string) =>
  axiosInstance.post<{ data: PreAssessmentRegistration }>(
    `${RESOURCE}/${registrationId}/started`
  );

// Programs the current student is eligible to register for. Filtered server
// side by college + batch + enrolled-course (admin-service /api/public route).
// The user id is read from localStorage the same way other student-facing
// /api/public callers do.
export const getEligiblePrograms = () => {
  const userId = localStorage.getItem("userId");
  return axios.get<{ programs: EligibleProgram[] }>(
    `${API_BASE}/api/public/programs/eligible`,
    {
      params: userId ? { user_id: userId } : undefined,
      headers: userId ? { "x-user-id": String(userId) } : undefined,
      timeout: 15000,
    }
  );
};
