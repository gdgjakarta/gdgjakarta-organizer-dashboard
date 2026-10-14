/**
 * DOKU Payment Link Webhook contract and utility functions.
 * Integrates GDG Jakarta Dashboard with n8n Dynamic DOKU Checkout Pipeline.
 */

import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";

import { calculatePaymentGatewayFee } from "./payment-fee";

export const DEFAULT_PAYMENT_HEADER_EMAIL_URL =
  "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png";

export interface PaymentCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface PaymentEventData {
  id?: string;
  title: string;
  headerEmailUrl?: string;
  paymentDeadlineMinutes?: number;
}

export interface PaymentItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  description?: string;
  type?: "Merchandise" | "Ticket" | "Fee" | string;
}

export interface PaymentFee {
  label: string;
  type: "fixed" | "percent";
  value: number;
  desc?: string;
}

export interface PaymentOptions {
  paymentMethodTypes?: string[];
  sendEmail?: boolean;
  emailTemplate?: "Commitment Fee" | "Ticketing" | string;
}

export interface DokuPaymentLinkRequest {
  customer: PaymentCustomer;
  event: PaymentEventData;
  items: PaymentItem[];
  fees?: PaymentFee[];
  payment?: PaymentOptions;
  referenceId?: string;
  isProduction?: boolean;
  webhookUrl?: string;
}

export interface DokuPaymentLinkResponse {
  status: boolean;
  message: string;
  paymentUrl?: string;
  invoiceNumber?: string;
  amount?: number;
  expiredDatetime?: string;
  details?: unknown;
}

export interface PaymentDispatchResult {
  success: boolean;
  paymentUrl?: string;
  invoiceNumber?: string;
  amount?: number;
  expiredDatetime?: string;
  message?: string;
  error?: string;
  details?: unknown;
}

/**
 * Resolves the webhook URL for the DOKU payment link generator in n8n.
 */
export function resolvePaymentLinkWebhookUrl(customBaseUrl?: string, isProduction?: boolean): string {
  if (customBaseUrl && customBaseUrl.trim().length > 0) {
    return customBaseUrl.trim();
  }

  if (isProduction === false && process.env.N8N_PAYMENT_LINK_DEV_WEBHOOK_URL) {
    return process.env.N8N_PAYMENT_LINK_DEV_WEBHOOK_URL.trim();
  }

  if (isProduction === true && process.env.N8N_PAYMENT_LINK_PROD_WEBHOOK_URL) {
    return process.env.N8N_PAYMENT_LINK_PROD_WEBHOOK_URL.trim();
  }

  if (process.env.N8N_PAYMENT_LINK_WEBHOOK_URL) {
    return process.env.N8N_PAYMENT_LINK_WEBHOOK_URL.trim();
  }

  const base = (process.env.N8N_WEBHOOK_BASE_URL ?? "https://n8n.gdgjakarta.com/webhook/api")
    .trim()
    .replace(/\/+$/, "");

  if (base.endsWith("/generate-payment-link")) {
    return base;
  }
  if (base.endsWith("/webhook/api")) {
    return `${base}/generate-payment-link`;
  }
  if (base.endsWith("/webhook")) {
    return `${base}/api/generate-payment-link`;
  }
  if (base.endsWith("/api")) {
    return `${base.slice(0, -4)}/webhook/api/generate-payment-link`;
  }

  return `${base}/webhook/api/generate-payment-link`;
}

/**
 * Calculates the net total payable amount for a registration taking into account:
 * - payment_amount (if explicitly defined as a number)
 * - ticket price or bundle price
 * - merchandise items total
 * - voucher discount amount
 * - referral discount amount
 */
export function calculateRegistrationTotalAmount(
  registration?: Partial<FirestoreRegistration> | null,
  event?: FirestoreEvent,
): number {
  if (!registration) return 0;
  if (typeof registration.payment_amount === "number") {
    return Math.max(0, registration.payment_amount);
  }
  const ticketPrice = registration.bundle_id ? (registration.bundle_price ?? 0) : (registration.ticket_price ?? 0);
  const merchTotal = (registration.selected_merchandise ?? []).reduce(
    (acc, m) => acc + (m.price ?? 0) * (m.quantity ?? 1),
    0,
  );
  const discountTotal = (registration.voucher_discount_amount ?? 0) + (registration.referral_discount_amount ?? 0);
  const subtotal = Math.max(0, ticketPrice + merchTotal - discountTotal);
  if (registration.payment_fee_bearer === "attendee" && typeof registration.payment_fee_amount === "number") {
    return subtotal + registration.payment_fee_amount;
  }
  if (event) {
    const feeResult = calculatePaymentGatewayFee(subtotal, event);
    if (feeResult.isEnabled && feeResult.isPassedToAttendee) {
      return subtotal + feeResult.feeAmount;
    }
  }
  return subtotal;
}

/**
 * Checks whether a registration requires payment (paid ticket, commitment fee, or merchandise).
 * Returns false if the net total price is zero or free.
 */
export function hasRegistrationPaymentRequirements(registration?: Partial<FirestoreRegistration> | null): boolean {
  if (!registration) return false;
  if (calculateRegistrationTotalAmount(registration) <= 0) return false;
  const hasMerch = Boolean(registration.selected_merchandise?.some((m) => (m.price ?? 0) > 0));
  const hasPaidTicket = registration.ticket_type === "paid" && (registration.ticket_price ?? 0) > 0;
  const hasCommitmentFee = registration.ticket_type === "commitment_fee" && (registration.ticket_price ?? 0) > 0;
  const hasBundle = Boolean(registration.bundle_id && (registration.bundle_price ?? 0) > 0);

  return hasMerch || hasPaidTicket || hasCommitmentFee || hasBundle;
}

/**
 * Extracts and sanitizes the customer's WhatsApp phone number from answers and registration metadata.
 * Normalizes leading '08...' to '628...' and '+62...' to '62...'.
 */
export function extractCustomerPhone(
  registration: Partial<FirestoreRegistration>,
  answersOverride?: Record<string, unknown>,
): string {
  const ans = answersOverride ?? ((registration.answers ?? {}) as Record<string, unknown>);

  // Direct key lookup
  const candidate =
    ans.whatsapp ??
    ans.whatsapp_number ??
    ans["WhatsApp Phone Number"] ??
    ans["whatsapp phone number"] ??
    ans.phone ??
    ans.phone_number ??
    ans["Phone Number"] ??
    ans.recipientPhone ??
    ans.recipient_phone ??
    registration.member_phone ??
    (registration as unknown as Record<string, unknown>).phone ??
    "";

  let raw = typeof candidate === "string" ? candidate.trim() : "";

  // Fallback: search any answer key matching whatsapp or phone
  if (!raw) {
    for (const [key, val] of Object.entries(ans)) {
      if (typeof val === "string" && val.trim().length > 0) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("whatsapp") ||
          lowerKey.includes("phone") ||
          lowerKey.includes("telepon") ||
          lowerKey.includes("hp")
        ) {
          raw = val.trim();
          break;
        }
      }
    }
  }

  if (!raw) return "";

  let clean = raw.replace(/[\s-]/g, "");
  if (clean.startsWith("+")) {
    clean = clean.slice(1);
  }
  if (clean.startsWith("0")) {
    clean = `62${clean.slice(1)}`;
  }
  return clean;
}

/**
 * Extracts the attendee/customer full name, checking custom question responses, member metadata, and auth fallback.
 */
export function extractCustomerName(
  registration: Partial<FirestoreRegistration>,
  answersOverride?: Record<string, unknown>,
  fallbackUser?: { name?: string | null },
): string {
  const ans = answersOverride ?? ((registration.answers ?? {}) as Record<string, unknown>);
  const candidate =
    ans.full_name ??
    ans.name ??
    ans["Full Name"] ??
    ans["full name"] ??
    registration.member_name ??
    fallbackUser?.name ??
    "";
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : "Community Member";
}

/**
 * Extracts the attendee/customer email, checking custom questionnaire answers, work_email, and auth fallback.
 */
export function extractCustomerEmail(
  registration: Partial<FirestoreRegistration>,
  answersOverride?: Record<string, unknown>,
  fallbackUser?: { email?: string | null },
): string {
  const ans = answersOverride ?? ((registration.answers ?? {}) as Record<string, unknown>);
  const candidate =
    ans.email ??
    ans.work_email ??
    ans["Work Email"] ??
    ans["Email Address"] ??
    ans["email"] ??
    registration.member_email ??
    fallbackUser?.email ??
    "";
  return typeof candidate === "string" ? candidate.trim() : "";
}

/**
 * Builds the standardized DOKU payment request payload from registration and event models.
 */
export function buildRegistrationPaymentPayload(
  registration: Partial<FirestoreRegistration>,
  event: Partial<FirestoreEvent>,
  options?: {
    sendEmail?: boolean;
    paymentMethodTypes?: string[];
    paymentDeadlineMinutes?: number;
    emailTemplate?: string;
  },
): DokuPaymentLinkRequest {
  const answers = (registration.answers ?? {}) as Record<string, unknown>;
  const phoneStr = extractCustomerPhone(registration, answers);
  const nameStr = extractCustomerName(registration, answers);
  const emailStr = extractCustomerEmail(registration, answers);

  const items: PaymentItem[] = (registration.selected_merchandise ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    quantity: m.quantity || 1,
    price: m.price ?? 0,
    type: "Merchandise",
  }));

  const bundleRecord = event.bundles?.find((b) => b.id === registration.bundle_id);
  const bundleHasTicket = Boolean(bundleRecord ? bundleRecord.ticket_id : registration.ticket_price === 0);

  if (registration.bundle_id && (registration.bundle_price ?? 0) > 0) {
    items.unshift({
      id: registration.bundle_id,
      name: bundleHasTicket
        ? `${registration.bundle_name ?? "Bundling Package"} (${registration.ticket_name ?? "Event Ticket"})`
        : (registration.bundle_name ?? "Bundling Package"),
      quantity: 1,
      price: registration.bundle_price ?? 0,
      type: bundleHasTicket ? "Ticket" : "Merchandise",
    });
  }

  if (
    (!registration.bundle_id || !bundleHasTicket) &&
    registration.ticket_type === "paid" &&
    (registration.ticket_price ?? 0) > 0
  ) {
    items.unshift({
      id: registration.ticket_id ?? "ticket",
      name: registration.ticket_name ?? "Event Ticket",
      quantity: 1,
      price: registration.ticket_price ?? 0,
      type: "Ticket",
    });
  }

  // Adjust item prices if voucher or referral discount is applied
  const discountTotal = (registration.voucher_discount_amount ?? 0) + (registration.referral_discount_amount ?? 0);
  if (discountTotal > 0 && items.length > 0) {
    let remainingDiscount = discountTotal;
    for (const item of items) {
      if (remainingDiscount <= 0) break;
      const itemSubtotal = item.price * item.quantity;
      const discountToApply = Math.min(itemSubtotal, remainingDiscount);
      const newSubtotal = Math.max(0, itemSubtotal - discountToApply);
      item.price = Math.round(newSubtotal / item.quantity);
      if (registration.voucher_code) {
        item.name = `${item.name} (${registration.voucher_code})`;
      } else if (registration.referral_code) {
        item.name = `${item.name} (Ref: ${registration.referral_code})`;
      }
      remainingDiscount -= discountToApply;
    }
  }

  const fees: PaymentFee[] = [];

  // If items array is empty but registration is a commitment fee, ensure it is added to items
  if (items.length === 0 && registration.ticket_type === "commitment_fee" && (registration.ticket_price ?? 0) > 0) {
    items.push({
      name: registration.ticket_name ?? "Commitment Fee",
      quantity: 1,
      price: registration.ticket_price ?? 50000,
      type: "Ticket",
    });
  }

  // Calculate payment gateway fee based on event fee configuration
  const orderSubtotal = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const feeCalc = calculatePaymentGatewayFee(orderSubtotal, event);

  if (feeCalc.feeAmount > 0 && feeCalc.isPassedToAttendee) {
    fees.push({
      label: feeCalc.feeLabel,
      type: "fixed",
      value: feeCalc.feeAmount,
      desc: feeCalc.feeDescription,
    });
  }

  let isProduction: boolean | undefined;
  if (event.payment_environment === "production") {
    isProduction = true;
  } else if (event.payment_environment === "sandbox") {
    isProduction = false;
  }

  const emailTemplate =
    options?.emailTemplate ??
    event.payment_email_template ??
    event.paymentEmailTemplate ??
    (registration.ticket_type === "commitment_fee" ? "Commitment Fee" : "Ticketing");

  return {
    customer: {
      name: nameStr,
      email: emailStr,
      phone: phoneStr,
    },
    event: {
      id: event.id ? String(event.id) : undefined,
      title: event.title ?? registration.event_title ?? "GDG Jakarta Event",
      headerEmailUrl:
        event.headerEmailUrl?.trim() || event.header_email_url?.trim() || DEFAULT_PAYMENT_HEADER_EMAIL_URL,
      paymentDeadlineMinutes:
        options?.paymentDeadlineMinutes ??
        event.paymentDeadlinesInMinutes ??
        event.paymentDeadlineMinutes ??
        event.payment_deadline_minutes ??
        1440,
    },
    items:
      items.length > 0
        ? items
        : [
            {
              name: "Commitment Fee",
              quantity: 1,
              price: 50000,
              type: "Ticket",
            },
          ],
    fees,
    payment: {
      paymentMethodTypes: options?.paymentMethodTypes ?? ["QRIS"],
      sendEmail: options?.sendEmail ?? true,
      emailTemplate,
    },
    referenceId: registration.id ?? `REG-${Date.now()}`,
    isProduction,
    webhookUrl: event.payment_webhook_url ?? undefined,
  };
}
