import {
  AcceptDisclaimerResponse,
  CreateModBody,
  CreateModResponse,
  DownloadModFileParams,
  GetModParams,
  GetModResponse,
  ListModsQueryParams,
  ListModsResponse,
  ListTagsResponse,
  ReportModBody,
  ReportModResponse,
  ToggleModLikeParams,
  ToggleModLikeResponse,
  UploadModFileParams,
  UploadModFileResponse,
} from "@workspace/api-zod";
import {
  db,
  modFilesTable,
  modLikesTable,
  modTagsTable,
  modsTable,
  reportsTable,
  tagsTable,
  usersTable,
} from "@workspace/db";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { basename, extname } from "node:path";
import { tmpdir } from "node:os";
import { unlink, open } from "node:fs/promises";
import {
  deleteDriveFile,
  GoogleDriveApiError,
  publishDriveFile,
  uploadJarToDrive,
} from "../lib/google-drive";
import { checkWithVirusTotal, sha256File, VirusTotalCheckError } from "../lib/virus-total";
import { requireAuth } from "../middlewares/requireAuth";
import {
  requireDisclaimer,
  setDisclaimerCookie,
} from "../middlewares/requireDisclaimer";

const router: IRouter = Router();

function isUniqueConstraintViolation(
  error: unknown,
  constraintName: string,
): boolean {
  const visited = new Set<object>();
  let current: unknown = error;
  while (typeof current === "object" && current !== null && !visited.has(current)) {
    visited.add(current);
    const value = current as Record<string, unknown>;
    if (value.code === "23505" && value.constraint === constraintName) {
      return true;
    }
    current = value.cause;
  }
  return false;
}
const MAX_JAR_BYTES = 512 * 1024 * 1024;
const JAR_UPLOAD = multer({
  dest: tmpdir(),
  limits: { fileSize: MAX_JAR_BYTES, files: 1 },
  fileFilter(_req, file, callback) {
    if (extname(file.originalname).toLowerCase() !== ".jar") {
      callback(new Error("Загрузите файл .jar."));
      return;
    }
    callback(null, true);
  },
});

function parseJarUpload(req: Request, res: Response, next: (error?: unknown) => void) {
  JAR_UPLOAD.single("file")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Файл слишком большой. Максимальный размер — 512 МБ." });
      return;
    }
    res.status(400).json({
      error: error instanceof Error ? error.message : "Не удалось загрузить файл.",
    });
  });
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ru")
    .replace(/[^a-z0-9а-яё]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "mod";
}

function displayName(
  firstName: string | null,
  lastName: string | null,
  email: string | null,
): string {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || email?.split("@")[0] || "Автор";
}

function publishedWhere(query?: string, tag?: string): SQL {
  const conditions: SQL[] = [
    eq(modsTable.status, "published"),
    eq(usersTable.isBanned, false),
  ];
  if (query) {
    conditions.push(
      or(
        ilike(modsTable.title, `%${query}%`),
        ilike(modsTable.description, `%${query}%`),
      )!,
    );
  }
  if (tag) {
    conditions.push(
      exists(
        db
          .select({ modId: modTagsTable.modId })
          .from(modTagsTable)
          .innerJoin(tagsTable, eq(tagsTable.id, modTagsTable.tagId))
          .where(
            and(
              eq(modTagsTable.modId, modsTable.id),
              or(eq(tagsTable.slug, tag), eq(tagsTable.name, tag)),
            ),
          ),
      ),
    );
  }
  return and(...conditions)!;
}

async function getTagsByModIds(modIds: string[]): Promise<Map<string, string[]>> {
  if (modIds.length === 0) return new Map();
  const rows = await db
    .select({ modId: modTagsTable.modId, name: tagsTable.name })
    .from(modTagsTable)
    .innerJoin(tagsTable, eq(tagsTable.id, modTagsTable.tagId))
    .where(inArray(modTagsTable.modId, modIds));
  const result = new Map<string, string[]>();
  for (const row of rows) {
    const list = result.get(row.modId) ?? [];
    list.push(row.name);
    result.set(row.modId, list);
  }
  return result;
}

async function getFileCounts(modIds: string[]): Promise<Map<string, number>> {
  if (modIds.length === 0) return new Map();
  const rows = await db
    .select({ modId: modFilesTable.modId, value: count() })
    .from(modFilesTable)
    .where(inArray(modFilesTable.modId, modIds))
    .groupBy(modFilesTable.modId);
  return new Map(rows.map((row) => [row.modId, row.value]));
}

router.post("/disclaimer/accept", (_req, res): void => {
  setDisclaimerCookie(res);
  res.json(AcceptDisclaimerResponse.parse({ accepted: true }));
});

router.get("/mods", async (req, res): Promise<void> => {
  const parsed = ListModsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const params = parsed.data;
  const where = publishedWhere(params.q, params.tag);
  const orderBy =
    params.sort === "newest"
      ? [desc(modsTable.createdAt)]
      : [desc(modsTable.likeCount), desc(modsTable.createdAt)];
  const offset = (params.page - 1) * params.pageSize;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: modsTable.id,
        title: modsTable.title,
        slug: modsTable.slug,
        description: modsTable.description,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
        likeCount: modsTable.likeCount,
        downloadCount: modsTable.downloadCount,
        verified: modsTable.verified,
        createdAt: modsTable.createdAt,
      })
      .from(modsTable)
      .innerJoin(usersTable, eq(usersTable.id, modsTable.authorId))
      .where(where)
      .orderBy(...orderBy)
      .limit(params.pageSize)
      .offset(offset),
    db
      .select({ value: count() })
      .from(modsTable)
      .innerJoin(usersTable, eq(usersTable.id, modsTable.authorId))
      .where(where),
  ]);

  const modIds = rows.map((row) => row.id);
  const [tagMap, fileCounts] = await Promise.all([
    getTagsByModIds(modIds),
    getFileCounts(modIds),
  ]);
  const items = rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    authorDisplayName: displayName(row.firstName, row.lastName, row.email),
    tags: tagMap.get(row.id) ?? [],
    likeCount: row.likeCount,
    downloadCount: row.downloadCount,
      verified: row.verified,
    fileCount: fileCounts.get(row.id) ?? 0,
    createdAt: row.createdAt,
  }));

  res.json(
    ListModsResponse.parse({
      items,
      total: totalRows[0]?.value ?? 0,
      page: params.page,
      pageSize: params.pageSize,
    }),
  );
});

router.get("/mods/:modId", async (req, res): Promise<void> => {
  const parsed = GetModParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [mod] = await db
    .select({
      id: modsTable.id,
      title: modsTable.title,
      slug: modsTable.slug,
      description: modsTable.description,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      likeCount: modsTable.likeCount,
      downloadCount: modsTable.downloadCount,
      verified: modsTable.verified,
      createdAt: modsTable.createdAt,
    })
    .from(modsTable)
    .innerJoin(usersTable, eq(usersTable.id, modsTable.authorId))
    .where(
      and(
        eq(modsTable.id, parsed.data.modId),
        eq(modsTable.status, "published"),
        eq(usersTable.isBanned, false),
      ),
    )
    .limit(1);

  if (!mod) {
    res.status(404).json({ error: "Мод не найден." });
    return;
  }

  const [tags, files] = await Promise.all([
    getTagsByModIds([mod.id]),
    db
      .select({
        id: modFilesTable.id,
        fileName: modFilesTable.fileName,
        minecraftVersions: modFilesTable.minecraftVersions,
        createdAt: modFilesTable.createdAt,
      })
      .from(modFilesTable)
      .where(eq(modFilesTable.modId, mod.id))
      .orderBy(desc(modFilesTable.createdAt)),
  ]);
  const fileCounts = await getFileCounts([mod.id]);

  res.json(
    GetModResponse.parse({
      id: mod.id,
      title: mod.title,
      slug: mod.slug,
      description: mod.description,
      authorDisplayName: displayName(mod.firstName, mod.lastName, mod.email),
      tags: tags.get(mod.id) ?? [],
      likeCount: mod.likeCount,
      downloadCount: mod.downloadCount,
      verified: mod.verified,
      fileCount: fileCounts.get(mod.id) ?? 0,
      createdAt: mod.createdAt,
      files: files.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        minecraftVersions: file.minecraftVersions,
        downloadUrl: `/api/mods/${mod.id}/files/${file.id}/download`,
        createdAt: file.createdAt,
      })),
    }),
  );
});

router.get("/tags", async (_req, res): Promise<void> => {
  const [tags, counts] = await Promise.all([
    db.select().from(tagsTable).orderBy(asc(tagsTable.name)),
    db
      .select({ tagId: modTagsTable.tagId, value: count() })
      .from(modTagsTable)
      .innerJoin(modsTable, eq(modsTable.id, modTagsTable.modId))
      .innerJoin(usersTable, eq(usersTable.id, modsTable.authorId))
      .where(
        and(
          eq(modsTable.status, "published"),
          eq(usersTable.isBanned, false),
        ),
      )
      .groupBy(modTagsTable.tagId),
  ]);
  const countByTag = new Map(counts.map((row) => [row.tagId, row.value]));
  res.json(
    ListTagsResponse.parse(
      tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        modCount: countByTag.get(tag.id) ?? 0,
      })),
    ),
  );
});

router.post(
  "/mods",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = CreateModBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const allTags = await db.select().from(tagsTable);
    const selectedTags = parsed.data.tags.map((value) => {
      const normalized = value.trim().toLocaleLowerCase("ru");
      return allTags.find(
        (tag) =>
          tag.name.toLocaleLowerCase("ru") === normalized ||
          tag.slug.toLocaleLowerCase("ru") === normalized,
      );
    });
    if (selectedTags.some((tag) => !tag)) {
      res.status(400).json({ error: "Выберите жанры из списка." });
      return;
    }

    const title = parsed.data.title.trim();
    const description = parsed.data.description.trim();
    const slug = `${slugify(title)}-${randomUUID().slice(0, 8)}`;
    const mod = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(modsTable)
        .values({
          authorId: req.dbUser!.id,
          title,
          slug,
          description,
        })
        .returning();
      if (selectedTags.length > 0) {
        await tx.insert(modTagsTable).values(
          selectedTags.map((tag) => ({ modId: created.id, tagId: tag!.id })),
        );
      }
      return created;
    }).catch((error: unknown) => {
      if (isUniqueConstraintViolation(error, "mods_author_title_idx")) {
        return null;
      }
      throw error;
    });

    if (!mod) {
      res.status(409).json({
        error: "У вас уже есть мод с таким названием. Измените название, чтобы продолжить.",
      });
      return;
    }

    res.status(201).json(
      CreateModResponse.parse({
        id: mod.id,
        title: mod.title,
        slug: mod.slug,
        status: mod.status,
        createdAt: mod.createdAt,
      }),
    );
  },
);

router.post(
  "/mods/:modId/files",
  requireAuth,
  parseJarUpload,
  async (req, res): Promise<void> => {
    const parsed = UploadModFileParams.safeParse(req.params);
    if (!parsed.success) {
      if (req.file?.path) await unlink(req.file.path).catch(() => undefined);
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Выберите файл .jar." });
      return;
    }
    res.once("finish", () => {
      void unlink(file.path).catch(() => undefined);
    });

    const versions = String(req.body.minecraftVersions ?? "")
      .split(",")
      .map((version) => version.trim())
      .filter(Boolean);
    if (
      versions.length === 0 ||
      versions.length > 20 ||
      versions.some((version) => !/^\d{1,2}\.\d{1,2}(?:\.\d{1,2})?$/.test(version))
    ) {
      await unlink(file.path).catch(() => undefined);
      res.status(400).json({ error: "Укажите поддерживаемые версии Minecraft." });
      return;
    }

    const [mod] = await db
      .select({
        id: modsTable.id,
        authorId: modsTable.authorId,
        status: modsTable.status,
      })
      .from(modsTable)
      .where(eq(modsTable.id, parsed.data.modId))
      .limit(1);
    if (!mod) {
      await unlink(file.path).catch(() => undefined);
      res.status(404).json({ error: "Мод не найден." });
      return;
    }
    if (mod.authorId !== req.dbUser!.id) {
      await unlink(file.path).catch(() => undefined);
      res.status(403).json({ error: "Добавлять файлы может только автор мода." });
      return;
    }
    if (mod.status === "reported" || mod.status === "rejected") {
      await unlink(file.path).catch(() => undefined);
      res.status(409).json({ error: "Публикация этого мода приостановлена." });
      return;
    }

    const uploadHandle = await open(file.path, "r");
    const signature = Buffer.alloc(4);
    const { bytesRead } = await uploadHandle.read(signature, 0, 4, 0);
    await uploadHandle.close();
    if (
      bytesRead < 4 ||
      !(
        signature.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
        signature.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) ||
        signature.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x07, 0x08]))
      )
    ) {
      await unlink(file.path).catch(() => undefined);
      res.status(400).json({ error: "Файл не похож на архив Java .jar." });
      return;
    }

    const safeFileName = basename(file.originalname)
      .replace(/[^\p{L}\p{N}._-]/gu, "_")
      .slice(0, 240);
    let driveFileId: string | null = null;
    try {
      const driveFile = await uploadJarToDrive(
        file.path,
        safeFileName,
        file.size,
      );
      driveFileId = driveFile.driveFileId;
      const sha256 = await sha256File(file.path);
      const scan = await checkWithVirusTotal(
        file.path,
        safeFileName,
        file.size,
        sha256,
      );
      if (scan.isMalicious) {
        await db
          .update(usersTable)
          .set({ isBanned: true })
          .where(eq(usersTable.id, mod.authorId));
        try {
          await deleteDriveFile(driveFileId);
        } catch (cleanupError) {
          req.log.error(
            { err: cleanupError, driveFileId },
            "Could not remove a VirusTotal-flagged Drive file",
          );
        }
        driveFileId = null;
        res.status(422).json({ error: "Файл содержит вирусы" });
        return;
      }

      const webContentLink = await publishDriveFile(driveFileId);
      const savedFile = await db.transaction(async (tx) => {
        const [saved] = await tx
          .insert(modFilesTable)
          .values({
            modId: mod.id,
            fileName: safeFileName,
            driveFileId: driveFileId!,
            webContentLink,
            minecraftVersions: [...new Set(versions)],
            sha256,
            maliciousDetections: scan.maliciousDetections,
          })
          .returning();
        const [updatedMod] = await tx
          .update(modsTable)
          .set({ status: "published", updatedAt: new Date() })
          .where(
            and(
              eq(modsTable.id, mod.id),
              ne(modsTable.status, "reported"),
              ne(modsTable.status, "rejected"),
            ),
          )
          .returning({ id: modsTable.id });
        if (!updatedMod) {
          throw new Error("Mod publishing was paused during file verification");
        }
        return saved;
      });
      driveFileId = null;

      res.status(201).json(
        UploadModFileResponse.parse({
          id: savedFile.id,
          fileName: savedFile.fileName,
          minecraftVersions: savedFile.minecraftVersions,
          downloadUrl: `/api/mods/${mod.id}/files/${savedFile.id}/download`,
          createdAt: savedFile.createdAt,
        }),
      );
    } catch (error) {
      if (driveFileId) {
        try {
          await deleteDriveFile(driveFileId);
        } catch (cleanupError) {
          req.log.error(
            { err: cleanupError, driveFileId },
            "Could not remove an unpublished Drive file",
          );
        }
      }
      if (error instanceof VirusTotalCheckError) {
        res.status(422).json({ error: error.message });
        return;
      }
      if (error instanceof GoogleDriveApiError) {
        req.log.error(
          { status: error.httpStatus, reason: error.reason },
          "Google Drive rejected mod upload",
        );
        const message =
          error.reason === "storageQuotaExceeded"
            ? "У сервисного аккаунта нет квоты для этой папки. Переместите её в общий диск Google Drive."
            : error.reason === "insufficientFilePermissions" ||
                error.reason === "insufficientPermissions" ||
                error.reason === "notFound"
              ? "Проверьте ID папки и предоставьте сервисному аккаунту права редактора."
              : error.reason === "accessNotConfigured" ||
                  error.reason === "SERVICE_DISABLED"
                ? "В проекте Google Cloud не включён Google Drive API."
                : "Google Drive отклонил загрузку. Проверьте доступ сервисного аккаунта к папке.";
        res.status(502).json({ error: message });
        return;
      }
      req.log.error({ err: error }, "Mod file upload failed");
      res.status(502).json({ error: "Не удалось загрузить и проверить файл." });
    } finally {
      await unlink(file.path).catch(() => undefined);
    }
  },
);

router.post(
  "/mods/:modId/like",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = ToggleModLikeParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const mod = await db
      .select({ id: modsTable.id })
      .from(modsTable)
      .innerJoin(usersTable, eq(usersTable.id, modsTable.authorId))
      .where(
        and(
          eq(modsTable.id, parsed.data.modId),
          eq(modsTable.status, "published"),
          eq(usersTable.isBanned, false),
        ),
      )
      .limit(1);
    if (!mod[0]) {
      res.status(404).json({ error: "Мод не найден." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(modLikesTable)
        .where(
          and(
            eq(modLikesTable.modId, parsed.data.modId),
            eq(modLikesTable.userId, req.dbUser!.id),
          ),
        )
        .limit(1);
      if (existing) {
        await tx
          .delete(modLikesTable)
          .where(
            and(
              eq(modLikesTable.modId, parsed.data.modId),
              eq(modLikesTable.userId, req.dbUser!.id),
            ),
          );
        const [updated] = await tx
          .update(modsTable)
          .set({ likeCount: sql`greatest(${modsTable.likeCount} - 1, 0)` })
          .where(eq(modsTable.id, parsed.data.modId))
          .returning({ likeCount: modsTable.likeCount });
        return { liked: false, likeCount: updated.likeCount };
      }

      const [inserted] = await tx
        .insert(modLikesTable)
        .values({ modId: parsed.data.modId, userId: req.dbUser!.id })
        .onConflictDoNothing()
        .returning({ modId: modLikesTable.modId });
      if (inserted) {
        const [updated] = await tx
          .update(modsTable)
          .set({ likeCount: sql`${modsTable.likeCount} + 1` })
          .where(eq(modsTable.id, parsed.data.modId))
          .returning({ likeCount: modsTable.likeCount });
        return { liked: true, likeCount: updated.likeCount };
      }
      const [current] = await tx
        .select({ likeCount: modsTable.likeCount })
        .from(modsTable)
        .where(eq(modsTable.id, parsed.data.modId));
      return { liked: true, likeCount: current.likeCount };
    });

    res.json(ToggleModLikeResponse.parse(result));
  },
);

router.post(
  "/mods/:modId/reports",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = GetModParams.safeParse(req.params);
    const body = ReportModBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({
        error: params.error.message,
      });
      return;
    }
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [mod] = await tx
        .select({ id: modsTable.id, status: modsTable.status })
        .from(modsTable)
        .where(eq(modsTable.id, params.data.modId))
        .limit(1);
      if (!mod || mod.status !== "published") return null;

      const [existing] = await tx
        .select({ id: reportsTable.id })
        .from(reportsTable)
        .where(
          and(
            eq(reportsTable.modId, mod.id),
            eq(reportsTable.reporterId, req.dbUser!.id),
          ),
        )
        .limit(1);
      const report =
        existing ??
        (
          await tx
            .insert(reportsTable)
            .values({
              modId: mod.id,
              reporterId: req.dbUser!.id,
              reason: body.data.reason,
              details: body.data.details?.trim() || null,
            })
            .returning({ id: reportsTable.id })
        )[0];
      await tx
        .update(modsTable)
        .set({ status: "reported", updatedAt: new Date() })
        .where(eq(modsTable.id, mod.id));
      return report;
    });

    if (!result) {
      res.status(404).json({ error: "Мод уже недоступен." });
      return;
    }
    res.status(201).json(
      ReportModResponse.parse({ id: result.id, status: "submitted" }),
    );
  },
);

router.get(
  "/mods/:modId/files/:fileId/download",
  requireDisclaimer,
  async (req, res): Promise<void> => {
    const parsed = DownloadModFileParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [file] = await db
      .select({
        id: modFilesTable.id,
        modId: modFilesTable.modId,
        webContentLink: modFilesTable.webContentLink,
      })
      .from(modFilesTable)
      .innerJoin(modsTable, eq(modsTable.id, modFilesTable.modId))
      .innerJoin(usersTable, eq(usersTable.id, modsTable.authorId))
      .where(
        and(
          eq(modFilesTable.id, parsed.data.fileId),
          eq(modFilesTable.modId, parsed.data.modId),
          eq(modsTable.status, "published"),
          eq(usersTable.isBanned, false),
        ),
      )
      .limit(1);
    if (!file) {
      res.status(404).json({ error: "Файл не найден." });
      return;
    }

    await db
      .update(modsTable)
      .set({ downloadCount: sql`${modsTable.downloadCount} + 1` })
      .where(eq(modsTable.id, file.modId));
    res.redirect(302, file.webContentLink);
  },
);

export default router;
