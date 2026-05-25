import QuestionSet from "../db/models/QuestionSet.js";
import Question from "../db/models/Question.js";

// ------------------ CREATE ------------------
export async function addQuestionSet(req, res) {
  try {
    const { setId, setName, category, questions } = req.body;

    if (!setId || !setName) {
      return res.status(400).json({ message: "setId and setName are required" });
    }

    const existing = await QuestionSet.findByPk(setId);
    if (existing) return res.status(409).json({ message: "QuestionSet already exists" });

    // Validate question IDs if provided
    if (questions && questions.length > 0) {
      const existingQuestions = await Question.findAll({ where: { quesId: questions } });
      if (existingQuestions.length !== questions.length) {
        return res.status(400).json({ message: "Some questions do not exist" });
      }
    }

    const qs = await QuestionSet.create({ setId, setName, category, questions: questions || [] });
    res.status(201).json(qs);
  } catch (err) {
    console.error("Error adding QuestionSet:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ------------------ GET ALL ------------------
export async function getAllQuestionSets(req, res) {
  try {
    const questionSets = await QuestionSet.findAll();
    res.json(questionSets);
  } catch (err) {
    console.error("Error fetching QuestionSets:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ------------------ GET BY ID (with full questions) ------------------
export async function getQuestionSetById(req, res) {
  try {
    const { id } = req.params;
    const questionSet = await QuestionSet.findByPk(id);
    if (!questionSet) return res.status(404).json({ message: "QuestionSet not found" });

    // Fetch full questions, preserving the admin-chosen order from the
    // canonical `questions` ID array. Sequelize.findAll returns DB order, so
    // we reindex by quesId and walk the original ID list.
    const orderedIds = Array.isArray(questionSet.questions) ? questionSet.questions : [];
    let questionDetails = [];
    if (orderedIds.length > 0) {
      const rows = await Question.findAll({ where: { quesId: orderedIds } });
      const byId = Object.fromEntries(rows.map((q) => [q.quesId, q]));
      questionDetails = orderedIds.map((qid) => byId[qid]).filter(Boolean);
    }

    // Preserve `questions` as the ordered ID array (matches the DB column and
    // what the admin form needs to hydrate selection). `questionDetails`
    // carries the joined Question objects for views that render them.
    res.json({
      ...questionSet.toJSON(),
      questions: orderedIds,
      questionDetails,
    });
  } catch (err) {
    console.error("Error fetching QuestionSet:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ------------------ UPDATE ------------------
export async function updateQuestionSet(req, res) {
  try {
    const { id } = req.params;
    const { setName, category, questions } = req.body;

    const questionSet = await QuestionSet.findByPk(id);
    if (!questionSet) return res.status(404).json({ message: "QuestionSet not found" });

    // Validate questions array
    if (questions && questions.length > 0) {
      const existingQuestions = await Question.findAll({ where: { quesId: questions } });
      if (existingQuestions.length !== questions.length) {
        return res.status(400).json({ message: "Some questions do not exist" });
      }
    }

    await questionSet.update({
      setName: setName || questionSet.setName,
      category: category || questionSet.category,
      questions: questions || questionSet.questions
    });

    res.json(questionSet);
  } catch (err) {
    console.error("Error updating QuestionSet:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ------------------ DELETE ------------------
export async function deleteQuestionSet(req, res) {
  try {
    const { id } = req.params;
    const questionSet = await QuestionSet.findByPk(id);
    if (!questionSet) return res.status(404).json({ message: "QuestionSet not found" });

    await questionSet.destroy();
    res.json({ message: "QuestionSet deleted successfully" });
  } catch (err) {
    console.error("Error deleting QuestionSet:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}
