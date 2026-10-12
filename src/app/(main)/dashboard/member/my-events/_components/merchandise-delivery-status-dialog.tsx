"use client";

import { useState } from "react";

import { format, parseISO } from "date-fns";
import { CheckCircle2, Clock, Copy, ExternalLink, FileImage, MapPin, ShoppingBag, Truck, XCircle } from "lucide-react";
import { toast } from "sonner";

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
import type { FirestoreRegistration, MerchandiseDeliveryStatus } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface MerchandiseDeliveryStatusDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  registration: FirestoreRegistration;
  onOpenPayment?: () => void;
}

const DELIVERY_STATUS_CONFIG: Record<
  MerchandiseDeliveryStatus,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending_payment: {
    label: "Pending Payment",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: Clock,
  },
  pending_review: {
    label: "Pending Organizer Review",
    badgeClass: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    icon: Clock,
  },
  approved: {
    label: "In Transit / Dispatched",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: Truck,
  },
  rejected: {
    label: "Request Rejected",
    badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: XCircle,
  },
  delivered: {
    label: "Delivered",
    badgeClass: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
    icon: CheckCircle2,
  },
};

export function MerchandiseDeliveryStatusDialog({
  isOpen,
  onOpenChange,
  registration,
  onOpenPayment,
}: MerchandiseDeliveryStatusDialogProps) {
  const req = registration.delivery_request;
  const [copiedResi, setCopiedResi] = useState(false);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);

  if (!req) return null;

  const statusConfig = DELIVERY_STATUS_CONFIG[req.status] || DELIVERY_STATUS_CONFIG.pending_review;
  const StatusIcon = statusConfig.icon;

  const handleCopyResi = () => {
    if (!req.tracking_number) return;
    navigator.clipboard.writeText(req.tracking_number);
    setCopiedResi(true);
    toast.success("Tracking number (No. Resi) copied to clipboard!");
    setTimeout(() => setCopiedResi(false), 2000);
  };

  let formattedDispatchedDate: string | null = null;
  if (req.dispatched_at) {
    try {
      formattedDispatchedDate = format(parseISO(req.dispatched_at), "dd MMM yyyy • h:mm a");
    } catch {
      formattedDispatchedDate = req.dispatched_at;
    }
  }

  let formattedDeliveredDate: string | null = null;
  if (req.delivered_at) {
    try {
      formattedDeliveredDate = format(parseISO(req.delivered_at), "dd MMM yyyy • h:mm a");
    } catch {
      formattedDeliveredDate = req.delivered_at;
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-primary">
              <Truck className="size-5" />
              <DialogTitle className="text-lg">Package Delivery Status</DialogTitle>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={cn("px-2.5 py-0.5 font-medium text-xs", statusConfig.badgeClass)}>
                <StatusIcon className="mr-1 size-3.5" />
                {statusConfig.label}
              </Badge>
              {req.payment_environment === "sandbox" && (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
                >
                  Sandbox
                </Badge>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs">
            Tracking information for your uncollected GDG Jakarta merchandise order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Status Explanation Card */}
          {req.status === "pending_payment" && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
              <p className="font-medium">Payment Required (Rp 50.000)</p>
              <p className="mt-1 text-[11px] leading-relaxed">
                Your delivery request was created, but the Rp 50.000 distribution & non-commitment cutting fee is still
                unpaid. Please complete payment to submit it for organizer review.
              </p>
              {onOpenPayment && (
                <Button size="sm" onClick={onOpenPayment} className="mt-2.5 h-8 gap-1.5 text-xs">
                  Pay Distribution Fee
                </Button>
              )}
            </div>
          )}

          {req.status === "pending_review" && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-blue-900 dark:text-blue-200">
              <p className="font-medium">Payment Confirmed — Awaiting Organizer Processing</p>
              <p className="mt-1 text-[11px] leading-relaxed">
                Your Rp 50.000 distribution fee has been verified. The organizers are packing your merchandise and will
                assign a courier tracking number soon.
              </p>
            </div>
          )}

          {(req.status === "approved" || req.status === "delivered") && (
            <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3.5">
              <div className="flex items-center justify-between border-border/40 border-b pb-2">
                <span className="text-muted-foreground">Courier Service:</span>
                <Badge variant="secondary" className="font-semibold text-[11px] uppercase tracking-wider">
                  {req.courier_type ?? "Standard Courier"}
                </Badge>
              </div>

              {req.tracking_number && (
                <div className="flex items-center justify-between border-border/40 border-b pb-2">
                  <span className="text-muted-foreground">Delivery ID / Resi:</span>
                  <div className="flex items-center gap-1.5 font-mono font-semibold text-foreground">
                    <span>{req.tracking_number}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopyResi}
                      className="size-6 text-muted-foreground hover:text-foreground"
                      title="Copy Tracking ID"
                    >
                      {copiedResi ? (
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {formattedDispatchedDate && (
                <div className="flex items-center justify-between border-border/40 border-b pb-2">
                  <span className="text-muted-foreground">Dispatched On:</span>
                  <span className="font-medium text-foreground">{formattedDispatchedDate}</span>
                </div>
              )}

              {req.status === "delivered" && formattedDeliveredDate && (
                <div className="flex items-center justify-between border-border/40 border-b pb-2">
                  <span className="text-muted-foreground">Delivered On:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">{formattedDeliveredDate}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {req.tracking_number && (
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setIsLiveTrackingOpen(true)}
                  >
                    <Truck className="size-3.5" />
                    Lacak Perjalanan Paket
                  </Button>
                )}

                {req.tracking_url && (
                  <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <a href={req.tracking_url} target="_blank" rel="noopener noreferrer">
                      Buka Web Ekspedisi
                      <ExternalLink className="size-3" />
                    </a>
                  </Button>
                )}

                {req.delivery_proof_url && (
                  <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <a href={req.delivery_proof_url} target="_blank" rel="noopener noreferrer">
                      <FileImage className="size-3" />
                      View Drop-off Proof
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          {req.status === "rejected" && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive">
              <p className="font-semibold">Delivery Request Rejected</p>
              <p className="mt-1 text-[11px] leading-relaxed">
                Reason: {req.rejection_reason ?? "Organizer was unable to process this delivery request."}
              </p>
            </div>
          )}

          {/* Destination Details */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <MapPin className="size-3.5 text-primary" />
              Delivery Address:
            </div>
            <div className="mt-1 text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">{req.recipient_name}</span> ({req.recipient_phone})<br />
              {req.shipping_address}
              <br />
              {req.city}, {req.postal_code}
            </div>
            {req.notes && (
              <div className="mt-2 border-border/40 border-t pt-1.5 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Notes:</span> {req.notes}
              </div>
            )}
          </div>

          {/* Items Summary */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 font-medium text-foreground">
              <ShoppingBag className="size-3.5 text-primary" />
              Merchandise Package Contents:
            </div>
            <div className="space-y-1 divide-y divide-border/40">
              {(registration.selected_merchandise ?? []).map((m, idx) => (
                <div key={m.id || idx} className="flex items-center justify-between pt-1 first:pt-0">
                  <span className="text-foreground">
                    {m.quantity}x {m.name}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    Verified
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
            Close
          </Button>
        </DialogFooter>

        <PackageTrackingDialog
          open={isLiveTrackingOpen}
          onOpenChange={setIsLiveTrackingOpen}
          trackingNumber={req.tracking_number}
          courierType={req.courier_type}
          recipientName={req.recipient_name}
        />
      </DialogContent>
    </Dialog>
  );
}
