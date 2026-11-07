import { open } from "node:fs/promises";
import { google } from "googleapis";
import type { drive_v3 } from "googleapis";

const DRIVE_CHUNK_BYTES = 8 * 1024 * 1024;
const DRIVE_API_BASE = "https://www.googleapis.com";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

interface ServiceAccountCredentials {
  type?: string;
  project_id?: string;
  private_key_id?: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
  universe_domain?: string;
}

interface DriveFileResponse {
  id?: string;
  name?: string;
  webContentLink?: string;
}

interface GoogleApiErrorBody {
  error?: {
    status?: string;
    errors?: { reason?: string }[];
  };
}

interface AuthorizedRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  data?: unknown;
  validateStatus?: (status: number) => boolean;
}

type ServiceAuth = InstanceType<typeof google.auth.JWT>;

export class GoogleDriveApiError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly reason?: string,
  ) {
    super(
      `Google Drive returned HTTP ${httpStatus}${reason ? ` (${reason})` : ""}`,
    );
    this.name = "GoogleDriveApiError";
  }
}

let serviceAuth: ServiceAuth | null = null;
let driveClient: drive_v3.Drive | null = null;

function getServiceAccountCredentials(): ServiceAccountCredentials {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Google service account is not configured");

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Google service account configuration is invalid");
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !("client_email" in value) ||
    typeof value.client_email !== "string" ||
    !("private_key" in value) ||
    typeof value.private_key !== "string"
  ) {
    throw new Error("Google service account configuration is invalid");
  }

  const credentials = value as ServiceAccountCredentials;
  if (
    credentials.token_uri &&
    credentials.token_uri !== "https://oauth2.googleapis.com/token"
  ) {
    throw new Error("Google service account token endpoint is invalid");
  }
  credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  return credentials;
}

function getServiceAuth(): ServiceAuth {
  if (!serviceAuth) {
    const credentials = getServiceAccountCredentials();
    serviceAuth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [DRIVE_SCOPE],
    });
  }
  return serviceAuth;
}

function getDriveClient(): drive_v3.Drive {
  if (!driveClient) {
    driveClient = google.drive({ version: "v3", auth: getServiceAuth() });
  }
  return driveClient;
}

function getFolderId(): string {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!folderId) throw new Error("Google Drive folder is not configured");
  return folderId;
}

function getDriveUrl(path: string): string {
  const url = new URL(path, DRIVE_API_BASE);
  if (
    url.protocol !== "https:" ||
    (url.hostname !== "googleapis.com" &&
      !url.hostname.endsWith(".googleapis.com"))
  ) {
    throw new Error("Google Drive returned an invalid URL");
  }
  return url.href;
}

function readGoogleApiError(error: unknown): {
  status?: number;
  reason?: string;
} {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return {};
  }
  const response = error.response;
  if (typeof response !== "object" || response === null) return {};

  const status =
    "status" in response && typeof response.status === "number"
      ? response.status
      : undefined;
  const data =
    "data" in response && typeof response.data === "object" && response.data
      ? (response.data as GoogleApiErrorBody)
      : undefined;
  const reason =
    data?.error?.errors?.find((detail) => detail.reason)?.reason ??
    data?.error?.status;
  return { status, reason };
}

function rethrowDriveError(error: unknown): never {
  if (error instanceof GoogleDriveApiError) throw error;
  const details = readGoogleApiError(error);
  if (details.status !== undefined) {
    throw new GoogleDriveApiError(details.status, details.reason);
  }
  throw new Error("Google Drive request failed");
}

async function authorizedRequest<T>(
  url: string,
  options: AuthorizedRequestOptions,
) {
  try {
    // Use Google's official auth transport for explicit 8 MiB resumable chunks;
    // the generated Drive client still handles permissions and file metadata.
    const authClient = getServiceAuth();
    return await authClient.request<T>({
      url: getDriveUrl(url),
      method: options.method,
      params: options.params,
      headers: options.headers,
      data: options.data,
      validateStatus:
        options.validateStatus ??
        ((status) => status >= 200 && status < 300),
    });
  } catch (error) {
    rethrowDriveError(error);
  }
}

async function driveApiCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    rethrowDriveError(error);
  }
}

export async function uploadJarToDrive(
  filePath: string,
  fileName: string,
  fileSize: number,
): Promise<{ driveFileId: string }> {
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
    throw new Error("The uploaded file is empty or has an invalid size");
  }

  const initResponse = await authorizedRequest<unknown>(
    "/upload/drive/v3/files",
    {
      method: "POST",
      params: { uploadType: "resumable", supportsAllDrives: true },
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "application/java-archive",
        "X-Upload-Content-Length": String(fileSize),
      },
      data: {
        name: fileName,
        mimeType: "application/java-archive",
        parents: [getFolderId()],
      },
    },
  );

  const location = initResponse.headers.get("location");
  if (!location) throw new Error("Google Drive did not return an upload session");
  const sessionUrl = getDriveUrl(location);

  const handle = await open(filePath, "r");
  let uploadedFile: DriveFileResponse | null = null;
  try {
    let start = 0;
    let noProgressRetries = 0;
    while (start < fileSize) {
      const chunkLength = Math.min(DRIVE_CHUNK_BYTES, fileSize - start);
      const chunk = Buffer.allocUnsafe(chunkLength);
      const { bytesRead } = await handle.read(chunk, 0, chunkLength, start);
      if (bytesRead !== chunkLength) {
        throw new Error("Could not read the complete uploaded file");
      }

      const end = start + chunkLength - 1;
      const response = await authorizedRequest<DriveFileResponse>(sessionUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/java-archive",
          "Content-Length": String(chunkLength),
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        },
        data: chunk,
        validateStatus: (status) =>
          (status >= 200 && status < 300) || status === 308,
      });

      if (response.status === 200 || response.status === 201) {
        uploadedFile = response.data;
        break;
      }
      if (response.status !== 308) {
        throw new Error("Google Drive interrupted the file upload");
      }

      const range = response.headers.get("range");
      const acceptedEnd = range
        ? Number(range.match(/bytes=0-(\d+)/)?.[1])
        : start - 1;
      if (
        !Number.isInteger(acceptedEnd) ||
        acceptedEnd < start - 1 ||
        acceptedEnd > end
      ) {
        throw new Error("Google Drive returned an invalid upload range");
      }
      const nextStart = acceptedEnd + 1;
      if (nextStart <= start) {
        noProgressRetries += 1;
        if (noProgressRetries > 3) {
          throw new Error("Google Drive upload made no progress");
        }
      } else {
        noProgressRetries = 0;
      }
      start = nextStart;
    }
  } finally {
    await handle.close();
  }

  if (!uploadedFile?.id) {
    throw new Error("Google Drive did not return a file ID");
  }
  return { driveFileId: uploadedFile.id };
}

export async function publishDriveFile(
  driveFileId: string,
): Promise<string> {
  const drive = getDriveClient();
  await driveApiCall(() =>
    drive.permissions.create({
      fileId: driveFileId,
      requestBody: { type: "anyone", role: "reader" },
      supportsAllDrives: true,
      fields: "id",
    }),
  );

  const response = await driveApiCall(() =>
    drive.files.get({
      fileId: driveFileId,
      supportsAllDrives: true,
      fields: "id,name,webContentLink",
    }),
  );
  const webContentLink = response.data.webContentLink;
  if (!webContentLink) {
    throw new Error("Google Drive did not return a download link");
  }
  const downloadUrl = new URL(webContentLink);
  if (
    downloadUrl.protocol !== "https:" ||
    !(
      downloadUrl.hostname.endsWith(".google.com") ||
      downloadUrl.hostname.endsWith(".googleusercontent.com")
    )
  ) {
    throw new Error("Google Drive returned an invalid download link");
  }
  return downloadUrl.href;
}

export async function deleteDriveFile(driveFileId: string): Promise<void> {
  const drive = getDriveClient();
  await driveApiCall(() =>
    drive.files.delete({
      fileId: driveFileId,
      supportsAllDrives: true,
    }),
  );
}
