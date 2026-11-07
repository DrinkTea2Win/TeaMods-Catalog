import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

interface VirusTotalStats {
  malicious?: number;
}

interface VirusTotalApiResponse {
  data?: {
    id?: string;
    attributes?: {
      status?: string;
      stats?: VirusTotalStats;
      last_analysis_stats?: VirusTotalStats;
    };
  };
}

export class VirusTotalCheckError extends Error {
  constructor(message = "Не удалось проверить файл в VirusTotal.") {
    super(message);
    this.name = "VirusTotalCheckError";
  }
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

function getApiKey(): string {
  const key = process.env.VIRUSTOTAL_API_KEY?.trim();
  if (!key) throw new VirusTotalCheckError();
  return key;
}

async function requestJson(
  url: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<VirusTotalApiResponse> {
  const response = await fetchVirusTotal(
    url,
    {
    ...init,
    headers: {
      "x-apikey": apiKey,
      ...init.headers,
    },
    },
    20_000,
  );
  if (!response.ok) throw new VirusTotalCheckError();
  return (await response.json()) as VirusTotalApiResponse;
}

async function fetchVirusTotal(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut =
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "TimeoutError";
    throw new VirusTotalCheckError(
      timedOut
        ? "VirusTotal не ответил вовремя. Попробуйте загрузить файл позже."
        : "Не удалось связаться с VirusTotal. Загрузка отменена.",
    );
  }
}

function getMaliciousCount(stats: VirusTotalStats | undefined): number | null {
  const value = stats?.malicious;
  return Number.isInteger(value) && value !== undefined && value >= 0
    ? value
    : null;
}

async function uploadForAnalysis(
  filePath: string,
  fileName: string,
  fileSize: number,
  apiKey: string,
): Promise<string> {
  let uploadUrl = "https://www.virustotal.com/api/v3/files";
  if (fileSize > 32 * 1024 * 1024) {
    const response = await fetchVirusTotal(
      "https://www.virustotal.com/api/v3/files/upload_url",
      {
        headers: { "x-apikey": apiKey },
      },
      20_000,
    );
    if (!response.ok) throw new VirusTotalCheckError();
    const candidate: unknown = await response.json();
    if (typeof candidate !== "string") throw new VirusTotalCheckError();
    const parsedUrl = new URL(candidate);
    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hostname !== "www.virustotal.com"
    ) {
      throw new VirusTotalCheckError();
    }
    uploadUrl = parsedUrl.href;
  }

  const boundary = `----TeaMods${randomBytes(18).toString("hex")}`;
  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 180);
  const opening = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeName}"\r\nContent-Type: application/java-archive\r\n\r\n`,
  );
  const closing = Buffer.from(`\r\n--${boundary}--\r\n`);
  const multipart = Readable.from(
    (async function* () {
      yield opening;
      for await (const chunk of createReadStream(filePath)) yield chunk;
      yield closing;
    })(),
  );
  const body = Readable.toWeb(multipart) as ReadableStream<Uint8Array>;
  const contentLength = opening.length + fileSize + closing.length;

  const response = await fetchVirusTotal(
    uploadUrl,
    {
      method: "POST",
      headers: {
        "x-apikey": apiKey,
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "content-length": String(contentLength),
      },
      body,
      duplex: "half",
    },
    120_000,
  );

  if (!response.ok) throw new VirusTotalCheckError();
  const result = (await response.json()) as VirusTotalApiResponse;
  if (!result.data?.id) throw new VirusTotalCheckError();
  return result.data.id;
}

async function getAnalysisStats(
  analysisId: string,
  apiKey: string,
): Promise<number> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 15_000));
    }
    const result = await requestJson(
      `https://www.virustotal.com/api/v3/analyses/${encodeURIComponent(analysisId)}`,
      apiKey,
    );
    if (result.data?.attributes?.status === "completed") {
      const count = getMaliciousCount(result.data.attributes.stats);
      if (count === null) throw new VirusTotalCheckError();
      return count;
    }
  }
  throw new VirusTotalCheckError();
}

export async function checkWithVirusTotal(
  filePath: string,
  fileName: string,
  fileSize: number,
  sha256: string,
): Promise<{ maliciousDetections: number; isMalicious: boolean }> {
  const apiKey = getApiKey();
  const existingResponse = await fetchVirusTotal(
    `https://www.virustotal.com/api/v3/files/${encodeURIComponent(sha256)}`,
    {
      headers: { "x-apikey": apiKey },
    },
    20_000,
  );

  let maliciousDetections: number;
  if (existingResponse.ok) {
    const report = (await existingResponse.json()) as VirusTotalApiResponse;
    const count = getMaliciousCount(
      report.data?.attributes?.last_analysis_stats,
    );
    if (count === null) throw new VirusTotalCheckError();
    maliciousDetections = count;
  } else if (existingResponse.status === 404) {
    const analysisId = await uploadForAnalysis(
      filePath,
      fileName,
      fileSize,
      apiKey,
    );
    maliciousDetections = await getAnalysisStats(analysisId, apiKey);
  } else {
    throw new VirusTotalCheckError();
  }

  return {
    maliciousDetections,
    isMalicious: maliciousDetections > 5,
  };
}
