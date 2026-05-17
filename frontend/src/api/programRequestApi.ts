import axios from "axios";

const BASE = (import.meta.env.VITE_ADMIN_API_URL as string) || "http://localhost:4000";

// Same base + per-student x-user-id header as the other /api/public clients
// (courseApi, preAssessmentApi). The header keys the request to the logged-in
// student on the server.
const api = axios.create({
  baseURL: `${BASE}/api/public`,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const id = localStorage.getItem("userId");
  if (id) config.headers.set("x-user-id", String(id));
  return config;
});

export type ProgramRequest = {
  program: string;
  status: "sent" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  updated_at: string;
};

// The pending program request an admin sent this student (or null if none
// is awaiting a response).
export const getMyProgramRequest = () =>
  api
    .get<{ request: ProgramRequest | null }>("/program-request")
    .then((r) => r.data.request);

// The program this student has accepted (or null). Used to gate the
// "Choose your program" cards.
export const getAcceptedProgram = () =>
  api
    .get<{ program: string | null }>("/program-request/accepted")
    .then((r) => r.data.program);

// Accept or reject the pending request.
export const respondToProgramRequest = (action: "accept" | "reject") =>
  api
    .post<{ message: string; status: string }>("/program-request/respond", { action })
    .then((r) => r.data);
