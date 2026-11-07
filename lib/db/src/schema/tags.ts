import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { modsTable } from "./mods";

export const tagsTable = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 60 }).notNull(),
    slug: varchar("slug", { length: 70 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("tags_slug_idx").on(table.slug)],
);

export const modTagsTable = pgTable(
  "mod_tags",
  {
    modId: uuid("mod_id")
      .notNull()
      .references(() => modsTable.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tagsTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.modId, table.tagId] }),
    index("mod_tags_tag_idx").on(table.tagId),
  ],
);

export type Tag = typeof tagsTable.$inferSelect;
export type InsertTag = typeof tagsTable.$inferInsert;
