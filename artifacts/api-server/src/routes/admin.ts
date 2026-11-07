import {
  GetAdminStatusResponse,
  GetModParams,
  VerifyModResponse,
} from "@workspace/api-zod";
import { clerkClient, getAuth } from "@clerk/express";
import { db, modsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { isAdminEmail } from "../lib/admin";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function isClerkAdmin(userId: string): Promise<boolean> {
  const user = await clerkClient.users.getUser(userId);
  return user.emailAddresses.some(
    (address) =>
      address.verification?.status === "verified" &&
      isAdminEmail(address.emailAddress),
  );
}

router.get("/admin/status", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const userId = getAuth(req).userId;
  if (!userId) {
    res.json(GetAdminStatusResponse.parse({ isAdmin: false }));
    return;
  }
  try {
    const isAdmin = await isClerkAdmin(userId);
    res.json(GetAdminStatusResponse.parse({ isAdmin }));
  } catch (error) {
    req.log.error({ err: error }, "Could not resolve the Clerk admin role");
    res.status(503).json({ error: "Не удалось проверить роль администратора." });
  }
});

router.post(
  "/mods/:modId/verification",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = GetModParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = getAuth(req).userId;
    const isAdmin = userId ? await isClerkAdmin(userId) : false;
    if (!isAdmin) {
      res.status(403).json({ error: "Действие доступно только администратору." });
      return;
    }

    const [mod] = await db
      .update(modsTable)
      .set({ verified: true, updatedAt: new Date() })
      .where(
        and(
          eq(modsTable.id, params.data.modId),
          eq(modsTable.status, "published"),
        ),
      )
      .returning({ id: modsTable.id, verified: modsTable.verified });

    if (!mod) {
      res.status(404).json({ error: "Опубликованный мод не найден." });
      return;
    }
    res.json(VerifyModResponse.parse(mod));
  },
);

export default router;
