import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, caiUsersTable } from "@workspace/db";
import { LoginBody, LoginResponse, GetCurrentUserResponse } from "@workspace/api-zod";
import { authenticateCai, signToken, verifyPassword } from "../lib/cai-auth";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "អ៊ីមែល និងពាក្យសម្ងាត់មិនត្រឹមត្រូវ" });
    return;
  }
  const [user] = await db.select().from(caiUsersTable).where(eq(caiUsersTable.email, parsed.data.email.toLowerCase())).limit(1);
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    res.status(401).json({ error: "អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ" });
    return;
  }
  const principal = { id: user.id, name: user.name, email: user.email, role: user.role as "staff" | "admin" };
  res.json(LoginResponse.parse({ token: signToken(principal), user: principal }));
});

router.get("/auth/me", authenticateCai, (req, res): void => {
  res.json(GetCurrentUserResponse.parse(req.caiUser));
});

export default router;