import { getAuth } from "@clerk/express";
import { db, usersTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      dbUser?: User;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const userId = auth.sessionClaims?.userId ?? auth.userId;
  if (!userId) {
    res.status(401).json({ error: "Для этого действия нужно войти." });
    return;
  }

  const localUserId = String(userId);
  let [dbUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, localUserId))
    .limit(1);

  if (!dbUser) {
    [dbUser] = await db
      .insert(usersTable)
      .values({ id: localUserId })
      .onConflictDoNothing()
      .returning();

    if (!dbUser) {
      [dbUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, localUserId))
        .limit(1);
    }
  }

  if (!dbUser) {
    res.status(500).json({ error: "Не удалось подготовить профиль пользователя." });
    return;
  }

  if (dbUser.isBanned) {
    res.status(403).json({ error: "Доступ к аккаунту ограничен." });
    return;
  }

  req.dbUser = dbUser;
  next();
}
