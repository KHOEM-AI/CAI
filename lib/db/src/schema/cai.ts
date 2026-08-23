import { createInsertSchema } from "drizzle-zod";
import { boolean, doublePrecision, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const caiUsersTable = pgTable("cai_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("staff"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const caiScansTable = pgTable("cai_scans", {
  id: text("id").primaryKey(),
  operatorId: text("operator_id").notNull().references(() => caiUsersTable.id),
  category: text("category").notNull(),
  batchId: text("batch_id").notNull(),
  totalCount: integer("total_count").notNull(),
  detectedTypes: text("detected_types").array().notNull(),
  hashSignature: text("hash_signature").notNull(),
  aiAssisted: boolean("ai_assisted").notNull().default(false),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCaiUserSchema = createInsertSchema(caiUsersTable).omit({ createdAt: true });
export const insertCaiScanSchema = createInsertSchema(caiScansTable).omit({ createdAt: true });
export type CaiUser = typeof caiUsersTable.$inferSelect;
export type CaiScan = typeof caiScansTable.$inferSelect;
export type InsertCaiUser = z.infer<typeof insertCaiUserSchema>;
export type InsertCaiScan = z.infer<typeof insertCaiScanSchema>;