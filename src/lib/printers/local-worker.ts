// Client for the local GDG Print Station App (`GDG Print Station.app` / `scripts/print-worker/worker.mjs`) running on the check-in Mac.
// Supports both Chromium (Chrome, Brave, Edge, Arc) and WebKit (Safari, Orion) over loopback HTTP (`127.0.0.1` and `localhost`).

export const DEFAULT_PRINT_WORKER_URL = "http://127.0.0.1:17777";
export const FALLBACK_PRINT_WORKER_URL = "http://localhost:17777";
/** Where the packaged Print Station macOS Disk Image (.dmg) lives (Media page, `community-dashboard/app/`). */
export const PRINT_WORKER_DOWNLOAD_URL =
  "https://gdgjakarta.com/api/media/community-dashboard/app/GDG-Print-Station-macOS.dmg?v=2.5.0";
/** Production dashboard address the worker accepts out of the box. */
export const PRINT_WORKER_DASHBOARD_ORIGIN = "https://gdgjakarta.com";
export const PRINT_WORKER_BINARY_NAME = "gdg-print-worker";
export const PRINT_STATION_APP_NAME = "GDG Print Station.app";
const WORKER_URL_STORAGE_KEY = "gdg_print_worker_url";
const HEALTH_TIMEOUT_MS = 3000;
const PRINT_TIMEOUT_MS = 45_000;

export interface PrintWorkerPrinter {
  name: string | null;
  /** Transport layer reported by worker v2.5.0+ ("usb" for CUPS, "bluetooth" for CoreBluetooth CT221B). */
  transport?: "usb" | "bluetooth";
  /** CUPS device URI (USB) or Bluetooth peripheral UUID (BLE). */
  uri?: string | null;
  state: string;
  busy: boolean;
  /** False while the worker is skipping this printer after a failure. */
  available: boolean;
  lastError: string | null;
  /** Number of incomplete CUPS jobs currently queued on this printer (workers from 2.4.0). */
  queueDepth?: number;
  /** Whether the USB device is physically present on the USB bus (workers from 2.4.0). */
  usbConnected?: boolean;
  /** Whether the BLE GATT link is currently connected (workers from 2.5.0). */
  bluetoothConnected?: boolean;
  /** Last battery percentage (0–100) reported by CT221B BLE notify frames. */
  batteryPercent?: number | null;
  /** CoreBluetooth peripheral UUID for disconnect/toggle actions. */
  bluetoothId?: string | null;
}

export interface PrintWorkerDevice {
  /** Stable hardware machine identifier (e.g. macOS IOPlatformUUID hash) so 1 Mac = 1 station across Safari & Chrome. */
  id?: string;
  computerName: string;
  model: string | null;
  os: string;
  /** "menubar" when running as the native macOS Menu Bar app (`GDG Print Station.app`), "cli" when running via Node. */
  appMode?: "menubar" | "cli";
  /** macOS CoreBluetooth state (e.g. "poweredOn", "poweredOff", "unauthorized") on v2.5.0+. */
  bluetoothState?: string;
}

export interface PrintWorkerHealth {
  ok: boolean;
  version: string;
  /** Which laptop the worker runs on. Missing on workers older than 2.3.0. */
  device?: PrintWorkerDevice;
  printers: PrintWorkerPrinter[];
  /** Jobs waiting inside the worker for a free printer. */
  queued: number;
}

export interface PrintWorkerPayload {
  /** Deterministic job ID for worker-side idempotency so timed-out retries never print twice. */
  jobId?: string;
  /** Attendee name displayed on the macOS Notch Dynamic Island HUD while printing. */
  attendeeName?: string;
  html: string;
  widthMm: number;
  heightMm: number;
  copies?: number;
  /** Print on exactly this printer (workers from 2.3.0). Without it the worker picks an idle one itself. */
  printer?: string;
  /** Optional thermal darkness (1–15, default 8) for Bluetooth TSPL printers. */
  density?: number;
  /** Optional label gap in mm (default 2) for Bluetooth TSPL printers. */
  gapMm?: number;
}

export interface WorkerBluetoothDevice {
  id: string;
  name: string;
  rssi: number;
  connected: boolean;
  batteryPercent?: number | null;
}

export interface WorkerBluetoothScanResult {
  ok: boolean;
  bluetoothState?: string;
  devices: WorkerBluetoothDevice[];
  error?: string;
}

export interface PrintWorkerResult {
  /** Printer that printed, as the worker reports it (null for the system default). */
  printer: string | null;
}

/** Thrown when the worker cannot be reached at all (not running, blocked, or permission denied). */
export class PrintWorkerUnreachableError extends Error {
  constructor(cause?: unknown) {
    super("GDG Print Station App is not running or not reachable on this Mac");
    this.name = "PrintWorkerUnreachableError";
    this.cause = cause;
  }
}

let activeBaseUrl: string | null = null;

export function getPrintWorkerUrl(): string {
  try {
    const custom = window.localStorage.getItem(WORKER_URL_STORAGE_KEY)?.trim();
    if (custom) return custom;
  } catch {
    // ignore storage access errors
  }
  return activeBaseUrl || DEFAULT_PRINT_WORKER_URL;
}

function getCandidateWorkerUrls(): string[] {
  try {
    const custom = window.localStorage.getItem(WORKER_URL_STORAGE_KEY)?.trim();
    if (custom) return [custom];
  } catch {
    // ignore
  }
  if (activeBaseUrl === FALLBACK_PRINT_WORKER_URL) {
    return [FALLBACK_PRINT_WORKER_URL, DEFAULT_PRINT_WORKER_URL];
  }
  return [DEFAULT_PRINT_WORKER_URL, FALLBACK_PRINT_WORKER_URL];
}

/** Cross-browser fetch with timeout that works cleanly across older & newer WebKit (Safari) and Chromium engines. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function fetchPrintWorkerHealth(): Promise<PrintWorkerHealth | null> {
  for (const baseUrl of getCandidateWorkerUrls()) {
    try {
      const res = await fetchWithTimeout(`${baseUrl}/health`, { method: "GET" }, HEALTH_TIMEOUT_MS);
      if (!res.ok) continue;
      const data = (await res.json()) as PrintWorkerHealth;
      if (data.ok) {
        activeBaseUrl = baseUrl;
        return data;
      }
    } catch {
      // Try next loopback candidate (`127.0.0.1` <-> `localhost` for WebKit/Chromium compatibility)
    }
  }
  return null;
}

export async function printViaWorker(payload: PrintWorkerPayload): Promise<PrintWorkerResult> {
  let res: Response | null = null;
  let lastNetworkErr: unknown = null;

  for (const baseUrl of getCandidateWorkerUrls()) {
    try {
      res = await fetchWithTimeout(
        `${baseUrl}/print`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        PRINT_TIMEOUT_MS,
      );
      activeBaseUrl = baseUrl;
      break;
    } catch (err) {
      lastNetworkErr = err;
    }
  }

  if (!res) {
    throw new PrintWorkerUnreachableError(lastNetworkErr);
  }

  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; printer?: string | null } | null;
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error ?? `Print Station App responded with ${res.status}`);
  }
  return { printer: data.printer ?? null };
}

const BLUETOOTH_SCAN_TIMEOUT_MS = 10_000;

async function postWorkerJson<T>(path: string, body: Record<string, unknown>, timeoutMs: number): Promise<T> {
  let res: Response | null = null;
  let lastErr: unknown = null;
  for (const baseUrl of getCandidateWorkerUrls()) {
    try {
      res = await fetchWithTimeout(
        `${baseUrl}${path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        timeoutMs,
      );
      activeBaseUrl = baseUrl;
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!res) {
    throw new PrintWorkerUnreachableError(lastErr);
  }
  const data = (await res.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error ?? `Print Station App responded with ${res.status}`);
  }
  return data;
}

export async function scanWorkerBluetoothPrinters(): Promise<WorkerBluetoothScanResult> {
  return postWorkerJson<WorkerBluetoothScanResult>("/bluetooth/scan", {}, BLUETOOTH_SCAN_TIMEOUT_MS);
}

export async function connectWorkerBluetoothPrinter(
  id: string,
  name?: string,
): Promise<{ ok: boolean; printer?: string }> {
  return postWorkerJson<{ ok: boolean; printer?: string }>(
    "/bluetooth/connect",
    { id, ...(name ? { name } : {}) },
    15_000,
  );
}

export async function disconnectWorkerBluetoothPrinter(id: string): Promise<{ ok: boolean }> {
  return postWorkerJson<{ ok: boolean }>("/bluetooth/disconnect", { id }, 8_000);
}

/**
 * Where the packaged worker (`npm run print-worker:build`) is downloaded from. It is ~42 MB, over Cloudflare's
 * 25 MiB static asset limit, so it is hosted in the R2 media bucket and served through `/api/media/...`.
 * `NEXT_PUBLIC_PRINT_WORKER_DOWNLOAD_URL` overrides it (e.g. a GitHub Release).
 */
export function getPrintWorkerDownloadUrl(): string {
  return process.env.NEXT_PUBLIC_PRINT_WORKER_DOWNLOAD_URL || PRINT_WORKER_DOWNLOAD_URL;
}

/** File name the browser saves the download as (last path segment of the URL), used in the install commands. */
export function getPrintWorkerArchiveFileName(): string {
  const url = getPrintWorkerDownloadUrl();
  try {
    const segment = new URL(url, "http://localhost").pathname.split("/").filter(Boolean).pop();
    if (segment) return decodeURIComponent(segment);
  } catch {
    // fall through to the default file name
  }
  return "GDG-Print-Station-macOS.dmg";
}
