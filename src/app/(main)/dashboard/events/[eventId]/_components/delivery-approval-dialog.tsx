"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { CheckCircle2, ExternalLink, Loader2, Printer, Search, Truck, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { DatePicker } from "@/components/date-picker";
import { PackageTrackingDialog } from "@/components/delivery/package-tracking-dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCourierTrackingUrl } from "@/lib/courier-utils";
import { formatFirestoreDate } from "@/lib/date-utils";
import { approveMerchandiseDeliveryAction } from "@/lib/firestore/actions";
import type { CourierType, FirestoreRegistration } from "@/lib/firestore/types";
import { useAuthStore } from "@/stores/auth/auth-provider";

import { parseMerchandiseVariations } from "./merchandise-helpers";

interface DeliveryApprovalDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  registration: FirestoreRegistration;
  eventId: string;
  onSuccess: (updated: FirestoreRegistration) => void;
  onPrintLabel?: () => void;
}

const COURIER_OPTIONS: { value: CourierType; label: string }[] = [
  { value: "jne", label: "JNE Express" },
  { value: "jnt", label: "J&T Express" },
  { value: "paxel", label: "Paxel" },
  { value: "sicepat", label: "SiCepat Ekspres" },
  { value: "gojek", label: "Gojek (Gosend Instant / Same Day)" },
  { value: "grab", label: "GrabExpress" },
  { value: "anteraja", label: "AnterAja" },
  { value: "pos", label: "Pos Indonesia" },
  { value: "lion_parcel", label: "Lion Parcel" },
  { value: "other", label: "Other Logistics" },
];

export function DeliveryApprovalDialog({
  isOpen,
  onOpenChange,
  registration,
  eventId,
  onSuccess,
  onPrintLabel,
}: DeliveryApprovalDialogProps) {
  const user = useAuthStore((s) => s.user);
  const req = registration.delivery_request;

  const [courierType, setCourierType] = useState<string>(req?.courier_type ?? "paxel");
  const [trackingNumber, setTrackingNumber] = useState<string>(req?.tracking_number ?? "");
  const [trackingUrl, setTrackingUrl] = useState<string>(req?.tracking_url ?? "");
  const [deliveryProofUrl, setDeliveryProofUrl] = useState<string>(req?.delivery_proof_url ?? "");
  const [dispatchedAt, setDispatchedAt] = useState<string>(
    req?.dispatched_at ? req.dispatched_at.slice(0, 16) : new Date().toISOString().slice(0, 16),
  );
  const [notes, setNotes] = useState<string>(req?.notes ?? "");
  const [isTrackingTestOpen, setIsTrackingTestOpen] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const proofFileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, startTransition] = useTransition();

  useEffect(() => {
    if (req) {
      setCourierType(req.courier_type ?? "paxel");
      setTrackingNumber(req.tracking_number ?? "");
      setTrackingUrl(req.tracking_url ?? "");
      setDeliveryProofUrl(req.delivery_proof_url ?? "");
      if (req.dispatched_at) {
        setDispatchedAt(req.dispatched_at.slice(0, 16));
      }
      setNotes(req.notes ?? "");
    }
  }, [req]);

  const handleUploadProof = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be 10MB or smaller.");
      return;
    }

    setIsUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("prefix", `delivery-proofs/${eventId}`);

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { success?: boolean; items?: { url: string }[]; error?: string };

      if (!res.ok || !data.success || !data.items?.[0]?.url) {
        throw new Error(data.error || "Failed to upload delivery proof.");
      }

      setDeliveryProofUrl(data.items[0].url);
      toast.success("Delivery proof uploaded to bucket storage.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload delivery proof.");
    } finally {
      setIsUploadingProof(false);
      if (proofFileInputRef.current) {
        proofFileInputRef.current.value = "";
      }
    }
  };

  const handleProofPaste = (e: React.ClipboardEvent) => {
    if (isUploadingProof || isSubmitting) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          void handleUploadProof(file);
        }
        return;
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!trackingNumber.trim()) {
      toast.error("Please enter the Delivery ID / Tracking Number (No. Resi).");
      return;
    }

    startTransition(async () => {
      const reviewer = {
        id: user?.id ?? "organizer",
        name: user?.name ?? user?.email ?? "Organizer",
        email: user?.email,
      };

      const res = await approveMerchandiseDeliveryAction({
        registrationId: registration.id,
        eventId,
        courierType: courierType.trim(),
        trackingNumber: trackingNumber.trim(),
        trackingUrl: trackingUrl.trim() ? trackingUrl.trim() : undefined,
        deliveryProofUrl: deliveryProofUrl.trim() ? deliveryProofUrl.trim() : undefined,
        dispatchedAt: dispatchedAt ? new Date(dispatchedAt).toISOString() : new Date().toISOString(),
        notes: notes.trim() ? notes.trim() : undefined,
        reviewer,
      });

      if (res.success) {
        toast.success(`Delivery approved! Tracking #${trackingNumber} assigned.`);
        if (req) {
          const updated: FirestoreRegistration = {
            ...registration,
            delivery_request: {
              ...req,
              status: "approved",
              courier_type: courierType.trim(),
              tracking_number: trackingNumber.trim(),
              tracking_url: trackingUrl.trim() || undefined,
              delivery_proof_url: deliveryProofUrl.trim() || undefined,
              dispatched_at: dispatchedAt ? new Date(dispatchedAt).toISOString() : new Date().toISOString(),
              notes: notes.trim() || undefined,
              reviewed_by_id: reviewer.id,
              reviewed_by_name: reviewer.name,
              reviewed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          };
          onSuccess(updated);
        }
        onOpenChange(false);
      } else {
        toast.error(res.error || "Failed to approve delivery.");
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Truck className="size-5" />
            <DialogTitle className="text-xl">Approve Merchandise Delivery</DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            Enter the courier fulfillment and tracking details for <strong>{registration.member_name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient Destination Preview */}
          {req && (
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-xs">
              <div className="flex items-center justify-between font-medium text-foreground">
                <span>Shipping Destination:</span>
                <div className="flex items-center gap-1.5">
                  {req.requested_at && (
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Requested: {formatFirestoreDate(req.requested_at, "dd MMM yyyy, HH:mm", "—")}
                    </span>
                  )}
                  <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    Fee Paid (Rp {(req.fee_amount || 50000).toLocaleString("id-ID")})
                  </Badge>
                  {onPrintLabel && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={onPrintLabel}
                      className="h-6 gap-1 px-2 text-[10px]"
                    >
                      <Printer className="size-3" />
                      Print Label
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-1 text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">{req.recipient_name}</span> ({req.recipient_phone})<br />
                {req.shipping_address}
                <br />
                {req.city}, {req.postal_code}
                {req.maps_url && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <a
                      href={req.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-medium text-[11px] text-primary hover:bg-primary/20 hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      View on Google Maps
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items Summary */}
          {(() => {
            const itemsToPack =
              registration.delivery_request?.items && registration.delivery_request.items.length > 0
                ? registration.delivery_request.items
                : (registration.selected_merchandise ?? []);

            return (
              <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 text-xs">
                <div className="mb-1.5 font-medium text-foreground">Items to Pack:</div>
                <div className="flex flex-wrap gap-1.5">
                  {itemsToPack.map((m, idx) => {
                    const variations = parseMerchandiseVariations(m, registration.answers);
                    const varText = variations.map((v) => (v.label ? `${v.label}: ${v.value}` : v.value)).join(", ");

                    return (
                      <Badge key={m.id || idx} variant="secondary" className="text-[11px]">
                        {m.quantity}x {m.name}
                        {varText ? ` (${varText})` : ""}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Courier Selection */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="courierType" className="text-xs">
                Delivery Type / Courier <span className="text-destructive">*</span>
              </Label>
              <Select
                value={courierType}
                onValueChange={(nextCourier) => {
                  const prevAutoUrl = getCourierTrackingUrl(courierType, trackingNumber);
                  setCourierType(nextCourier);
                  if (
                    trackingNumber.trim() &&
                    (!trackingUrl.trim() ||
                      trackingUrl.trim() === prevAutoUrl ||
                      /^https?:\/\/(www\.)?cekresi\.com/i.test(trackingUrl.trim()))
                  ) {
                    setTrackingUrl(getCourierTrackingUrl(nextCourier, trackingNumber));
                  }
                }}
              >
                <SelectTrigger id="courierType" className="h-9 text-xs">
                  <SelectValue placeholder="Select Courier" />
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

            <div className="space-y-1">
              <Label htmlFor="trackingNumber" className="text-xs">
                Delivery ID / Tracking No. (Resi) <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="trackingNumber"
                  placeholder="e.g. 023423949234324 or PAX-12345678"
                  value={trackingNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    const prevAutoUrl = getCourierTrackingUrl(courierType, trackingNumber);
                    setTrackingNumber(val);
                    if (
                      val.trim() &&
                      (!trackingUrl.trim() ||
                        trackingUrl.trim() === prevAutoUrl ||
                        /^https?:\/\/(www\.)?cekresi\.com/i.test(trackingUrl.trim()))
                    ) {
                      setTrackingUrl(getCourierTrackingUrl(courierType, val));
                    }
                  }}
                  required
                  className="h-9 font-mono text-xs flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!trackingNumber.trim()}
                  onClick={() => setIsTrackingTestOpen(true)}
                  className="h-9 text-xs gap-1.5 shrink-0 px-3"
                  title="Track shipment via CekResi API"
                >
                  <Search className="size-3.5 text-muted-foreground" />
                  <span>Track Shipment</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Tracking URL & Proof URL */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="trackingUrl" className="text-xs">
                Package Tracking Link (URL)
              </Label>
              <Input
                id="trackingUrl"
                type="url"
                placeholder="https://track.paxel.co/..."
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5" onPaste={handleProofPaste}>
              <Label htmlFor="deliveryProofUrl" className="text-xs">
                Delivery Proof Image (Drop-off photo / Receipt)
              </Label>
              <input
                ref={proofFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUploadProof(file);
                }}
              />
              <div className="flex items-center gap-2">
                <Input
                  id="deliveryProofUrl"
                  type="url"
                  placeholder="Paste image, URL, or upload..."
                  value={deliveryProofUrl}
                  onChange={(e) => setDeliveryProofUrl(e.target.value)}
                  className="h-9 flex-1 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 text-xs"
                  disabled={isUploadingProof || isSubmitting}
                  onClick={() => proofFileInputRef.current?.click()}
                >
                  {isUploadingProof ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {isUploadingProof ? "Uploading..." : "Upload"}
                </Button>
                {deliveryProofUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeliveryProofUrl("")}
                    aria-label="Clear delivery proof"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {deliveryProofUrl && (
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-1.5">
                  <img src={deliveryProofUrl} alt="Delivery proof preview" className="h-10 w-10 rounded object-cover" />
                  <a
                    href={deliveryProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-1 truncate text-xs text-primary hover:underline"
                  >
                    <span className="truncate">{deliveryProofUrl}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="dispatchedAt" className="text-xs">
                  Dispatched / Delivery Date & Time
                </Label>
                <DatePicker
                  id="dispatchedAt"
                  withTime
                  value={dispatchedAt}
                  onChange={setDispatchedAt}
                  placeholder="Select dispatch date & time"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="organizerNotes" className="text-xs">
                  Organizer Fulfillment Notes
                </Label>
                <Input
                  id="organizerNotes"
                  placeholder="e.g. Handed to driver at 14:00"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-9 gap-1.5 bg-emerald-600 text-white text-xs hover:bg-emerald-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving & Dispatching...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  Approve & Dispatch Package
                </>
              )}
            </Button>
          </DialogFooter>
        </form>

        <PackageTrackingDialog
          open={isTrackingTestOpen}
          onOpenChange={setIsTrackingTestOpen}
          trackingNumber={trackingNumber}
          courierType={courierType}
          recipientName={req?.recipient_name}
        />
      </DialogContent>
    </Dialog>
  );
}
