import { getDB } from "../config/db.js";
import { getMessagesBySession, saveMessage } from "./Message.js";
import { ObjectId } from "mongodb";

export async function ensureActiveSessionIndex() {
  const db = getDB();
  const sessions = db.collection("sessions");
  // 1 sola sesión activa por usuario (con userId válido)
  await sessions.createIndex(
    { userId: 1, active: 1 },
    { unique: true, partialFilterExpression: { active: true, userId: { $type: "string" } } }
  );
}

export async function getActiveSessionByUser(userId) {
  const db = getDB();
  return await db.collection("sessions").findOne({ userId, active: true });
}

export async function getActiveSessionId(userId) {
  const s = await getActiveSessionByUser(userId);
  return s ? s._id : null;
}

export async function createOrReuseSession(userId, language, level) {
  const db = getDB();
  const sessions = db.collection("sessions");

  const uid = String(userId); // 👈 forzar string

  const existing = await sessions.findOne({ userId: uid, active: true });
  if (existing) return existing._id;

  const session = {
    userId: uid,                 // 👈 guardar como string
    language,
    level,
    startedAt: new Date(),
    endedAt: null,
    active: true,                // 👈 boolean real
  };

  const result = await sessions.insertOne(session);
  return result.insertedId;
}


export async function endActiveSessionByUser(userId) {
  const db = getDB();
  const sessions = db.collection("sessions");
  const now = new Date();

  const res = await sessions.findOneAndUpdate(
    { userId, active: true },
    { $set: { active: false, endedAt: now } },
    { returnDocument: "after" }
  );

  // proteger si no hay resultado
  if (!res || !res.value) {
    console.warn(`⚠️ No se encontró sesión activa para el usuario ${userId}`);
    return null;
  }

  return res.value; // sesión cerrada
}


export async function endSessionById(sessionId) {
  const db = getDB();
  const sessions = db.collection("sessions");
  await sessions.updateOne(
    { _id: new ObjectId(sessionId) },
    { $set: { active: false, endedAt: new Date() } }
  );
}



// ✅ Recuperar historial de mensajes de una sesión
export async function getSessionHistory(sessionId) {
  return await getMessagesBySession(sessionId);
}

// ✅ Guardar mensaje (usamos el de Message.js)
export { saveMessage };
