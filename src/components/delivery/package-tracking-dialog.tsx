"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trackDeliveryPackageAction } from "@/lib/firestore/actions";
import type { CourierType } from "@/lib/firestore/types";
import type { CekResiTrackingData } from "@/lib/shipping/cek-resi";
import { cn } from "@/lib/utils";

const COURIER_OPTIONS: Array<{ value: CourierType; label: string }> = [
  { value: "jne", label: "JNE Express" },
  { value: "jnt", label: "J&T Express" },
  { value: "sicepat", label: "SiCepat" },
  { value: "pos", label: "Pos Indonesia" },
  { value: "anteraja", label: "Anteraja" },
  { value: "paxel", label: "Paxel" },
  { value: "gojek", label: "Gojek" },
  { value: "grab", label: "Grab" },
  { value: "other", label: "Lainnya / Auto" },
];

interface PackageTrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingNumber?: string;
  courierType?: CourierType | string;
  recipientName?: string;
  allowManualSearch?: boolean;
}

export function PackageTrackingDialog({
  open,
  onOpenChange,
  trackingNumber: initialTrackingNumber = "",
  courierType: initialCourierType = "jne",
  recipientName,
  allowManualSearch = false,
}: PackageTrackingDialogProps) {
  const [trackingNumber, setTrackingNumber] = useState<string>(initialTrackingNumber);
  const [courier, setCourier] = useState<string>(initialCourierType);
  const [trackingData, setTrackingData] = useState<CekResiTrackingData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const performTrack = useCallback((numberToTrack: string, courierCode: string) => {
    const cleanNumber = numberToTrack.trim();
    if (!cleanNumber) {
      setErrorMessage("Nomor resi tidak boleh kosong.");
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await trackDeliveryPackageAction({
          trackingNumber: cleanNumber,
          courier: courierCode,
        });

        if (res.valid && res.data) {
          setTrackingData(res.data);
          setErrorMessage(null);
        } else {
          setTrackingData(null);
          setErrorMessage(
            res.message ?? res.error ?? "Nomor resi belum terdaftar atau tidak ditemukan di sistem ekspedisi.",
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal memuat status pelacakan paket.";
        setErrorMessage(msg);
      }
    });
  }, []);

  // Reset or initialize when opened
  useEffect(() => {
    if (open) {
      const activeNumber = initialTrackingNumber.trim();
      setTrackingNumber(activeNumber);
      setCourier(initialCourierType);
      setErrorMessage(null);
      setTrackingData(null);

      if (activeNumber) {
        performTrack(activeNumber, initialCourierType);
      }
    }
  }, [open, initialTrackingNumber, initialCourierType, performTrack]);

  const handleCopyResi = (num: string) => {
    if (!num) return;
    navigator.clipboard.writeText(num);
    setCopied(true);
    toast.success("Nomor resi disalin ke papan klip");
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadgeVariant = (statusText: string) => {
    const lower = statusText.toLowerCase();
    if (lower.includes("delivered") || lower.includes("terima") || lower.includes("selesai")) {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    }
    if (lower.includes("process") || lower.includes("kirim") || lower.includes("transit") || lower.includes("jalan")) {
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400";
    }
    if (lower.includes("gagal") || lower.includes("retur") || lower.includes("cancel") || lower.includes("batal")) {
      return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400";
    }
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:max-w-2xl">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Truck className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">Pelacakan Paket Pengiriman</DialogTitle>
                <DialogDescription className="text-xs">
                  Integrasi live tracking ekspedisi Indonesia via CekResi API
                </DialogDescription>
              </div>
            </div>
            {trackingData?.status && (
              <Badge
                className={cn(
                  "px-2.5 py-0.5 text-xs font-semibold capitalize",
                  getStatusBadgeVariant(trackingData.status),
                )}
              >
                {trackingData.status}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Search Bar / Input Controls */}
          {allowManualSearch && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3.5 bg-muted/40 rounded-xl border">
              <div className="sm:col-span-4 space-y-1">
                <Label htmlFor="courier-select" className="text-xs font-medium">
                  Ekspedisi
                </Label>
                <Select value={courier} onValueChange={setCourier}>
                  <SelectTrigger id="courier-select" className="h-9 text-xs">
                    <SelectValue placeholder="Pilih Kurir" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURIER_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-6 space-y-1">
                <Label htmlFor="search-resi-input" className="text-xs font-medium">
                  Nomor Resi / Delivery ID
                </Label>
                <Input
                  id="search-resi-input"
                  placeholder="Contoh: 023423949234324"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="h-9 text-xs font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      performTrack(trackingNumber, courier);
                    }
                  }}
                />
              </div>

              <div className="sm:col-span-2 flex items-end">
                <Button
                  size="sm"
                  className="w-full h-9 text-xs gap-1.5"
                  disabled={isPending || !trackingNumber.trim()}
                  onClick={() => performTrack(trackingNumber, courier)}
                >
                  {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                  Lacak
                </Button>
              </div>
            </div>
          )}

          {/* Quick Resi Header when search bar is not shown */}
          {!allowManualSearch && trackingNumber && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-muted/30 rounded-xl border">
              <div className="space-y-0.5">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Nomor Resi ({courier.toUpperCase()})
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base">{trackingNumber}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => handleCopyResi(trackingNumber)}
                    title="Salin Resi"
                  >
                    {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  disabled={isPending}
                  onClick={() => performTrack(trackingNumber, courier)}
                >
                  <RefreshCw className={cn("size-3.5", isPending && "animate-spin")} />
                  Refresh
                </Button>
                {trackingData?.linkCekResi && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-8 text-xs gap-1 text-primary hover:text-primary/80"
                  >
                    <a href={trackingData.linkCekResi} target="_blank" rel="noopener noreferrer">
                      <span>CekResi</span>
                      <ExternalLink className="size-3" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isPending && !trackingData && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Loader2 className="size-6 animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">Menghubungkan ke Ekspedisi...</p>
                <p className="text-xs text-muted-foreground">Mengambil riwayat tracking resmi melalui CekResi API</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && !isPending && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive">
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-sm">Tidak Dapat Menampilkan Status</p>
                <p className="text-muted-foreground">{errorMessage}</p>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => performTrack(trackingNumber, courier)}
                  >
                    Coba Lagi
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Loaded Tracking Content */}
          {trackingData && (
            <div className="space-y-5">
              {/* Delivery Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border bg-card space-y-0.5">
                  <span className="text-[11px] text-muted-foreground font-medium">Ekspedisi</span>
                  <p className="font-semibold text-sm truncate">
                    {trackingData.expedisi ? trackingData.expedisi : courier.toUpperCase()}
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-card space-y-0.5">
                  <span className="text-[11px] text-muted-foreground font-medium">Tujuan / Penerima</span>
                  <p className="font-semibold text-sm truncate">
                    {recipientName ?? (trackingData.tujuan !== "-" ? trackingData.tujuan : "Sesuai Alamat Pemesan")}
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-card space-y-0.5 col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Status Terkini</span>
                  <p className="font-semibold text-sm text-primary truncate">
                    {trackingData.penerima
                      ? trackingData.penerima
                      : trackingData.status
                        ? trackingData.status
                        : "Dalam Pengiriman"}
                  </p>
                </div>
              </div>

              {/* Journey Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground" />
                    <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      Riwayat Perjalanan Paket ({trackingData.perjalanan.length} Checkpoint)
                    </span>
                  </div>
                  {allowManualSearch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-muted-foreground"
                      onClick={() => performTrack(trackingNumber, courier)}
                      disabled={isPending}
                    >
                      <RefreshCw className={cn("size-3", isPending && "animate-spin")} />
                      Refresh
                    </Button>
                  )}
                </div>

                {trackingData.perjalanan.length === 0 ? (
                  <div className="p-6 text-center rounded-xl border border-dashed text-muted-foreground text-xs">
                    <Package className="size-8 mx-auto mb-2 opacity-50" />
                    Belum ada rincian riwayat perjalanan bertahap. Paket kemungkinan baru di-manifestasi atau dalam
                    proses penjemputan kurir.
                  </div>
                ) : (
                  <ScrollArea className="max-h-[320px] rounded-xl border bg-muted/10 p-4">
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                      {trackingData.perjalanan.map((step, idx) => {
                        const isLatest = idx === 0;
                        const isDelivered =
                          step.keterangan.toLowerCase().includes("delivered") ||
                          step.keterangan.toLowerCase().includes("terima");

                        return (
                          <div key={`${step.tanggal}-${idx}`} className="relative group">
                            {/* Marker dot */}
                            <div
                              className={cn(
                                "absolute -left-[23px] top-0.5 size-3.5 rounded-full border-2 transition-colors",
                                isDelivered
                                  ? "border-emerald-600 bg-emerald-500"
                                  : isLatest
                                    ? "border-primary bg-primary animate-pulse"
                                    : "border-muted-foreground/40 bg-background",
                              )}
                            />

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                                  {step.tanggal !== "-" ? step.tanggal : "Proses Kurir"}
                                </span>
                                {isLatest && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] py-0 px-1.5 border-primary/40 text-primary"
                                  >
                                    Update Terbaru
                                  </Badge>
                                )}
                                {isDelivered && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] py-0 px-1.5 border-emerald-500/40 text-emerald-600"
                                  >
                                    Paket Diterima
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-foreground font-medium leading-relaxed">{step.keterangan}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Congratulatory note if package delivered */}
              {(trackingData.status.toLowerCase().includes("delivered") ||
                trackingData.penerima?.toLowerCase().includes("delivered")) && (
                <div className="flex items-center gap-2.5 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 text-xs">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>Paket telah sampai di tujuan. Terima kasih telah memesan merchandise resmi GDG Jakarta!</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
