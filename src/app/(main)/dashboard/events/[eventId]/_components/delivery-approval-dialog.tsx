"use client";

import { useEffect, useState, useTransition } from "react";

import { CheckCircle2, Loader2, Truck } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { approveMerchandiseDeliveryAction } from "@/lib/firestore/actions";
import type { CourierType, FirestoreRegistration } from "@/lib/firestore/types";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface DeliveryApprovalDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  registration: FirestoreRegistration;
  eventId: string;
  onSuccess: (updated: FirestoreRegistration) => void;
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
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  Fee Paid (Rp 50.000)
                </Badge>
              </div>
              <div className="mt-1 text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">{req.recipient_name}</span> ({req.recipient_phone})<br />
                {req.shipping_address}
                <br />
                {req.city}, {req.postal_code}
              </div>
            </div>
          )}

          {/* Items Summary */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 text-xs">
            <div className="mb-1 font-medium text-foreground">Items to Pack:</div>
            <div className="flex flex-wrap gap-1.5">
              {(registration.selected_merchandise ?? []).map((m, idx) => (
                <Badge key={m.id || idx} variant="secondary" className="text-[11px]">
                  {m.quantity}x {m.name}
                  {m.selected_variations && Object.keys(m.selected_variations).length > 0
                    ? ` (${Object.values(m.selected_variations).join(", ")})`
                    : ""}
                </Badge>
              ))}
            </div>
          </div>

          {/* Courier Selection */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="courierType" className="text-xs">
                Delivery Type / Courier <span className="text-destructive">*</span>
              </Label>
              <Select value={courierType} onValueChange={setCourierType}>
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
              <Input
                id="trackingNumber"
                placeholder="e.g. PAX-12345678 or JNE98765432"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                required
                className="h-9 font-mono text-xs"
              />
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

            <div className="space-y-1">
              <Label htmlFor="deliveryProofUrl" className="text-xs">
                Delivery Proof Image URL (Drop-off photo / Receipt)
              </Label>
              <Input
                id="deliveryProofUrl"
                type="url"
                placeholder="https://storage.googleapis.com/... or image link"
                value={deliveryProofUrl}
                onChange={(e) => setDeliveryProofUrl(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="dispatchedAt" className="text-xs">
                  Dispatched / Delivery Date & Time
                </Label>
                <Input
                  id="dispatchedAt"
                  type="datetime-local"
                  value={dispatchedAt}
                  onChange={(e) => setDispatchedAt(e.target.value)}
                  className="h-9 text-xs"
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
      </DialogContent>
    </Dialog>
  );
}
