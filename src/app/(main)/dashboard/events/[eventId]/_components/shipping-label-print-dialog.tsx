"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Laptop,
  Loader2,
  MapPin,
  Printer,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { subscribePrintStations } from "@/lib/firestore/client";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { fetchPrintWorkerHealth, type PrintWorkerHealth } from "@/lib/printers/local-worker";
import {
  type AvailableThermalPrinterTarget,
  buildShippingLabelHtml,
  dispatchShippingLabelToThermal,
  extractShippingLabelData,
} from "@/lib/printers/shipping-label";
import { BROWSER_PRINTER_NAME, isPrintStationOnline, type PrintStation } from "@/lib/printers/types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface ShippingLabelPrintDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  registrations: FirestoreRegistration[];
  event: FirestoreEvent;
}

export function ShippingLabelPrintDialog({
  isOpen,
  onOpenChange,
  registrations,
  event,
}: ShippingLabelPrintDialogProps) {
  const user = useAuthStore((s) => s.user);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [stations, setStations] = useState<PrintStation[]>([]);
  const [localHealth, setLocalHealth] = useState<PrintWorkerHealth | null>(null);
  const [isCheckingLocal, setIsCheckingLocal] = useState(false);
  const [selectedTargetKey, setSelectedTargetKey] = useState<string>("auto");
  const [isPrinting, setIsPrinting] = useState(false);

  const widthMm = event.printer_config?.paper_width_mm ?? 50;
  const heightMm = event.printer_config?.paper_height_mm ?? 30;
  const orientation = event.printer_config?.orientation ?? "landscape";

  const checkLocalWorker = useCallback(async () => {
    setIsCheckingLocal(true);
    try {
      const h = await fetchPrintWorkerHealth();
      setLocalHealth(h);
    } finally {
      setIsCheckingLocal(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setPreviewIndex(0);
    void checkLocalWorker();
    const unsub = subscribePrintStations(
      (list) => setStations(list),
      () => setStations([]),
    );
    return () => unsub();
  }, [isOpen, checkLocalWorker]);

  const availablePrinters = useMemo<AvailableThermalPrinterTarget[]>(() => {
    const targets: AvailableThermalPrinterTarget[] = [];
    const seenKeys = new Set<string>();
    const localDeviceId = localHealth?.device?.id ? `stn_${localHealth.device.id}` : null;

    // 1. Add online Print Stations from Firestore (local or remote laptops)
    for (const station of stations) {
      if (!isPrintStationOnline(station) || !station.worker_connected || !station.station_running) {
        continue;
      }
      const isThisLaptop =
        Boolean(localDeviceId && (station.id === localDeviceId || station.device_id === localHealth?.device?.id)) ||
        Boolean(localHealth?.device?.computerName && station.name === localHealth.device.computerName);

      for (const p of station.printers || []) {
        if (!p.name || p.name === BROWSER_PRINTER_NAME) continue;
        const key = `${station.id}::${p.name}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        targets.push({
          key,
          stationId: station.id,
          stationName: station.name,
          stationModel: station.model,
          userEmail: station.user_email,
          printerName: p.name,
          state: p.state,
          busy: p.busy,
          isLocalWorker: isThisLaptop,
          stationRunning: true,
        });
      }
    }

    // 2. Add local worker printers directly if not already represented by a running station
    if (localHealth?.ok) {
      const fallbackStationId = localDeviceId || "local-worker";
      const fallbackName = localHealth.device?.computerName || "This Laptop";
      for (const p of localHealth.printers || []) {
        if (!p.name || p.name === BROWSER_PRINTER_NAME) continue;
        const alreadyListed = targets.some((t) => t.isLocalWorker && t.printerName === p.name);
        if (alreadyListed) continue;
        const key = `${fallbackStationId}::${p.name}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        targets.push({
          key,
          stationId: fallbackStationId,
          stationName: fallbackName,
          stationModel: localHealth.device?.model ?? undefined,
          userEmail: user?.email ?? undefined,
          printerName: p.name,
          state: p.state,
          busy: p.busy,
          isLocalWorker: true,
          stationRunning: false,
        });
      }
    }

    return targets;
  }, [stations, localHealth, user?.email]);

  // Keep selectedTargetKey valid when printers connect/disconnect
  useEffect(() => {
    if (availablePrinters.length === 0) {
      setSelectedTargetKey("auto");
      return;
    }
    if (selectedTargetKey === "auto") {
      if (availablePrinters.length === 1) {
        setSelectedTargetKey(availablePrinters[0].key);
      }
      return;
    }
    if (!availablePrinters.some((p) => p.key === selectedTargetKey)) {
      setSelectedTargetKey(availablePrinters.length === 1 ? availablePrinters[0].key : "auto");
    }
  }, [availablePrinters, selectedTargetKey]);

  const activeReg = registrations[previewIndex] ?? registrations[0];
  const activeData = useMemo(() => (activeReg ? extractShippingLabelData(activeReg, event) : null), [activeReg, event]);
  const previewHtml = useMemo(
    () => (activeData ? buildShippingLabelHtml(activeData, { widthMm, heightMm, orientation }) : ""),
    [activeData, widthMm, heightMm, orientation],
  );

  const hasMapsQr = Boolean(activeData?.mapsUrl && activeData.mapsUrl.trim().length > 0);

  const handleConfirmPrint = async () => {
    if (availablePrinters.length === 0) {
      toast.error("Please connect printer thermal first");
      return;
    }

    const selectedTarget =
      selectedTargetKey === "auto"
        ? "auto"
        : (availablePrinters.find((p) => p.key === selectedTargetKey) ?? availablePrinters[0]);

    // If "auto" is chosen and there is a local-only worker (stationRunning=false), route directly to it
    const effectiveTarget =
      selectedTarget === "auto" && !availablePrinters.some((p) => p.stationRunning)
        ? availablePrinters[0]
        : selectedTarget;

    setIsPrinting(true);
    try {
      let printedCount = 0;
      for (const reg of registrations) {
        await dispatchShippingLabelToThermal({
          reg,
          event,
          target: effectiveTarget,
          widthMm,
          heightMm,
          orientation,
        });
        printedCount += 1;
      }

      const targetDesc =
        effectiveTarget === "auto"
          ? "connected thermal printer pool"
          : `${effectiveTarget.printerName} (${effectiveTarget.stationName})`;

      toast.success(
        printedCount === 1
          ? `Shipping label sent to ${targetDesc}.`
          : `${printedCount} shipping labels sent to ${targetDesc}.`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print shipping label.");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Printer className="size-5" />
            <DialogTitle className="text-lg">
              {registrations.length > 1
                ? `Preview & Print ${registrations.length} Shipping Labels`
                : "Preview & Print Shipping Label"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Verify recipient data, shipping destination, and Maps QR code before sending to a thermal printer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Batch switcher */}
          {registrations.length > 1 && (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-1.5 text-xs">
              <span className="font-medium text-foreground">
                Label {previewIndex + 1} of {registrations.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  disabled={previewIndex === 0}
                  onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  disabled={previewIndex >= registrations.length - 1}
                  onClick={() => setPreviewIndex((i) => Math.min(registrations.length - 1, i + 1))}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Thermal Label Preview */}
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-foreground">
                Thermal Sticker Preview ({widthMm}×{heightMm}mm • {orientation})
              </span>
              {hasMapsQr ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300"
                >
                  <QrCode className="size-3" />
                  Maps QR Included
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                  <MapPin className="size-3" />
                  No Maps Link (Full-Width Text)
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-center overflow-auto rounded-md border bg-zinc-100 p-4 dark:bg-zinc-900">
              {previewHtml ? (
                (() => {
                  const mmToPx = 96 / 25.4;
                  const previewScale = Math.min(2, 340 / (widthMm * mmToPx));
                  const boxW = Math.round(widthMm * mmToPx * previewScale);
                  const boxH = Math.round(heightMm * mmToPx * previewScale);
                  return (
                    <div
                      className="overflow-hidden rounded-xs border border-border/80 bg-white shadow-sm"
                      style={{ width: `${boxW}px`, height: `${boxH}px` }}
                    >
                      <iframe
                        title="Shipping Label Thermal Preview"
                        srcDoc={previewHtml}
                        className="border-0 bg-white"
                        style={{
                          width: `${widthMm}mm`,
                          height: `${heightMm}mm`,
                          transform: `scale(${previewScale})`,
                          transformOrigin: "top left",
                        }}
                      />
                    </div>
                  );
                })()
              ) : (
                <div className="py-8 text-center text-muted-foreground text-xs">No label preview available.</div>
              )}
            </div>
          </div>

          {/* Target Thermal Printer & Device Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground text-xs">Target Thermal Printer &amp; Device</span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => void checkLocalWorker()}
                disabled={isCheckingLocal}
                className="h-6 gap-1 px-2 text-[11px]"
              >
                <RefreshCw className={cn("size-3", isCheckingLocal && "animate-spin")} />
                Recheck
              </Button>
            </div>

            {availablePrinters.length === 0 ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="space-y-1">
                  <div className="font-semibold text-destructive">No device connected</div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    No connected thermal printer or active Print Station was detected on this laptop or any other online
                    laptop. Please open <strong>GDG Print Station.app</strong> and connect your thermal printer.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {availablePrinters.length > 1 && availablePrinters.some((p) => p.stationRunning) && (
                  <button
                    type="button"
                    onClick={() => setSelectedTargetKey("auto")}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border p-2.5 text-left text-xs transition-colors",
                      selectedTargetKey === "auto"
                        ? "border-primary bg-primary/5"
                        : "border-border/70 hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Printer className="size-4 text-primary" />
                      <div>
                        <div className="font-medium text-foreground">Auto-assign idle thermal printer</div>
                        <div className="text-[11px] text-muted-foreground">
                          Routes to the first available thermal printer across {availablePrinters.length} online
                          printers
                        </div>
                      </div>
                    </div>
                    {selectedTargetKey === "auto" && <CheckCircle2 className="size-4 text-primary" />}
                  </button>
                )}

                {availablePrinters.map((target) => {
                  const isSelected = selectedTargetKey === target.key;
                  return (
                    <button
                      key={target.key}
                      type="button"
                      onClick={() => setSelectedTargetKey(target.key)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border p-2.5 text-left text-xs transition-colors",
                        isSelected ? "border-primary bg-primary/5" : "border-border/70 hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Laptop className="mt-0.5 size-4 shrink-0 text-primary" />
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-foreground">{target.printerName}</span>
                            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                              {target.isLocalWorker ? "This Laptop" : "Remote Laptop"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "h-4 px-1.5 text-[10px]",
                                target.busy
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                              )}
                            >
                              {target.busy ? "Busy" : "Ready"}
                            </Badge>
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            Device: <span className="font-medium text-foreground">{target.stationName}</span>
                            {target.stationModel ? ` (${target.stationModel})` : ""}
                            {target.userEmail ? ` • ${target.userEmail}` : ""}
                          </div>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-9 text-xs">
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isPrinting}
            onClick={() => void handleConfirmPrint()}
            className="h-9 gap-1.5 text-xs"
          >
            {isPrinting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Sending to Thermal...
              </>
            ) : (
              <>
                <Printer className="size-3.5" />
                {registrations.length > 1
                  ? `Confirm & Print ${registrations.length} Labels`
                  : "Confirm & Print to Thermal"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
