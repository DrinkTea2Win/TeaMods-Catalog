import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { modsTable } from "./mods";

export const reportsTable = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modId: uuid("mod_id")
      .notNull()
      .references(() => modsTable.id, { onDelete: "cascade" }),
    reporterId: varchar("reporter_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 40 }).notNull(),
    details: text("details"),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("reports_mod_status_idx").on(table.modId, table.status)],
);

export type Report = typeof reportsTable.$inferSelect;
export type InsertReport = typeof reportsTable.$inferInsert;
