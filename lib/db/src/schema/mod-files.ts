import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { modsTable } from "./mods";

export const modFilesTable = pgTable("mod_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  modId: uuid("mod_id")
    .notNull()
    .references(() => modsTable.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  driveFileId: varchar("drive_file_id", { length: 255 }).notNull().unique(),
  webContentLink: text("web_content_link").notNull(),
  minecraftVersions: text("minecraft_versions").array().notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  maliciousDetections: integer("malicious_detections").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ModFile = typeof modFilesTable.$inferSelect;
export type InsertModFile = typeof modFilesTable.$inferInsert;
