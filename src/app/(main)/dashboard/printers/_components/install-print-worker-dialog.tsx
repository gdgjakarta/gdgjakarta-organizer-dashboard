"use client";

import * as React from "react";

import { CheckCircle2, Copy, Download, ExternalLink, Loader2 } from "lucide-react";
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
const PRINTER_DRIVER_URL = "https://ga.ctaiot.com/";
/** Screenshots of the guide, uploaded to the Media page under `community-dashboard/media/`. */
const GUIDE_IMAGE_BASE_URL = "https://gdgjakarta.com/api/media/community-dashboard/media";

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

/** Guide screenshot; opens full size on click and hides itself until the file is uploaded to the Media page. */
function GuideImage({ file, alt, caption }: { file: string; alt: string; caption?: string }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return null;
  const src = `${GUIDE_IMAGE_BASE_URL}/${file}`;
  return (
    <figure className="space-y-1">
      <a href={src} target="_blank" rel="noreferrer" title="Open full size">
        {/* biome-ignore lint/performance/noImgElement: guide screenshot hosted on the media bucket */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full max-w-md rounded-lg border"
        />
      </a>
      {caption && <figcaption className="text-muted-foreground text-xs">{caption}</figcaption>}
    </figure>
  );
}

function PartHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="border-b pb-1 font-semibold text-sm">{children}</h3>;
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="size-5 text-primary" />
              Install the Print Worker
            </DialogTitle>
            <DialogDescription>
              A small background app for the check-in Mac (Apple Silicon). It prints badges straight to your label
              printers, so the browser print dialog never appears. Set up the printers first (Part 1), then install the
              worker (Part 2). Both parts are done once per laptop.
            </DialogDescription>
          </DialogHeader>

          <PartHeading>Part 1: Set up the printers</PartHeading>
          <ol className="space-y-4">
            <Step index={1} title="Install the printer driver">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Download and install the Clabel driver from{" "}
                <a
                  href={PRINTER_DRIVER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2"
                >
                  ga.ctaiot.com <ExternalLink className="size-3" />
                </a>
                . Do this before connecting the printers.
              </p>
            </Step>

            <Step index={2} title="Connect and turn on the printers">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Plug every label printer into this Mac by USB and switch them on. Keep each printer in the same USB port
                from now on: the setup remembers printers by port.
              </p>
            </Step>

            <Step index={3} title="Open Printers & Scanners and click Add Printer">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Open <strong className="text-foreground">System Settings → Printers &amp; Scanners</strong> and click{" "}
                <strong className="text-foreground">Add Printer, Scanner, or Fax…</strong>.
              </p>
              <GuideImage
                file="printer-setup-3a-printers-and-scanners-empty.jpg"
                alt="Printers & Scanners in System Settings with no printers and the Add Printer, Scanner, or Fax button"
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                In the <strong className="text-foreground">Default</strong> tab, every connected printer is listed as{" "}
                <span className="font-mono text-foreground">Clabel- CT221B</span> (kind USB). Two printers show up as
                two rows with the same name; that is expected.
              </p>
              <GuideImage
                file="printer-setup-3b-add-printer-dialog.jpg"
                alt="Add Printer dialog listing two Clabel- CT221B USB printers"
              />
            </Step>

            <Step index={4} title="Add each printer with its own name">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Select one row and change <strong className="text-foreground">Name</strong> to something unique, for
                example <span className="font-mono text-foreground">Clabel- CT221B (Printer A)</span>. Make sure{" "}
                <strong className="text-foreground">Use</strong> shows{" "}
                <span className="font-mono text-foreground">Clabel- CT221B</span> (the driver from step 1), then click{" "}
                <strong className="text-foreground">Add</strong>. Repeat for the next row with a different name (
                <span className="font-mono text-foreground">Printer B</span>, and so on).
              </p>
              <GuideImage
                file="printer-setup-4-add-printer-select-and-name.jpg"
                alt="Add Printer dialog with one Clabel- CT221B row selected, a custom name and the Clabel- CT221B driver"
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Tip: stick a label with the same name on each physical printer so you can tell them apart later.
              </p>
            </Step>

            <Step index={5} title="Check that every printer is listed">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Back in <strong className="text-foreground">Printers &amp; Scanners</strong> each printer should be
                listed as <strong className="text-foreground">Idle</strong>. If one is missing, add it again. The worker
                can only use printers that appear here.
              </p>
              <GuideImage
                file="printer-setup-5-printers-added.jpg"
                alt="Printers & Scanners listing two Clabel- CT221B printers with different names, both idle"
              />
            </Step>
          </ol>

          <PartHeading>Part 2: Install the worker</PartHeading>
          <ol className="space-y-4">
            <Step index={6} title="Worker download started">
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

            <Step index={7} title="Open Terminal and run this once">
              <CommandBlock command={installCommand} />
              <p className="text-muted-foreground text-xs leading-relaxed">
                The <span className="font-mono">xattr</span> line lets macOS run the downloaded file. If the file was
                saved with a different name (for example <span className="font-mono">(1)</span> at the end), adjust the
                file name in the commands. The printers from Part 1 must already be added, otherwise setup finds no
                printers.
              </p>
            </Step>

            <Step index={8} title="Answer the setup questions">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Setup lists the printers installed on this Mac with the device address each one points to. Type the
                numbers of your label printers, separated by commas. The suggested default in brackets is what you used
                last time.
              </p>
              <GuideImage
                file="printer-setup-8a-terminal-printers.png"
                alt="Terminal showing the installed printers with their USB addresses and the printer selection prompt"
                caption="Here printers 2 and 3 are selected. Other printers on the list (like 1) are ignored."
              />
              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground text-xs leading-relaxed">
                <li>
                  <strong className="text-foreground">Printers:</strong> every selected printer prints in parallel, and
                  every label goes to a free printer.
                </li>
                <li>
                  Two printers of the same model can share one USB address, so every label would print on only one of
                  them. If setup warns that printers{" "}
                  <strong className="text-foreground">point to the same device</strong>, follow the steps it prints
                  before continuing.
                </li>
                <li>Press Enter to accept the Chrome path, port and dashboard address.</li>
                <li>
                  Answer <span className="font-mono">y</span> to{" "}
                  <strong className="text-foreground">Start the worker now</strong>. It keeps running in that Terminal
                  window.
                </li>
              </ul>
              <GuideImage
                file="printer-setup-8b-terminal-start-worker.png"
                alt="Terminal after answering all setup questions, asking whether to start the worker now"
                caption="All questions answered. Type y (or press Enter) to start the worker."
              />
            </Step>

            <Step index={9} title="Allow local network access and start the station">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Chrome may ask to let this site connect to devices on your local network. Choose{" "}
                <strong className="text-foreground">Allow</strong>, then keep this page open and press{" "}
                <strong className="text-foreground">Start Print Station</strong>. Keep the Terminal window open while
                printing.
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Press <strong className="text-foreground">Test Print</strong> a couple of times: the labels should come
                out of different printers, and <strong className="text-foreground">Workers &amp; Printers</strong> on
                this page lists this laptop with all its printers.
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
