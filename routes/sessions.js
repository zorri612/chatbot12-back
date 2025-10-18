import express from "express";
import {
  startSession,
  chatWithAI,
  finishByUserAndSummarize,
  getSessionSummary,
  getActive
} from "../controllers/sessionController.js";

const router = express.Router();

// crear o reutilizar sesión
router.post("/", startSession);

// chat: acepta { sessionId, message } o { userId, message }
router.post("/chat", chatWithAI);

// finalizar por userId (body: { userId })
router.post("/finish", finishByUserAndSummarize);

// obtener id de sesión activa por userId
router.get("/active/:userId", getActive);

// obtener resumen por sessionId
router.get("/summary/:sessionId", getSessionSummary);

router.get("/debug/:userId", async (req, res) => {
  const db = getDB();
  const { userId } = req.params;
  const docs = await db.collection("sessions")
    .find({ userId: String(userId) })
    .project({ _id:1, userId:1, active:1, startedAt:1, endedAt:1 })
    .sort({ startedAt:-1 })
    .limit(10)
    .toArray();
  res.json(docs);
});

export default router;
