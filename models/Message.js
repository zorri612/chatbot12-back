import { getDB } from "../config/db.js";

export const saveMessage = async (sessionId, role, text) => {
  const db = getDB();
  const message = {
    sessionId,
    role,
    text,
    timestamp: new Date(),
  };
  await db.collection("messages").insertOne(message);
};

export const getMessagesBySession = async (sessionId) => {
  const db = getDB();
  return await db.collection("messages").find({ sessionId }).sort({ timestamp: 1 }).toArray();
};
