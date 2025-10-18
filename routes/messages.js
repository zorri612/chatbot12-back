import express from "express";
import { sendMessage, getMessages } from "../controllers/messageController.js";

const router = express.Router();

router.post("/send", sendMessage); // <- ESTA ES LA RUTA CLAVE
router.get("/:sessionId", getMessages);

export default router;
