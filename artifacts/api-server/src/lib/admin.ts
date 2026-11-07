const ADMIN_EMAILS = new Set(
  [
    "slavamer28@gmail.com",
    ...(process.env.TEAMODS_ADMIN_EMAILS ?? "").split(","),
  ]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.has(email.trim().toLowerCase());
}
