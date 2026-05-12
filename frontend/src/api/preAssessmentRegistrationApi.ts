import axiosInstance from "./axiosInstance";

// Mirrors the enum in `backend/assessment-service/src/utils/preAssessmentConstants.js`.
// Kept here so the modal can iterate type-safely without re-importing strings
// from a JS bundle.
export const PRE_ASSESSMENT_PROGRAMS = [
  "AI Frontier",
  "AI Frontier Plus",
  "Elite AI Residency",
] as const;

export type PreAssessmentProgram = (typeof PRE_ASSESSMENT_PROGRAMS)[number];

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
