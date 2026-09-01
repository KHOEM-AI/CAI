import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db, caiScansTable } from "@workspace/db";
import { CreateScanBody, CreateScanResponse, GetDashboardSummaryResponse, ListScansQueryParams, ListScansResponse, ListScansResponseItem } from "@workspace/api-zod";
import { authenticateCai } from "../lib/cai-auth";

const router: IRouter = Router();
const mapScan = (row: typeof caiScansTable.$inferSelect, operator: string) => ({
  id: row.id, operator, category: row.category, batchId: row.batchId, totalCount: row.totalCount,
  detectedTypes: row.detectedTypes, hashSignature: row.hashSignature, aiAssisted: row.aiAssisted,
  latitude: row.latitude, longitude: row.longitude, locationAccuracy: row.locationAccuracy, estimated: row.estimated, confidence: row.confidence,
  modelName: row.modelName, modelVersion: row.modelVersion, createdAt: row.createdAt.toISOString(),
});

router.get("/scans", authenticateCai, async (req, res): Promise<void> => {
  const parsed = ListScansQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const query = db.select().from(caiScansTable).orderBy(desc(caiScansTable.createdAt)).limit(parsed.data.limit);
  const rows = req.caiUser!.role === "admin" ? await query : await query.where(eq(caiScansTable.operatorId, req.caiUser!.id));
  res.json(ListScansResponse.parse(rows.map((row) => mapScan(row, req.caiUser!.role === "admin" ? "ក្រុមការងារ" : req.caiUser!.name))));
});

router.post("/scans", authenticateCai, async (req, res): Promise<void> => {
  const parsed = CreateScanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const row = { id: `scan_${crypto.randomUUID()}`, operatorId: req.caiUser!.id, ...parsed.data, latitude: parsed.data.latitude ?? null, longitude: parsed.data.longitude ?? null };
  const [saved] = await db.insert(caiScansTable).values(row).returning();
  res.status(201).json(CreateScanResponse.parse(mapScan(saved, req.caiUser!.name)));
});

router.get("/dashboard/summary", authenticateCai, async (req, res): Promise<void> => {
  const rows = await db.select().from(caiScansTable).orderBy(desc(caiScansTable.createdAt)).limit(100);
  const visible = req.caiUser!.role === "admin" ? rows : rows.filter((row) => row.operatorId === req.caiUser!.id);
  const today = new Date().toISOString().slice(0, 10);
  const categoryCounts: Record<string, number> = {};
  for (const row of visible) categoryCounts[row.category] = (categoryCounts[row.category] ?? 0) + 1;
  res.json(GetDashboardSummaryResponse.parse({
    totalScans: visible.length,
    totalItems: visible.reduce((sum, row) => sum + row.totalCount, 0),
    todayScans: visible.filter((row) => row.createdAt.toISOString().slice(0, 10) === today).length,
    categoryCounts,
    recentScans: visible.slice(0, 5).map((row) => mapScan(row, req.caiUser!.role === "admin" ? "ក្រុមការងារ" : req.caiUser!.name)),
  }));
});

export default router;
