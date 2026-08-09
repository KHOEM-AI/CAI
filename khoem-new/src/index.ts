/**
 * KHOEM_AI Engine Barrel
 * Exports all four core pillars for use by route handlers.
 */
export * from "./brain.js";
export * from "./guardrails.js";
export * from "./memory.js";
export * from "./voice.js";

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import khoemRouter from "./khoem";
import voiceRouter from "./voice";

const router: IRouter = Router();

router.use(healthRouter);
router.use(khoemRouter);
router.use(voiceRouter);

export default router;
