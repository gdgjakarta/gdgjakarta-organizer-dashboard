"use client";

import * as React from "react";

import { toast } from "sonner";

import {
  claimPrintJob,
  failLostPrintJob,
  finishPrintJob,
  removePrintStation,
  subscribePendingPrintQueue,
  subscribePrintStations,
  upsertPrintStation,
} from "@/lib/firestore/client";
import { fetchPrintWorkerHealth, type PrintWorkerHealth, printViaWorker } from "@/lib/printers/local-worker";
import {
  BROWSER_PRINTER_NAME,
  isPrintStationOnline,
  PRINT_STATION_LOST_MS,
  type PrintJob,
  type PrintStation,
  type PrintStationPrinter,
  printerKey,
} from "@/lib/printers/types";

const STATION_ID_STORAGE_KEY = "gdg_print_station_id";
const HEARTBEAT_MS = 10_000;
const SWEEP_MS = 15_000;
/** A job this tab itself holds but no longer works on (tab was reloaded mid-print) is failed after this long. */
const ORPHAN_JOB_MS = 30_000;
/** Stations silent for this long are cleaned up from Firestore. */
const STALE_STATION_DELETE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PRINTER_KEY = "default";

function newStationId(): string {
  return `stn_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** One id per browser tab (survives reloads), so two tabs on one laptop never overwrite each other's heartbeat. */
function readStationId(): string {
  try {
    const existing = window.sessionStorage.getItem(STATION_ID_STORAGE_KEY);
    if (existing) return existing;
    const created = newStationId();
    window.sessionStorage.setItem(STATION_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return newStationId();
  }
}

interface UsePrintStationOptions {
  /** Start Print Station switch: while on, this laptop takes jobs from the queue. */
  isStationRunning: boolean;
  userEmail?: string;
  /** Wraps a rendered label body into the full document the worker prints. */
  buildDocument: (bodyHtml: string) => string;
  widthMm: number;
  heightMm: number;
  /** Fallback when this laptop has no worker: prints through the hidden iframe / browser dialog. */
  printInBrowser: (bodyHtml: string) => Promise<void>;
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
  /** Every laptop that reported in (this one included), from Firestore. */
  stations: PrintStation[];
}

/**
 * Connects this laptop's open dashboard tab to the print queue:
 * - heartbeats the laptop and its printers to `print_workers/{stationId}`;
 * - while the Print Station is running, claims pending jobs for each idle local printer (one transaction per job, so a
 *   job is only ever held by one printer, on any laptop) and prints them through the local worker;
 * - fails jobs held by a laptop that stopped answering.
 */
export function usePrintStation(options: UsePrintStationOptions): PrintStationState {
  const { isStationRunning, userEmail, recentJobs } = options;

  const [stationId, setStationId] = React.useState<string | null>(null);
  const [health, setHealth] = React.useState<PrintWorkerHealth | null>(null);
  const [isCheckingWorker, setIsCheckingWorker] = React.useState(false);
  const [stations, setStations] = React.useState<PrintStation[]>([]);

  const stationIdRef = React.useRef<string | null>(null);
  const healthRef = React.useRef<PrintWorkerHealth | null>(null);
  const stationsRef = React.useRef<PrintStation[]>([]);
  const pendingJobsRef = React.useRef<PrintJob[]>([]);
  const recentJobsRef = React.useRef<PrintJob[]>(recentJobs);
  const optionsRef = React.useRef(options);
  const stationNameRef = React.useRef("This laptop");
  /** printer key (name) -> job id it is claiming/printing here right now. */
  const activePrintersRef = React.useRef<Map<string, string>>(new Map());
  const claimingJobIdsRef = React.useRef<Set<string>>(new Set());
  const lastUsedRef = React.useRef<Map<string, number>>(new Map());
  const registeredRef = React.useRef(false);

  optionsRef.current = options;
  recentJobsRef.current = recentJobs;

  React.useEffect(() => {
    const id = readStationId();
    stationIdRef.current = id;
    setStationId(id);
  }, []);

  const stationName = health?.device?.computerName ?? "This laptop";
  stationNameRef.current = stationName;

  /** Printers this laptop can print on right now: the worker's, or the browser dialog when there is no worker. */
  const getLocalPrinters = React.useCallback((): PrintStationPrinter[] => {
    const active = activePrintersRef.current;
    const current = healthRef.current;
    if (current) {
      return current.printers.map((printer) => {
        const key = printer.name ?? DEFAULT_PRINTER_KEY;
        return {
          name: printer.name,
          device_uri: printer.uri ?? null,
          state: printer.state,
          busy: printer.busy || active.has(key),
          available: printer.available,
          last_error: printer.lastError,
          current_job_id: active.get(key) ?? null,
        };
      });
    }
    return [
      {
        name: BROWSER_PRINTER_NAME,
        state: "Browser print dialog",
        busy: active.has(BROWSER_PRINTER_NAME),
        available: true,
        last_error: null,
        current_job_id: active.get(BROWSER_PRINTER_NAME) ?? null,
      },
    ];
  }, []);

  const publishPresence = React.useCallback(async () => {
    const id = stationIdRef.current;
    if (!id) return;
    const current = healthRef.current;
    const running = optionsRef.current.isStationRunning;

    // Nothing to report: no worker and not taking jobs. Don't leave a fake laptop in the list.
    if (!current && !running) {
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
        name: current?.device?.computerName ?? stationNameRef.current,
        model: current?.device?.model ?? undefined,
        os: current?.device?.os ?? undefined,
        worker_version: current?.version,
        worker_connected: current !== null,
        station_running: running,
        printers: getLocalPrinters(),
        user_email: optionsRef.current.userEmail,
      });
    } catch (err) {
      console.warn("[Print Station] Heartbeat failed:", err);
    }
  }, [getLocalPrinters]);

  /** True when some other online printer (any laptop) could still take this job after `failedKey` failed it. */
  const canRetryElsewhere = React.useCallback((job: PrintJob, failedKey: string): boolean => {
    const now = Date.now();
    return stationsRef.current.some(
      (station) =>
        station.station_running &&
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
      const { buildDocument, widthMm, heightMm, printInBrowser } = optionsRef.current;
      const key = printerKey(id, printer.name);
      try {
        let printedOn: string | null | undefined = printer.name;
        if (healthRef.current && printer.name !== BROWSER_PRINTER_NAME) {
          const result = await printViaWorker({
            html: buildDocument(job.rendered_html),
            widthMm,
            heightMm,
            // An old worker ignores this and picks a printer itself; `result.printer` then records the real one.
            printer: printer.name ?? undefined,
          });
          printedOn = result.printer ?? printer.name;
        } else {
          await printInBrowser(job.rendered_html);
        }
        await finishPrintJob(job.id, id, { ok: true, printer: printedOn });
        toast.success(`Printed label for ${job.member_name} on ${printedOn ?? "default printer"}`);
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
    const id = stationIdRef.current;
    if (!id || !optionsRef.current.isStationRunning) return;

    for (const job of pendingJobsRef.current) {
      if (claimingJobIdsRef.current.has(job.id)) continue;

      // Idle printers, least recently used first, minus the ones that already failed this job.
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
        // Nothing idle at all: stop. Otherwise this job only skipped because of its exclusions: try the next one.
        if (getLocalPrinters().every((p) => !p.available || p.busy)) break;
        continue;
      }

      const printerId = printer.name ?? DEFAULT_PRINTER_KEY;
      activePrintersRef.current.set(printerId, job.id);
      claimingJobIdsRef.current.add(job.id);
      void (async () => {
        try {
          const claimed = await claimPrintJob(job.id, {
            stationId: id,
            stationName: stationNameRef.current,
            printer: printer.name,
          });
          // null: another printer won the job. Nothing to print here.
          if (claimed) {
            void publishPresence();
            await runClaimedJob(claimed, printer, id);
          }
        } catch (err) {
          console.warn("[Print Station] Could not claim job:", err);
        } finally {
          activePrintersRef.current.delete(printerId);
          claimingJobIdsRef.current.delete(job.id);
          lastUsedRef.current.set(printerId, Date.now());
          void publishPresence();
          drain();
        }
      })();
    }
  }, [getLocalPrinters, publishPresence, runClaimedJob]);

  const recheckWorker = React.useCallback(async () => {
    setIsCheckingWorker(true);
    const next = await fetchPrintWorkerHealth();
    healthRef.current = next;
    setHealth(next);
    setIsCheckingWorker(false);
    void publishPresence();
    drain();
  }, [publishPresence, drain]);

  // Poll the local worker; every poll is also the heartbeat to Firestore.
  React.useEffect(() => {
    void recheckWorker();
    const timer = window.setInterval(() => void recheckWorker(), HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [recheckWorker]);

  // Report right away when Start/Stop Print Station is toggled (the heartbeat only runs every few seconds).
  // biome-ignore lint/correctness/useExhaustiveDependencies: isStationRunning is the trigger, publishPresence reads it from a ref.
  React.useEffect(() => {
    void publishPresence();
  }, [isStationRunning, userEmail, stationId, publishPresence]);

  // Take this laptop off the list when the tab goes away.
  React.useEffect(() => {
    const leave = () => {
      const id = stationIdRef.current;
      if (id && registeredRef.current) void removePrintStation(id).catch(() => undefined);
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  // All laptops, for the dashboard and for "can another printer still take this job".
  React.useEffect(() => {
    return subscribePrintStations((next) => {
      stationsRef.current = next;
      setStations(next);
    });
  }, []);

  // Queue listener: only while this laptop takes jobs.
  React.useEffect(() => {
    if (!isStationRunning) {
      pendingJobsRef.current = [];
      return;
    }
    const unsubscribe = subscribePendingPrintQueue((jobs) => {
      pendingJobsRef.current = jobs;
      drain();
    });
    return unsubscribe;
  }, [isStationRunning, drain]);

  // Sweep: fail jobs whose laptop stopped answering mid-print, and drop long-dead laptops from the list.
  React.useEffect(() => {
    const sweep = () => {
      const now = Date.now();
      const ownId = stationIdRef.current;
      for (const job of recentJobsRef.current) {
        if (job.status !== "printing" || !job.assigned_station_id) continue;
        const assignedAt = job.assigned_at ? new Date(job.assigned_at).getTime() : 0;

        if (job.assigned_station_id === ownId) {
          // Held by this tab id but no longer being worked on (the tab was reloaded while printing).
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

  return { stationId, stationName, health, healthRef, isCheckingWorker, recheckWorker, stations };
}
