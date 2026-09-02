import { Router, type IRouter } from "express";
import healthRouter from "./health";
import caiAuthRouter from "./cai-auth";
import caiScansRouter from "./cai-scans";

const router: IRouter = Router();

router.use(healthRouter);
router.use(caiAuthRouter);
router.use(caiScansRouter);

export default router;

