"use client";

import * as React from "react";

import { CheckCircle2, Copy, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getPrintWorkerArchiveFileName,
  getPrintWorkerDownloadUrl,
  PRINT_WORKER_BINARY_NAME,
  PRINT_WORKER_DASHBOARD_ORIGIN,
  type PrintWorkerHealth,
} from "@/lib/printers/local-worker";

const RECHECK_INTERVAL_MS = 3000;
const INSTALLED_WORKER_PATH = `~/.gdg-print-worker/bin/${PRINT_WORKER_BINARY_NAME}`;

interface InstallPrintWorkerDialogProps {
  health: PrintWorkerHealth | null;
  onRecheck: () => void;
}

function startDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = getPrintWorkerArchiveFileName();
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function CommandBlock({ command }: { command: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  };

  return (
    <div className="relative rounded-lg bg-zinc-950 p-3 pr-11 font-mono text-emerald-400 text-xs">
      <pre className="overflow-x-auto whitespace-pre">{command}</pre>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="absolute top-1.5 right-1.5 size-7 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        onClick={() => void copy()}
        aria-label="Copy command"
      >
        <Copy className="size-3.5" />
      </Button>
    </div>
  );
}

function Step({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-xs">
        {index}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="font-medium text-sm">{title}</div>
        {children}
      </div>
    </li>
  );
}

export function InstallPrintWorkerDialog({ health, onRecheck }: InstallPrintWorkerDialogProps) {
  const [open, setOpen] = React.useState(false);
  const isConnected = health !== null;
  const archiveFileName = getPrintWorkerArchiveFileName();
  // The production dashboard is always allowed. When this page is open from elsewhere (e.g. localhost while
  // developing) that address is added too, otherwise the worker would refuse it.
  const currentOrigin = typeof window === "undefined" ? "" : window.location.origin;
  const originArgs = [PRINT_WORKER_DASHBOARD_ORIGIN, currentOrigin]
    .filter((origin, index, all) => origin && all.indexOf(origin) === index)
    .map((origin) => `--origin ${origin}`)
    .join(" ");

  // While the dialog is open, check often so the "connected" state shows as soon as setup finishes.
  React.useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(onRecheck, RECHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [open, onRecheck]);

  const handleInstallClick = () => {
    startDownload(getPrintWorkerDownloadUrl());
    setOpen(true);
  };

  const installCommand = [
    "cd ~/Downloads",
    `tar -xzf ${archiveFileName}`,
    `xattr -d com.apple.quarantine ${PRINT_WORKER_BINARY_NAME} 2>/dev/null`,
    `./${PRINT_WORKER_BINARY_NAME} setup ${originArgs}`,
  ].join("\n");

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={handleInstallClick}>
        <Download className="size-3.5" />
        Install Worker
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="size-5 text-primary" />
              Install the Print Worker
            </DialogTitle>
            <DialogDescription>
              A small background app for the check-in Mac (Apple Silicon). It prints badges straight to your label
              printers, so the browser print dialog never appears.
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-4">
            <Step index={1} title="Download started">
              <p className="text-muted-foreground text-xs leading-relaxed">
                <span className="font-mono text-foreground">{archiveFileName}</span> is saving to your Downloads folder.{" "}
                <button
                  type="button"
                  className="text-primary underline underline-offset-2"
                  onClick={() => startDownload(getPrintWorkerDownloadUrl())}
                >
                  Download again
                </button>
              </p>
            </Step>

            <Step index={2} title="Open Terminal and run this once">
              <CommandBlock command={installCommand} />
              <p className="text-muted-foreground text-xs leading-relaxed">
                The <span className="font-mono">xattr</span> line lets macOS run the downloaded file. If the file was
                saved with a different name (for example <span className="font-mono">(1)</span> at the end), adjust the
                file name in the commands.
              </p>
            </Step>

            <Step index={3} title="Answer the setup questions">
              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground text-xs leading-relaxed">
                <li>
                  <strong className="text-foreground">Printers:</strong> type every label printer number, separated by
                  commas (e.g. <span className="font-mono">1,2</span>). They print in parallel and the worker picks a
                  free one for each badge.
                </li>
                <li>Press Enter to accept the Chrome path, port and dashboard address.</li>
                <li>
                  Answer <span className="font-mono">y</span> to{" "}
                  <strong className="text-foreground">Start the worker now</strong>. It keeps running in that Terminal
                  window.
                </li>
              </ul>
            </Step>

            <Step index={4} title="Allow local network access">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Chrome may ask to let this site connect to devices on your local network. Choose{" "}
                <strong className="text-foreground">Allow</strong>, then keep this page open and press{" "}
                <strong className="text-foreground">Start Print Station</strong>. Keep the Terminal window open while
                printing.
              </p>
            </Step>
          </ol>

          <div
            className={
              isConnected
                ? "flex items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-500/10 p-3 text-emerald-700 text-sm dark:text-emerald-300"
                : "flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-muted-foreground text-sm"
            }
            role="status"
          >
            {isConnected ? (
              <>
                <CheckCircle2 className="size-4 shrink-0" />
                Worker connected with {health.printers.length} {health.printers.length === 1 ? "printer" : "printers"}.
                You&apos;re done.
              </>
            ) : (
              <>
                <Loader2 className="size-4 shrink-0 animate-spin" />
                Waiting for the worker to connect...
              </>
            )}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="font-medium text-sm">Starting and stopping the worker</div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              The worker does <strong className="text-foreground">not</strong> start by itself when the Mac restarts or
              you log in. It only runs while you have started it.
            </p>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">Start (each time you set up the print station):</div>
              <CommandBlock command={`${INSTALLED_WORKER_PATH} run`} />
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">
                Stop: press <kbd className="rounded border bg-muted px-1 font-mono">Ctrl</kbd>+
                <kbd className="rounded border bg-muted px-1 font-mono">C</kbd> in the Terminal window it runs in (or
                just close that window). From another Terminal:
              </div>
              <CommandBlock command={`${INSTALLED_WORKER_PATH} stop`} />
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              After it stops, the Worker indicator turns yellow within 10 seconds and printing falls back to the browser
              print dialog.
            </p>
          </div>

          <Button variant={isConnected ? "default" : "outline"} onClick={() => setOpen(false)}>
            {isConnected ? "Done" : "Close"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
