import { format, parseISO } from "date-fns";

import { toTimezoneDate } from "@/lib/date-utils";
import { calculatePaymentGatewayFee } from "@/lib/events/payment-fee";
import { calculateVoucherDiscount } from "@/lib/events/voucher-utils";
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

export interface RegistrationDiscountBreakdown {
  voucherDiscount: number;
  referralDiscount: number;
  totalDiscount: number;
  hasDiscount: boolean;
  voucherCode?: string;
  referralCode?: string;
  referrerName?: string;
  baseTicketPrice: number;
  netTicketPrice: number;
}

/**
 * Calculates the discount breakdown for a registration based on applied voucher and promo referral.
 */
export function getRegistrationDiscountBreakdown(
  registration: FirestoreRegistration,
  event?: FirestoreEvent | null,
): RegistrationDiscountBreakdown {
  let baseTicketPrice = registration.bundle_id ? (registration.bundle_price ?? 0) : (registration.ticket_price ?? 0);

  if (baseTicketPrice === 0 && registration.ticket_id && event?.tickets) {
    const matchTicket = event.tickets.find((t) => t.id === registration.ticket_id);
    if (matchTicket && typeof matchTicket.price === "number") {
      baseTicketPrice = matchTicket.price;
    }
  }

  if (baseTicketPrice === 0 && registration.bundle_id && event?.bundles) {
    const matchBundle = event.bundles.find((b) => b.id === registration.bundle_id);
    if (matchBundle && typeof matchBundle.price === "number") {
      baseTicketPrice = matchBundle.price;
    }
  }

  // 1. Voucher discount
  let voucherDiscount = 0;
  if (typeof registration.voucher_discount_amount === "number" && registration.voucher_discount_amount > 0) {
    voucherDiscount = registration.voucher_discount_amount;
  } else if (
    (registration.voucher_code || registration.voucher_id) &&
    typeof registration.voucher_discount_value === "number" &&
    registration.voucher_discount_value > 0
  ) {
    if (registration.voucher_discount_type === "percentage") {
      voucherDiscount = Math.round((baseTicketPrice * registration.voucher_discount_value) / 100);
    } else {
      voucherDiscount = registration.voucher_discount_value;
    }
  }

  if (baseTicketPrice > 0) {
    voucherDiscount = Math.min(baseTicketPrice, voucherDiscount);
  }

  // 2. Referral discount
  let referralDiscount = 0;
  if (typeof registration.referral_discount_amount === "number" && registration.referral_discount_amount > 0) {
    referralDiscount = registration.referral_discount_amount;
  } else if (registration.referral_code) {
    const remainingForReferral = Math.max(0, baseTicketPrice - voucherDiscount);
    if (typeof registration.referral_discount_percent === "number" && registration.referral_discount_percent > 0) {
      referralDiscount = Math.round((baseTicketPrice * registration.referral_discount_percent) / 100);
    } else if (
      registration.referral_discount_type === "fixed" &&
      typeof event?.referral_discount_amount === "number" &&
      event.referral_discount_amount > 0
    ) {
      referralDiscount = event.referral_discount_amount;
    } else if (typeof event?.referral_discount_percentage === "number" && event.referral_discount_percentage > 0) {
      referralDiscount = Math.round((baseTicketPrice * event.referral_discount_percentage) / 100);
    } else if (baseTicketPrice > 0) {
      // Default standard referral 10%
      referralDiscount = Math.round((baseTicketPrice * 10) / 100);
    }
    referralDiscount = Math.min(remainingForReferral, referralDiscount);
  }

  const totalDiscount = voucherDiscount + referralDiscount;

  if (baseTicketPrice === 0) {
    let rawPaidBase = 0;
    if (typeof registration.payment_subtotal_amount === "number" && registration.payment_subtotal_amount > 0) {
      rawPaidBase = registration.payment_subtotal_amount;
    } else if (typeof registration.payment_amount === "number" && registration.payment_amount > 0) {
      rawPaidBase = registration.payment_amount - (registration.payment_fee_amount ?? 0);
    }
    baseTicketPrice = Math.max(0, rawPaidBase + totalDiscount);
  }

  const netTicketPrice = Math.max(0, baseTicketPrice - totalDiscount);

  return {
    voucherDiscount,
    referralDiscount,
    totalDiscount,
    hasDiscount: totalDiscount > 0,
    voucherCode: registration.voucher_code,
    referralCode: registration.referral_code,
    referrerName: registration.referrer_name,
    baseTicketPrice,
    netTicketPrice,
  };
}

/**
 * Calculates the refundable deposit amount for a registration.
 *
 * Organizer rule:
 * By default (event.refund_include_fee = false or undefined), the organizer only refunds
 * the deposit ticket amount without payment gateway fees.
 * When event.refund_include_fee = true, the fee is added into the refundable amount.
 * If the attendee used a discount voucher or promo referral, it is deducted so only what
 * the attendee actually paid for the ticket deposit is refunded.
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
  const discounts = getRegistrationDiscountBreakdown(registration, event);

  // 1. Determine base ticket deposit amount / subtotal without fee, cutting off voucher/referral discounts
  let depositWithoutFee: number | null = null;

  if (discounts.baseTicketPrice > 0) {
    depositWithoutFee = discounts.netTicketPrice;
  } else if (typeof registration.payment_subtotal_amount === "number" && registration.payment_subtotal_amount > 0) {
    depositWithoutFee = Math.max(0, registration.payment_subtotal_amount - discounts.totalDiscount);
  } else if (
    typeof registration.payment_amount === "number" &&
    typeof registration.payment_fee_amount === "number" &&
    registration.payment_fee_amount > 0
  ) {
    const rawSubtotal = Math.max(0, registration.payment_amount - registration.payment_fee_amount);
    depositWithoutFee = Math.max(0, rawSubtotal - discounts.totalDiscount);
  } else if (typeof registration.payment_amount === "number" && registration.payment_amount > 0) {
    depositWithoutFee = Math.max(0, registration.payment_amount - discounts.totalDiscount);
  }

  // Cap refundable deposit at actual payment amount so organizer never refunds more than attendee paid
  if (
    depositWithoutFee !== null &&
    typeof registration.payment_amount === "number" &&
    registration.payment_amount > 0
  ) {
    depositWithoutFee = Math.min(depositWithoutFee, registration.payment_amount);
  }

  // 2. Determine amount with fee
  let amountWithFee: number | null = null;
  if (depositWithoutFee !== null) {
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
    depositWithoutFee = Math.max(0, rawFallback - discounts.totalDiscount);
    amountWithFee = depositWithoutFee;
  }

  if (includeFee) {
    return amountWithFee ?? depositWithoutFee;
  }

  return depositWithoutFee;
}
