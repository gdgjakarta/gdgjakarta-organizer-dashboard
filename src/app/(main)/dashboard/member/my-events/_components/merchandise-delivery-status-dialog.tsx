"use client";

import { useState } from "react";

import { format, parseISO } from "date-fns";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileImage,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";
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
import {
  formatMerchandiseDeliveryNotice,
  getMerchandiseDeliveryTimeline,
} from "@/lib/events/merchandise-delivery-timeline";
import { parseMerchandiseVariations } from "@/lib/events/merchandise-helpers";
import type { FirestoreEvent, FirestoreRegistration, MerchandiseDeliveryStatus } from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

interface MerchandiseDeliveryStatusDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  registration: FirestoreRegistration;
  event?: FirestoreEvent;
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
  event,
  onOpenPayment,
}: MerchandiseDeliveryStatusDialogProps) {
  const req = registration.delivery_request;
  const [copiedResi, setCopiedResi] = useState(false);
  const [isLiveTrackingOpen, setIsLiveTrackingOpen] = useState(false);

  if (!req) return null;

  const statusConfig = DELIVERY_STATUS_CONFIG[req.status] || DELIVERY_STATUS_CONFIG.pending_review;
  const StatusIcon = statusConfig.icon;

  const timelineConfig = getMerchandiseDeliveryTimeline(event);
  const timelineNotice = formatMerchandiseDeliveryNotice(timelineConfig);

  const handleCopyResi = () => {
    if (!req.tracking_number) return;
    navigator.clipboard.writeText(req.tracking_number);
    setCopiedResi(true);
    toast.success("Tracking number (No. Resi) copied to clipboard!");
    setTimeout(() => setCopiedResi(false), 2000);
  };

  let formattedRequestedDate: string | null = null;
  if (req.requested_at) {
    try {
      formattedRequestedDate = format(parseISO(req.requested_at), "dd MMM yyyy • h:mm a");
    } catch {
      formattedRequestedDate = req.requested_at;
    }
  }

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

  const rawLogs = Array.isArray(registration.status_logs) ? registration.status_logs : [];
  const deliveryStatusLogs = rawLogs.filter((log) => {
    const isDeliveryStatus =
      log.id?.includes("delivery") ||
      (typeof log.notes === "string" && /delivery|package|distribution fee|shipping|courier|resi/i.test(log.notes));
    return isDeliveryStatus;
  });

  // Synthesize timeline entries from delivery request milestones if no explicit status log was recorded yet
  interface TimelineItem {
    id: string;
    title: string;
    actor: string;
    timestamp: string;
    badgeLabel: string;
    badgeClass: string;
    notes?: string;
  }

  const timelineItems: TimelineItem[] = [];

  if (deliveryStatusLogs.length > 0) {
    for (const log of deliveryStatusLogs) {
      const isApproved = log.notes?.includes("approved") || log.notes?.includes("dispatched");
      const isDelivered = log.notes?.includes("delivered");
      const isRejected = log.notes?.includes("rejected");
      const isFeePaid = log.notes?.includes("fee confirmed") || log.notes?.includes("Payment confirmed");

      const badgeLabel = isDelivered
        ? "Delivered"
        : isApproved
          ? "Dispatched"
          : isRejected
            ? "Rejected"
            : isFeePaid
              ? "Payment Confirmed"
              : "Requested";

      const badgeClass = isDelivered
        ? "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
        : isApproved
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : isRejected
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : isFeePaid
              ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
              : "border-muted-foreground/30 bg-muted/30 text-muted-foreground";

      timelineItems.push({
        id: log.id,
        title: badgeLabel,
        actor: log.changed_by_name || "System",
        timestamp: log.changed_at,
        badgeLabel,
        badgeClass,
        notes: log.notes,
      });
    }
  } else {
    // Fallback: build from delivery_request timestamps
    if (req.requested_at) {
      timelineItems.push({
        id: `tl_req_${req.id || "1"}`,
        title: "Delivery Requested",
        actor: req.recipient_name || registration.member_name || "Attendee",
        timestamp: req.requested_at,
        badgeLabel: "Requested",
        badgeClass: "border-muted-foreground/30 bg-muted/30 text-muted-foreground",
        notes: `Delivery request submitted for ${req.city}.`,
      });
    }
    if (req.paid_at) {
      timelineItems.push({
        id: `tl_paid_${req.id || "2"}`,
        title: "Fee Payment Confirmed",
        actor: "Payment Gateway",
        timestamp: req.paid_at,
        badgeLabel: "Payment Confirmed",
        badgeClass: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
        notes: `Rp ${(req.fee_amount || 50000).toLocaleString("id-ID")} distribution fee settled.`,
      });
    }
    if (req.dispatched_at || (req.status === "approved" && req.reviewed_at)) {
      timelineItems.push({
        id: `tl_disp_${req.id || "3"}`,
        title: "Approved & In Transit",
        actor: req.reviewed_by_name || "Organizer",
        timestamp: req.dispatched_at || req.reviewed_at || req.updated_at,
        badgeLabel: "Dispatched",
        badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        notes: req.tracking_number
          ? `Dispatched via ${req.courier_type || "Courier"} (Resi: ${req.tracking_number}).`
          : "Delivery request approved for dispatch.",
      });
    }
    if (req.status === "delivered" && (req.delivered_at || req.updated_at)) {
      timelineItems.push({
        id: `tl_deliv_${req.id || "4"}`,
        title: "Package Delivered",
        actor: "Organizer",
        timestamp: req.delivered_at || req.updated_at,
        badgeLabel: "Delivered",
        badgeClass: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
        notes: "Package marked as successfully delivered to attendee.",
      });
    }
    if (req.status === "rejected" && req.reviewed_at) {
      timelineItems.push({
        id: `tl_rej_${req.id || "5"}`,
        title: "Delivery Request Rejected",
        actor: req.reviewed_by_name || "Organizer",
        timestamp: req.reviewed_at,
        badgeLabel: "Rejected",
        badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
        notes: req.rejection_reason ? `Reason: ${req.rejection_reason}` : "Request rejected by organizer.",
      });
    }
  }

  // Sort timeline latest first
  timelineItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

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
              <p className="font-medium">Payment Required (Rp {(req.fee_amount || 50000).toLocaleString("id-ID")})</p>
              <p className="mt-1 text-[11px] leading-relaxed">
                Your delivery request was created, but the Rp {(req.fee_amount || 50000).toLocaleString("id-ID")}{" "}
                distribution & non-commitment cutting fee is still unpaid. Please complete payment to submit it for
                organizer review.
              </p>
              {onOpenPayment && (
                <Button size="sm" onClick={onOpenPayment} className="mt-2.5 h-8 gap-1.5 text-xs">
                  Pay Distribution Fee
                </Button>
              )}
            </div>
          )}

          {req.status === "pending_review" && (
            <div className="space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-blue-900 dark:text-blue-200">
              <p className="font-medium">Payment Confirmed — Awaiting Organizer Processing</p>
              <p className="text-[11px] leading-relaxed">
                Your Rp {(req.fee_amount || 50000).toLocaleString("id-ID")} distribution fee has been verified. The
                organizers are packing your merchandise and will assign a courier tracking number soon.
              </p>
              <div className="flex items-start gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/5 p-2 text-[11px] text-blue-900 dark:text-blue-100">
                <CalendarClock className="size-3.5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                <span className="leading-snug">{timelineNotice}</span>
              </div>
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

              {formattedRequestedDate && (
                <div className="flex items-center justify-between border-border/40 border-b pb-2">
                  <span className="text-muted-foreground">Requested On:</span>
                  <span className="font-medium text-foreground">{formattedRequestedDate}</span>
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
            <div className="flex items-center justify-between font-medium text-foreground">
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-primary" />
                Delivery Address:
              </div>
              {formattedRequestedDate && (
                <span className="text-[10px] text-muted-foreground font-normal">
                  Requested: {formattedRequestedDate}
                </span>
              )}
            </div>
            <div className="mt-1 text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">{req.recipient_name}</span> ({req.recipient_phone})<br />
              {req.shipping_address}
              <br />
              {req.city}, {req.postal_code}
            </div>
            {req.maps_url && (
              <div className="mt-2 border-border/40 border-t pt-1.5 text-[11px]">
                <a
                  href={req.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <ExternalLink className="size-3" />
                  View Google Maps Pinpoint
                </a>
              </div>
            )}
            {req.notes && (
              <div className="mt-2 border-border/40 border-t pt-1.5 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Notes:</span> {req.notes}
              </div>
            )}
          </div>

          {/* Items Summary */}
          {(() => {
            const packageItems =
              req.items && req.items.length > 0 ? req.items : (registration.selected_merchandise ?? []);

            return (
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                <div className="mb-2 flex items-center gap-1.5 font-medium text-foreground">
                  <ShoppingBag className="size-3.5 text-primary" />
                  Merchandise Package Contents:
                </div>
                {packageItems.length > 0 ? (
                  <div className="space-y-2 divide-y divide-border/40">
                    {packageItems.map((m, idx) => {
                      const variations = parseMerchandiseVariations(m, registration.answers, event?.custom_questions);

                      return (
                        <div key={m.id || idx} className="flex items-start justify-between gap-3 pt-2 first:pt-0">
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="font-medium text-foreground leading-tight">
                              {m.quantity}x {m.name}
                            </span>
                            {variations.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                {variations.map((v) => (
                                  <Badge
                                    key={v.key + v.value}
                                    variant="outline"
                                    className={cn(
                                      "h-4 px-1.5 py-0 font-medium text-[9px] leading-none",
                                      v.isSize
                                        ? "border-primary/40 bg-primary/10 font-semibold text-primary"
                                        : "border-muted-foreground/30 bg-muted/60 text-muted-foreground",
                                    )}
                                  >
                                    {v.label ? `${v.label}: ` : ""}
                                    {v.value}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            Verified
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No merchandise items recorded.</p>
                )}
              </div>
            );
          })()}

          {/* Status Tracking & Audit Logs */}
          {timelineItems.length > 0 && (
            <div className="space-y-2.5 rounded-lg border border-border/80 bg-muted/20 p-3">
              <div className="flex items-center justify-between border-border/40 border-b pb-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <ShieldCheck className="size-3.5 text-primary" />
                  Status Tracking & Audit Logs
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {timelineItems.length} {timelineItems.length === 1 ? "update" : "updates"}
                </span>
              </div>

              <div className="space-y-2 pt-0.5">
                {timelineItems.map((item) => {
                  let formattedTime = item.timestamp;
                  try {
                    formattedTime = format(parseISO(item.timestamp), "dd MMM yyyy, HH:mm");
                  } catch {
                    // keep fallback
                  }

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-1 border-border/30 border-b pb-2 text-[11px] last:border-b-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={cn("px-1.5 py-0 text-[10px] font-medium", item.badgeClass)}
                          >
                            {item.badgeLabel}
                          </Badge>
                          <span className="text-muted-foreground">
                            by <span className="font-medium text-foreground">{item.actor}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="size-3" />
                          <span>{formattedTime}</span>
                        </div>
                      </div>
                      {item.notes && (
                        <p className="pl-0.5 text-muted-foreground italic leading-relaxed">{item.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
