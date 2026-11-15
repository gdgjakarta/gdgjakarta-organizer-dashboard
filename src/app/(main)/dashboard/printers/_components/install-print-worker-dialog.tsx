"use client";

import * as React from "react";

import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Monitor,
  Printer,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getPrintWorkerArchiveFileName,
  getPrintWorkerDownloadUrl,
  PRINT_STATION_APP_NAME,
  type PrintWorkerHealth,
} from "@/lib/printers/local-worker";
import { MIN_PRINT_WORKER_VERSION } from "@/lib/printers/types";

const RECHECK_INTERVAL_MS = 3000;
const PRINTER_DRIVER_URL = "https://ga.ctaiot.com/";
/** Screenshots of the guide, uploaded to the Media page under `community-dashboard/media/`. */
const GUIDE_IMAGE_BASE_URL = "https://gdgjakarta.com/api/media/community-dashboard/media";

interface InstallPrintWorkerDialogProps {
  health: PrintWorkerHealth | null;
  onRecheck: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
      <pre className="whitespace-pre-wrap break-all">{command}</pre>
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
          className="h-auto max-w-full rounded-lg border object-contain"
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

/** Visual diagram of the macOS Menu Bar popover so organizers know exactly what to click on their Mac. */
function MenuBarPopoverPreview({ health }: { health: PrintWorkerHealth | null }) {
  const computerName = health?.device?.computerName ?? "Check-in MacBook Pro";
  const version = health?.version ?? MIN_PRINT_WORKER_VERSION;
  const livePrinters = health?.printers ?? [];
  const readyCount = livePrinters.filter((p) => p.available && p.usbConnected !== false).length;

  return (
    <div className="overflow-hidden rounded-xl border bg-zinc-900 text-zinc-100 shadow-lg">
      {/* Simulated macOS Menu Bar strip */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-3 py-1.5 text-[11px]">
        <div className="flex items-center gap-3 text-zinc-400">
          <span className="font-semibold text-zinc-200"></span>
          <span>Safari / Chrome</span>
          <span className="hidden sm:inline">File</span>
          <span className="hidden sm:inline">View</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 font-medium text-zinc-100 ring-1 ring-white/15">
            <Printer className="size-3" />
            <span>{health ? readyCount : 2}</span>
          </span>
          <span className="text-zinc-400">Wi-Fi</span>
          <span className="font-mono text-zinc-300">Sun 09:41 AM</span>
        </div>
      </div>

      {/* Actual native NSMenu layout from GDG Print Station.app */}
      <div className="grid grid-cols-1 gap-3.5 p-3.5 md:grid-cols-12">
        <div className="md:col-span-7">
          <div className="rounded-xl border border-white/15 bg-zinc-800/95 p-1.5 font-sans text-[12px] text-zinc-100 shadow-2xl backdrop-blur-md">
            {/* Disabled menu header lines */}
            <div className="px-2.5 py-0.5 text-zinc-400">GDG Print Station • v{version}</div>
            <div className="px-2.5 pb-1.5 text-[11px] text-zinc-400">Online on 127.0.0.1:17777 ({computerName})</div>

            <div className="my-1 border-t border-white/10" />

            <div className="px-2.5 py-0.5 text-[11px] text-zinc-400">Configured Printers (Click to Toggle):</div>

            {livePrinters.length > 0 ? (
              livePrinters.map((p, idx) => {
                const statusBadge = p.busy
                  ? "Printing…"
                  : p.usbConnected === false
                    ? "USB Unplugged"
                    : !p.available
                      ? "Offline"
                      : (p.queueDepth ?? 0) > 0
                        ? `Ready (${p.queueDepth} in spool)`
                        : `Ready • Printer #${idx + 1}`;
                return (
                  <div
                    key={p.name}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-zinc-100 hover:bg-blue-600 hover:text-white"
                  >
                    <Check className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {p.name} — {statusBadge}
                    </span>
                  </div>
                );
              })
            ) : (
              <>
                <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-zinc-100">
                  <Check className="size-3.5 shrink-0" />
                  <span className="truncate">Clabel__CT221B__Abadi_ — Ready • Printer #1</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-md bg-blue-600 px-2 py-1 text-white">
                  <Check className="size-3.5 shrink-0" />
                  <span className="truncate">Clabel__CT221B__Fachri_ — Ready • Printer #2</span>
                </div>
              </>
            )}

            <div className="my-1 border-t border-white/10" />

            <div className="flex items-center justify-between rounded-md px-2.5 py-1 hover:bg-blue-600 hover:text-white">
              <span>Refresh Printers &amp; Auto-Fix USB Ports</span>
              <span className="font-mono text-[11px] text-zinc-400">⌘R</span>
            </div>
            <div className="flex items-center justify-between rounded-md px-2.5 py-1 hover:bg-blue-600 hover:text-white">
              <span>Test Print Sample Badge (50×30mm)</span>
              <span className="font-mono text-[11px] text-zinc-400">⌘T</span>
            </div>
            <div className="flex items-center justify-between rounded-md px-2.5 py-1 hover:bg-blue-600 hover:text-white">
              <span>Clear Stuck CUPS Print Queues</span>
            </div>
            <div className="flex items-center justify-between rounded-md px-2.5 py-1 hover:bg-blue-600 hover:text-white">
              <span>Open Dashboard Printers Page…</span>
              <span className="font-mono text-[11px] text-zinc-400">⌘O</span>
            </div>

            <div className="my-1 border-t border-white/10" />

            <div className="flex items-center justify-between rounded-md px-2.5 py-1 hover:bg-blue-600 hover:text-white">
              <span>Quit GDG Print Station</span>
              <span className="font-mono text-[11px] text-zinc-400">⌘Q</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-2 text-xs text-zinc-300 md:col-span-5">
          <div className="space-y-1.5">
            <div className="font-semibold text-zinc-100">Native macOS Menu Bar Controls</div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              <strong className="text-zinc-200">{PRINT_STATION_APP_NAME}</strong> runs as a native macOS Menu Bar app
              and renders badges via macOS WebKit PDF (~100ms per label).
            </p>
            <ul className="list-disc space-y-1 pl-4 text-[11px] text-zinc-300">
              <li>
                <strong className="text-zinc-100">Click any printer row (`✓`):</strong> Enable or disable individual USB
                printers on this Mac (or toggle all off).
              </li>
              <li>
                <strong className="text-zinc-100">Refresh Printers &amp; Auto-Fix USB Ports (`⌘R`):</strong> Scans live
                USB hardware (`ioreg`) and binds identical Clabel CT221B printers to their unique USB{" "}
                <code className="text-emerald-300">location=</code> port.
              </li>
              <li>
                <strong className="text-zinc-100">Test Print (`⌘T`) &amp; Clear Stuck Queues:</strong> Verifies live USB
                connection before printing or flushes stalled CUPS jobs in 1 click.
              </li>
            </ul>
          </div>
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-300">
            Works in <strong>Safari</strong>, <strong>Chrome</strong>, <strong>Brave</strong>, <strong>Edge</strong>,
            and <strong>Arc</strong>.
          </div>
        </div>
      </div>
    </div>
  );
}

/** Visual diagram of the actual Notch Dynamic Island and Non-Notch Floating Dynamic Island HUD from GDGPrintStation.swift. */
function DynamicIslandHudPreview() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* MacBook with Camera Notch — matches NotchDynamicIslandController (.printing / .failed) */}
      <div className="overflow-hidden rounded-xl border bg-zinc-900 p-3 text-zinc-100">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-semibold text-xs text-zinc-200">MacBook with Camera Notch</span>
          <Badge variant="outline" className="border-zinc-700 text-[10px] text-zinc-300">
            Below Camera Notch (`safeAreaInsets.top`)
          </Badge>
        </div>
        <div className="relative flex flex-col items-center rounded-lg border border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900 px-3 pt-0 pb-4">
          {/* Attached top notch panel: 388pt wide, full word-wrapping, PRINTING tag */}
          <div className="w-full max-w-[310px] rounded-b-[18px] border-x border-b border-white/15 bg-black/95 px-3.5 pt-3 pb-2.5 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="mt-1 size-2.5 shrink-0 rounded-full bg-blue-500" />
                <div className="min-w-0 space-y-0.5">
                  <div className="break-words font-semibold text-[11.5px] text-white leading-tight">
                    Printing badge for Fachridan Tio…
                  </div>
                  <div className="break-words font-mono text-[10px] text-zinc-400 leading-tight">
                    → Clabel__CT221B__Fachri_ (50×30mm)
                  </div>
                </div>
              </div>
              <span className="shrink-0 rounded-[6px] bg-blue-500/25 px-1.5 py-0.5 font-bold text-[9px] text-cyan-400">
                PRINTING
              </span>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-zinc-400 leading-relaxed">
            Drops down below the physical MacBook camera notch (
            <code className="text-zinc-300">safeAreaInsets.top</code>
            ), wraps multi-line printer names cleanly without <code className="text-zinc-300">…</code> truncation, and
            shows <strong className="text-cyan-400">PRINTING</strong>,{" "}
            <strong className="text-emerald-400">DONE</strong>, or <strong className="text-rose-400">ALERT</strong> (if
            USB is unplugged).
          </p>
        </div>
      </div>

      {/* Macs without a Notch / External Monitor — matches NotchDynamicIslandController (.completed) */}
      <div className="overflow-hidden rounded-xl border bg-zinc-900 p-3 text-zinc-100">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-semibold text-xs text-zinc-200">iMac / Mac mini / External Monitor</span>
          <Badge variant="outline" className="border-zinc-700 text-[10px] text-zinc-300">
            <Monitor className="mr-1 size-2.5" />
            Floating Dynamic Island
          </Badge>
        </div>
        <div className="relative flex flex-col items-center rounded-lg border border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900 px-3 pt-3 pb-4">
          {/* Floating rounded-18pt panel */}
          <div className="w-full max-w-[310px] rounded-[18px] border border-white/15 bg-black/95 px-3.5 py-2.5 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="mt-1 size-2.5 shrink-0 rounded-full bg-emerald-500" />
                <div className="min-w-0 space-y-0.5">
                  <div className="break-words font-semibold text-[11.5px] text-white leading-tight">
                    Printed Fachridan Tio
                  </div>
                  <div className="break-words font-mono text-[10px] text-zinc-400 leading-tight">
                    ✓ Clabel__CT221B__Fachri_
                  </div>
                </div>
              </div>
              <span className="shrink-0 rounded-[6px] bg-emerald-500/25 px-1.5 py-0.5 font-bold text-[9px] text-emerald-400">
                DONE
              </span>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-zinc-400 leading-relaxed">
            On displays without a camera notch (or when a USB printer is unplugged showing a red{" "}
            <strong className="text-rose-400">ALERT</strong> banner), it appears as a floating top-centered pill below
            the menu bar.
          </p>
        </div>
      </div>
    </div>
  );
}

export function InstallPrintWorkerDialog({
  health,
  onRecheck,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: InstallPrintWorkerDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      setUncontrolledOpen(next);
      setControlledOpen?.(next);
    },
    [setControlledOpen],
  );

  const isConnected = health !== null;
  const archiveFileName = getPrintWorkerArchiveFileName();

  // While the dialog is open, check often so the "connected" state shows as soon as setup finishes.
  React.useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(onRecheck, RECHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [open, onRecheck]);

  const handleOpenClick = () => {
    setOpen(true);
  };

  const handleDownload = () => {
    startDownload(getPrintWorkerDownloadUrl());
    toast.success("GDG Print Station download started.");
  };

  const oneLineInstallCommand =
    'curl -fsSL "https://gdgjakarta.com/api/media/community-dashboard/app/install-macos.sh?v=2.4.0" | bash';

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={handleOpenClick}>
        <SlidersHorizontal className="size-3.5" />
        Preparation &amp; Config
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl md:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="size-5 text-primary" />
              Print Station Preparation &amp; Native macOS App Setup
            </DialogTitle>
            <DialogDescription>
              Follow these steps once per check-in Mac. Add your USB Clabel printers in macOS Settings (Part 1), clean
              up any legacy Terminal worker, and launch <strong>{PRINT_STATION_APP_NAME}</strong> (Part 2) for
              zero-Terminal, dialog-free printing with live Notch Dynamic Island feedback.
            </DialogDescription>
          </DialogHeader>

          <PartHeading>Part 1: Set up the USB printers in macOS (Supports 1 or 2+ Printers per Laptop)</PartHeading>
          <ol className="space-y-4">
            <Step index={1} title="Install the Clabel printer driver">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Download and install the Clabel macOS Print Driver from{" "}
                <a
                  href={PRINTER_DRIVER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2"
                >
                  ga.ctaiot.com <ExternalLink className="size-3" />
                </a>
                . Install the driver before plugging in the printers.
              </p>
            </Step>

            <Step index={2} title="Connect and switch on your thermal printers">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Plug 1 or 2+ Clabel CT221B printers into this Mac via USB and switch them on. Keep each printer plugged
                into the same USB port during the event so macOS keeps its hardware USB port assignment fixed.
              </p>
            </Step>

            <Step index={3} title="Open System Settings → Printers & Scanners → Add Printer">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Open <strong className="text-foreground">System Settings → Printers &amp; Scanners</strong> and click{" "}
                <strong className="text-foreground">Add Printer, Scanner, or Fax…</strong>.
              </p>
              <GuideImage
                file="printer-setup-3a-printers-and-scanners-empty.jpg"
                alt="Printers & Scanners in System Settings with no printers and the Add Printer, Scanner, or Fax button"
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                In the <strong className="text-foreground">Default</strong> tab, every connected USB printer appears as{" "}
                <span className="font-mono text-foreground">Clabel- CT221B</span>. Two physical printers plugged into
                one Mac appear as two rows.
              </p>
              <GuideImage
                file="printer-setup-3b-add-printer-dialog.jpg"
                alt="Add Printer dialog listing two Clabel- CT221B USB printers"
              />
            </Step>

            <Step index={4} title="Give each printer a distinct name (for separate assigned queues)">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Select the first row and give it a unique <strong className="text-foreground">Name</strong>, for example{" "}
                <span className="font-mono text-foreground">Clabel- CT221B (Printer A)</span>. Confirm{" "}
                <strong className="text-foreground">Use</strong> is set to{" "}
                <span className="font-mono text-foreground">Clabel- CT221B</span>, then click{" "}
                <strong className="text-foreground">Add</strong>. Repeat for the second printer with a distinct name (
                <span className="font-mono text-foreground">Clabel- CT221B (Printer B)</span>).
              </p>
              <GuideImage
                file="printer-setup-4-add-printer-select-and-name.jpg"
                alt="Add Printer dialog with one Clabel- CT221B row selected, a custom name and the Clabel- CT221B driver"
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Why this matters: one laptop can drive 2 printers in parallel. Each named printer receives its own
                independent queue slot so two attendees&apos; badges print simultaneously without ever duplicating
                labels.
              </p>
            </Step>

            <Step index={5} title="Verify all printers show as Idle">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Back in <strong className="text-foreground">Printers &amp; Scanners</strong>, confirm every printer is
                listed as <strong className="text-foreground">Idle</strong>.
              </p>
              <GuideImage
                file="printer-setup-5-printers-added.jpg"
                alt="Printers & Scanners listing two Clabel- CT221B printers with different names, both idle"
              />
            </Step>
          </ol>

          <PartHeading>Part 2: Install &amp; Launch {PRINT_STATION_APP_NAME} (No Terminal Kept Open)</PartHeading>
          <ol className="space-y-4">
            <Step index={6} title={`Install & open ${PRINT_STATION_APP_NAME} with one command`}>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Paste this single line in Terminal once. It automatically cleans up any old CLI worker (skipping if none
                exists), installs <strong className="text-foreground">{PRINT_STATION_APP_NAME}</strong> to{" "}
                <span className="font-mono">/Applications</span> without macOS Gatekeeper popups, and launches it in
                your Menu Bar—then you can close Terminal:
              </p>
              <CommandBlock command={oneLineInstallCommand} />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-muted-foreground text-xs">
                <span>
                  Prefer a manual installer? Download the <span className="font-mono">.dmg</span> (if macOS blocks it,
                  click <strong>Open Anyway</strong> in <strong>System Settings → Privacy &amp; Security</strong>):
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 gap-1.5 border text-xs shadow-xs"
                  onClick={handleDownload}
                >
                  <Download className="size-3.5 text-primary" />
                  <span>Download .dmg</span>
                </Button>
              </div>
            </Step>

            <Step index={7} title="Check printer status from the macOS Menu Bar">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Look at the top-right macOS Menu Bar for the{" "}
                <strong className="text-foreground">printer icon with your active printer count</strong>. Click it at
                any time to check live printer status, toggle which printers receive jobs, run{" "}
                <strong className="text-foreground">Refresh Printers &amp; Auto-Fix USB Ports</strong>, or trigger a{" "}
                <strong className="text-foreground">Test Print</strong>:
              </p>
              <MenuBarPopoverPreview health={health} />
            </Step>

            <Step index={8} title="Click Start Print Station & watch the Notch / Floating Dynamic Island HUD">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Once the header badge on this page turns green (
                <strong className="text-foreground">Print Station App: Connected</strong>), click{" "}
                <strong className="text-foreground">Start Print Station</strong>. Whenever an attendee is checked in
                (via QR Scanner, Registrants table, or another organizer&apos;s phone/iPad), this Mac claims the badge
                and displays a live <strong className="text-foreground">Dynamic Island HUD</strong> at the top of your
                screen:
              </p>
              <DynamicIslandHudPreview />
              <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5 text-muted-foreground text-xs">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">Multi-Tab &amp; Multi-Printer Safe:</strong> Opening multiple
                  dashboard tabs or switching tabs will not stop your running Print Station or create duplicate laptop
                  entries. Each physical printer connected to this Mac claims its own separate queue item so badges
                  never print twice.
                </span>
              </div>
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
                <span>
                  <strong>{PRINT_STATION_APP_NAME}</strong> connected (v{health.version}) on{" "}
                  <strong>{health.device?.computerName || "this Mac"}</strong> with {health.printers.length}{" "}
                  {health.printers.length === 1 ? "printer" : "printers"} configured. You&apos;re ready to print!
                </span>
              </>
            ) : (
              <>
                <Loader2 className="size-4 shrink-0 animate-spin" />
                <span>
                  Waiting for <strong>{PRINT_STATION_APP_NAME}</strong> on{" "}
                  <code className="font-mono">127.0.0.1:17777</code>…
                </span>
              </>
            )}
          </div>

          <Button variant={isConnected ? "default" : "outline"} onClick={() => setOpen(false)}>
            {isConnected ? "Done" : "Close"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
