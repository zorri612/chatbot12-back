import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import sessionRoutes from "./routes/sessions.js";
import messageRoutes from "./routes/messages.js";
import statsRoutes from "./routes/stats.js";
import { initSessionIndexes } from "./controllers/sessionController.js";


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a MongoDB
await connectDB();
await initSessionIndexes(); // 👈 crea índice único userId+active

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/stats", statsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
