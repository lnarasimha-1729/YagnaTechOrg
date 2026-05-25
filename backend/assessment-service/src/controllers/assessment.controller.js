import Assessment from "../db/models/Assessment.js";
import QuestionSet from "../db/models/QuestionSet.js";
import Question from "../db/models/Question.js";

// Normalise an incoming list of ids to deduped string array. Accepts either
// an array or a single value; trims; drops empties. Used for both clgIds and
// courseIds so the JSON column always stores a clean shape.
function normaliseIdList(value) {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const s = String(v ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

// ------------------ CREATE ------------------
export async function addAssessment(req, res) {
  try {
    const { assessmentId, type, setId, startAt, score, timer, status } = req.body;
    const clgIds = normaliseIdList(req.body.clgIds);
    const courseIds = normaliseIdList(req.body.courseIds);

    if (!assessmentId || !type || !setId) {
      return res.status(400).json({ message: "assessmentId, type, and setId are required" });
    }

    // Check if assessment already exists
    const existing = await Assessment.findByPk(assessmentId);
    if (existing) return res.status(409).json({ message: "Assessment already exists" });

    // Check if QuestionSet exists
    const qs = await QuestionSet.findByPk(setId);
    if (!qs) return res.status(400).json({ message: "QuestionSet not found" });

    const assessment = await Assessment.create({
      assessmentId,
      type,
      setId,
      startAt,
      score,
      timer,
      status,
      clgIds,
      courseIds
    });

    res.status(201).json(assessment);
  } catch (err) {
    console.error("Error adding assessment:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ------------------ GET ALL ------------------
export async function getAllAssessments(req, res) {
  try {
    const assessments = await Assessment.findAll();

    // fetch QuestionSet for each assessment
    const result = await Promise.all(
      assessments.map(async (assess) => {
        const qs = await QuestionSet.findByPk(assess.setId);
        return {
          ...assess.toJSON(),
          QuestionSet: qs
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error("Error fetching assessments:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}


// ------------------ GET BY ID (with questions) ------------------
export async function getAssessmentById(req, res) {
  try {
    const { id } = req.params;

    // Find the assessment
    const assessment = await Assessment.findByPk(id);
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    // Fetch the related QuestionSet manually
    const questionSet = await QuestionSet.findByPk(assessment.setId);

    // Fetch full questions if questionSet has quesIds. Preserve the order
    // defined in the QuestionSet — Sequelize.findAll returns DB order, which
    // would otherwise shuffle the sequence the admin configured.
    let questions = [];
    if (questionSet && questionSet.questions.length > 0) {
      const orderedIds = questionSet.questions;
      const rows = await Question.findAll({ where: { quesId: orderedIds } });
      const byId = Object.fromEntries(rows.map((q) => [q.quesId, q]));
      questions = orderedIds.map((qid) => byId[qid]).filter(Boolean);
    }

    res.json({
      ...assessment.toJSON(),
      questionSet,
      questions
    });
  } catch (err) {
    console.error("Error fetching assessment:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}


// ------------------ UPDATE ------------------
export async function updateAssessment(req, res) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    const assessment = await Assessment.findByPk(id);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });

    // If updating setId, validate QuestionSet exists
    if (updates.setId) {
      const qs = await QuestionSet.findByPk(updates.setId);
      if (!qs) return res.status(400).json({ message: "Invalid QuestionSet" });
    }

    // Only normalise when the caller sent the field — preserves existing
    // values when the admin form is partial.
    if (Object.prototype.hasOwnProperty.call(updates, 'clgIds')) {
      updates.clgIds = normaliseIdList(updates.clgIds);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'courseIds')) {
      updates.courseIds = normaliseIdList(updates.courseIds);
    }

    await assessment.update(updates);
    res.json(assessment);
  } catch (err) {
    console.error("Error updating assessment:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ------------------ DELETE ------------------
export async function deleteAssessment(req, res) {
  try {
    const { id } = req.params;
    const assessment = await Assessment.findByPk(id);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });

    await assessment.destroy();
    res.json({ message: "Assessment deleted successfully" });
  } catch (err) {
    console.error("Error deleting assessment:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}
