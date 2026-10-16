import { format } from "date-fns";

import { parseFirestoreDate } from "@/lib/date-utils";
import { calculateRegistrationTotalAmount } from "@/lib/events/doku-payment";
import type { FirestoreEvent, FirestoreRegistration, RegistrationStatus } from "@/lib/firestore/types";

/**
 * Evaluates whether an event has curation mode active.
 * An explicit `curation_mode` boolean takes priority over `requires_approval`.
 */
export function isEventCurationMode(event?: Partial<FirestoreEvent> | null): boolean {
  if (!event) return false;
  const raw = event as unknown as Record<string, unknown>;
  if (typeof raw.curation_mode === "boolean") {
    return raw.curation_mode;
  }
  if (typeof raw.requires_approval === "boolean") {
    return raw.requires_approval;
  }
  return false;
}

/**
 * Checks if an event registration has payable elements (paid ticket tier, merchandise, or bundle).
 * Returns false if the net total amount is zero or free.
 */
export function isPaidRegistration(reg: Partial<FirestoreRegistration>): boolean {
  if (calculateRegistrationTotalAmount(reg) <= 0) {
    return false;
  }
  if (reg.ticket_price && reg.ticket_price > 0) return true;
  if (reg.ticket_type === "paid" || reg.ticket_type === "commitment_fee") return true;
  if (reg.bundle_price && reg.bundle_price > 0) return true;
  if (reg.selected_merchandise && reg.selected_merchandise.length > 0) return true;
  if (
    reg.status === "waiting_for_payment" ||
    reg.status === "paid_and_registered" ||
    reg.status === "paid_waitlisted" ||
    reg.status === "expired" ||
    reg.status === "failed" ||
    reg.status === "canceled" ||
    reg.status === "cancelled" ||
    reg.payment_url !== undefined ||
    reg.payment_status !== undefined
  ) {
    return true;
  }
  return false;
}

/**
 * Resolves the configured payment deadline in minutes for an event (defaults to 1440 = 24 hours).
 */
export function getEventPaymentDeadlineMinutes(event?: Partial<FirestoreEvent>): number {
  const minutes = event?.paymentDeadlinesInMinutes ?? event?.paymentDeadlineMinutes ?? event?.payment_deadline_minutes;
  return typeof minutes === "number" && minutes > 0 ? minutes : 1440;
}

export interface PaymentDeadlineInfo {
  deadlineDate: Date | null;
  isOverdue: boolean;
  minutesRemaining: number | null; // Negative if overdue
  formattedDeadline: string | null;
  timeStatusText: string | null;
}

/**
 * Calculates the exact payment deadline and overdue status for a registration.
 * Expired status is determined when current date in minutes is overdue of payment deadlines.
 */
export function getRegistrationPaymentDeadline(
  reg: Partial<FirestoreRegistration>,
  event?: Partial<FirestoreEvent>,
): PaymentDeadlineInfo {
  // If already paid, attended, or approved, it is not overdue
  const statusLower = (reg.status ?? "").toLowerCase().trim();
  const paymentStatusLower = (reg.payment_status ?? "").toLowerCase().trim();

  if (
    statusLower === "paid_and_registered" ||
    statusLower === "approved" ||
    statusLower === "attended" ||
    statusLower === "registered" ||
    paymentStatusLower === "paid"
  ) {
    return {
      deadlineDate: null,
      isOverdue: false,
      minutesRemaining: null,
      formattedDeadline: null,
      timeStatusText: "Paid",
    };
  }

  // If manually failed or canceled
  if (
    statusLower === "failed" ||
    statusLower === "canceled" ||
    statusLower === "cancelled" ||
    statusLower === "rejected"
  ) {
    return {
      deadlineDate: null,
      isOverdue: false,
      minutesRemaining: null,
      formattedDeadline: null,
      timeStatusText: null,
    };
  }

  const nowMs = Date.now();
  let deadlineDate: Date | null = null;

  // 1. Check explicit payment_expired_datetime (from DOKU / Mayar checkout generation)
  if (reg.payment_expired_datetime) {
    const parsed = parseFirestoreDate(reg.payment_expired_datetime);
    if (parsed) {
      deadlineDate = parsed;
    }
  }

  // 2. Fall back to event payment deadline minutes based on reviewed_at / registered_at / updated_at
  if (!deadlineDate) {
    const deadlineMinutes = getEventPaymentDeadlineMinutes(event);
    const baseDateVal = reg.reviewed_at ?? reg.registered_at ?? reg.updated_at;
    if (baseDateVal) {
      const baseDate = parseFirestoreDate(baseDateVal);
      if (baseDate) {
        deadlineDate = new Date(baseDate.getTime() + deadlineMinutes * 60 * 1000);
      }
    }
  }

  if (!deadlineDate) {
    return {
      deadlineDate: null,
      isOverdue: statusLower === "expired",
      minutesRemaining: null,
      formattedDeadline: null,
      timeStatusText: statusLower === "expired" ? "Expired" : null,
    };
  }

  const diffMs = deadlineDate.getTime() - nowMs;
  const minutesRemaining = Math.round(diffMs / (60 * 1000));
  const isOverdue = minutesRemaining <= 0 || statusLower === "expired";

  let formattedDeadline: string | null = null;
  try {
    formattedDeadline = format(deadlineDate, "dd MMM yyyy, HH:mm");
  } catch {
    formattedDeadline = deadlineDate.toLocaleString("id-ID");
  }

  let timeStatusText: string;
  if (isOverdue) {
    const overdueMins = Math.abs(minutesRemaining);
    if (overdueMins >= 1440) {
      const days = Math.floor(overdueMins / 1440);
      timeStatusText = `Expired ${days}d ago`;
    } else if (overdueMins >= 60) {
      const hours = Math.floor(overdueMins / 60);
      timeStatusText = `Expired ${hours}h ago`;
    } else {
      timeStatusText = `Expired ${Math.max(1, overdueMins)}m ago`;
    }
  } else {
    if (minutesRemaining >= 1440) {
      const days = Math.floor(minutesRemaining / 1440);
      timeStatusText = `Expires in ${days}d`;
    } else if (minutesRemaining >= 60) {
      const hours = Math.floor(minutesRemaining / 60);
      timeStatusText = `Expires in ${hours}h`;
    } else {
      timeStatusText = `Expires in ${minutesRemaining}m`;
    }
  }

  return {
    deadlineDate,
    isOverdue,
    minutesRemaining,
    formattedDeadline,
    timeStatusText,
  };
}

/**
 * Checks if a registration is overdue for payment.
 */
export function isRegistrationPaymentOverdue(
  reg: Partial<FirestoreRegistration>,
  event?: Partial<FirestoreEvent>,
): boolean {
  if (reg.status === "expired") return true;
  const { isOverdue } = getRegistrationPaymentDeadline(reg, event);
  return isOverdue;
}

/**
 * Resolves the effective status of a registration taking overdue payment deadlines into account.
 * If waiting for payment and deadline in minutes is exceeded, returns "expired".
 */
export function getEffectiveRegistrationStatus(
  reg: FirestoreRegistration,
  event?: Partial<FirestoreEvent>,
): RegistrationStatus {
  const currentStatus = reg.status;

  // Normalized check
  if (currentStatus === "cancelled") return "canceled";

  // If waiting for payment, check if today's date in minutes is overdue
  if (currentStatus === "waiting_for_payment" || reg.payment_status === "unpaid") {
    if (isRegistrationPaymentOverdue(reg, event)) {
      return "expired";
    }
  }

  return currentStatus;
}
