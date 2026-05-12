import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  ALLOWED_PROOF_MIMES,
  ALLOWED_PROOF_EXTS,
  MAX_PROOF_SIZE_BYTES,
} from "../utils/preAssessmentConstants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Uploads land under <service>/uploads/pre-assessment-proofs. Kept inside the
// service folder so dev environments work out of the box — production should
// remap this directory to an external volume / object store.
const PROOF_DIR = path.join(__dirname, "..", "..", "uploads", "pre-assessment-proofs");
if (!fs.existsSync(PROOF_DIR)) {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PROOF_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "proof";
    cb(null, `${Date.now()}-${safe}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = ALLOWED_PROOF_MIMES.includes(file.mimetype);
  const extOk = ALLOWED_PROOF_EXTS.includes(ext);
  if (mimeOk && extOk) return cb(null, true);
  cb(new Error("Only PDF, JPG, JPEG, and PNG files are allowed"));
};

const uploader = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_PROOF_SIZE_BYTES, files: 1 },
});

// Wrap multer.single so we surface a clean JSON error instead of the default
// "Unexpected field" / "File too large" stack traces.
export const uploadProof = (req, res, next) => {
  uploader.single("collegeProof")(req, res, (err) => {
    if (!err) return next();
    const status = err instanceof multer.MulterError ? 400 : 400;
    return res.status(status).json({
      message: err.message || "Failed to upload college proof",
    });
  });
};

export const PROOF_PUBLIC_PATH = "/uploads/pre-assessment-proofs";
export const PROOF_DISK_PATH = PROOF_DIR;
