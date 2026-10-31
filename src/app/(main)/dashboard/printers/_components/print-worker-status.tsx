"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getPrintWorkerUrl,
  PRINT_WORKER_BINARY_NAME,
  type PrintWorkerHealth,
  type PrintWorkerPrinter,
} from "@/lib/printers/local-worker";
import { cn } from "@/lib/utils";

interface PrintWorkerStatusProps {
  health: PrintWorkerHealth | null;
  isChecking: boolean;
  onRecheck: () => void;
}

function workerLabel(health: PrintWorkerHealth): string {
  if (health.printers.length === 1) return health.printers[0].name ?? "Default printer";
  const ready = health.printers.filter((printer) => printer.available).length;
  return `${ready}/${health.printers.length} printers`;
}

const INSTALLED_WORKER_PATH = `~/.gdg-print-worker/bin/${PRINT_WORKER_BINARY_NAME}`;

function printerBadge(printer: PrintWorkerPrinter): { label: string; className: string } {
  if (!printer.available) {
    return { label: "Skipped", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" };
  }
  if (printer.busy) {
    return { label: "Printing", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300" };
  }
  return { label: "Ready", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
}

export function PrintWorkerStatus({ health, isChecking, onRecheck }: PrintWorkerStatusProps) {
  const isConnected = health !== null;
  const workerUrl = typeof window === "undefined" ? "" : getPrintWorkerUrl();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2" aria-label="Print worker status">
          <span className="relative flex size-2">
            {isConnected && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            )}
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                isConnected ? "bg-emerald-500" : "bg-amber-500",
              )}
            />
          </span>
          {isConnected ? `Worker: ${workerLabel(health)}` : "Worker: Not connected"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-0.5">
          <div className="font-semibold text-sm">
            {isConnected ? "Print worker connected" : "Print worker not detected"}
          </div>
          <p className="text-muted-foreground text-xs">
            {isConnected
              ? "Badges print straight to the printers with no browser dialog. Each queued job is assigned to one free printer and logged in the Print Queue."
              : "Printing falls back to the browser print dialog until the worker is running."}
          </p>
        </div>

        {isConnected ? (
          <div className="space-y-2 text-xs">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Address</dt>
              <dd className="truncate font-mono">{workerUrl}</dd>
              <dt className="text-muted-foreground">Version</dt>
              <dd>{health.version}</dd>
              <dt className="text-muted-foreground">Waiting jobs</dt>
              <dd>{health.queued}</dd>
            </dl>
            <ul className="space-y-1.5">
              {health.printers.map((printer) => (
                <li key={printer.name ?? "default"} className="rounded-md border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{printer.name ?? "System default"}</span>
                    <span className={cn("shrink-0 rounded-sm px-1.5 py-0.5", printerBadge(printer).className)}>
                      {printerBadge(printer).label}
                    </span>
                  </div>
                  <div className="mt-0.5 break-words text-muted-foreground">{printer.lastError ?? printer.state}</div>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">
              To stop: press <span className="font-mono text-foreground">Ctrl+C</span> in the Terminal window running
              the worker, or run{" "}
              <span className="break-all font-mono text-foreground">{`${INSTALLED_WORKER_PATH} stop`}</span>.
            </p>
          </div>
        ) : (
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">
              Looked for it at <span className="font-mono text-foreground">{workerUrl}</span>. On the check-in Mac run:
            </p>
            <p className="text-muted-foreground">
              Not installed yet? Click <strong className="text-foreground">Install Worker</strong> at the top of this
              page.
            </p>
            <p className="text-muted-foreground">
              Already installed but stopped? Start it again in Terminal (keep that window open):
            </p>
            <div className="break-all rounded-md bg-zinc-950 p-2 font-mono text-emerald-400">
              {`${INSTALLED_WORKER_PATH} run`}
            </div>
            <p className="text-muted-foreground">
              Still not connecting? Re-run <span className="font-mono text-foreground">gdg-print-worker setup</span> and
              make sure this dashboard&apos;s address is in the allowed origins.
            </p>
          </div>
        )}

        <Button size="sm" variant="outline" className="gap-1.5" onClick={onRecheck} disabled={isChecking}>
          <RefreshCw className={cn("size-3.5", isChecking && "animate-spin")} />
          Check again
        </Button>
      </PopoverContent>
    </Popover>
  );
}
