import { format, parseISO } from "date-fns";

import { toTimezoneDate } from "@/lib/date-utils";
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
    registration.status === "approved";

  const hasPaidAmount =
    (typeof registration.payment_amount === "number" && registration.payment_amount > 0) ||
    (typeof registration.ticket_price === "number" && registration.ticket_price > 0) ||
    registration.ticket_type === "commitment_fee";

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

  if (cutoffInfo.isExpired) {
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
