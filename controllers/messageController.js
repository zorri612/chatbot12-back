import { saveMessage, getMessagesBySession } from "../models/Message.js";

export const sendMessage = async (req, res) => {
  try {
    const { sessionId, role, text } = req.body;
    await saveMessage(sessionId, role, text);
    res.json({ message: "Mensaje guardado" });
  } catch (error) {
    console.error("❌ Error enviando mensaje:", error);
    res.status(500).json({ message: "Error enviando mensaje" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await getMessagesBySession(sessionId);
    res.json(messages);
  } catch (error) {
    console.error("❌ Error obteniendo mensajes:", error);
    res.status(500).json({ message: "Error obteniendo mensajes" });
  }
};
