import { format, parseISO } from "date-fns";

import { toTimezoneDate } from "@/lib/date-utils";
import { calculatePaymentGatewayFee } from "@/lib/events/payment-fee";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";

export interface BankOption {
  code: string;
  name: string;
}

export const POPULAR_INDONESIAN_BANKS: BankOption[] = [
  { code: "BCA", name: "BCA (Bank Central Asia)" },
  { code: "MANDIRI", name: "Bank Mandiri" },
  { code: "BNI", name: "BNI (Bank Negara Indonesia)" },
  { code: "BRI", name: "BRI (Bank Rakyat Indonesia)" },
  { code: "BSI", name: "BSI (Bank Syariah Indonesia)" },
  { code: "CIMB", name: "CIMB Niaga" },
  { code: "PERMATA", name: "Permata Bank" },
  { code: "DANAMON", name: "Bank Danamon" },
  { code: "JENIUS", name: "Jenius / Bank BTPN" },
  { code: "SEABANK", name: "SeaBank" },
  { code: "JAGO", name: "Bank Jago" },
  { code: "BLU", name: "Blu by BCA Digital" },
  { code: "OTHER", name: "Other Bank / E-Wallet" },
];

export const DEFAULT_REFUND_POLICY_NOTES =
  "Commitment deposit will be refunded via bank transfer within 3-5 business days after event ends.";

export function getEventRefundPolicyNotes(event?: FirestoreEvent | null): string {
  const custom = event?.refund_policy_notes?.trim();
  return custom && custom.length > 0 ? custom : DEFAULT_REFUND_POLICY_NOTES;
}

export interface RefundCutoffInfo {
  cutoffDate: Date | null;
  isExpired: boolean;
  formattedCutoff: string;
  deadlineDescription: string;
}

/**
 * Calculates the refund cutoff deadline for an event.
 * Priority:
 * 1. event.refund_cutoff_date (explicit timestamp)
 * 2. event.refund_cutoff_days_before (e.g. 1 day before event start date)
 * 3. Default: 1 day before event start date
 */
export function getEventRefundCutoff(event?: FirestoreEvent): RefundCutoffInfo {
  if (!event) {
    return {
      cutoffDate: null,
      isExpired: false,
      formattedCutoff: "—",
      deadlineDescription: "Event details unavailable.",
    };
  }

  let cutoff: Date | null = null;

  if (event.refund_cutoff_date) {
    try {
      cutoff = parseISO(event.refund_cutoff_date);
    } catch {
      cutoff = null;
    }
  }

  if (!cutoff && event.start_date) {
    try {
      const startDate = parseISO(event.start_date);
      const daysBefore = typeof event.refund_cutoff_days_before === "number" ? event.refund_cutoff_days_before : 1;
      cutoff = new Date(startDate.getTime() - daysBefore * 24 * 60 * 60 * 1000);
    } catch {
      cutoff = null;
    }
  }

  if (!cutoff || Number.isNaN(cutoff.getTime())) {
    return {
      cutoffDate: null,
      isExpired: false,
      formattedCutoff: "—",
      deadlineDescription: "Before event day",
    };
  }

  const isExpired = Date.now() > cutoff.getTime();
  const tzDate = toTimezoneDate(cutoff);
  const formattedCutoff = format(tzDate, "dd MMM yyyy, HH:mm");

  const daysDiff = Math.ceil((cutoff.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  let deadlineDescription = "";
  if (isExpired) {
    deadlineDescription = `Refund window closed on ${formattedCutoff}`;
  } else if (daysDiff <= 1) {
    deadlineDescription = `Refund closes soon: ${formattedCutoff}`;
  } else {
    deadlineDescription = `Refund open until ${formattedCutoff}`;
  }

  return {
    cutoffDate: cutoff,
    isExpired,
    formattedCutoff,
    deadlineDescription,
  };
}

/**
 * Checks whether an attendee's registration is eligible for refund request:
 * 1. Must be `paid_waitlisted` (or has existing refund_request).
 * 2. Has paid commitment fee or ticket amount (> 0).
 * 3. Event refund_enabled must not be false.
 * 4. If creating a new request, current time must be before the cutoff.
 */
export function isRegistrationEligibleForRefund(
  registration: FirestoreRegistration,
  event?: FirestoreEvent,
): {
  isEligible: boolean;
  canSubmitNew: boolean;
  hasActiveRequest: boolean;
  reason?: string;
  cutoffInfo: RefundCutoffInfo;
} {
  const cutoffInfo = getEventRefundCutoff(event);
  const hasActiveRequest = Boolean(registration.refund_request);

  if (event?.refund_enabled === false) {
    return {
      isEligible: hasActiveRequest,
      canSubmitNew: false,
      hasActiveRequest,
      reason: "Refunds are disabled for this event.",
      cutoffInfo,
    };
  }

  const isEligibleStatus =
    registration.status === "paid_waitlisted" ||
    registration.status === "paid_and_registered" ||
    registration.status === "registered" ||
    registration.status === "approved" ||
    registration.status === "rejected";

  const hasPaidAmount =
    registration.payment_status === "paid" ||
    Boolean(registration.paid_at) ||
    (typeof registration.payment_amount === "number" && registration.payment_amount > 0) ||
    (typeof registration.ticket_price === "number" && registration.ticket_price > 0) ||
    registration.ticket_type === "commitment_fee";

  // For rejected paid registrations, must have actually completed payment (or had a paid waitlist / paid status)
  const isRejectedStatus = registration.status === "rejected";
  const hasConfirmedPaymentForRejected =
    registration.payment_status === "paid" ||
    Boolean(registration.paid_at) ||
    Boolean(registration.payment_invoice_number && (registration.payment_amount ?? 0) > 0) ||
    Boolean(
      registration.status_logs?.some((l) => l.status === "paid_waitlisted" || l.status === "paid_and_registered"),
    );

  if (isRejectedStatus && !hasConfirmedPaymentForRejected && !hasActiveRequest) {
    return {
      isEligible: false,
      canSubmitNew: false,
      hasActiveRequest: false,
      reason: "Refund is only applicable for rejected registrations that have completed payment.",
      cutoffInfo,
    };
  }

  if (!isEligibleStatus && !hasActiveRequest) {
    return {
      isEligible: false,
      canSubmitNew: false,
      hasActiveRequest: false,
      reason: "Refund is only applicable for paid registrations.",
      cutoffInfo,
    };
  }

  if (!hasPaidAmount && !hasActiveRequest) {
    return {
      isEligible: false,
      canSubmitNew: false,
      hasActiveRequest: false,
      reason: "No payment amount associated with this registration.",
      cutoffInfo,
    };
  }

  if (hasActiveRequest) {
    return {
      isEligible: true,
      canSubmitNew: false,
      hasActiveRequest: true,
      cutoffInfo,
    };
  }

  // Rejected paid waitlisted attendees can submit a refund request even if the refund cutoff date has passed
  if (cutoffInfo.isExpired && !isRejectedStatus) {
    return {
      isEligible: false,
      canSubmitNew: false,
      hasActiveRequest: false,
      reason: `Refund submission window closed on ${cutoffInfo.formattedCutoff}.`,
      cutoffInfo,
    };
  }

  return {
    isEligible: true,
    canSubmitNew: true,
    hasActiveRequest: false,
    cutoffInfo,
  };
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Flattens registrations into one row per refund record: the active `refund_request` plus any archived
 * `refund_history` entries (kept when a refunded member re-registers). Archived rows are read-only
 * snapshots shown as canceled/refunded and get a synthetic id so they don't collide with the live row.
 */
export function expandRefundRecords(registrations: FirestoreRegistration[]): FirestoreRegistration[] {
  const rows: FirestoreRegistration[] = [];
  for (const reg of registrations) {
    if (reg.refund_request) rows.push(reg);
    for (const [index, past] of (reg.refund_history ?? []).entries()) {
      rows.push({
        ...reg,
        id: `${reg.id}__refund_${past.id ?? index}`,
        status: "canceled",
        payment_status: "refunded",
        refund_request: past,
      });
    }
  }
  return rows;
}

/**
 * Calculates the refundable deposit amount for a registration.
 *
 * Organizer rule:
 * By default (event.refund_include_fee = false or undefined), the organizer only refunds
 * the deposit ticket amount without payment gateway fees.
 * When event.refund_include_fee = true, the fee is added into the refundable amount.
 */
export function getRegistrationRefundAmount(
  registration: FirestoreRegistration,
  event?: FirestoreEvent | null,
): number {
  // If the refund is already completed, respect the actual finalized disbursed amount
  if (
    registration.refund_request?.status === "refund_completed" &&
    typeof registration.refund_request.refund_amount === "number" &&
    registration.refund_request.refund_amount > 0
  ) {
    return registration.refund_request.refund_amount;
  }

  const includeFee = Boolean(event?.refund_include_fee);

  // 1. Determine base ticket deposit amount / subtotal without fee
  let depositWithoutFee: number | null = null;

  if (typeof registration.payment_subtotal_amount === "number" && registration.payment_subtotal_amount > 0) {
    depositWithoutFee = registration.payment_subtotal_amount;
  } else if (
    typeof registration.payment_amount === "number" &&
    typeof registration.payment_fee_amount === "number" &&
    registration.payment_fee_amount > 0
  ) {
    depositWithoutFee = Math.max(0, registration.payment_amount - registration.payment_fee_amount);
  } else if (typeof registration.ticket_price === "number" && registration.ticket_price > 0) {
    depositWithoutFee = registration.ticket_price;
  } else if (typeof registration.bundle_price === "number" && registration.bundle_price > 0) {
    depositWithoutFee = registration.bundle_price;
  }

  // 2. Determine amount with fee
  let amountWithFee: number | null = null;
  if (typeof registration.payment_amount === "number" && registration.payment_amount > 0) {
    amountWithFee = registration.payment_amount;
  } else if (depositWithoutFee !== null) {
    if (typeof registration.payment_fee_amount === "number" && registration.payment_fee_amount > 0) {
      amountWithFee = depositWithoutFee + registration.payment_fee_amount;
    } else {
      const feeCalc = calculatePaymentGatewayFee(depositWithoutFee, event);
      amountWithFee = depositWithoutFee + feeCalc.feeAmount;
    }
  }

  // 3. Fallback if depositWithoutFee could not be resolved from structured fields
  if (depositWithoutFee === null) {
    const rawFallback = registration.refund_request?.refund_amount ?? registration.payment_amount ?? 0;

    if (typeof registration.ticket_price === "number" && registration.ticket_price > 0) {
      depositWithoutFee = registration.ticket_price;
      amountWithFee = rawFallback > depositWithoutFee ? rawFallback : (amountWithFee ?? rawFallback);
    } else {
      depositWithoutFee = rawFallback;
      amountWithFee = rawFallback;
    }
  }

  if (includeFee) {
    return amountWithFee ?? depositWithoutFee;
  }

  return depositWithoutFee;
}
