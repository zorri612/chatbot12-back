import OpenAI from "openai";
import { getDB } from "../config/db.js";
import {
  ensureActiveSessionIndex,
  createOrReuseSession,
  getActiveSessionId,
  endActiveSessionByUser,
} from "../models/Session.js";
import { getMessagesBySession, saveMessage } from "../models/Message.js";
import { ObjectId } from "mongodb";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function toObjectId(id) {
  try { return ObjectId.createFromHexString(String(id)); } catch { return null; }
}

// Llama a esto desde index.js después de connectDB()
export async function initSessionIndexes() {
  await ensureActiveSessionIndex();
}

export const startSession = async (req, res) => {
  try {
    const { userId, language, level } = req.body;
    console.log("📦 startSession req.body:", req.body);
    const sessionId = await createOrReuseSession(userId, language, level);
    res.status(201).json({ sessionId: sessionId.toString() });
  } catch (error) {
    console.error("❌ startSession:", error);
    res.status(500).json({ message: "Error creando sesión" });
  }
};

// Obtener la sesión activa por usuario (útil para depurar o reanudar)
export const getActive = async (req, res) => {
  try {
    const { userId } = req.params;
    const id = await getActiveSessionId(userId);
    if (!id) return res.status(404).json({ message: "No hay sesión activa" });
    res.json({ sessionId: id.toString() });
  } catch (e) {
    console.error("❌ getActive:", e);
    res.status(500).json({ message: "Error obteniendo sesión activa" });
  }
};

// Chat con GPT: si no llega sessionId, resuélvelo por userId + active:true
export const chatWithAI = async (req, res) => {
  try {
    let { sessionId, message, userId } = req.body;

    if (!sessionId) {
      if (!userId) return res.status(400).json({ message: "Falta userId o sessionId" });
      const activeId = await getActiveSessionId(userId);
      if (!activeId) return res.status(404).json({ message: "No hay sesión activa para el usuario" });
      sessionId = activeId.toString();
    }

    const db = getDB();

    // Cargar sesión para idioma/nivel
    const session = await db
  .collection("sessions")
  .findOne({ _id: new ObjectId(String(sessionId)) });

    if (!session) return res.status(404).json({ message: "Sesión no encontrada" });

    const language = session.language || "English";
    const level = session.level || "Intermediate";

    // Historial
    const history = await getMessagesBySession(sessionId);
    const systemPrompt = `
You are LangMatch, a friendly tutor. Student practices ${language} at ${level} level.
Always reply in ${language}, keep it natural and short, correct gently, and ask follow-ups.
`;
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map(m => ({
        role: m.role === "bot" ? "assistant" : "user",
        content: m.text || m.content || ""
      })),
      { role: "user", content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.8,
    });
    const reply = completion.choices[0].message.content;

    await saveMessage(sessionId, "user", message);
    await saveMessage(sessionId, "bot", reply);

    res.json({ reply });
  } catch (e) {
    console.error("❌ chatWithAI:", e);
    res.status(500).json({ message: "Error procesando chat" });
  }
};

// Finalizar por userId (no por sessionId) y generar resumen
// controllers/sessionController.js


export const finishByUserAndSummarize = async (req, res) => {
  try {
    const { userId, sessionId } = req.body;
    const db = getDB();
    const sessions = db.collection("sessions");

    let session = null;

    // 1) Intentar cerrar por sessionId si llega
    if (sessionId) {
      const oid = toObjectId(sessionId);
      if (oid) {
        session = await sessions.findOne({ _id: oid });
        if (session && session.active === true) {
          await sessions.updateOne(
            { _id: session._id },
            { $set: { active: false, endedAt: new Date() } }
          );
          session = await sessions.findOne({ _id: session._id }); // refrescar doc con endedAt
        }
      }
    }

    // 2) Si no hay sesión aún, cerrar por userId activo
    if (!session && userId) {
      session = await sessions.findOne({ userId: String(userId), active: true });
      if (session) {
        await sessions.updateOne(
          { _id: session._id },
          { $set: { active: false, endedAt: new Date() } }
        );
        session = await sessions.findOne({ _id: session._id }); // refrescar
      }
    }

    // 3) Diagnóstico si no hay sesión
    if (!session) {
      const recent = userId
        ? await sessions.find({ userId: String(userId) })
            .project({ _id:1, active:1, startedAt:1, endedAt:1 })
            .sort({ startedAt:-1 })
            .limit(5)
            .toArray()
        : [];
      return res.status(404).json({
        message: "No se encontró sesión para finalizar",
        hint: "Verifica que el sessionId sea el creado y que userId coincida",
        userId, sessionId,
        recentSessions: recent,
      });
    }

    // ---------- Métricas + resumen ----------
    const sid = session._id.toString();           // 👈 usa SIEMPRE el _id real
    const messages = await getMessagesBySession(sid);
    const totalMessages = messages.length;

    const start = session.startedAt ? new Date(session.startedAt) : new Date();
    const end   = session.endedAt   ? new Date(session.endedAt)   : new Date();
    const durationMinutes = Math.max(0, (end - start) / 60000);

    // temas simples
    const textAll = messages.map(m => m.text || m.content || "").join(" ");
    const tokens = textAll.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/).filter(Boolean);
    const stop = new Set([
      "el","la","los","las","de","del","y","o","u","un","una","que","en","es","con","por","para","mi","tu","su",
      "the","and","or","a","an","to","in","is","it","you","i","of","on","for","my","your",
      "le","les","et","ou","une","des","de","du","en","est","pour","mon","ton","son"
    ]);
    const freq = {};
    for (const t of tokens) { if (t.length >= 3 && !stop.has(t)) freq[t] = (freq[t] || 0) + 1; }
    const topics = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([w])=>w);

    const language = session.language || "English";
    const level    = session.level    || "Intermediate";
    const convo    = messages.map(m => `${m.role === "bot" ? "Tutor" : "Usuario"}: ${m.text || ""}`).join("\n");

    let summary = "";
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "system",
          content: `Create a short session summary in ${language} (student level ${level}), with key phrases, common mistakes (with gentle corrections) and 2 suggestions. <=120 words.\n\nConversation:\n${convo}`
        }]
      });
      summary = completion.choices?.[0]?.message?.content?.trim() || "";
    } catch (err) {
      console.warn("OpenAI summary failed:", err?.message);
      summary = `Mensajes: ${totalMessages}. Temas: ${topics.join(", ")}. Duración: ${durationMinutes.toFixed(1)} min.`;
    }

    const payload = {
      metrics: {
        totalMessages,
        durationMinutes: Number(durationMinutes.toFixed(1)),
        topics,
        language,
        level,
      },
      summary,
    };

    // guarda el resumen en la sesión correcta
    await sessions.updateOne(
      { _id: session._id },
      { $set: { summary: payload } }
    );

    return res.json(payload);
  } catch (e) {
    console.error("❌ finishByUserAndSummarize:", e);
    return res.status(500).json({ message: "Error finalizando sesión" });
  }
};


// Obtener resumen ya guardado (por sessionId)
// controllers/sessionController.js
export const getSessionSummary = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const oid = toObjectId(sessionId);
    if (!oid) {
      return res.status(400).json({
        message: "sessionId inválido: debe ser hex de 24 caracteres",
        sessionId,
      });
    }

    const db = getDB();
    const session = await db.collection("sessions").findOne({ _id: oid });
    if (!session) return res.status(404).json({ message: "Sesión no encontrada" });
    if (!session.summary) return res.status(404).json({ message: "Aún no hay resumen almacenado" });
    return res.json(session.summary);
  } catch (e) {
    console.error("❌ getSessionSummary:", e);
    res.status(500).json({ message: "Error trayendo el resumen" });
  }
};

