"use client";

import { useMemo, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Clock,
  CreditCard,
  Edit3,
  FileText,
  Gift,
  Globe,
  Layers,
  Lock,
  MapPin,
  Package,
  PackageCheck,
  Radio,
  RotateCcw,
  Sparkles,
  Ticket,
  Truck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { BundleVouchersDialog } from "@/app/(main)/dashboard/member/my-events/_components/bundle-vouchers-dialog";
import { MerchandiseDeliveryRequestDialog } from "@/app/(main)/dashboard/member/my-events/_components/merchandise-delivery-request-dialog";
import { MerchandiseDeliveryStatusDialog } from "@/app/(main)/dashboard/member/my-events/_components/merchandise-delivery-status-dialog";
import { CancelRegistrationDialog } from "@/components/cancel-registration-dialog";
import { EditRegistrationModal } from "@/components/edit-registration-modal";
import { EventCardImage } from "@/components/event-card-image";
import { EventRegistrationModal } from "@/components/event-registration-modal";
import { RefundRequestDialog } from "@/components/refund/refund-request-dialog";
import { RefundStatusDialog } from "@/components/refund/refund-status-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveEventAudience } from "@/lib/bevy/audience";
import { formatFirestoreDate } from "@/lib/date-utils";
import { extractEventImageUrl } from "@/lib/events/media-utils";
import {
  getEffectiveRegistrationStatus,
  getRegistrationPaymentDeadline,
  isPaidRegistration,
} from "@/lib/events/payment-deadline";
import { getEventRefundPolicyNotes, isRegistrationEligibleForRefund } from "@/lib/events/refund-utils";
import type {
  FirestoreEvent,
  FirestoreRegistration,
  RegistrationStatus,
  RegistrationStatusLog,
} from "@/lib/firestore/types";
import { cn } from "@/lib/utils";

export interface EventCardItemProps {
  event?: FirestoreEvent;
  registration?: FirestoreRegistration | null;
  index?: number;
  priority?: boolean;
  loading?: "eager" | "lazy";
  isCardLoading?: boolean;
  fromPath?: string;
  onRegistrationUpdated?: (updated: FirestoreRegistration) => void;
  onRegistrationCancelled?: (registrationId: string) => void;
}

const STATUS_VARIANTS: Record<RegistrationStatus, { label: string; badgeClass: string }> = {
  pending: {
    label: "Pending Review",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  waiting_for_payment: {
    label: "Waiting for Payment",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold",
  },
  paid_and_registered: {
    label: "Paid & Registered",
    badgeClass: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold",
  },
  expired: {
    label: "Payment Expired",
    badgeClass: "border-zinc-500/30 bg-zinc-500/15 text-zinc-700 dark:text-zinc-400",
  },
  failed: {
    label: "Payment Failed",
    badgeClass: "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-400",
  },
  canceled: {
    label: "Canceled",
    badgeClass: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  cancelled: {
    label: "Canceled",
    badgeClass: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  approved: {
    label: "Confirmed / Approved",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  registered: {
    label: "Registered",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  rejected: {
    label: "Not Selected",
    badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  waitlisted: {
    label: "Waitlisted",
    badgeClass: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  paid_waitlisted: {
    label: "Paid Waitlist",
    badgeClass: "border-indigo-500/30 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-semibold",
  },
  attended: {
    label: "Attended",
    badgeClass: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  },
};

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function isEventPast(event?: FirestoreEvent): boolean {
  if (!event) return false;
  if (event.status === "Completed") return true;
  const targetDate = event.end_date || event.start_date;
  if (!targetDate) return false;
  try {
    return new Date(targetDate).getTime() < Date.now();
  } catch {
    return false;
  }
}

function renderUnregisteredFeeBadge(event: FirestoreEvent) {
  const rawTickets = event.tickets ?? [];
  const activeTickets = rawTickets.filter((t) => t.status !== "hidden");
  const rawBundles = event.bundles ?? [];
  const activeBundles = rawBundles.filter((b) => b.status !== "hidden");

  if (activeTickets.length === 0 && activeBundles.length === 0) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-[11px] text-emerald-700 dark:text-emerald-300"
      >
        Free of Charge
      </Badge>
    );
  }

  const freeTickets = activeTickets.filter((t) => t.type === "free" || (t.price ?? 0) === 0);
  const paidTickets = activeTickets.filter(
    (t) => t.type === "paid" || t.type === "commitment_fee" || (t.price ?? 0) > 0,
  );
  const paidBundles = activeBundles.filter((b) => (b.price ?? 0) > 0);
  const allPaidPrices = [...paidTickets.map((t) => t.price ?? 0), ...paidBundles.map((b) => b.price ?? 0)].filter(
    (p) => p > 0,
  );

  const minPaidPrice = allPaidPrices.length > 0 ? Math.min(...allPaidPrices) : 0;
  const maxPaidPrice = allPaidPrices.length > 0 ? Math.max(...allPaidPrices) : 0;
  const isOnlyCommitmentFee =
    paidTickets.length > 0 && paidTickets.every((t) => t.type === "commitment_fee") && paidBundles.length === 0;

  const formattedPrice =
    minPaidPrice === maxPaidPrice || maxPaidPrice === 0
      ? `Rp ${minPaidPrice.toLocaleString("id-ID")}`
      : `from Rp ${minPaidPrice.toLocaleString("id-ID")}`;

  if (freeTickets.length > 0 && allPaidPrices.length > 0) {
    return (
      <Badge
        variant="outline"
        className="border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-medium text-[11px] text-blue-700 dark:text-blue-300"
      >
        Free or Paid ({formattedPrice})
      </Badge>
    );
  }

  if (isOnlyCommitmentFee) {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-medium text-[11px] text-amber-700 dark:text-amber-300"
      >
        Commitment Deposit ({formattedPrice})
      </Badge>
    );
  }

  if (allPaidPrices.length > 0) {
    return (
      <Badge
        variant="outline"
        className="border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-medium text-[11px] text-blue-700 dark:text-blue-300"
      >
        {formattedPrice}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-[11px] text-emerald-700 dark:text-emerald-300"
    >
      Free of Charge
    </Badge>
  );
}

export function EventCardItem({
  event,
  registration,
  index: _index,
  priority = false,
  loading = "lazy",
  isCardLoading = false,
  fromPath,
  onRegistrationUpdated,
  onRegistrationCancelled,
}: EventCardItemProps) {
  const pathname = usePathname();
  const currentPath = fromPath ?? pathname;

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [isDeliveryStatusOpen, setIsDeliveryStatusOpen] = useState(false);
  const [isBundleVouchersOpen, setIsBundleVouchersOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isRefundStatusOpen, setIsRefundStatusOpen] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  const reg = registration ?? null;

  const effectiveEvent: FirestoreEvent = useMemo(() => {
    if (event) return event;
    return {
      id: reg?.event_id ?? "",
      title: reg?.event_title ?? "GDG Jakarta Event",
      description: "",
      start_date: reg?.registered_at,
      status: "Published",
      city: "Jakarta",
      is_published: true,
    } as unknown as FirestoreEvent;
  }, [event, reg]);

  const effectiveStatus = reg ? getEffectiveRegistrationStatus(reg, effectiveEvent) : null;
  const deadlineInfo = reg ? getRegistrationPaymentDeadline(reg, effectiveEvent) : null;
  const isPast = isEventPast(effectiveEvent);

  const isPending = effectiveStatus === "pending" || effectiveStatus === "waitlisted";
  const isWaitingPayment = effectiveStatus === "waiting_for_payment";
  const isPaidAndRegistered = effectiveStatus === "paid_and_registered";
  const isApproved = effectiveStatus === "approved" || effectiveStatus === "registered";
  const _isExpired = effectiveStatus === "expired";
  const _isFailed = effectiveStatus === "failed";

  const statusMeta = effectiveStatus
    ? STATUS_VARIANTS[effectiveStatus] || STATUS_VARIANTS[reg?.status as RegistrationStatus] || STATUS_VARIANTS.pending
    : null;

  const selectedTrack =
    reg?.session_title ??
    (reg?.answers?.session_title as string | undefined) ??
    (reg?.session_id ? `Track ID: ${reg.session_id}` : null);

  let formattedDate = effectiveEvent?.start_date
    ? formatFirestoreDate(effectiveEvent.start_date, "dd MMM yyyy • h:mm a", "")
    : formatFirestoreDate(reg?.registered_at, "dd MMM yyyy", "—");
  if (!formattedDate && reg?.registered_at) {
    formattedDate = formatFirestoreDate(reg.registered_at, "dd MMM yyyy", "—");
  }

  const imageUrl = extractEventImageUrl(
    effectiveEvent as unknown as Record<string, unknown>,
    reg as unknown as Record<string, unknown>,
  );

  const detailsHref = `/dashboard/member/events/${effectiveEvent.id}?from=${encodeURIComponent(currentPath)}`;

  const handleCheckMemberPayment = async () => {
    if (!reg?.id || !effectiveEvent.id) return;
    setIsCheckingPayment(true);
    try {
      const { auth } = await import("@/config/firebase");
      const idToken = await auth?.currentUser?.getIdToken();
      const { checkMemberEventPaymentStatusAction } = await import("@/server/payment-actions");
      const res = await checkMemberEventPaymentStatusAction({
        eventId: String(effectiveEvent.id),
        registrationId: String(reg.id),
        idToken: idToken || undefined,
      });

      const newLog: RegistrationStatusLog = res.logEntry ?? {
        id: `log_${Date.now()}_doku`,
        status: "paid_and_registered",
        previous_status: reg.status,
        changed_at: res.paidAt ?? new Date().toISOString(),
        changed_by_id: "doku_payment_gateway",
        changed_by_name: "DOKU Payment Gateway",
        notes: `Payment confirmed via ${res.paymentChannel ?? "QRIS"}. Status updated to Paid & Registered.`,
      };

      const updatedReg: FirestoreRegistration = {
        ...reg,
        payment_check_count: res.checkCount,
        ...(res.isPaid
          ? {
              status: "paid_and_registered" as RegistrationStatus,
              payment_status: "paid" as const,
              paid_at: res.paidAt ?? new Date().toISOString(),
              status_logs: res.statusLogs ?? [...(reg.status_logs ?? []), newLog],
            }
          : {}),
      };

      onRegistrationUpdated?.(updatedReg);

      if (res.isPaid) {
        toast.success(res.message || "Payment confirmed! Your registration is now completed.");
      } else if (res.success) {
        toast.info(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to verify payment status.";
      toast.error(msg);
    } finally {
      setIsCheckingPayment(false);
    }
  };

  return (
    <>
      <Card
        className={cn(
          "group flex flex-col justify-between overflow-hidden shadow-xs transition-all hover:shadow-md",
          isWaitingPayment && "border-amber-500/50 ring-1 ring-amber-500/20 dark:border-amber-500/40",
          isPaidAndRegistered && "border-emerald-500/30",
          isPending && "border-amber-500/30",
        )}
      >
        <div>
          {/* ── Event Picture / Banner with Audience Tag ────────── */}
          <Link href={detailsHref} className="block">
            <EventCardImage
              src={imageUrl}
              alt={effectiveEvent.title}
              isLoading={isCardLoading}
              priority={priority}
              loading={loading}
              className="transition-transform duration-300 group-hover:scale-105"
            >
              <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="bg-background/90 text-[10px] backdrop-blur-xs">
                  {(() => {
                    const { isVirtual, isHybrid } = resolveEventAudience(
                      effectiveEvent.audience_type,
                      effectiveEvent.is_virtual,
                    );
                    if (isVirtual) {
                      return (
                        <span className="flex items-center gap-1 text-blue-500">
                          <Radio className="size-3" /> Virtual
                        </span>
                      );
                    }
                    if (isHybrid) {
                      return (
                        <span className="flex items-center gap-1 text-purple-500">
                          <Globe className="size-3" /> Hybrid
                        </span>
                      );
                    }
                    return (
                      <span className="flex items-center gap-1 text-emerald-500">
                        <MapPin className="size-3" /> In-Person
                      </span>
                    );
                  })()}
                </Badge>
                {isPast && (
                  <Badge variant="secondary" className="bg-background/90 text-[10px] backdrop-blur-xs">
                    Concluded
                  </Badge>
                )}
                {effectiveEvent.is_test ? (
                  <Badge
                    variant="outline"
                    className="border-purple-500/30 bg-purple-500/20 text-[10px] text-purple-700 backdrop-blur-xs dark:text-purple-300"
                  >
                    Test
                  </Badge>
                ) : null}
              </div>
            </EventCardImage>
          </Link>

          {/* ── Card Header ─────────────────────────────────────── */}
          <CardHeader className="space-y-2 p-4 pb-2">
            <div className="flex items-center justify-between gap-2">
              {reg && statusMeta ? (
                <Badge variant="outline" className={cn("px-2 py-0.5 font-medium text-[11px]", statusMeta.badgeClass)}>
                  {statusMeta.label}
                </Badge>
              ) : (
                renderUnregisteredFeeBadge(effectiveEvent)
              )}
              <span className="text-muted-foreground text-xs">{isPast ? "Concluded" : "Upcoming"}</span>
            </div>

            <CardTitle className="line-clamp-2 font-semibold text-base leading-snug">
              <Link href={detailsHref} className="transition-colors hover:text-primary hover:underline">
                {effectiveEvent.title}
              </Link>
            </CardTitle>

            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Clock className="size-3.5 text-muted-foreground" />
              {formattedDate}
            </CardDescription>
          </CardHeader>

          {/* ── Card Content ────────────────────────────────────── */}
          <CardContent className="space-y-2.5 px-4 pb-3">
            {/* Selected Track badge */}
            {selectedTrack && (
              <div className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs">
                <Layers className="size-3.5 shrink-0 text-primary" />
                <span className="truncate font-medium text-[11px] text-foreground">Track: {selectedTrack}</span>
              </div>
            )}

            {/* Bundling Package badge */}
            {reg?.bundle_name && (
              <div className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs">
                <PackageCheck className="size-3.5 shrink-0 text-primary" />
                <span className="truncate font-semibold text-[11px] text-primary">Package: {reg.bundle_name}</span>
              </div>
            )}

            {/* Ticket Tier / Price Tag */}
            {(() => {
              if (!reg) {
                // If not registered, show available ticket tiers if multiple
                if (effectiveEvent.tickets && effectiveEvent.tickets.length > 0) {
                  return (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {effectiveEvent.tickets.slice(0, 2).map((t) => (
                        <Badge
                          key={t.id}
                          variant="secondary"
                          className="gap-1 border border-primary/20 bg-primary/5 text-[10px] text-primary"
                        >
                          <Ticket className="size-3" />
                          {t.name} {t.price && t.price > 0 ? `(${formatRupiah(t.price)})` : "(Free)"}
                        </Badge>
                      ))}
                      {effectiveEvent.tickets.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{effectiveEvent.tickets.length - 2} more
                        </span>
                      )}
                    </div>
                  );
                }
                return null;
              }

              const isPaid = isPaidRegistration(reg);
              const ticketTier = reg.ticket_tier ?? reg.ticket_name;
              const price = reg.payment_amount ?? reg.ticket_price ?? reg.bundle_price;

              if (!isPaid && !ticketTier && !price) return null;

              return (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {ticketTier && (
                    <Badge
                      variant="secondary"
                      className="gap-1 border border-primary/20 bg-primary/5 text-[10px] text-primary"
                    >
                      <Ticket className="size-3" />
                      {ticketTier}
                    </Badge>
                  )}
                  {price && price > 0 ? (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {formatRupiah(price)}
                    </Badge>
                  ) : null}
                </div>
              );
            })()}

            {/* Status Helper Callout (Waiting for payment) */}
            {isWaitingPayment && reg && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
                <div className="flex items-center justify-between font-semibold text-amber-800 dark:text-amber-200">
                  <span className="flex items-center gap-1.5 text-xs">
                    <CreditCard className="size-3.5 text-amber-600 dark:text-amber-400" />
                    Payment Required
                  </span>
                  {reg.payment_amount ? (
                    <span className="font-bold text-amber-700 dark:text-amber-300">
                      {formatRupiah(reg.payment_amount)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-amber-700/90 dark:text-amber-300/90">
                  <span>
                    {deadlineInfo?.timeStatusText
                      ? `⏰ ${deadlineInfo.timeStatusText}`
                      : "Complete payment to secure your ticket."}
                  </span>
                  {deadlineInfo?.formattedDeadline ? <span>Due {deadlineInfo.formattedDeadline}</span> : null}
                </div>
              </div>
            )}

            {/* Paid Waitlisted Info Banner */}
            {reg?.status === "paid_waitlisted" && (
              <div className="rounded-md border border-indigo-500/40 bg-indigo-500/10 p-2.5 text-xs">
                <div className="flex items-center justify-between font-semibold text-indigo-900 dark:text-indigo-200">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                    Paid Waitlist Deposit
                  </span>
                  {reg.payment_amount ? (
                    <span className="font-bold text-indigo-700 dark:text-indigo-300">
                      {formatRupiah(reg.payment_amount)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] text-indigo-700/90 dark:text-indigo-300/90">
                  Session capacity is currently full. You will be prioritized if seats open up, or eligible for a full
                  refund.
                </p>
              </div>
            )}

            {/* Refund Status Callout Banner */}
            {(() => {
              if (!reg) return null;
              const refundInfo = isRegistrationEligibleForRefund(reg, effectiveEvent);
              const refundReq = reg.refund_request;

              if (!refundInfo.isEligible && !refundReq) return null;

              if (refundReq) {
                const isRefundPending = refundReq.status === "waiting_for_approval";
                const isRefundCompleted = refundReq.status === "refund_completed";
                const isRefundRejected = refundReq.status === "rejected";

                return (
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-md border p-2.5 text-xs",
                      isRefundPending && "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
                      isRefundCompleted &&
                        "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
                      isRefundRejected && "border-destructive/40 bg-destructive/10 text-destructive",
                    )}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <CreditCard className="size-3.5 shrink-0" />
                      <span className="truncate font-semibold text-[11px]">
                        {isRefundPending && "Refund Request Under Review"}
                        {isRefundCompleted && "Refund Completed • RSVP Canceled"}
                        {isRefundRejected && "Refund Request Rejected"}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 border-current font-medium text-[10px] capitalize",
                        isRefundPending && "bg-amber-500/20",
                        isRefundCompleted && "bg-emerald-500/20",
                        isRefundRejected && "bg-destructive/20",
                      )}
                    >
                      {isRefundPending && "Pending"}
                      {isRefundCompleted && "Refunded"}
                      {isRefundRejected && "Action Needed"}
                    </Badge>
                  </div>
                );
              }

              if (refundInfo.canSubmitNew) {
                return (
                  <div className="space-y-1.5 rounded-md border border-indigo-500/30 bg-indigo-500/5 p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] text-indigo-700 dark:text-indigo-300">
                        💸 {refundInfo.cutoffInfo.deadlineDescription}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-indigo-500/40 text-[10px] text-indigo-600 dark:text-indigo-400"
                      >
                        Refund Eligible
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-[10px] text-muted-foreground leading-normal">
                      📋 {getEventRefundPolicyNotes(effectiveEvent)}
                    </p>
                  </div>
                );
              }

              return null;
            })()}

            {isPending && reg && (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                ✏️ Form responses can be edited while pending review.
              </div>
            )}

            {isApproved && reg && (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-800 dark:text-emerald-300">
                ✓ Confirmed attendee. Responses locked.
              </div>
            )}

            {/* Merchandise Delivery Info (No-Show Attendee) */}
            {(() => {
              if (!reg) return null;
              const hasPurchasedMerch = Boolean(reg.selected_merchandise && reg.selected_merchandise.length > 0);
              const isNotCheckedIn = !reg.is_checked_in && reg.status !== "attended";
              const isEligibleForDelivery = isPast && isNotCheckedIn && hasPurchasedMerch;
              const deliveryReq = reg.delivery_request;

              if (isEligibleForDelivery && !deliveryReq) {
                return (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold text-primary">
                        <Package className="size-3.5" />
                        Uncollected Merchandise
                      </span>
                      <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
                        Delivery Available
                      </Badge>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">
                      Event concluded and check-in was missed. You can request courier delivery for your uncollected
                      merchandise.
                    </p>
                  </div>
                );
              }

              if (deliveryReq) {
                return (
                  <div className="flex items-center justify-between rounded-md border border-border/80 bg-muted/40 p-2 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Truck className="size-3.5 text-primary" />
                      <span className="font-medium text-foreground">Package Delivery</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] capitalize",
                        deliveryReq.status === "approved" &&
                          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                        deliveryReq.status === "pending_review" &&
                          "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
                        deliveryReq.status === "pending_payment" &&
                          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                        deliveryReq.status === "delivered" &&
                          "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
                        deliveryReq.status === "rejected" && "border-destructive/30 bg-destructive/10 text-destructive",
                      )}
                    >
                      {(() => {
                        switch (deliveryReq.status) {
                          case "pending_payment":
                            return "Pay Fee";
                          case "pending_review":
                            return "Under Review";
                          case "approved":
                            return "In Transit";
                          case "delivered":
                            return "Delivered";
                          case "rejected":
                            return "Rejected";
                          default:
                            return deliveryReq.status;
                        }
                      })()}
                    </Badge>
                  </div>
                );
              }

              return null;
            })()}

            <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
              {effectiveEvent.description_short ??
                effectiveEvent.description ??
                "Registered GDG Jakarta session. Check details for venue access and agenda."}
            </p>
          </CardContent>
        </div>

        {/* ── Card Footer Action Buttons ──────────────────────── */}
        <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-border/40 border-t bg-muted/20 p-3.5">
          {reg ? (
            <div className="flex flex-wrap items-center gap-2">
              {/* Complete Payment Button if awaiting payment */}
              {isWaitingPayment && reg.payment_url && (
                <a href={reg.payment_url} target="_blank" rel="noopener noreferrer">
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 bg-amber-600 font-semibold text-white text-xs shadow-xs hover:bg-amber-700"
                  >
                    <CreditCard className="size-3.5" />
                    Pay Now {reg.payment_amount ? `(${formatRupiah(reg.payment_amount)})` : ""}
                  </Button>
                </a>
              )}

              {/* Check Payment Status button (when waiting for payment or expired) */}
              {(isWaitingPayment || _isExpired) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    isCheckingPayment ||
                    (reg.payment_check_count !== undefined &&
                      reg.payment_check_count >= (effectiveEvent.member_payment_check_limit ?? 3))
                  }
                  onClick={() => void handleCheckMemberPayment()}
                  className="h-8 gap-1.5 border-primary/40 bg-primary/5 text-primary text-xs hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                  title={
                    (reg.payment_check_count ?? 0) >= (effectiveEvent.member_payment_check_limit ?? 3)
                      ? "Payment check quota reached for this registration"
                      : "Check latest payment status from DOKU"
                  }
                >
                  <RotateCcw className={cn("size-3.5", isCheckingPayment && "animate-spin")} />
                  {isCheckingPayment
                    ? "Checking..."
                    : `Check Status (${Math.max(0, (effectiveEvent.member_payment_check_limit ?? 3) - (reg.payment_check_count ?? 0))} left)`}
                </Button>
              )}

              {/* Friend Vouchers Button if registration contains bundle vouchers */}
              {reg.bundle_vouchers && reg.bundle_vouchers.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 border-primary/40 bg-primary/5 font-semibold text-primary text-xs hover:bg-primary/10"
                  onClick={() => setIsBundleVouchersOpen(true)}
                >
                  <Gift className="size-3.5" />
                  Friend Vouchers ({reg.bundle_vouchers.filter((v) => v.status === "available").length} left)
                </Button>
              )}

              {/* Edit Responses Modal or Finalized indicator */}
              {reg.refund_request?.status === "refund_completed" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled
                  className="h-8 cursor-not-allowed gap-1.5 text-muted-foreground text-xs opacity-60"
                >
                  <Lock className="size-3.5" />
                  Refund Finalized
                </Button>
              ) : (
                <EditRegistrationModal
                  registration={reg}
                  event={effectiveEvent}
                  onSuccess={(updated) => onRegistrationUpdated?.(updated)}
                  onCancel={() => {
                    if (reg.id) {
                      onRegistrationCancelled?.(reg.id);
                    }
                  }}
                  triggerButton={
                    isPending || isWaitingPayment ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 border-amber-500/40 text-amber-700 text-xs hover:bg-amber-500/10 dark:text-amber-300"
                      >
                        <Edit3 className="size-3.5 text-amber-600 dark:text-amber-400" />
                        Edit Responses
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-muted-foreground text-xs hover:text-foreground"
                      >
                        <FileText className="size-3.5" />
                        View Responses
                      </Button>
                    )
                  }
                />
              )}

              {/* Refund Request / Status Button */}
              {(() => {
                const refundInfo = isRegistrationEligibleForRefund(reg, effectiveEvent);
                const refundReq = reg.refund_request;

                if (!refundInfo.isEligible && !refundReq) return null;

                if (refundReq) {
                  let label = "Refund Status 💰";
                  if (refundReq.status === "refund_completed") {
                    label = "Refund Receipt 🧾";
                  } else if (refundReq.status === "rejected") {
                    label = "Refund Rejected ⚠️";
                  }

                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-8 gap-1.5 font-semibold text-xs",
                        refundReq.status === "refund_completed" &&
                          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
                        refundReq.status === "waiting_for_approval" &&
                          "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300",
                        refundReq.status === "rejected" &&
                          "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
                      )}
                      onClick={() => setIsRefundStatusOpen(true)}
                    >
                      <CreditCard className="size-3.5" />
                      {label}
                    </Button>
                  );
                }

                if (refundInfo.canSubmitNew) {
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 border-indigo-500/40 bg-indigo-500/10 font-semibold text-indigo-700 text-xs hover:bg-indigo-500/20 dark:text-indigo-300"
                      onClick={() => setIsRefundModalOpen(true)}
                    >
                      <CreditCard className="size-3.5" />
                      Request Refund 💸
                    </Button>
                  );
                }

                return null;
              })()}

              {/* Merchandise Delivery Request / Status Button */}
              {(() => {
                const hasPurchasedMerch = Boolean(reg.selected_merchandise && reg.selected_merchandise.length > 0);
                const isNotCheckedIn = !reg.is_checked_in && reg.status !== "attended";
                const isEligibleForDelivery = isPast && isNotCheckedIn && hasPurchasedMerch;
                const deliveryReq = reg.delivery_request;

                if (isEligibleForDelivery && !deliveryReq) {
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 border-primary/40 bg-primary/5 text-primary text-xs hover:bg-primary/10"
                      onClick={() => setIsDeliveryModalOpen(true)}
                    >
                      <Truck className="size-3.5" />
                      Request Delivery 📦
                    </Button>
                  );
                }

                if (deliveryReq) {
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => setIsDeliveryStatusOpen(true)}
                    >
                      <Truck className="size-3.5" />
                      Delivery Status 🚚
                    </Button>
                  );
                }

                return null;
              })()}

              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-8 gap-1 text-muted-foreground text-xs hover:text-foreground"
              >
                <Link href={detailsHref}>Details →</Link>
              </Button>

              {!isPast &&
                !isPaidAndRegistered &&
                reg.status !== "attended" &&
                reg.refund_request?.status !== "refund_completed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-destructive text-xs hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setIsCancelModalOpen(true)}
                  >
                    <UserX className="size-3.5" />
                    Cancel RSVP
                  </Button>
                )}
            </div>
          ) : (
            <div className="flex w-full items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-8 gap-1 text-muted-foreground text-xs hover:text-foreground"
              >
                <Link href={detailsHref}>Details →</Link>
              </Button>

              {isPast ? (
                <Button variant="outline" size="sm" disabled className="h-8 text-xs opacity-60">
                  Event Concluded
                </Button>
              ) : (
                <EventRegistrationModal event={effectiveEvent} onSuccess={(newReg) => onRegistrationUpdated?.(newReg)}>
                  <Button size="sm" className="h-8 gap-1.5 font-semibold text-xs shadow-xs">
                    <Sparkles className="size-3.5" />
                    Register Now
                  </Button>
                </EventRegistrationModal>
              )}
            </div>
          )}
        </CardFooter>
      </Card>

      {/* ── Modals / Dialogs (Portaled) ────────────────────────── */}
      {reg && isCancelModalOpen && (
        <CancelRegistrationDialog
          open={isCancelModalOpen}
          onOpenChange={setIsCancelModalOpen}
          registration={reg}
          event={effectiveEvent}
          onSuccess={() => {
            if (reg.id) {
              onRegistrationCancelled?.(reg.id);
            }
            setIsCancelModalOpen(false);
          }}
        />
      )}

      {reg && isDeliveryModalOpen && (
        <MerchandiseDeliveryRequestDialog
          isOpen={isDeliveryModalOpen}
          onOpenChange={setIsDeliveryModalOpen}
          registration={reg}
          event={effectiveEvent}
          onSuccess={(updated) => {
            onRegistrationUpdated?.(updated);
            setIsDeliveryModalOpen(false);
          }}
        />
      )}

      {reg && isDeliveryStatusOpen && (
        <MerchandiseDeliveryStatusDialog
          isOpen={isDeliveryStatusOpen}
          onOpenChange={setIsDeliveryStatusOpen}
          registration={reg}
          onOpenPayment={() => {
            setIsDeliveryStatusOpen(false);
            setIsDeliveryModalOpen(true);
          }}
        />
      )}

      {reg && isBundleVouchersOpen && (
        <BundleVouchersDialog
          open={isBundleVouchersOpen}
          onOpenChange={setIsBundleVouchersOpen}
          registration={reg}
          event={effectiveEvent}
        />
      )}

      {reg && isRefundModalOpen && (
        <RefundRequestDialog
          isOpen={isRefundModalOpen}
          onOpenChange={setIsRefundModalOpen}
          registration={reg}
          event={effectiveEvent}
          onSuccess={(updatedRefund) => {
            onRegistrationUpdated?.({
              ...reg,
              refund_request: updatedRefund,
            });
            setIsRefundModalOpen(false);
          }}
        />
      )}

      {reg && isRefundStatusOpen && (
        <RefundStatusDialog
          isOpen={isRefundStatusOpen}
          onOpenChange={setIsRefundStatusOpen}
          registration={reg}
          event={effectiveEvent}
          onEditRequest={() => {
            setIsRefundStatusOpen(false);
            setIsRefundModalOpen(true);
          }}
        />
      )}
    </>
  );
}
