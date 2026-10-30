// Client for the local print worker (`scripts/print-worker/worker.mjs`) running on the check-in PC.
// The dashboard talks to it over loopback HTTP so badges print with no browser print dialog.

export const DEFAULT_PRINT_WORKER_URL = "http://127.0.0.1:17777";
/** Object key of the uploaded archive inside the R2 bucket (as uploaded: note `-tar.gz`, not `.tar.gz`). */
export const PRINT_WORKER_ARCHIVE_KEY = "gdg-jakarta/gdg-print-worker-macos-arm64-tar.gz";
/** Production dashboard address the worker is told to accept (`setup --origin`). */
export const PRINT_WORKER_DASHBOARD_ORIGIN = "https://gdgjakarta.com";
export const PRINT_WORKER_BINARY_NAME = "gdg-print-worker";
const WORKER_URL_STORAGE_KEY = "gdg_print_worker_url";
const HEALTH_TIMEOUT_MS = 1500;
const PRINT_TIMEOUT_MS = 45_000;

export interface PrintWorkerPrinter {
  name: string | null;
  state: string;
  busy: boolean;
  /** False while the worker is skipping this printer after a failure. */
  available: boolean;
  lastError: string | null;
}

export interface PrintWorkerHealth {
  ok: boolean;
  version: string;
  printers: PrintWorkerPrinter[];
  /** Jobs waiting inside the worker for a free printer. */
  queued: number;
}

export interface PrintWorkerPayload {
  html: string;
  widthMm: number;
  heightMm: number;
  copies?: number;
}

/** Thrown when the worker cannot be reached at all (not running, blocked, or permission denied). */
export class PrintWorkerUnreachableError extends Error {
  constructor(cause?: unknown) {
    super("Print worker is not reachable");
    this.name = "PrintWorkerUnreachableError";
    this.cause = cause;
  }
}

export function getPrintWorkerUrl(): string {
  try {
    return window.localStorage.getItem(WORKER_URL_STORAGE_KEY)?.trim() || DEFAULT_PRINT_WORKER_URL;
  } catch {
    return DEFAULT_PRINT_WORKER_URL;
  }
}

export async function fetchPrintWorkerHealth(): Promise<PrintWorkerHealth | null> {
  try {
    const res = await fetch(`${getPrintWorkerUrl()}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = (await res.json()) as PrintWorkerHealth;
    return data.ok ? data : null;
  } catch {
    return null;
  }
}

export async function printViaWorker(payload: PrintWorkerPayload): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${getPrintWorkerUrl()}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(PRINT_TIMEOUT_MS),
    });
  } catch (err) {
    throw new PrintWorkerUnreachableError(err);
  }

  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error ?? `Print worker responded with ${res.status}`);
  }
}

/**
 * Where the packaged worker (`npm run print-worker:build`) is downloaded from. It is ~42 MB, over Cloudflare's
 * 25 MiB static asset limit, so it is hosted on R2: `<NEXT_PUBLIC_R2_PUBLIC_URL>/<PRINT_WORKER_ARCHIVE_KEY>`.
 * `NEXT_PUBLIC_PRINT_WORKER_DOWNLOAD_URL` overrides it (e.g. a GitHub Release).
 */
export function getPrintWorkerDownloadUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_PRINT_WORKER_DOWNLOAD_URL;
  if (explicit) return explicit;
  const r2BaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  return r2BaseUrl ? `${r2BaseUrl.replace(/\/$/, "")}/${PRINT_WORKER_ARCHIVE_KEY}` : `/${PRINT_WORKER_ARCHIVE_KEY}`;
}

/** File name the browser saves the download as (last path segment of the URL), used in the install commands. */
export function getPrintWorkerArchiveFileName(): string {
  const url = getPrintWorkerDownloadUrl();
  try {
    const segment = new URL(url, "http://localhost").pathname.split("/").filter(Boolean).pop();
    if (segment) return decodeURIComponent(segment);
  } catch {
    // fall through to the key's own name
  }
  return PRINT_WORKER_ARCHIVE_KEY.split("/").pop() ?? PRINT_WORKER_ARCHIVE_KEY;
}
