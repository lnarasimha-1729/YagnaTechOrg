import { Router } from "express";
import isLoggedIn from "../middlewares/isLoggedin.js";
import authRoles from "../middlewares/authRoles.js";
import { uploadProof } from "../middlewares/uploadProof.js";
import validatePreAssessmentReg from "../middlewares/validatePreAssessmentReg.js";
import * as controller from "../controllers/preAssessmentRegistration.controller.js";

const router = Router();

// Submit a brand new registration (multipart/form-data).
// Order matters: uploadProof parses the multipart body so that the validator
// can read text fields and req.file in the same request.
router.post(
  "/submit",
  isLoggedIn,
  uploadProof,
  validatePreAssessmentReg,
  controller.submitRegistration
);

// Returns the logged-in user's registration (or null) — used by the frontend
// to decide whether to show the onboarding modal again.
router.get("/me", isLoggedIn, controller.getMyRegistration);

// Flip status to in-progress when the assessment screen actually loads.
router.post("/:id/started", isLoggedIn, controller.markStarted);

// Admin-facing endpoints — paginated list and single lookup.
router.get("/", isLoggedIn, authRoles(["admin"]), controller.listRegistrationsHandler);
router.get("/:id", isLoggedIn, authRoles(["admin"]), controller.getRegistration);

export default router;
