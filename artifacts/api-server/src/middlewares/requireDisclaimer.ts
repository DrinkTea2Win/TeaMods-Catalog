import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const DISCLAIMER_COOKIE = "tea_disclaimer";

function expectedCookieValue(): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const signature = createHmac("sha256", secret)
    .update("TeaMods disclaimer accepted v1")
    .digest("hex");
  return `v1.${signature}`;
}

export function hasAcceptedDisclaimer(req: Request): boolean {
  const expected = expectedCookieValue();
  const actual = req.cookies?.[DISCLAIMER_COOKIE];
  if (!expected || typeof actual !== "string") return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return (
    expectedBytes.length === actualBytes.length &&
    timingSafeEqual(expectedBytes, actualBytes)
  );
}

export function requireDisclaimer(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!hasAcceptedDisclaimer(req)) {
    res.status(403).json({
      error: "Сначала подтвердите согласие с условиями.",
      code: "DISCLAIMER_REQUIRED",
    });
    return;
  }
  next();
}

export function setDisclaimerCookie(res: Response): void {
  const value = expectedCookieValue();
  if (!value) throw new Error("SESSION_SECRET is required for disclaimer consent");
  res.cookie(DISCLAIMER_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api",
    maxAge: 365 * 24 * 60 * 60 * 1000,
  });
}
