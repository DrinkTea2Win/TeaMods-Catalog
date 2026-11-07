import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const modStatusEnum = pgEnum("mod_status", [
  "draft",
  "published",
  "reported",
  "rejected",
]);

export const modsTable = pgTable(
  "mods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: varchar("author_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    description: text("description").notNull(),
    status: modStatusEnum("status").notNull().default("draft"),
    verified: boolean("verified").notNull().default(false),
    likeCount: integer("like_count").notNull().default(0),
    downloadCount: integer("download_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("mods_slug_idx").on(table.slug),
    uniqueIndex("mods_author_title_idx").on(
      table.authorId,
      sql`lower(${table.title})`,
    ),
  ],
);

export type Mod = typeof modsTable.$inferSelect;
export type InsertMod = typeof modsTable.$inferInsert;
