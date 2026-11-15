"use client";

import { AlertTriangle, Apple, RefreshCw, Sparkles, Usb } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getPrintWorkerUrl,
  PRINT_STATION_APP_NAME,
  type PrintWorkerHealth,
  type PrintWorkerPrinter,
} from "@/lib/printers/local-worker";
import { isWorkerVersionOutdated, MIN_PRINT_WORKER_VERSION } from "@/lib/printers/types";
import { cn } from "@/lib/utils";

interface PrintWorkerStatusProps {
  health: PrintWorkerHealth | null;
  isChecking: boolean;
  onRecheck: () => void;
  onOpenSetupGuide?: () => void;
}

function appStatusLabel(health: PrintWorkerHealth): string {
  if (health.printers.length === 1) return health.printers[0].name ?? "1 printer";
  const ready = health.printers.filter((printer) => printer.available && printer.usbConnected !== false).length;
  return `${ready}/${health.printers.length} printers`;
}

function printerBadge(printer: PrintWorkerPrinter): { label: string; className: string } {
  if (printer.usbConnected === false) {
    return { label: "USB Unplugged", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300" };
  }
  if (!printer.available) {
    return { label: "Skipped", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" };
  }
  if (printer.busy) {
    return { label: "Printing", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300" };
  }
  return { label: "Ready", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
}

export function PrintWorkerStatus({ health, isChecking, onRecheck, onOpenSetupGuide }: PrintWorkerStatusProps) {
  const isConnected = health !== null;
  const isOutdated = isConnected && isWorkerVersionOutdated(health.version);
  const workerUrl = typeof window === "undefined" ? "" : getPrintWorkerUrl();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2" aria-label="Print Station App status">
          <span className="relative flex size-2">
            {isConnected && !isOutdated && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            )}
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                !isConnected ? "bg-amber-500" : isOutdated ? "bg-amber-500" : "bg-emerald-500",
              )}
            />
          </span>
          {isConnected
            ? `Print Station App: ${appStatusLabel(health)}${isOutdated ? " (Update)" : ""}`
            : "Print Station App: Not Running"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-88 space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              <Apple className="size-4 text-primary" />
              {isConnected ? "GDG Print Station App Connected" : "Print Station App Not Detected"}
            </div>
            {isConnected && (
              <Badge
                variant="outline"
                className={cn(
                  "px-1.5 py-0 font-mono text-[10px]",
                  isOutdated
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                )}
              >
                v{health.version}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {isConnected
              ? "Native macOS Menu Bar app is running with in-process WebKit PDF rendering and Notch Dynamic Island live activity HUD."
              : `Open ${PRINT_STATION_APP_NAME} on this Mac so badges print straight to your USB printers with zero browser dialogs (supports Safari & Chrome).`}
          </p>
        </div>

        {isOutdated && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-800 text-xs dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1">
              <div className="font-semibold">
                Outdated Worker Detected (v{health?.version} &lt; v{MIN_PRINT_WORKER_VERSION})
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                Upgrade to the new Menu Bar app (
                <strong>
                  {PRINT_STATION_APP_NAME} v{MIN_PRINT_WORKER_VERSION}
                </strong>
                ) for Notch Dynamic Island HUD, hardware device ID deduplication, and zero-Terminal operation.
              </p>
              {onOpenSetupGuide && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-1 h-6 text-[11px]"
                  onClick={onOpenSetupGuide}
                >
                  Open Upgrade Guide
                </Button>
              )}
            </div>
          </div>
        )}

        {isConnected ? (
          <div className="space-y-2.5 text-xs">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-muted/40 p-2">
              <dt className="text-muted-foreground">Device</dt>
              <dd className="truncate font-medium">
                {health.device?.computerName ?? "This Mac"}
                {health.device?.model ? ` (${health.device.model})` : ""}
              </dd>
              <dt className="text-muted-foreground">Loopback</dt>
              <dd className="truncate font-mono text-[11px]">{workerUrl}</dd>
              <dt className="text-muted-foreground">Mode</dt>
              <dd className="flex items-center gap-1">
                <Sparkles className="size-3 text-emerald-500" />
                {health.device?.appMode === "cli" ? "CLI Service" : "macOS Menu Bar + Notch HUD"}
              </dd>
              <dt className="text-muted-foreground">In-flight</dt>
              <dd>{health.queued} queued in local pool</dd>
            </dl>
            <div className="space-y-1">
              <div className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                Assigned Printer Queues ({health.printers.length})
              </div>
              <ul className="space-y-1.5">
                {health.printers.map((printer) => (
                  <li key={printer.name ?? "default"} className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{printer.name ?? "System default"}</span>
                      <span
                        className={cn("shrink-0 rounded-sm px-1.5 py-0.5 text-[10px]", printerBadge(printer).className)}
                      >
                        {printerBadge(printer).label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="truncate">{printer.lastError ?? printer.state}</span>
                      {typeof printer.queueDepth === "number" && printer.queueDepth > 0 && (
                        <span className="shrink-0 font-mono text-[10px] text-amber-600 dark:text-amber-400">
                          CUPS: {printer.queueDepth}
                        </span>
                      )}
                    </div>
                    {printer.uri && (
                      <div className="mt-0.5 flex items-center gap-1 truncate font-mono text-[10px] text-muted-foreground/80">
                        <Usb className="size-2.5 shrink-0" />
                        <span className="truncate">{printer.uri}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Manage printers, refresh USB ports, or quit anytime from the printer icon in your macOS top{" "}
              <strong className="text-foreground">Menu Bar</strong>.
            </p>
          </div>
        ) : (
          <div className="space-y-2 rounded-md border bg-muted/30 p-2.5 text-xs">
            <div className="font-medium text-foreground">How to connect in 10 seconds:</div>
            <ol className="list-decimal space-y-1 pl-4 text-muted-foreground text-[11px] leading-relaxed">
              <li>
                Open <strong className="text-foreground">{PRINT_STATION_APP_NAME}</strong> from your{" "}
                <span className="font-mono text-foreground">Applications</span> or{" "}
                <span className="font-mono text-foreground">Downloads</span> folder.
              </li>
              <li>
                Look for the printer icon in the top-right <strong className="text-foreground">macOS Menu Bar</strong>.
              </li>
              <li>
                Click <strong className="text-foreground">Start Print Station</strong> on this page.
              </li>
            </ol>
            {onOpenSetupGuide && (
              <Button type="button" size="sm" className="mt-1 w-full text-xs" onClick={onOpenSetupGuide}>
                Download &amp; Setup Guide
              </Button>
            )}
          </div>
        )}

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full gap-2"
          onClick={onRecheck}
          disabled={isChecking}
        >
          <RefreshCw className={cn("size-3.5", isChecking && "animate-spin")} />
          {isChecking ? "Checking..." : "Check Connection Now"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
