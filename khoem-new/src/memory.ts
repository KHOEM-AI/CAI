  const db = getDb();
  // Delete the oldest rows beyond the cap using a subquery on the min id
  const info = db
    .prepare<[string, string, number]>(
      `DELETE FROM session_memory
       WHERE session_id = ?
         AND id NOT IN (
           SELECT id FROM session_memory
           WHERE session_id = ?
           ORDER BY id DESC
           LIMIT ?
         )`,
    )
    .run(sessionId, sessionId, maxTurns);

  if (info.changes > 0) {
    logger.info(
      { sessionId, pruned: info.changes, kept: maxTurns },
      "[MemoryEngine] Session pruned",
    );
    
