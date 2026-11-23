"use client";

import * as React from "react";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { toast } from "sonner";

import {
  claimPrintJob,
  db,
  failLostPrintJob,
  finishPrintJob,
  removePrintStation,
  subscribePendingPrintQueue,
  subscribePrintStations,
  upsertPrintStation,
} from "@/lib/firestore/client";
import type { FirestoreRegistration } from "@/lib/firestore/types";
import { buildDeterministicCheckInJobId, enqueueCheckInBadgeIfEnabled } from "@/lib/printers/checkin-auto-print";
import { fetchPrintWorkerHealth, type PrintWorkerHealth, printViaWorker } from "@/lib/printers/local-worker";
import { buildPrintDocument } from "@/lib/printers/templates";
import {
  BROWSER_PRINTER_NAME,
  isPrintStationOnline,
  PRINT_STATION_LOST_MS,
  type PrintJob,
  type PrintStation,
  type PrintStationPrinter,
  printerKey,
} from "@/lib/printers/types";
import {
  connectWebBluetoothCT221B,
  isWebBluetoothSupported,
  printViaWebBluetooth,
  type WebBluetoothPrinterHandle,
} from "@/lib/printers/web-bluetooth-ct221b";

const DEVICE_STATION_ID_STORAGE_KEY = "gdg_print_station_device_id";
const LEGACY_TAB_STATION_ID_KEY = "gdg_print_station_id";
export const STATION_RUNNING_STORAGE_KEY = "gdg_print_station_running";
const LEADER_LEASE_STORAGE_KEY = "gdg_print_station_leader_lease";
const LEADER_LEASE_TTL_MS = 15_000;
const HEARTBEAT_MS = 10_000;
const SWEEP_MS = 15_000;
const PRESENCE_DEBOUNCE_MS = 1_200;
/** A job this laptop itself holds but no longer works on (tab was reloaded mid-print) is failed after this long. */
const ORPHAN_JOB_MS = 30_000;
/** Stations silent for this long are cleaned up from Firestore. */
const STALE_STATION_DELETE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PRINTER_KEY = "default";
const MAX_CONSECUTIVE_CLAIM_ERRORS = 5;

function newRandomDeviceId(): string {
  return `stn_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Derives a canonical station ID for a physical laptop from its hardware info (`IOPlatformUUID` or computerName+model)
 * so Safari (WebKit) and Chrome (Chromium) on the same Mac share the exact same station document.
 */
export function canonicalStationIdFromHealth(health: PrintWorkerHealth | null): string | null {
  if (!health?.device) return null;
  const raw = health.device.id?.trim() || `${health.device.computerName || ""}_${health.device.model || ""}`.trim();
  if (!raw || raw === "_") return null;
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return slug ? `stn_${slug}` : null;
}

/** One ID per physical device (stored in `localStorage`, upgraded to hardware ID when worker connects). */
export function readDeviceStationId(): string {
  try {
    // Clean up old per-tab sessionStorage ID if present
    const legacyTabId = window.sessionStorage.getItem(LEGACY_TAB_STATION_ID_KEY);
    if (legacyTabId) {
      window.sessionStorage.removeItem(LEGACY_TAB_STATION_ID_KEY);
      void removePrintStation(legacyTabId).catch(() => undefined);
    }
    const existing = window.localStorage.getItem(DEVICE_STATION_ID_STORAGE_KEY)?.trim();
    if (existing) return existing;
    const created = newRandomDeviceId();
    window.localStorage.setItem(DEVICE_STATION_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return newRandomDeviceId();
  }
}

export function readPersistedStationRunning(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STATION_RUNNING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writePersistedStationRunning(running: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATION_RUNNING_STORAGE_KEY, running ? "true" : "false");
    window.dispatchEvent(new CustomEvent("gdg-print-station-running-change", { detail: { running } }));
  } catch {
    // ignore storage errors
  }
}

/**
 * Deduplicates stations that belong to the same physical laptop (e.g. if a stale random ID document exists alongside
 * the canonical hardware station ID, or if Safari and Chrome reported before hardware ID sync).
 */
export function deduplicatePrintStations(
  stations: PrintStation[],
  ownStationId?: string | null,
): { unique: PrintStation[]; duplicateIdsToRemove: string[] } {
  const byDeviceId = new Map<string, PrintStation>();
  const byNameModel = new Map<string, PrintStation>();
  const uniqueList: PrintStation[] = [];
  const duplicateIdsToRemove: string[] = [];
  const now = Date.now();

  // Sort online + ownStationId + freshest first so the live canonical doc always wins over stale offline docs.
  const sorted = [...stations].sort((a, b) => {
    const aOnline = isPrintStationOnline(a, now);
    const bOnline = isPrintStationOnline(b, now);
    if (aOnline !== bOnline) return aOnline ? -1 : 1;
    if (ownStationId) {
      if (a.id === ownStationId && b.id !== ownStationId) return -1;
      if (b.id === ownStationId && a.id !== ownStationId) return 1;
    }
    const timeDiff = new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });

  for (const station of sorted) {
    const devKey = station.device_id?.trim().toLowerCase() || null;
    const rawName = station.name?.trim() || "";
    const isGenericName = !rawName || rawName === "This Mac" || rawName === "This laptop";
    const nameKey = !isGenericName
      ? `name:${rawName.toLowerCase()}::${(station.model ?? "").trim().toLowerCase()}`
      : null;

    const existingByDev = devKey ? byDeviceId.get(devKey) : undefined;
    const existingByName = nameKey ? byNameModel.get(nameKey) : undefined;
    const existing = existingByDev ?? existingByName;

    if (!existing) {
      uniqueList.push(station);
      if (devKey) byDeviceId.set(devKey, station);
      if (nameKey) byNameModel.set(nameKey, station);
    } else {
      duplicateIdsToRemove.push(station.id);
    }
  }

  const unique = uniqueList.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return { unique, duplicateIdsToRemove };
}

interface UsePrintStationOptions {
  /** Start Print Station switch: while on, this laptop takes jobs from the queue. */
  isStationRunning: boolean;
  userEmail?: string;
  /** Optional target event ID to watch for real-time check-in transitions (`is_checked_in: true`). */
  selectedEventId?: string;
  /** Wraps a rendered label body into the full document the worker prints. */
  buildDocument?: (
    bodyHtml: string,
    widthMm?: number,
    heightMm?: number,
    orientation?: "portrait" | "landscape",
  ) => string;
  widthMm: number;
  heightMm: number;
  orientation?: "portrait" | "landscape";
  /** Optional thermal darkness (1–15, default 8) for Bluetooth TSPL printers. */
  bluetoothDensity?: number;
  /** Optional label gap in mm (default 2) for Bluetooth TSPL printers. */
  bluetoothGapMm?: number;
  /** Fallback when manually printing through the hidden iframe / browser dialog. */
  printInBrowser?: (bodyHtml: string) => Promise<void>;
  /** Recent jobs, used to fail jobs whose laptop vanished mid-print. */
  recentJobs: PrintJob[];
}

export interface PrintStationState {
  stationId: string | null;
  stationName: string;
  health: PrintWorkerHealth | null;
  healthRef: React.RefObject<PrintWorkerHealth | null>;
  isCheckingWorker: boolean;
  recheckWorker: () => Promise<void>;
  /** Every unique laptop that reported in (this one included), from Firestore. */
  stations: PrintStation[];
  /** True until the initial Firestore print stations snapshot resolves. */
  isLoadingStations: boolean;
  /** Non-null when Firestore rules or connectivity prevented reading the print queue / stations. */
  queueError: string | null;
  /** True when this browser tab is the active leader for this physical laptop. */
  isLeaderTab: boolean;
  /** True in Chromium browsers that support direct Web Bluetooth (`navigator.bluetooth`). */
  webBluetoothSupported: boolean;
  /** Active CT221B printers paired directly in this browser tab via Web Bluetooth. */
  webBluetoothPrinters: WebBluetoothPrinterHandle[];
  connectWebBluetoothPrinter: () => Promise<WebBluetoothPrinterHandle | null>;
  disconnectWebBluetoothPrinter: (id: string) => void;
}

/**
 * Connects this laptop to the print queue:
 * - Resolves a single station ID per physical Mac (`IOPlatformUUID` / `localStorage`) so multiple tabs or browsers
 *   never create duplicate laptops in `Connected Print Stations & Printers`.
 * - Elects a single leader tab per laptop so two open tabs don't double-claim on the same USB printers.
 * - Supports 2+ printers on the same laptop in parallel: each idle printer (`${stationId}::${printerName}`) claims
 *   its own job in a Firestore transaction and pins `POST /print` to that specific printer.
 * - Watches `event_registrations` check-ins when active so any check-in anywhere in the app with Auto-Print enabled
 *   automatically enters `print_jobs`.
 */
export function usePrintStation(options: UsePrintStationOptions): PrintStationState {
  const { isStationRunning, userEmail, recentJobs, selectedEventId } = options;

  const [stationId, setStationId] = React.useState<string | null>(null);
  const [health, setHealth] = React.useState<PrintWorkerHealth | null>(null);
  const [isCheckingWorker, setIsCheckingWorker] = React.useState(false);
  const [stations, setStations] = React.useState<PrintStation[]>([]);
  const [isLoadingStations, setIsLoadingStations] = React.useState(true);
  const [queueError, setQueueError] = React.useState<string | null>(null);
  const [isLeaderTab, setIsLeaderTab] = React.useState(true);
  const [webBluetoothSupported, setWebBluetoothSupported] = React.useState(false);
  const [webBluetoothPrinters, setWebBluetoothPrinters] = React.useState<WebBluetoothPrinterHandle[]>([]);

  const tabInstanceIdRef = React.useRef<string>(
    `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
  );
  const isLeaderTabRef = React.useRef(true);
  const stationIdRef = React.useRef<string | null>(null);
  const healthRef = React.useRef<PrintWorkerHealth | null>(null);
  const webBluetoothPrintersRef = React.useRef<WebBluetoothPrinterHandle[]>([]);
  const stationsRef = React.useRef<PrintStation[]>([]);
  const pendingJobsRef = React.useRef<PrintJob[]>([]);
  const recentJobsRef = React.useRef<PrintJob[]>(recentJobs);
  const optionsRef = React.useRef(options);
  const stationNameRef = React.useRef("This Mac");
  /** printer name -> job id it is claiming/printing on this laptop right now (supports 2+ printers in parallel). */
  const activePrintersRef = React.useRef<Map<string, string>>(new Map());
  const claimingJobIdsRef = React.useRef<Set<string>>(new Set());
  const lastUsedRef = React.useRef<Map<string, number>>(new Map());
  /** jobId -> timestamp until which this laptop should skip retrying a failed claim (exponential backoff). */
  const jobBackoffUntilRef = React.useRef<Map<string, { until: number; tries: number }>>(new Map());
  const consecutiveErrorsRef = React.useRef(0);
  const presenceTimerRef = React.useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const registeredRef = React.useRef(false);
  const initialHealthCheckDoneRef = React.useRef(false);

  optionsRef.current = options;
  recentJobsRef.current = recentJobs;

  // Initialize device station ID and leader-tab election
  React.useEffect(() => {
    const id = readDeviceStationId();
    stationIdRef.current = id;
    setStationId(id);

    const tabId = tabInstanceIdRef.current;
    const acquireOrRenewLease = (): boolean => {
      try {
        const now = Date.now();
        const raw = window.localStorage.getItem(LEADER_LEASE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { tabId?: string; expiresAt?: number; running?: boolean };
          // Another tab holds a live lease and is running (or we aren't running): yield to it
          if (
            parsed.tabId &&
            parsed.tabId !== tabId &&
            typeof parsed.expiresAt === "number" &&
            parsed.expiresAt > now &&
            (parsed.running || !optionsRef.current.isStationRunning)
          ) {
            isLeaderTabRef.current = false;
            setIsLeaderTab(false);
            return false;
          }
        }
        window.localStorage.setItem(
          LEADER_LEASE_STORAGE_KEY,
          JSON.stringify({
            tabId,
            expiresAt: now + LEADER_LEASE_TTL_MS,
            running: optionsRef.current.isStationRunning,
          }),
        );
        isLeaderTabRef.current = true;
        setIsLeaderTab(true);
        return true;
      } catch {
        isLeaderTabRef.current = true;
        setIsLeaderTab(true);
        return true;
      }
    };

    acquireOrRenewLease();
    const leaseTimer = window.setInterval(acquireOrRenewLease, 5_000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === LEADER_LEASE_STORAGE_KEY) {
        acquireOrRenewLease();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(leaseTimer);
      window.removeEventListener("storage", onStorage);
      try {
        const raw = window.localStorage.getItem(LEADER_LEASE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { tabId?: string };
          if (parsed.tabId === tabId) {
            window.localStorage.removeItem(LEADER_LEASE_STORAGE_KEY);
          }
        }
      } catch {
        // ignore
      }
    };
  }, []);

  const stationName = health?.device?.computerName ?? "This Mac";
  stationNameRef.current = stationName;

  // Detect Chromium Web Bluetooth support client-side
  React.useEffect(() => {
    setWebBluetoothSupported(isWebBluetoothSupported());
  }, []);

  /**
   * Printers connected to this laptop's Print Station App (USB + CoreBluetooth BLE) or direct Web Bluetooth.
   * IMPORTANT (Weakness F fix): Never return a fake "Browser print dialog" printer when offline.
   */
  const getLocalPrinters = React.useCallback((): PrintStationPrinter[] => {
    const active = activePrintersRef.current;
    const current = healthRef.current;
    const workerList: PrintStationPrinter[] = current
      ? current.printers.map((printer) => {
          const key = printer.name ?? DEFAULT_PRINTER_KEY;
          const isBle = printer.transport === "bluetooth";
          const usbOk = isBle ? true : printer.usbConnected !== false;
          const btOk = isBle ? printer.bluetoothConnected !== false : undefined;
          const queueStuck = !isBle && (printer.queueDepth ?? 0) > 5;
          const linkOk = isBle ? btOk !== false : usbOk;
          return {
            name: printer.name,
            transport: isBle ? "bluetooth" : "usb",
            device_uri: printer.uri ?? null,
            state: !linkOk ? (isBle ? "Bluetooth disconnected" : "USB not connected") : printer.state,
            busy: printer.busy || active.has(key),
            available: printer.available && linkOk && !queueStuck,
            last_error: !linkOk
              ? isBle
                ? "Bluetooth printer disconnected or turned off"
                : "USB printer unplugged or turned off"
              : queueStuck
                ? `${printer.queueDepth} stuck jobs in CUPS queue`
                : printer.lastError,
            current_job_id: active.get(key) ?? null,
            queue_depth: printer.queueDepth ?? 0,
            usb_connected: usbOk,
            bluetooth_connected: btOk,
            battery_percent: printer.batteryPercent ?? null,
          };
        })
      : [];

    const webBleList: PrintStationPrinter[] = webBluetoothPrintersRef.current.map((bt) => {
      const displayName = bt.name.endsWith(" (Web BLE)") ? bt.name : `${bt.name} (Web BLE)`;
      const connected = bt.connected && Boolean(bt.device.gatt?.connected);
      return {
        name: displayName,
        transport: "web_bluetooth",
        device_uri: `web-ble://${bt.id}`,
        state: connected ? "idle (Web Bluetooth)" : "Bluetooth disconnected",
        busy: active.has(displayName),
        available: connected,
        last_error: connected ? null : (bt.lastError ?? "Web Bluetooth disconnected"),
        current_job_id: active.get(displayName) ?? null,
        queue_depth: 0,
        usb_connected: true,
        bluetooth_connected: connected,
        battery_percent: bt.batteryPercent,
      };
    });

    return [...workerList, ...webBleList];
  }, []);

  const publishPresenceImmediate = React.useCallback(async () => {
    if (!isLeaderTabRef.current || !initialHealthCheckDoneRef.current) return;
    const id = stationIdRef.current;
    if (!id) return;
    const current = healthRef.current;
    const hasWebBle = webBluetoothPrintersRef.current.some((p) => p.connected && p.device.gatt?.connected);
    const hasLiveTransport = current !== null || hasWebBle;
    const running = optionsRef.current.isStationRunning;

    // Nothing to report: no worker, no Web BLE, and not taking jobs. Don't leave a ghost laptop in the list.
    if (!hasLiveTransport && !running) {
      if (registeredRef.current) {
        registeredRef.current = false;
        await removePrintStation(id).catch(() => undefined);
      }
      return;
    }

    registeredRef.current = true;
    try {
      await upsertPrintStation({
        id,
        device_id: current?.device?.id ?? id,
        name: current?.device?.computerName ?? (hasWebBle ? "Browser Bluetooth Station" : stationNameRef.current),
        model: current?.device?.model ?? undefined,
        os: current?.device?.os ?? undefined,
        worker_version: current?.version,
        worker_connected: hasLiveTransport,
        station_running: running && hasLiveTransport,
        printers: getLocalPrinters(),
        user_email: optionsRef.current.userEmail,
      });
    } catch (err) {
      console.warn("[Print Station] Heartbeat failed:", err);
    }
  }, [getLocalPrinters]);

  /** Debounced presence publisher so rapid claim/finish cycles don't burn Firestore write quota (Weakness C). */
  const publishPresence = React.useCallback(() => {
    if (presenceTimerRef.current) {
      globalThis.clearTimeout(presenceTimerRef.current);
    }
    presenceTimerRef.current = globalThis.setTimeout(() => {
      presenceTimerRef.current = null;
      void publishPresenceImmediate();
    }, PRESENCE_DEBOUNCE_MS);
  }, [publishPresenceImmediate]);

  /** True when some other online printer (on this laptop or another laptop) could still take this job after `failedKey` failed it. */
  const canRetryElsewhere = React.useCallback((job: PrintJob, failedKey: string): boolean => {
    const now = Date.now();
    return stationsRef.current.some(
      (station) =>
        station.station_running &&
        station.worker_connected &&
        isPrintStationOnline(station, now) &&
        station.printers.some((printer) => {
          if (!printer.available) return false;
          const key = printerKey(station.id, printer.name);
          return key !== failedKey && !job.excluded_printers?.includes(key);
        }),
    );
  }, []);

  const runClaimedJob = React.useCallback(
    async (job: PrintJob, printer: PrintStationPrinter, id: string) => {
      const {
        buildDocument,
        widthMm,
        heightMm,
        orientation = "landscape",
        bluetoothDensity,
        bluetoothGapMm,
      } = optionsRef.current;
      const jobWidthMm = job.paper_width_mm ?? widthMm;
      const jobHeightMm = job.paper_height_mm ?? heightMm;
      const jobOrientation = job.orientation ?? orientation;
      const key = printerKey(id, printer.name);

      try {
        const fullHtml = buildDocument
          ? buildDocument(job.rendered_html, jobWidthMm, jobHeightMm, jobOrientation)
          : buildPrintDocument(job.rendered_html, jobWidthMm, jobHeightMm, jobOrientation);

        let printedOn: string | null = printer.name;

        if (printer.transport === "web_bluetooth") {
          const btId = printer.device_uri?.replace(/^web-ble:\/\//, "");
          const handle = webBluetoothPrintersRef.current.find(
            (h) => h.id === btId || `${h.name} (Web BLE)` === printer.name || h.name === printer.name,
          );
          if (!handle || !handle.connected) {
            throw new Error("Web Bluetooth printer disconnected before printing could start.");
          }
          await printViaWebBluetooth(handle, {
            html: fullHtml,
            widthMm: jobWidthMm,
            heightMm: jobHeightMm,
            density: bluetoothDensity,
            gapMm: bluetoothGapMm,
          });
        } else {
          if (!healthRef.current || printer.name === BROWSER_PRINTER_NAME) {
            throw new Error("GDG Print Station App disconnected before printing could start.");
          }
          const result = await printViaWorker({
            jobId: job.id,
            attendeeName: job.member_name,
            html: fullHtml,
            widthMm: jobWidthMm,
            heightMm: jobHeightMm,
            density: bluetoothDensity,
            gapMm: bluetoothGapMm,
            // Pinned to this specific printer slot so 2 printers on 1 laptop print their own assigned jobs concurrently.
            printer: printer.name ?? undefined,
          });
          printedOn = result.printer ?? printer.name;
        }

        await finishPrintJob(job.id, id, { ok: true, printer: printedOn });
        consecutiveErrorsRef.current = 0;
        jobBackoffUntilRef.current.delete(job.id);
        toast.success(`Printed badge for ${job.member_name} on ${printedOn ?? "default printer"}`);
      } catch (err) {
        const error = err instanceof Error ? err.message : "Print execution error";
        console.error("[Print Station] Print failure:", err);
        try {
          await finishPrintJob(job.id, id, { ok: false, error, retryElsewhere: canRetryElsewhere(job, key) });
        } catch (finishErr) {
          console.error("[Print Station] Could not record the failure:", finishErr);
        }
        toast.error(`Print failed for ${job.member_name} on ${printer.name ?? "default printer"}: ${error}`);
      }
    },
    [canRetryElsewhere],
  );

  const drain = React.useCallback(() => {
    if (!isLeaderTabRef.current) return;
    const id = stationIdRef.current;
    const hasWebBle = webBluetoothPrintersRef.current.some((p) => p.connected && p.device.gatt?.connected);
    // Never claim jobs when the station is stopped or when neither the local Print Station App nor Web BLE is connected (Weakness F).
    if (!id || !optionsRef.current.isStationRunning || (!healthRef.current && !hasWebBle)) return;
    if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_CLAIM_ERRORS) return;

    const now = Date.now();

    for (const job of pendingJobsRef.current) {
      if (claimingJobIdsRef.current.has(job.id)) continue;

      const backoff = jobBackoffUntilRef.current.get(job.id);
      if (backoff && backoff.until > now) continue;

      // Idle printers on this laptop, least recently used first, minus any printer that already failed this job.
      // Because activePrintersRef marks each claimed printer busy immediately in this synchronous loop,
      // Job 1 is handed to Printer A and Job 2 is handed to Printer B on the same laptop simultaneously!
      const idle = getLocalPrinters()
        .filter((printer) => printer.available && !printer.busy)
        .filter((printer) => !job.excluded_printers?.includes(printerKey(id, printer.name)))
        .sort(
          (a, b) =>
            (lastUsedRef.current.get(a.name ?? DEFAULT_PRINTER_KEY) ?? 0) -
            (lastUsedRef.current.get(b.name ?? DEFAULT_PRINTER_KEY) ?? 0),
        );
      const printer = idle[0];
      if (!printer) {
        // Nothing idle at all on this laptop: stop. Otherwise this job only skipped because of its exclusions: try next.
        if (getLocalPrinters().every((p) => !p.available || p.busy)) break;
        continue;
      }

      const printerId = printer.name ?? DEFAULT_PRINTER_KEY;
      activePrintersRef.current.set(printerId, job.id);
      claimingJobIdsRef.current.add(job.id);
      void (async () => {
        let shouldScheduleDrain = true;
        let drainDelayMs = 50;
        try {
          const claimed = await claimPrintJob(job.id, {
            stationId: id,
            stationName: stationNameRef.current,
            printer: printer.name,
          });
          if (claimed) {
            consecutiveErrorsRef.current = 0;
            publishPresence();
            await runClaimedJob(claimed, printer, id);
          } else {
            // Lost the transaction race to another printer/laptop: brief backoff on this job until snapshot updates.
            jobBackoffUntilRef.current.set(job.id, { until: Date.now() + 1_500, tries: 1 });
            drainDelayMs = 400;
          }
        } catch (err) {
          console.warn("[Print Station] Could not claim job:", err);
          consecutiveErrorsRef.current += 1;
          const prevTries = jobBackoffUntilRef.current.get(job.id)?.tries ?? 0;
          const nextTries = prevTries + 1;
          const delay = Math.min(30_000, 2_000 * 2 ** Math.min(nextTries, 4));
          jobBackoffUntilRef.current.set(job.id, { until: Date.now() + delay, tries: nextTries });
          drainDelayMs = delay;
          if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_CLAIM_ERRORS) {
            setQueueError(
              err instanceof Error
                ? `Print queue paused after repeated Firestore errors: ${err.message}`
                : "Print queue paused after repeated Firestore errors.",
            );
            shouldScheduleDrain = false;
          }
        } finally {
          activePrintersRef.current.delete(printerId);
          claimingJobIdsRef.current.delete(job.id);
          lastUsedRef.current.set(printerId, Date.now());
          publishPresence();
          if (shouldScheduleDrain) {
            globalThis.setTimeout(() => drain(), drainDelayMs);
          }
        }
      })();
    }
  }, [getLocalPrinters, publishPresence, runClaimedJob]);

  const recheckWorker = React.useCallback(async () => {
    setIsCheckingWorker(true);
    const next = await fetchPrintWorkerHealth();
    healthRef.current = next;
    setHealth(next);

    // Upgrade stationId to canonical hardware ID when worker reports its device info so 1 Mac = 1 station document
    const canonicalId = canonicalStationIdFromHealth(next);
    if (canonicalId && stationIdRef.current && canonicalId !== stationIdRef.current) {
      const oldId = stationIdRef.current;
      stationIdRef.current = canonicalId;
      setStationId(canonicalId);
      try {
        window.localStorage.setItem(DEVICE_STATION_ID_STORAGE_KEY, canonicalId);
      } catch {
        // ignore
      }
      void removePrintStation(oldId).catch(() => undefined);
    }

    initialHealthCheckDoneRef.current = true;
    setIsCheckingWorker(false);
    void publishPresenceImmediate();
    drain();
  }, [publishPresenceImmediate, drain]);

  // Poll the local worker; every poll is also the heartbeat to Firestore.
  React.useEffect(() => {
    void recheckWorker();
    const timer = window.setInterval(() => void recheckWorker(), HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [recheckWorker]);

  // Report right away when Start/Stop Print Station is toggled (and reset error counter when restarted).
  // biome-ignore lint/correctness/useExhaustiveDependencies: isStationRunning is the trigger, publishPresenceImmediate reads it from a ref.
  React.useEffect(() => {
    if (isStationRunning) {
      consecutiveErrorsRef.current = 0;
    }
    void publishPresenceImmediate();
  }, [isStationRunning, userEmail, stationId, publishPresenceImmediate]);

  // Take this laptop off the list only when the page unloads and no other tab holds the station running.
  React.useEffect(() => {
    const leave = () => {
      if (readPersistedStationRunning()) return;
      const id = stationIdRef.current;
      if (id && registeredRef.current) void removePrintStation(id).catch(() => undefined);
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
    };
  }, []);

  // All laptops, deduplicated by hardware identity so duplicate tabs never appear as separate laptops.
  React.useEffect(() => {
    return subscribePrintStations(
      (rawStations) => {
        const { unique, duplicateIdsToRemove } = deduplicatePrintStations(rawStations, stationIdRef.current);
        stationsRef.current = unique;
        setStations(unique);
        setIsLoadingStations(false);
        if (isLeaderTabRef.current && duplicateIdsToRemove.length > 0) {
          for (const dupId of duplicateIdsToRemove) {
            if (dupId !== stationIdRef.current) {
              void removePrintStation(dupId).catch(() => undefined);
            }
          }
        }
      },
      (err) => {
        setIsLoadingStations(false);
        setQueueError(`Cannot read print stations (${err.message}). Verify your account has organizer/team access.`);
      },
    );
  }, []);

  // Queue listener: active while this laptop takes jobs.
  React.useEffect(() => {
    if (!isStationRunning) {
      pendingJobsRef.current = [];
      return;
    }
    const unsubscribe = subscribePendingPrintQueue(
      (jobs) => {
        setQueueError(null);
        pendingJobsRef.current = jobs;
        drain();
      },
      (err) => {
        setQueueError(`Cannot read print queue (${err.message}). Verify Firestore rules and team permissions.`);
      },
    );
    return unsubscribe;
  }, [isStationRunning, drain]);

  // Real-Time Check-In Watcher: while Print Station is running, watch `event_registrations` for `is_checked_in == true`
  // so any check-in anywhere in the dashboard (or via external sync) with Auto-Print enabled is guaranteed to enqueue.
  React.useEffect(() => {
    if (!isStationRunning || !isLeaderTab) return;

    const RECENT_CHECKIN_WINDOW_MS = 2 * 60 * 1000;
    const MAX_LIVE_BURST = 10;
    const watcherStartedAt = Date.now();
    const seenCheckedInIds = new Set<string>();
    let initialSnapshotDone = false;

    const q = selectedEventId
      ? query(
          collection(db, "event_registrations"),
          where("event_id", "==", String(selectedEventId)),
          where("is_checked_in", "==", true),
        )
      : query(collection(db, "event_registrations"), where("is_checked_in", "==", true));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        // Wait for the first non-cache server snapshot before arming so local cache hydration
        // never replays historical check-ins as brand-new "added" events.
        if (!initialSnapshotDone) {
          for (const docSnap of snap.docs) {
            seenCheckedInIds.add(docSnap.id);
          }
          if (!snap.metadata.fromCache) {
            initialSnapshotDone = true;
          }
          return;
        }

        const newlyCheckedIn: FirestoreRegistration[] = [];
        for (const change of snap.docChanges()) {
          if (change.type === "added" || change.type === "modified") {
            const reg = { id: change.doc.id, ...(change.doc.data() as Omit<FirestoreRegistration, "id">) };
            if (!reg.is_checked_in || seenCheckedInIds.has(reg.id)) continue;
            seenCheckedInIds.add(reg.id);

            // Only auto-print genuinely recent check-ins (prevents Bevy sync or reconnects from reprinting old attendees).
            const checkedInMs = reg.checked_in_at ? new Date(reg.checked_in_at).getTime() : 0;
            if (
              !checkedInMs ||
              Number.isNaN(checkedInMs) ||
              checkedInMs < watcherStartedAt - RECENT_CHECKIN_WINDOW_MS
            ) {
              continue;
            }
            newlyCheckedIn.push(reg);
          } else if (change.type === "removed") {
            seenCheckedInIds.delete(change.doc.id);
          }
        }

        // Guard against bulk syncs / reconnect bursts flooding the thermal printer queue.
        if (newlyCheckedIn.length > MAX_LIVE_BURST) {
          console.warn(
            `[Print Station] Suppressed bulk check-in burst (${newlyCheckedIn.length} attendees in one snapshot).`,
          );
          return;
        }

        for (const reg of newlyCheckedIn) {
          const expectedJobId = buildDeterministicCheckInJobId(reg.event_id, reg.id);
          const alreadyInRecent = recentJobsRef.current.some(
            (j) =>
              j.id === expectedJobId || (String(j.event_id) === String(reg.event_id) && j.registration_id === reg.id),
          );
          if (alreadyInRecent) continue;

          void enqueueCheckInBadgeIfEnabled({
            eventId: String(reg.event_id),
            registration: reg,
          });
        }
      },
      (err) => {
        console.warn("[Print Station] Real-time check-in watcher warning:", err);
      },
    );

    return () => unsubscribe();
  }, [isStationRunning, isLeaderTab, selectedEventId]);

  // Sweep: fail jobs whose laptop stopped answering mid-print, and drop long-dead laptops from the list.
  React.useEffect(() => {
    const sweep = () => {
      if (!isLeaderTabRef.current) return;
      const now = Date.now();
      const ownId = stationIdRef.current;
      for (const job of recentJobsRef.current) {
        if (job.status !== "printing" || !job.assigned_station_id) continue;
        const assignedAt = job.assigned_at ? new Date(job.assigned_at).getTime() : 0;

        if (job.assigned_station_id === ownId) {
          // Held by this laptop ID but no longer being worked on (the tab was reloaded while printing).
          const stillWorking = [...activePrintersRef.current.values()].includes(job.id);
          if (!stillWorking && now - assignedAt > ORPHAN_JOB_MS) {
            void failLostPrintJob(job.id, job.assigned_station_id, "Print station was reloaded while printing.");
          }
          continue;
        }

        const holder = stationsRef.current.find((station) => station.id === job.assigned_station_id);
        const lastSignal = Math.max(assignedAt, holder ? new Date(holder.last_seen_at).getTime() : 0);
        if (now - lastSignal > PRINT_STATION_LOST_MS) {
          void failLostPrintJob(
            job.id,
            job.assigned_station_id,
            `${job.assigned_station_name ?? "Print station"} stopped responding while printing. Check whether the label came out before retrying.`,
          );
        }
      }

      for (const station of stationsRef.current) {
        if (station.id !== ownId && now - new Date(station.last_seen_at).getTime() > STALE_STATION_DELETE_MS) {
          void removePrintStation(station.id).catch(() => undefined);
        }
      }
    };
    sweep();
    const timer = window.setInterval(sweep, SWEEP_MS);
    return () => window.clearInterval(timer);
  }, []);

  const connectWebBluetoothPrinter = React.useCallback(async (): Promise<WebBluetoothPrinterHandle | null> => {
    try {
      const handle = await connectWebBluetoothCT221B({
        onStatusChange: () => {
          setWebBluetoothPrinters([...webBluetoothPrintersRef.current]);
          publishPresence();
        },
      });
      const next = [...webBluetoothPrintersRef.current.filter((p) => p.id !== handle.id), handle];
      webBluetoothPrintersRef.current = next;
      setWebBluetoothPrinters(next);
      toast.success(`Connected to ${handle.name} via Web Bluetooth.`);
      void publishPresenceImmediate();
      drain();
      return handle;
    } catch (err) {
      if (err instanceof Error && err.name === "NotFoundError") {
        // User cancelled the browser Bluetooth chooser
        return null;
      }
      toast.error(err instanceof Error ? err.message : "Could not connect to Bluetooth printer.");
      return null;
    }
  }, [publishPresence, publishPresenceImmediate, drain]);

  const disconnectWebBluetoothPrinter = React.useCallback(
    (id: string) => {
      const found = webBluetoothPrintersRef.current.find((p) => p.id === id);
      found?.disconnect();
      const next = webBluetoothPrintersRef.current.filter((p) => p.id !== id);
      webBluetoothPrintersRef.current = next;
      setWebBluetoothPrinters(next);
      void publishPresenceImmediate();
    },
    [publishPresenceImmediate],
  );

  return {
    stationId,
    stationName,
    health,
    healthRef,
    isCheckingWorker,
    recheckWorker,
    stations,
    isLoadingStations,
    queueError,
    isLeaderTab,
    webBluetoothSupported,
    webBluetoothPrinters,
    connectWebBluetoothPrinter,
    disconnectWebBluetoothPrinter,
  };
}
