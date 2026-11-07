import { primaryKey, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { modsTable } from "./mods";

export const modLikesTable = pgTable(
  "mod_likes",
  {
    modId: uuid("mod_id")
      .notNull()
      .references(() => modsTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.modId, table.userId] })],
);

export type ModLike = typeof modLikesTable.$inferSelect;
