import express from "express";
import { userStats, globalStats } from "../controllers/statsController.js";
const router = express.Router();

router.get("/user/:id", userStats);
router.get("/global", globalStats);

export default router;
