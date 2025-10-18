import { getDB } from "../config/db.js";

// 🔹 Métricas por usuario
export const userStats = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDB();

    // Obtener sesiones del usuario
    const sessions = await db.collection("sessions").find({ userId: id }).toArray();

    if (sessions.length === 0) {
      return res.status(404).json({ message: "No sessions found for this user" });
    }

    // Contar total de mensajes del usuario (en todas sus sesiones)
    const sessionIds = sessions.map((s) => s._id);
    const totalMessages = await db
      .collection("messages")
      .countDocuments({ sessionId: { $in: sessionIds } });

    // Calcular duración total (en minutos)
    const totalDuration = sessions.reduce((acc, s) => {
      if (s.startedAt && s.endedAt) {
        const start = new Date(s.startedAt);
        const end = new Date(s.endedAt);
        acc += (end - start) / 60000; // minutos
      }
      return acc;
    }, 0);

    // Idioma, nivel y tema más reciente
    const lastSession = sessions[sessions.length - 1];

    res.json({
      language: lastSession.language || "N/A",
      level: lastSession.level || "N/A",
      totalMessages,
      durationMinutes: totalDuration.toFixed(1),
      sessionsCount: sessions.length,
      topic: lastSession.topic || "General conversation",
    });
  } catch (error) {
    console.error("❌ Error in userStats:", error);
    res.status(500).json({ message: "Error trayendo las métricas" });
  }
};

// 🔹 Métricas globales (para todos los usuarios)
export const globalStats = async (req, res) => {
  try {
    const db = getDB();

    const totalUsers = await db.collection("users").countDocuments();
    const totalSessions = await db.collection("sessions").countDocuments();
    const totalMessages = await db.collection("messages").countDocuments();

    res.json({
      totalUsers,
      totalSessions,
      totalMessages,
    });
  } catch (error) {
    console.error("❌ Error in globalStats:", error);
    res.status(500).json({ message: "Error trayendo las métricas globales" });
  }
};
