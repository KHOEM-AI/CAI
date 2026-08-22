// Retrieve full conversation history for a session
// ─────────────────────────────────────────────────────────
router.get("/khoem/memory/:sessionId", (req: Request, res: Response) => {
  const sessionId = req.params["sessionId"] as string;
  const limitParam = req.query["limit"];
  const limit =
    typeof limitParam === "string" && !isNaN(Number(limitParam))
      ? Math.min(Number(limitParam), 200)
      : 50;

  const history = getMemory(sessionId, limit);

  res.json({
    sessionId,
    count: history.length,
    history,
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /api/khoem/memory/:sessionId
// Wipe all memory for a session (fresh start)
// ─────────────────────────────────────────────────────────
router.delete("/khoem/memory/:sessionId", (req: Request, res: Response) => {
  const sessionId = req.params["sessionId"] as string;
  const deleted = clearMemory(sessionId);

  res.json({
    sessionId,
    deleted,
    message: `Session memory cleared (${deleted} entries removed)`,
  });
});

// ─────────────────────────────────────────────────────────
// GET /api/khoem/memory/:sessionId/stats
// Session health: total turns, oldest/newest timestamps, prune status
// ─────────────────────────────────────────────────────────
router.get("/khoem/memory/:sessionId/stats", (req: Request, res: Response) => {
  const sessionId = req.params["sessionId"] as string;
  const stats = getMemoryStats(sessionId);
  res.json({
    sessionId,
