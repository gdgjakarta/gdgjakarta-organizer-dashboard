"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  Lock,
  MapPin,
  Radio,
  RotateCcw,
  Share2,
  Sparkles,
  Truck,
  Users,
  UserX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { UnifiedAgendaTimeline } from "@/app/(external)/events/[eventId]/_components/unified-agenda-timeline";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getDashboardHomeUrl } from "@/lib/auth-roles";
import { resolveEventAudience } from "@/lib/bevy/audience";
import { toTimezoneDate } from "@/lib/date-utils";
import { extractEventImageUrl } from "@/lib/events/media-utils";
import { getEffectiveRegistrationStatus, getRegistrationPaymentDeadline } from "@/lib/events/payment-deadline";
import { getEventRefundPolicyNotes, isRegistrationEligibleForRefund } from "@/lib/events/refund-utils";
import { getRegistrationWindowStatus } from "@/lib/events/registration-defaults";
import { checkEventRegistrationAction } from "@/lib/firestore/actions";
import type {
  FirestoreEvent,
  FirestoreRegistration,
  RegistrationStatus,
  RegistrationStatusLog,
} from "@/lib/firestore/types";
import { cn, sanitizeHtml } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface MemberEventDetailProps {
  event: FirestoreEvent;
  initialRegistration?: FirestoreRegistration | null;
  from?: string;
}

function EventDescriptionContent({ html }: { html: string }) {
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none space-y-4 leading-relaxed [&_a]:text-primary [&_a]:underline [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Bevy verified event HTML content
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
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

function getEventEntryFeeDisplay(event: FirestoreEvent, registration?: FirestoreRegistration | null) {
  // If user is already registered and has specific ticket information
  if (registration) {
    if (registration.ticket_price && registration.ticket_price > 0) {
      return (
        <strong className="text-right font-semibold text-foreground">
          Rp {registration.ticket_price.toLocaleString("id-ID")}
          {registration.ticket_name ? ` (${registration.ticket_name})` : ""}
        </strong>
      );
    }
    if (registration.payment_amount && registration.payment_amount > 0) {
      return (
        <strong className="text-right font-semibold text-foreground">
          Rp {registration.payment_amount.toLocaleString("id-ID")}
          {registration.ticket_name ? ` (${registration.ticket_name})` : ""}
        </strong>
      );
    }
    if (registration.ticket_type === "free" || registration.ticket_price === 0) {
      return (
        <strong className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
          Free of Charge
          {registration.ticket_name ? ` (${registration.ticket_name})` : ""}
        </strong>
      );
    }
  }

  // Not registered or registration has no ticket details: inspect event tickets & bundles
  const rawTickets = event.tickets ?? [];
  const activeTickets = rawTickets.filter((t) => t.status !== "hidden");
  const rawBundles = event.bundles ?? [];
  const activeBundles = rawBundles.filter((b) => b.status !== "hidden");

  // If no tickets or bundles configured at all, it's a default free event
  if (activeTickets.length === 0 && activeBundles.length === 0) {
    return <strong className="text-right font-semibold text-emerald-600 dark:text-emerald-400">Free of Charge</strong>;
  }

  const freeTickets = activeTickets.filter((t) => t.type === "free" || (t.price ?? 0) === 0);
  const paidTickets = activeTickets.filter(
    (t) => t.type === "paid" || t.type === "commitment_fee" || (t.price ?? 0) > 0,
  );
  const paidBundles = activeBundles.filter((b) => (b.price ?? 0) > 0);

  const hasFree = freeTickets.length > 0;
  const hasPaid = paidTickets.length > 0 || paidBundles.length > 0;

  // Collect all paid prices
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

  // 1. Both Free and Paid options exist: "can be free but there is a paid pass"
  if (hasFree && hasPaid) {
    return (
      <strong className="text-right font-semibold text-foreground">
        <span className="text-emerald-600 dark:text-emerald-400">Free</span>
        <span className="font-normal text-muted-foreground"> / </span>
        <span className="text-blue-600 dark:text-blue-400">Paid Pass ({formattedPrice})</span>
      </strong>
    );
  }

  // 2. Only Paid passes exist (no free tickets): "paid pass"
  if (hasPaid && !hasFree) {
    if (isOnlyCommitmentFee) {
      return (
        <strong className="text-right font-semibold text-amber-600 dark:text-amber-400">
          Commitment Deposit ({formattedPrice})
        </strong>
      );
    }
    return (
      <strong className="text-right font-semibold text-blue-600 dark:text-blue-400">
        Paid Pass ({formattedPrice})
      </strong>
    );
  }

  // 3. Only Free pass exists: "free pass"
  return <strong className="text-right font-semibold text-emerald-600 dark:text-emerald-400">Free of Charge</strong>;
}

export function MemberEventDetail({ event, initialRegistration = null, from }: MemberEventDetailProps) {
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const [currentEvent, setCurrentEvent] = useState<FirestoreEvent>(event);
  const [registration, setRegistration] = useState<FirestoreRegistration | null>(initialRegistration);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(
    initialRegistration === null && (Boolean(user) || isAuthLoading),
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [isDeliveryStatusOpen, setIsDeliveryStatusOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isRefundStatusOpen, setIsRefundStatusOpen] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const { isVirtual, isHybrid } = resolveEventAudience(currentEvent.audience_type, currentEvent.is_virtual);

  const rawFrom = from ? decodeURIComponent(from) : undefined;
  const validFrom = rawFrom?.startsWith("/dashboard") ? rawFrom : undefined;
  const [referrerPath, setReferrerPath] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !validFrom && document.referrer) {
      try {
        const refUrl = new URL(document.referrer);
        if (refUrl.origin === window.location.origin && refUrl.pathname.startsWith("/dashboard")) {
          setReferrerPath(refUrl.pathname + refUrl.search);
        }
      } catch {
        // ignore invalid referrer
      }
    }
  }, [validFrom]);

  const defaultBackUrl = getDashboardHomeUrl(user);
  const targetBackUrl = validFrom || referrerPath || defaultBackUrl;
  const isFromMyEvents = targetBackUrl.includes("my-events");
  const backLabel = isFromMyEvents ? "Back to My Events" : "Back to Events";

  useEffect(() => {
    setCurrentEvent(event);
    async function checkMyRegistrationAndEvent() {
      try {
        const { getFirestoreEventById } = await import("@/lib/firestore/client");
        const docData = await getFirestoreEventById(String(event.id));
        if (docData) {
          setCurrentEvent((prev) => ({
            ...prev,
            ...docData,
            picture_url: docData.picture_url || prev.picture_url,
            banner_url: docData.banner_url || prev.banner_url,
            picture: docData.picture || prev.picture,
            banner: docData.banner || prev.banner,
            cropped_picture_url: docData.cropped_picture_url || prev.cropped_picture_url,
            cropped_banner_url: docData.cropped_banner_url || prev.cropped_banner_url,
          }));
        }
      } catch (err) {
        console.warn("[MemberEventDetail] Failed to load Firestore event:", err);
      }

      if (isAuthLoading) {
        return;
      }

      if (!user) {
        setIsCheckingRegistration(false);
        return;
      }

      try {
        setIsCheckingRegistration(true);
        const found = await checkEventRegistrationAction(String(event.id), user.id, user.email);
        if (found) {
          setIsTransitioning(true);
          setRegistration(found);
          setTimeout(() => setIsTransitioning(false), 1500);
        } else {
          setRegistration(null);
        }
      } catch (err) {
        console.error("[MemberEventDetail] Failed to check registration:", err);
      } finally {
        setIsCheckingRegistration(false);
      }
    }

    void checkMyRegistrationAndEvent();
  }, [user, isAuthLoading, event]);

  const isPast = isEventPast(currentEvent);

  let formattedStartDate = event.start_date;
  let formattedEndDate = event.end_date;
  try {
    formattedStartDate = format(toTimezoneDate(parseISO(event.start_date)), "EEEE, dd MMMM yyyy • h:mm a");
    if (event.end_date) {
      formattedEndDate = format(toTimezoneDate(parseISO(event.end_date)), "h:mm a (zzz)");
    }
  } catch {
    // Keep raw
  }

  const handleShare = () => {
    if (typeof window !== "undefined") {
      void navigator.clipboard.writeText(window.location.href);
      toast.success("Event link copied to clipboard!");
    }
  };

  const handleCheckPaymentStatus = async () => {
    if (!registration?.id || !currentEvent.id) return;
    setIsCheckingPayment(true);
    try {
      const { auth } = await import("@/config/firebase");
      const idToken = await auth?.currentUser?.getIdToken();
      const { checkMemberEventPaymentStatusAction } = await import("@/server/payment-actions");
      const res = await checkMemberEventPaymentStatusAction({
        eventId: String(currentEvent.id),
        registrationId: String(registration.id),
        idToken: idToken || undefined,
      });

      setRegistration((prev) => {
        if (!prev) return prev;
        const newLog: RegistrationStatusLog = res.logEntry ?? {
          id: `log_${Date.now()}_doku`,
          status: "paid_and_registered",
          previous_status: prev.status,
          changed_at: res.paidAt ?? new Date().toISOString(),
          changed_by_id: "doku_payment_gateway",
          changed_by_name: "DOKU Payment Gateway",
          notes: `Payment confirmed via ${res.paymentChannel ?? "QRIS"}. Status updated to Paid & Registered.`,
        };
        return {
          ...prev,
          payment_check_count: res.checkCount,
          ...(res.isPaid
            ? {
                status: "paid_and_registered" as RegistrationStatus,
                payment_status: "paid",
                paid_at: res.paidAt ?? new Date().toISOString(),
                status_logs: res.statusLogs ?? [...(prev.status_logs ?? []), newLog],
              }
            : {}),
        };
      });

      if (res.isPaid) {
        toast.success(res.message || "Payment confirmed! Your ticket is registered.");
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

  const effectiveStatus = registration ? getEffectiveRegistrationStatus(registration, currentEvent) : null;
  const deadlineInfo = registration ? getRegistrationPaymentDeadline(registration, currentEvent) : null;

  const isCanceled =
    effectiveStatus === "canceled" ||
    effectiveStatus === "cancelled" ||
    registration?.status === "canceled" ||
    registration?.status === "cancelled" ||
    registration?.refund_request?.status === "refund_completed";
  const isRejected = effectiveStatus === "rejected" || registration?.status === "rejected";
  const isPaidAndRegistered = !isCanceled && !isRejected && effectiveStatus === "paid_and_registered";
  const isApproved =
    !isCanceled &&
    !isRejected &&
    (effectiveStatus === "approved" ||
      effectiveStatus === "registered" ||
      effectiveStatus === "attended" ||
      isPaidAndRegistered);
  const isWaitlisted = !isCanceled && !isRejected && effectiveStatus === "waitlisted";
  const isWaitingPayment = !isCanceled && !isRejected && effectiveStatus === "waiting_for_payment";
  const isExpired = !isCanceled && !isRejected && effectiveStatus === "expired";
  const isFailed = !isCanceled && !isRejected && effectiveStatus === "failed";
  const isPending =
    !isWaitlisted &&
    !isWaitingPayment &&
    !isExpired &&
    !isFailed &&
    !isCanceled &&
    !isRejected &&
    (effectiveStatus === "pending" ||
      Boolean(
        registration &&
          !isApproved &&
          (currentEvent.requires_approval || (currentEvent as unknown as Record<string, unknown>).curation_mode),
      ));

  let statusBadgeClass = "";
  let statusBadgeText = "Registered";
  if (isPaidAndRegistered) {
    statusBadgeClass =
      "border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold";
    statusBadgeText = "Paid & Registered";
  } else if (isApproved) {
    statusBadgeClass = "bg-emerald-600 text-white font-medium";
    statusBadgeText = "Approved";
  } else if (isWaitingPayment) {
    statusBadgeClass = "border border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold";
    statusBadgeText = "Waiting for Payment";
  } else if (isExpired) {
    statusBadgeClass = "border border-zinc-500/40 bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 font-medium";
    statusBadgeText = "Payment Expired";
  } else if (isFailed) {
    statusBadgeClass = "border border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-400 font-medium";
    statusBadgeText = "Payment Failed";
  } else if (isWaitlisted) {
    statusBadgeClass = "border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400";
    statusBadgeText = "Waitlisted";
  } else if (isCanceled) {
    statusBadgeClass = "border border-zinc-500/40 bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 font-medium";
    statusBadgeText = registration?.refund_request?.status === "refund_completed" ? "Canceled (Refunded)" : "Canceled";
  } else if (isRejected) {
    statusBadgeClass = "border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400";
    statusBadgeText = "Application Rejected";
  } else if (isPending) {
    statusBadgeClass = "border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    statusBadgeText = "Pending Review";
  }

  const isChecking = !registration && (isCheckingRegistration || (isAuthLoading && initialRegistration === null));
  const windowStatus = getRegistrationWindowStatus(currentEvent);

  let registrationStatusDescription = "Open registration. Reserve your spot today.";
  if (isChecking) {
    registrationStatusDescription = "Verifying your registration status...";
  } else if (registration) {
    if (isPaidAndRegistered) {
      registrationStatusDescription = "Payment confirmed and ticket secured! See you at the session.";
    } else if (isApproved) {
      registrationStatusDescription = "Your spot is confirmed! See you at the session.";
    } else if (isWaitingPayment) {
      registrationStatusDescription = deadlineInfo?.timeStatusText
        ? `Application accepted! Please complete payment (${deadlineInfo.timeStatusText}) to confirm your ticket.`
        : "Application accepted! Please complete payment to confirm your ticket.";
    } else if (isExpired) {
      registrationStatusDescription = "Payment deadline has expired. This reservation has been released.";
    } else if (isFailed) {
      registrationStatusDescription = "Payment attempt failed. Please contact organizers or retry.";
    } else if (isWaitlisted) {
      registrationStatusDescription =
        "Your registration is on the Waitlist. Organizers will review and notify you if capacity becomes available.";
    } else if (isCanceled) {
      registrationStatusDescription =
        registration.refund_request?.status === "refund_completed"
          ? "Your registration has been canceled and refund has been disbursed to your bank account."
          : "Your registration for this event has been canceled.";
    } else if (isRejected) {
      registrationStatusDescription = "Your application was not approved by organizers.";
    } else {
      registrationStatusDescription =
        "Your application has been received and is currently Pending Review by organizers.";
    }
  } else if (isPast || windowStatus.status === "completed") {
    registrationStatusDescription = "This event has already concluded. Registrations are closed.";
  } else if (windowStatus.isWaitlist) {
    registrationStatusDescription =
      "This event has reached full capacity. Direct registration is closed, but waitlist registration is open.";
  } else if (currentEvent.requires_approval || (currentEvent as unknown as Record<string, unknown>).curation_mode) {
    registrationStatusDescription =
      "This event is in curation mode. New registrations are Pending Review until approved.";
  }

  const registeredSessionTitle =
    registration?.session_title ??
    (registration?.answers?.session_title as string | undefined) ??
    (registration?.session_id ? `Track: ${registration.session_id}` : null);

  let formatBadgeContent = (
    <span className="flex items-center gap-1.5 text-emerald-500">
      <MapPin className="size-3.5" /> In-Person Meetup
    </span>
  );
  if (isVirtual) {
    formatBadgeContent = (
      <span className="flex items-center gap-1.5 text-blue-500">
        <Radio className="size-3.5" /> Virtual Event
      </span>
    );
  } else if (isHybrid) {
    formatBadgeContent = (
      <span className="flex items-center gap-1.5 text-purple-500">
        <Globe className="size-3.5" /> Hybrid Event
      </span>
    );
  }

  let venueIcon = <MapPin className="mt-0.5 size-4 shrink-0 text-emerald-500" />;
  let venueTitle = "In-Person Venue";
  let venueDetail = "Jakarta, Indonesia (See Bevy page for detailed map)";

  if (isVirtual) {
    venueIcon = <Radio className="mt-0.5 size-4 shrink-0 text-blue-500" />;
    venueTitle = "Virtual Session";
    venueDetail = "Online link will be provided upon registration approval";
  } else if (isHybrid) {
    venueIcon = <Globe className="mt-0.5 size-4 shrink-0 text-purple-500" />;
    venueTitle = "Hybrid Session & Venue";
    venueDetail = event.venue?.name
      ? `${event.venue.name} & Online link provided upon approval`
      : "Jakarta, Indonesia & Online Session";
  } else if (event.venue?.name) {
    venueDetail = `${event.venue.name}${event.venue.city ? `, ${event.venue.city}` : ""}`;
  }

  let actionButton = (
    <EventRegistrationModal
      event={currentEvent}
      existingRegistration={registration}
      onSuccess={(newReg) => {
        setIsTransitioning(true);
        setRegistration(newReg);
        setTimeout(() => setIsTransitioning(false), 1500);
      }}
    >
      <Button className="w-full gap-2 font-medium" size="lg">
        {windowStatus.isWaitlist ? (
          <>
            <Clock className="size-4" />
            Join Waitlist
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            Register for Event
          </>
        )}
      </Button>
    </EventRegistrationModal>
  );

  if (isChecking) {
    actionButton = (
      <Button
        disabled
        variant="outline"
        className="relative w-full cursor-default gap-2 overflow-hidden border-border/60 bg-muted/60 font-medium text-muted-foreground opacity-90 shadow-xs transition-all duration-300"
        size="lg"
      >
        <Sparkles className="relative z-10 size-4 shrink-0 animate-pulse text-muted-foreground/60" />
        <span className="relative z-10">Checking registration...</span>
        <div className="shimmer-wave" aria-hidden="true" />
      </Button>
    );
  } else if (registration) {
    const formattedAmount = registration.payment_amount
      ? new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(registration.payment_amount)
      : null;

    actionButton = (
      <div className="space-y-3">
        <div className="fade-in-50 animate-in rounded-lg bg-muted/60 p-3 text-center text-muted-foreground text-xs">
          {(() => {
            if (isPaidAndRegistered) return "✓ Payment received & spot confirmed! See you at the session.";
            if (isApproved) return "✓ You are registered. Check your email for further event announcements.";
            if (isWaitingPayment)
              return deadlineInfo?.timeStatusText
                ? `⏳ Application approved! Please complete payment (${deadlineInfo.timeStatusText}).`
                : "⏳ Application approved! Please complete payment to secure your ticket.";
            if (isExpired) return "⚠️ Payment deadline expired. This ticket reservation has been released.";
            if (isWaitlisted)
              return "⏳ You are on the waitlist. Organizers will notify you if capacity becomes available.";
            if (isCanceled)
              return registration.refund_request?.status === "refund_completed"
                ? "ℹ️ Registration canceled and refund finalized. You may re-register if capacity is available."
                : "ℹ️ Your registration has been canceled.";
            if (isRejected) return "⚠️ Your application was not approved by organizers.";
            return "⏳ You have applied. Your registration is Pending Review by organizers.";
          })()}
        </div>

        {/* Complete Payment Button if waiting for payment */}
        {isWaitingPayment && registration.payment_url && (
          <a href={registration.payment_url} target="_blank" rel="noopener noreferrer" className="block w-full">
            <Button
              size="lg"
              className="w-full gap-2 bg-amber-600 font-semibold text-white shadow-xs hover:bg-amber-700"
            >
              <CreditCard className="size-4" />
              Complete Payment {formattedAmount ? `(${formattedAmount})` : ""}
            </Button>
          </a>
        )}

        {/* Check Payment Status Button (only when waiting for payment) */}
        {isWaitingPayment && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              isCheckingPayment ||
              (registration.payment_check_count !== undefined &&
                registration.payment_check_count >= (currentEvent.member_payment_check_limit ?? 3))
            }
            onClick={() => void handleCheckPaymentStatus()}
            className="w-full gap-2 border-primary/40 bg-primary/5 text-primary text-xs shadow-xs hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            title={
              (registration.payment_check_count ?? 0) >= (currentEvent.member_payment_check_limit ?? 3)
                ? "Payment check quota reached for this registration"
                : "Check latest payment status from DOKU"
            }
          >
            <RotateCcw className={cn("size-3.5", isCheckingPayment && "animate-spin")} />
            {isCheckingPayment
              ? "Checking DOKU Payment Status..."
              : `Check Payment Status (${Math.max(0, (currentEvent.member_payment_check_limit ?? 3) - (registration.payment_check_count ?? 0))} attempts left)`}
          </Button>
        )}

        {/* Payment window notice */}
        {isWaitingPayment && deadlineInfo && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-800 text-xs dark:text-amber-200">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-amber-600 dark:text-amber-400" />
                Payment Window
              </span>
              <span>{deadlineInfo.timeStatusText || "Pending"}</span>
            </div>
            {deadlineInfo.formattedDeadline && (
              <p className="mt-1 text-[11px] opacity-85">Due: {deadlineInfo.formattedDeadline}</p>
            )}
          </div>
        )}

        {/* Paid & Registered receipt callout */}
        {isPaidAndRegistered && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-800 text-xs dark:text-emerald-200">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                Payment Confirmed
              </span>
              {formattedAmount && <span>{formattedAmount}</span>}
            </div>
            {registration.payment_invoice_number && (
              <p className="mt-1 text-[11px] opacity-85">Invoice Number: #{registration.payment_invoice_number}</p>
            )}
          </div>
        )}

        <Button
          type="button"
          aria-disabled="true"
          variant={isApproved ? "outline" : "secondary"}
          className={cn(
            "relative w-full cursor-default gap-2 overflow-hidden font-medium transition-all duration-500",
            isApproved &&
              "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300",
            isWaitlisted &&
              "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300",
            isWaitingPayment &&
              "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300",
            (isExpired || isCanceled) &&
              "border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:border-zinc-500/30 dark:bg-zinc-950/40 dark:text-zinc-300",
            isRejected &&
              "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300",
            isPending &&
              "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300",
            isTransitioning && "fade-in-50 zoom-in-95 scale-[1.01] animate-in ring-2 ring-emerald-500/40",
          )}
          size="lg"
        >
          {(() => {
            if (isCanceled || isRejected) {
              return (
                <XCircle
                  className={cn(
                    "relative z-10 size-4 text-zinc-600 transition-transform duration-500 dark:text-zinc-400",
                    isTransitioning && "scale-110",
                  )}
                />
              );
            }
            if (isWaitlisted) {
              return (
                <Clock
                  className={cn(
                    "relative z-10 size-4 text-blue-600 transition-transform duration-500 dark:text-blue-400",
                    isTransitioning && "scale-110",
                  )}
                />
              );
            }
            if (isWaitingPayment || isPending) {
              return (
                <Clock
                  className={cn(
                    "relative z-10 size-4 text-amber-600 transition-transform duration-500 dark:text-amber-400",
                    isTransitioning && "scale-110",
                  )}
                />
              );
            }
            if (isExpired) {
              return (
                <Clock
                  className={cn(
                    "relative z-10 size-4 text-zinc-600 transition-transform duration-500 dark:text-zinc-400",
                    isTransitioning && "scale-110",
                  )}
                />
              );
            }
            return (
              <CheckCircle2
                className={cn(
                  "relative z-10 size-4 text-emerald-600 transition-transform duration-500 dark:text-emerald-400",
                  isTransitioning && "scale-110",
                )}
              />
            );
          })()}
          <span className="relative z-10 font-medium">{statusBadgeText}</span>
          <div className="shimmer-wave" aria-hidden="true" />
        </Button>

        {/* Edit or View Responses button */}
        {registration.refund_request?.status === "refund_completed" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled
            className="w-full cursor-not-allowed gap-2 font-medium text-muted-foreground text-xs opacity-60 shadow-xs"
          >
            <Lock className="size-3.5" />
            Refund Finalized • Form Locked
          </Button>
        ) : (
          <EditRegistrationModal
            registration={registration}
            event={currentEvent}
            onSuccess={(updated) => {
              setRegistration(updated);
            }}
            onCancel={() => {
              setRegistration(null);
            }}
            triggerButton={
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-full gap-2 font-medium text-xs shadow-xs",
                  (isPending || isWaitingPayment) &&
                    "border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300",
                )}
              >
                {isPending || isWaitingPayment ? (
                  <>
                    <Edit3 className="size-3.5 text-amber-500" />
                    Edit Form Responses
                  </>
                ) : (
                  <>
                    <FileText className="size-3.5" />
                    View Submitted Responses
                  </>
                )}
              </Button>
            }
          />
        )}

        {/* Refund Mechanism for Paid Waitlisted */}
        {(() => {
          const refundInfo = isRegistrationEligibleForRefund(registration, currentEvent);
          const refundReq = registration.refund_request;

          if (!refundInfo.isEligible && !refundReq) return null;

          if (refundReq) {
            let label = "View Refund Status 💰";
            if (refundReq.status === "refund_completed") {
              label = "View Refund Receipt 🧾";
            } else if (refundReq.status === "rejected") {
              label = "Refund Request Rejected ⚠️";
            }

            return (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRefundStatusOpen(true)}
                className={cn(
                  "w-full gap-2 font-semibold text-xs shadow-xs",
                  refundReq.status === "refund_completed" &&
                    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
                  refundReq.status === "waiting_for_approval" &&
                    "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300",
                  refundReq.status === "rejected" &&
                    "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
                )}
              >
                <CreditCard className="size-3.5" />
                {label}
              </Button>
            );
          }

          if (refundInfo.canSubmitNew) {
            return (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRefundModalOpen(true)}
                  className="w-full gap-2 border-indigo-500/40 bg-indigo-500/10 font-semibold text-indigo-700 text-xs shadow-xs hover:bg-indigo-500/20 dark:text-indigo-300"
                >
                  <CreditCard className="size-3.5" />
                  {registration.status === "paid_waitlisted"
                    ? "Request Commitment Fee Refund 💸"
                    : "Request Ticket Refund 💸"}
                </Button>
                <div className="rounded-md border border-border/80 bg-muted/40 p-2.5 text-xs">
                  <p className="font-semibold text-[11px] text-foreground">Refund Policy:</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed">
                    {getEventRefundPolicyNotes(currentEvent ?? event)}
                  </p>
                </div>
              </div>
            );
          }

          return null;
        })()}

        {/* Re-register for Event when registration is canceled or refunded */}
        {isCanceled && !isPast && (windowStatus.isOpen || windowStatus.isWaitlist) && (
          <EventRegistrationModal
            event={currentEvent}
            existingRegistration={null}
            onSuccess={(newReg) => {
              setIsTransitioning(true);
              setRegistration(newReg);
              setTimeout(() => setIsTransitioning(false), 1500);
            }}
          >
            <Button
              type="button"
              size="sm"
              className="w-full gap-2 bg-primary font-semibold text-primary-foreground text-xs shadow-xs hover:bg-primary/90"
            >
              <RotateCcw className="size-3.5" />
              Cancel Registration & Re-register
            </Button>
          </EventRegistrationModal>
        )}

        {/* Cancel Registration Buttons (only if event is not concluded and registration is not attended, not paid, and not already canceled) */}
        {!isPast && !isCanceled && registration.status !== "attended" && !isPaidAndRegistered && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCancelModalOpen(true)}
              className="flex-1 gap-2 border-destructive/30 text-destructive text-xs shadow-xs hover:bg-destructive/10 hover:text-destructive"
            >
              <UserX className="size-3.5" />
              Cancel Registration
            </Button>
            <EventRegistrationModal
              event={currentEvent}
              existingRegistration={null}
              onSuccess={(newReg) => {
                setIsTransitioning(true);
                setRegistration(newReg);
                setTimeout(() => setIsTransitioning(false), 1500);
              }}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 gap-2 border-primary/40 bg-primary/5 text-primary text-xs shadow-xs hover:bg-primary/10"
              >
                <RotateCcw className="size-3.5" />
                Cancel & Re-register
              </Button>
            </EventRegistrationModal>
          </div>
        )}

        {/* Merchandise Delivery Claim for No-Show Attendees */}
        {isPast &&
          !registration.is_checked_in &&
          registration.status !== "attended" &&
          Boolean(registration.selected_merchandise && registration.selected_merchandise.length > 0) && (
            <div className="space-y-2 pt-1">
              {!registration.delivery_request ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeliveryModalOpen(true)}
                  className="w-full gap-2 border-primary/40 bg-primary/5 text-primary text-xs shadow-xs hover:bg-primary/10"
                >
                  <Truck className="size-3.5" />
                  Request Merchandise Delivery (Rp 50.000)
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeliveryStatusOpen(true)}
                  className="w-full gap-2 text-xs shadow-xs"
                >
                  <Truck className="size-3.5" />
                  View Delivery Status ({(() => {
                    const st = registration.delivery_request.status;
                    switch (st) {
                      case "approved":
                        return "In Transit";
                      case "pending_review":
                        return "Under Review";
                      case "pending_payment":
                        return "Pay Fee";
                      case "delivered":
                        return "Delivered";
                      case "rejected":
                        return "Rejected";
                      default:
                        return st;
                    }
                  })()})
                </Button>
              )}
            </div>
          )}
      </div>
    );
  } else if (isPast) {
    actionButton = (
      <Button disabled variant="secondary" className="w-full cursor-default font-medium opacity-75" size="lg">
        Event Ended • Registration Closed
      </Button>
    );
  }

  let statusBadgeNode = (
    <Badge variant="outline" className="text-muted-foreground">
      Not Registered
    </Badge>
  );

  if (isChecking) {
    statusBadgeNode = (
      <Badge variant="outline" className="relative overflow-hidden text-muted-foreground">
        Checking...
        <div className="shimmer-wave" aria-hidden="true" />
      </Badge>
    );
  } else if (registration) {
    statusBadgeNode = (
      <Badge
        variant={isApproved ? "default" : "secondary"}
        className={cn(statusBadgeClass, isTransitioning && "fade-in-50 zoom-in-95 animate-in")}
      >
        {statusBadgeText}
      </Badge>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb / Back Link */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href={targetBackUrl}>
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {event.id && (
            <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
              <Link href={`/events/${event.id}`} target="_blank" rel="noopener noreferrer">
                <Globe className="size-3.5" />
                Open Live Page
              </Link>
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5 text-xs">
            <Share2 className="size-3.5" />
            Share Event
          </Button>

          {event.url && (
            <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
              <a href={event.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                View on Bevy
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left 2 Cols: Hero Banner & Full Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Banner / Poster */}
          {(() => {
            const imageUrl = extractEventImageUrl(
              currentEvent as unknown as Record<string, unknown>,
              registration as unknown as Record<string, unknown>,
            );
            return (
              <EventCardImage
                src={imageUrl}
                alt={currentEvent.title}
                aspectRatio="aspect-[21/9]"
                containerClassName="rounded-xl border shadow-xs"
                priority
                loading="eager"
                isLoading={isCheckingRegistration && !imageUrl}
              >
                <div className="absolute top-4 left-4 z-20 flex gap-2">
                  <Badge variant="secondary" className="bg-background/90 text-xs backdrop-blur-md">
                    {formatBadgeContent}
                  </Badge>
                  {event.requires_approval && (
                    <Badge variant="secondary" className="bg-background/90 text-xs backdrop-blur-md">
                      Curated RSVP
                    </Badge>
                  )}
                  {event.is_test && (
                    <Badge
                      variant="outline"
                      className="border-purple-500/30 bg-purple-500/20 text-purple-700 text-xs backdrop-blur-md dark:text-purple-300"
                    >
                      Test Event
                    </Badge>
                  )}
                </div>
              </EventCardImage>
            );
          })()}

          {/* Title & Short Summary */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 font-medium text-muted-foreground text-xs">
              <Badge variant="outline" className="text-xs">
                {event.event_type_title ?? "Technical Session"}
              </Badge>
              {event.is_test && (
                <Badge
                  variant="outline"
                  className="border-purple-500/20 bg-purple-500/10 text-purple-600 text-xs dark:text-purple-400"
                >
                  Test
                </Badge>
              )}
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                {formattedStartDate}
              </span>
            </div>

            <h1 className="font-bold text-2xl tracking-tight sm:text-3xl lg:text-4xl">{event.title}</h1>

            {event.description_short && (
              <p className="font-medium text-base text-muted-foreground leading-relaxed">{event.description_short}</p>
            )}
          </div>

          <Separator />

          {/* Description / Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">About this Event</CardTitle>
              <CardDescription>Event overview, topics covered, and key takeaways.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-foreground/90 text-sm leading-relaxed">
              {event.description ? (
                <EventDescriptionContent html={event.description} />
              ) : (
                <p className="text-muted-foreground italic">
                  No detailed description has been published for this event yet. Check back soon!
                </p>
              )}
            </CardContent>
          </Card>

          {/* Unified Event Agenda & Sessions */}
          {(currentEvent.agenda || (currentEvent.sessions && currentEvent.sessions.length > 0)) && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-primary" />
                  <CardTitle className="text-lg">Event Agenda & Sessions</CardTitle>
                </div>
                <CardDescription>Full event schedule, speaker sessions, and presentation slides.</CardDescription>
              </CardHeader>
              <CardContent>
                <UnifiedAgendaTimeline
                  bevyAgenda={currentEvent.agenda}
                  speakers={currentEvent.speakers}
                  firestoreSessions={currentEvent.sessions}
                />
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Topics & Technologies
              </h3>
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="font-normal text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Quick RSVP & Event Details Card */}
        <div className="space-y-6">
          {/* Registration Card */}
          <Card className="bg-card shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Registration Status</span>
                {statusBadgeNode}
              </CardTitle>
              <CardDescription>{registrationStatusDescription}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {registeredSessionTitle && (
                <div className="flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs">
                  <Layers className="size-4 shrink-0 text-primary" />
                  <div>
                    <span className="block font-medium text-[10px] text-muted-foreground uppercase">
                      Your Selected Session Track
                    </span>
                    <strong className="text-foreground">{registeredSessionTitle}</strong>
                  </div>
                </div>
              )}

              <div className="space-y-2 rounded-lg bg-muted/30 p-3.5 text-xs">
                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="shrink-0">Capacity / RSVPs</span>
                  <strong className="text-right text-foreground">
                    {currentEvent.total_registrations || event.total_registrations || 0} registered
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="shrink-0">Entry Fee</span>
                  {getEventEntryFeeDisplay(currentEvent, registration)}
                </div>
              </div>

              {actionButton}
            </CardContent>
          </Card>

          {/* Event Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Event Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <div className="font-medium text-foreground">Date & Time</div>
                  <div className="text-muted-foreground">{formattedStartDate}</div>
                  {formattedEndDate && <div className="text-muted-foreground">Until {formattedEndDate}</div>}
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                {venueIcon}
                <div>
                  <div className="font-medium text-foreground">{venueTitle}</div>
                  <div className="text-muted-foreground">{venueDetail}</div>
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                <Users className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <div className="font-medium text-foreground">Organized by</div>
                  <div className="text-muted-foreground">Google Developer Group (GDG) Jakarta</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {registration && (
        <CancelRegistrationDialog
          open={isCancelModalOpen}
          onOpenChange={setIsCancelModalOpen}
          registration={registration}
          event={currentEvent}
          onSuccess={() => {
            setRegistration(null);
            setIsCancelModalOpen(false);
          }}
        />
      )}

      {registration && isDeliveryModalOpen && (
        <MerchandiseDeliveryRequestDialog
          isOpen={isDeliveryModalOpen}
          onOpenChange={setIsDeliveryModalOpen}
          registration={registration}
          event={currentEvent}
          onSuccess={(updated: FirestoreRegistration) => {
            setRegistration(updated);
            setIsDeliveryModalOpen(false);
          }}
        />
      )}

      {registration && isDeliveryStatusOpen && registration.delivery_request && (
        <MerchandiseDeliveryStatusDialog
          isOpen={isDeliveryStatusOpen}
          onOpenChange={setIsDeliveryStatusOpen}
          registration={registration}
          onOpenPayment={() => {
            setIsDeliveryStatusOpen(false);
            setIsDeliveryModalOpen(true);
          }}
        />
      )}

      {registration && isRefundModalOpen && (
        <RefundRequestDialog
          isOpen={isRefundModalOpen}
          onOpenChange={setIsRefundModalOpen}
          registration={registration}
          event={currentEvent}
          onSuccess={(updatedRefund) => {
            setRegistration((prev) =>
              prev
                ? {
                    ...prev,
                    refund_request: updatedRefund,
                  }
                : prev,
            );
            setIsRefundModalOpen(false);
          }}
        />
      )}

      {registration && isRefundStatusOpen && registration.refund_request && (
        <RefundStatusDialog
          isOpen={isRefundStatusOpen}
          onOpenChange={setIsRefundStatusOpen}
          registration={registration}
          event={currentEvent}
          onEditRequest={() => {
            setIsRefundStatusOpen(false);
            setIsRefundModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
