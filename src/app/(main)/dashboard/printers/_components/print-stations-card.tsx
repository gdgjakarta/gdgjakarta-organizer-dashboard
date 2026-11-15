"use client";

import { AlertTriangle, Laptop, Printer, Usb } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  isPrintStationOnline,
  isWorkerVersionOutdated,
  type PrintJob,
  type PrintStation,
  type PrintStationPrinter,
} from "@/lib/printers/types";
import { cn } from "@/lib/utils";

import { deduplicatePrintStations } from "./use-print-station";

/** Laptops that have been silent for longer than this are hidden (they are deleted from Firestore after a day). */
const HIDE_OFFLINE_AFTER_MS = 60 * 60 * 1000;

interface PrintStationsCardProps {
  stations: PrintStation[];
  ownStationId: string | null;
  jobs: PrintJob[];
}

function printerStatus(
  printer: PrintStationPrinter,
  online: boolean,
  jobs: PrintJob[],
): { label: string; className: string; detail: string | null } {
  if (!online) {
    return { label: "Offline", className: "bg-muted text-muted-foreground", detail: null };
  }
  if (printer.usb_connected === false) {
    return {
      label: "USB Unplugged",
      className: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
      detail: printer.last_error ?? "USB cable disconnected or printer switched off",
    };
  }
  const job = printer.current_job_id ? jobs.find((j) => j.id === printer.current_job_id) : undefined;
  if (printer.busy) {
    return {
      label: "Printing",
      className: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
      detail: job ? `Printing: ${job.member_name}` : null,
    };
  }
  if (!printer.available) {
    return {
      label: "Skipped",
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      detail: printer.last_error,
    };
  }
  return {
    label: "Ready",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    detail: printer.queue_depth && printer.queue_depth > 0 ? `${printer.queue_depth} in CUPS queue` : null,
  };
}

/** Device URIs used by more than one printer of a laptop (CUPS cannot tell those printers apart). */
function sharedDeviceUris(station: PrintStation): Set<string> {
  const counts = new Map<string, number>();
  for (const printer of station.printers) {
    if (printer.device_uri) counts.set(printer.device_uri, (counts.get(printer.device_uri) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([uri]) => uri));
}

export function PrintStationsCard({ stations, ownStationId, jobs }: PrintStationsCardProps) {
  const now = Date.now();
  const { unique } = deduplicatePrintStations(stations, ownStationId);
  const visible = unique.filter(
    (station) =>
      isPrintStationOnline(station, now) || now - new Date(station.last_seen_at).getTime() < HIDE_OFFLINE_AFTER_MS,
  );
  const onlineStations = visible.filter((station) => isPrintStationOnline(station, now));
  const totalReadyPrinters = onlineStations.reduce(
    (sum, s) =>
      sum + (s.station_running ? s.printers.filter((p) => p.available && p.usb_connected !== false).length : 0),
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Connected Print Stations &amp; Assigned Printers</CardTitle>
        <CardDescription>
          Each physical Mac appears once here and can run 2+ USB printers in parallel. Every queued badge is claimed by
          one idle printer (<code className="font-mono text-[11px]">deviceId::printerName</code>) so labels never
          duplicate.
        </CardDescription>
        <CardAction className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-xs">
            {onlineStations.length} {onlineStations.length === 1 ? "Mac" : "Macs"} online
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              totalReadyPrinters > 0
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "text-muted-foreground",
            )}
          >
            {totalReadyPrinters} {totalReadyPrinters === 1 ? "printer" : "printers"} taking jobs
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
            <Laptop className="mb-2 size-7 text-muted-foreground/50" />
            <p className="font-medium text-sm">No Print Station Mac connected</p>
            <p className="mt-1 text-muted-foreground text-xs">
              Open <strong>GDG Print Station.app</strong> on a check-in Mac and click{" "}
              <strong>Start Print Station</strong> above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((station) => {
              const online = isPrintStationOnline(station, now);
              const outdated = isWorkerVersionOutdated(station.worker_version);
              const sharedUris = sharedDeviceUris(station);
              return (
                <div key={station.id} className={cn("space-y-2.5 rounded-lg border p-3", !online && "opacity-60")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Laptop className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium text-sm">{station.name}</span>
                        {station.id === ownStationId && (
                          <Badge variant="outline" className="px-1 py-0 text-[10px]">
                            This Mac
                          </Badge>
                        )}
                        {outdated && station.worker_version && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 bg-amber-500/10 px-1 py-0 text-[10px] text-amber-700 dark:text-amber-300"
                          >
                            Update v{station.worker_version}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-muted-foreground text-xs">
                        {[station.model, station.os, station.worker_version && `App v${station.worker_version}`]
                          .filter(Boolean)
                          .join(" · ") || "macOS Print Station"}
                      </div>
                      {station.user_email && (
                        <div className="truncate text-[11px] text-muted-foreground">{station.user_email}</div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge
                        className={cn(
                          "text-[10px]",
                          online
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                            : "border-muted bg-muted text-muted-foreground",
                        )}
                      >
                        {online ? "Online" : "Offline"}
                      </Badge>
                      {online && (
                        <span
                          className={cn(
                            "font-medium text-[10px]",
                            station.station_running && station.worker_connected
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {station.station_running && station.worker_connected
                            ? `Taking jobs (${station.printers.length} ${station.printers.length === 1 ? "printer" : "printers"})`
                            : "Standby (paused)"}
                        </span>
                      )}
                    </div>
                  </div>

                  {!station.worker_connected && online && (
                    <div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-amber-800 text-xs dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        <strong>GDG Print Station.app</strong> is not running on this Mac. Queue claiming is paused so
                        jobs are never lost to browser dialogs.
                      </span>
                    </div>
                  )}

                  {sharedUris.size > 0 && (
                    <div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-amber-800 text-xs dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Two printers on this Mac share one USB serial address. Click the{" "}
                        <strong>GDG Print Station</strong> icon in the macOS Menu Bar &rarr;{" "}
                        <strong>Refresh Printers &amp; Auto-Fix USB Ports</strong> so each printer prints its own
                        assigned badges.
                      </span>
                    </div>
                  )}

                  {station.printers.length > 0 && (
                    <ul className="space-y-1.5">
                      {station.printers.map((printer, idx) => {
                        const status = printerStatus(printer, online, jobs);
                        return (
                          <li
                            key={`${station.id}::${printer.name ?? idx}`}
                            className="rounded-md bg-muted/40 p-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Printer className="size-3 shrink-0 text-muted-foreground" />
                                <span className="truncate font-medium">{printer.name ?? "System default"}</span>
                                <Badge
                                  variant="outline"
                                  className="px-1 py-0 font-mono text-[9px] text-muted-foreground"
                                >
                                  Printer #{idx + 1}
                                </Badge>
                              </span>
                              <span className={cn("shrink-0 rounded-sm px-1.5 py-0.5 text-[10px]", status.className)}>
                                {status.label}
                              </span>
                            </div>
                            {printer.device_uri && (
                              <div
                                className={cn(
                                  "mt-0.5 flex items-center gap-1 break-all font-mono text-[10px]",
                                  sharedUris.has(printer.device_uri)
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-muted-foreground/80",
                                )}
                              >
                                <Usb className="size-2.5 shrink-0" />
                                <span className="truncate">
                                  {sharedUris.has(printer.device_uri)
                                    ? `Shared URI: ${printer.device_uri}`
                                    : printer.device_uri}
                                </span>
                              </div>
                            )}
                            {status.detail && (
                              <div className="mt-0.5 break-words text-[11px] text-muted-foreground">
                                {status.detail}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
