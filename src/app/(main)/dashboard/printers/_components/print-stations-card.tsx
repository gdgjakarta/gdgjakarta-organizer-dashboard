"use client";

import { Laptop, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isPrintStationOnline, type PrintJob, type PrintStation, type PrintStationPrinter } from "@/lib/printers/types";
import { cn } from "@/lib/utils";

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
  const job = printer.current_job_id ? jobs.find((j) => j.id === printer.current_job_id) : undefined;
  if (printer.busy) {
    return {
      label: "Printing",
      className: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
      detail: job ? job.member_name : null,
    };
  }
  if (!printer.available) {
    return {
      label: "Skipped",
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      detail: printer.last_error,
    };
  }
  return { label: "Ready", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", detail: null };
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
  const visible = stations.filter(
    (station) =>
      isPrintStationOnline(station, now) || now - new Date(station.last_seen_at).getTime() < HIDE_OFFLINE_AFTER_MS,
  );
  const onlineCount = visible.filter((station) => isPrintStationOnline(station, now)).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Workers & Printers</CardTitle>
        <CardDescription>
          Every laptop with this page open reports here. A queued label goes to one idle printer on one laptop.
        </CardDescription>
        <CardAction>
          <Badge variant="outline" className="text-xs">
            {onlineCount} online
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
            <Laptop className="mb-2 size-7 text-muted-foreground/50" />
            <p className="font-medium text-sm">No laptop connected</p>
            <p className="mt-1 text-muted-foreground text-xs">
              Start the print worker on a laptop and keep this page open there.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((station) => {
              const online = isPrintStationOnline(station, now);
              return (
                <div key={station.id} className={cn("space-y-2 rounded-lg border p-3", !online && "opacity-60")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Laptop className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium text-sm">{station.name}</span>
                        {station.id === ownStationId && (
                          <Badge variant="outline" className="px-1 py-0 text-[10px]">
                            This laptop
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-muted-foreground text-xs">
                        {[station.model, station.os, station.worker_version && `worker ${station.worker_version}`]
                          .filter(Boolean)
                          .join(" · ") || "Details unavailable"}
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
                        <span className="text-[10px] text-muted-foreground">
                          {station.station_running ? "Taking jobs" : "Not taking jobs"}
                        </span>
                      )}
                    </div>
                  </div>

                  {!station.worker_connected && online && (
                    <p className="text-amber-700 text-xs dark:text-amber-300">
                      No print worker here: labels print through the browser dialog.
                    </p>
                  )}

                  {sharedDeviceUris(station).size > 0 && (
                    <p className="text-amber-700 text-xs dark:text-amber-300">
                      Some printers here share one device address, so labels may all print on one of them. Re-run
                      <span className="font-mono"> gdg-print-worker setup</span> for the fix.
                    </p>
                  )}

                  <ul className="space-y-1.5">
                    {station.printers.map((printer) => {
                      const status = printerStatus(printer, online, jobs);
                      return (
                        <li key={printer.name ?? "default"} className="rounded-md bg-muted/40 p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <Printer className="size-3 shrink-0 text-muted-foreground" />
                              <span className="truncate font-medium">{printer.name ?? "System default"}</span>
                            </span>
                            <span className={cn("shrink-0 rounded-sm px-1.5 py-0.5", status.className)}>
                              {status.label}
                            </span>
                          </div>
                          {printer.device_uri && sharedDeviceUris(station).has(printer.device_uri) && (
                            <div className="mt-0.5 break-all font-mono text-[10px] text-amber-700 dark:text-amber-300">
                              Same device as another printer: {printer.device_uri}
                            </div>
                          )}
                          {status.detail && (
                            <div className="mt-0.5 break-words text-muted-foreground">{status.detail}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
