import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db, caiUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const configuredSecret = process.env.SESSION_SECRET;
if (!configuredSecret) throw new Error("SESSION_SECRET must be set");
const secret = configuredSecret;

export type CaiPrincipal = { id: string; name: string; email: string; role: "staff" | "admin" };

declare global {
  namespace Express {
    interface Request {
      caiUser?: CaiPrincipal;
    }
  }
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function signToken(user: CaiPrincipal) {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function authenticateCai(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const [payload, signature] = header.slice(7).split(".");
    if (!payload || !signature) throw new Error("invalid token");
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("invalid signature");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub: string; exp: number };
    if (decoded.exp < Date.now()) throw new Error("expired token");
    const [user] = await db.select().from(caiUsersTable).where(eq(caiUsersTable.id, decoded.sub)).limit(1);
    if (!user || (user.role !== "staff" && user.role !== "admin")) throw new Error("unknown user");
    req.caiUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}