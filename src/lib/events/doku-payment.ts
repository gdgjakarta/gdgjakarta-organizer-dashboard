/**
 * DOKU Payment Link Webhook contract and utility functions.
 * Integrates GDG Jakarta Dashboard with n8n Dynamic DOKU Checkout Pipeline.
 */

import type { FirestoreEvent, FirestoreRegistration, RegistrationStatusLog } from "@/lib/firestore/types";
import { assertSafeWebhookUrl } from "@/lib/security/webhook-validator";

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
  requestId?: string;
  isProduction?: boolean;
}

export interface DokuPaymentLinkResponse {
  status: boolean;
  message: string;
  paymentUrl?: string;
  invoiceNumber?: string;
  requestId?: string;
  amount?: number;
  expiredDatetime?: string;
  details?: unknown;
}

export interface PaymentDispatchResult {
  success: boolean;
  paymentUrl?: string;
  invoiceNumber?: string;
  requestId?: string;
  amount?: number;
  expiredDatetime?: string;
  message?: string;
  error?: string;
  details?: unknown;
}

export interface DokuCancelOrderRequest {
  invoiceNumber: string;
  originalRequestId?: string;
  requestId?: string;
  reason?: string;
  customer?: Partial<PaymentCustomer>;
  event?: Partial<PaymentEventData>;
  referenceId?: string;
  isProduction?: boolean;
}

export interface DokuCancelOrderResponse {
  status: boolean;
  message: string;
  invoiceNumber?: string;
  details?: unknown;
}

export interface CancelOrderDispatchResult {
  success: boolean;
  invoiceNumber?: string;
  message?: string;
  error?: string;
  details?: unknown;
}

export interface DokuCheckStatusResponse {
  order?: {
    invoice_number?: string;
    amount?: number;
    status?: "ORDER_GENERATED" | "ORDER_EXPIRED" | "ORDER_RECOVERED" | "SUCCESS" | "PAID" | string;
    date?: string;
    tips?: number;
    terminal_id?: string;
  };
  transaction?: {
    status?: "SUCCESS" | "PENDING" | "FAILED" | "EXPIRED" | "PAID" | string;
    date?: string;
    original_request_id?: string;
  };
  service?: {
    id?: string | null;
    name?: string | null;
  };
  acquirer?: {
    id?: string | null;
    name?: string | null;
  };
  channel?: {
    id?: string | null;
    name?: string | null;
  };
  issuer?: {
    id?: string | null;
    name?: string | null;
  };
  customer?: {
    doku_id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  merchant?: {
    name?: string;
    pan?: string;
  };
  emoney_payment?: {
    account_id?: string;
    approval_code?: string;
  };
  additional_info?: {
    line_items?: Array<{
      sku?: string;
      name?: string;
      type?: string;
      price?: string | number;
      quantity?: number;
      image_url?: string;
    }>;
  };
  error?: {
    message?: string;
    code?: string;
  };
}

export interface DokuNotificationPayload {
  service?: {
    id: string;
    name: string;
  };
  acquirer?: {
    id: string;
    name: string;
  };
  issuer?: {
    id: string;
    name: string;
  };
  channel?: {
    id: string;
    name: string;
  };
  customer?: {
    doku_id?: string;
    name: string;
    email: string;
    phone: string;
  };
  merchant?: {
    name: string;
    pan?: string;
  };
  order: {
    invoice_number: string;
    amount: number;
    tips?: number;
    terminal_id?: string;
  };
  emoney_payment?: {
    account_id?: string;
    approval_code?: string;
  };
  transaction: {
    status: "SUCCESS" | "FAILED" | "PENDING" | "EXPIRED" | string;
    date: string;
    original_request_id?: string;
  };
  additional_info?: {
    line_items?: Array<{
      sku?: string;
      name?: string;
      type?: string;
      price?: string | number;
      quantity?: number;
      image_url?: string;
    }>;
  };
}

export interface DokuStatusCheckResult {
  success: boolean;
  isPaid: boolean;
  invoiceNumber: string;
  dokuStatus: "SUCCESS" | "PENDING" | "ORDER_EXPIRED" | "FAILED" | "UNKNOWN" | string;
  amount?: number;
  paymentChannel?: string;
  paidAt?: string;
  approvalCode?: string;
  dokuResponse?: DokuCheckStatusResponse | unknown;
  n8nDispatched?: boolean;
  n8nResult?: unknown;
  statusLogs?: RegistrationStatusLog[];
  logEntry?: RegistrationStatusLog;
  message: string;
  error?: string;
}

/**
 * Resolves the webhook URL for the DOKU payment link generator in n8n.
 */
export function resolvePaymentLinkWebhookUrl(customBaseUrl?: string, isProduction?: boolean): string {
  const defaultFallback = "https://n8n.gdgjakarta.com/webhook/api/generate-payment-link";

  if (customBaseUrl && customBaseUrl.trim().length > 0) {
    const safeCustom = assertSafeWebhookUrl(customBaseUrl, "");
    if (safeCustom) {
      return safeCustom;
    }
  }

  let targetUrl = "";
  if (isProduction === false && process.env.N8N_PAYMENT_LINK_DEV_WEBHOOK_URL) {
    targetUrl = process.env.N8N_PAYMENT_LINK_DEV_WEBHOOK_URL.trim();
  } else if (isProduction === true && process.env.N8N_PAYMENT_LINK_PROD_WEBHOOK_URL) {
    targetUrl = process.env.N8N_PAYMENT_LINK_PROD_WEBHOOK_URL.trim();
  } else if (process.env.N8N_PAYMENT_LINK_WEBHOOK_URL) {
    targetUrl = process.env.N8N_PAYMENT_LINK_WEBHOOK_URL.trim();
  } else {
    const base = (process.env.N8N_WEBHOOK_BASE_URL ?? "https://n8n.gdgjakarta.com/webhook/api")
      .trim()
      .replace(/\/+$/, "");

    if (base.endsWith("/generate-payment-link")) {
      targetUrl = base;
    } else if (base.endsWith("/webhook/api")) {
      targetUrl = `${base}/generate-payment-link`;
    } else if (base.endsWith("/webhook")) {
      targetUrl = `${base}/api/generate-payment-link`;
    } else if (base.endsWith("/api")) {
      targetUrl = `${base.slice(0, -4)}/webhook/api/generate-payment-link`;
    } else {
      targetUrl = `${base}/webhook/api/generate-payment-link`;
    }
  }

  return assertSafeWebhookUrl(targetUrl, defaultFallback);
}

/**
 * Resolves the payment gateway execution environment (production vs sandbox).
 * Strictly honors the event's or registration's configured payment gateway environment,
 * never defaulting to process.env.NODE_ENV.
 */
export function resolvePaymentEnvironment(
  event?: Partial<FirestoreEvent> | null,
  registration?: Partial<FirestoreRegistration> | null,
  explicitIsProduction?: boolean,
): boolean {
  if (explicitIsProduction !== undefined) {
    return explicitIsProduction;
  }
  const configuredEnv = event?.payment_environment ?? registration?.payment_environment;
  if (configuredEnv === "production") return true;
  if (configuredEnv === "sandbox") return false;

  if (event?.is_test !== undefined) {
    return !event.is_test;
  }
  // Default to production for payment operations if not explicitly sandbox
  return true;
}

/**
 * Resolves the webhook URL for the DOKU cancel order API in n8n.
 */
export function resolveCancelPaymentLinkWebhookUrl(customBaseUrl?: string, isProduction?: boolean): string {
  const defaultFallback = "https://n8n.gdgjakarta.com/webhook/api/cancel-payment-link";

  if (customBaseUrl && customBaseUrl.trim().length > 0) {
    const safeCustom = assertSafeWebhookUrl(customBaseUrl, "");
    if (safeCustom) {
      return safeCustom;
    }
  }

  let targetUrl = "";
  if (isProduction === false && process.env.N8N_CANCEL_PAYMENT_LINK_DEV_WEBHOOK_URL) {
    targetUrl = process.env.N8N_CANCEL_PAYMENT_LINK_DEV_WEBHOOK_URL.trim();
  } else if (isProduction === true && process.env.N8N_CANCEL_PAYMENT_LINK_PROD_WEBHOOK_URL) {
    targetUrl = process.env.N8N_CANCEL_PAYMENT_LINK_PROD_WEBHOOK_URL.trim();
  } else if (process.env.N8N_CANCEL_PAYMENT_LINK_WEBHOOK_URL) {
    targetUrl = process.env.N8N_CANCEL_PAYMENT_LINK_WEBHOOK_URL.trim();
  } else {
    const base = (process.env.N8N_WEBHOOK_BASE_URL ?? "https://n8n.gdgjakarta.com/webhook/api")
      .trim()
      .replace(/\/+$/, "");

    if (base.endsWith("/cancel-payment-link")) {
      targetUrl = base;
    } else if (base.endsWith("/generate-payment-link")) {
      targetUrl = `${base.slice(0, -"/generate-payment-link".length)}/cancel-payment-link`;
    } else if (base.endsWith("/webhook/api")) {
      targetUrl = `${base}/cancel-payment-link`;
    } else if (base.endsWith("/webhook")) {
      targetUrl = `${base}/api/cancel-payment-link`;
    } else if (base.endsWith("/api")) {
      targetUrl = `${base.slice(0, -4)}/webhook/api/cancel-payment-link`;
    } else {
      targetUrl = `${base}/webhook/api/cancel-payment-link`;
    }
  }

  return assertSafeWebhookUrl(targetUrl, defaultFallback);
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
  customQuestions?: Array<{ id: string; label?: string }>,
): string {
  const ans = answersOverride ?? ((registration.answers ?? {}) as Record<string, unknown>);

  // Direct key lookup
  const candidate =
    ans.whatsapp ??
    ans.whatsapp_number ??
    ans["WhatsApp Phone Number"] ??
    ans["whatsapp phone number"] ??
    ans["Nomor WhatsApp"] ??
    ans["Nomor WhatsApp (Aktif)"] ??
    ans["No. WhatsApp"] ??
    ans["No WhatsApp"] ??
    ans.nomor_whatsapp ??
    ans.phone ??
    ans.phone_number ??
    ans["Phone Number"] ??
    ans.no_hp ??
    ans.no_wa ??
    ans["Nomor HP"] ??
    ans["No HP"] ??
    ans["No. HP"] ??
    ans.nomor_hp ??
    ans.mobile ??
    ans.mobile_phone ??
    ans.cell_phone ??
    ans.telepon ??
    ans.handphone ??
    ans.recipientPhone ??
    ans.recipient_phone ??
    registration.member_phone ??
    (registration as unknown as Record<string, unknown>).phone ??
    (registration as unknown as Record<string, unknown>).mobile_phone ??
    (registration as unknown as Record<string, unknown>).mobile ??
    "";

  let raw = candidate != null ? String(candidate).trim() : "";

  // Fallback: match via custom questions labels
  if (!raw && customQuestions && customQuestions.length > 0) {
    for (const q of customQuestions) {
      const qLabel = (q.label || "").toLowerCase();
      if (
        qLabel.includes("whatsapp") ||
        qLabel.includes("phone") ||
        qLabel.includes("telepon") ||
        qLabel.includes("hp") ||
        qLabel.includes("nomor") ||
        qLabel.includes("mobile") ||
        qLabel.includes("wa") ||
        qLabel.includes("handphone")
      ) {
        const val = ans[q.id];
        if (val != null) {
          const strVal = String(val).trim();
          if (strVal) {
            raw = strVal;
            break;
          }
        }
      }
    }
  }

  // Fallback: search any answer key matching whatsapp or phone
  if (!raw) {
    for (const [key, val] of Object.entries(ans)) {
      if (val != null) {
        const strVal = String(val).trim();
        if (!strVal) continue;
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("whatsapp") ||
          lowerKey.includes("phone") ||
          lowerKey.includes("telepon") ||
          lowerKey.includes("hp") ||
          lowerKey.includes("nomor") ||
          lowerKey.includes("mobile") ||
          lowerKey.includes("wa") ||
          lowerKey.includes("handphone")
        ) {
          raw = strVal;
          break;
        }
      }
    }
  }

  // Fallback: search any value in answers that looks like an Indonesian or international phone number
  if (!raw) {
    for (const [key, val] of Object.entries(ans)) {
      if (key === "session_id" || key === "session_title" || key === "session" || key === "bevy_user_id") continue;
      if (val != null) {
        const strVal = String(val).trim();
        const digits = strVal.replace(/[^0-9]/g, "");
        if (
          (strVal.startsWith("+62") ||
            strVal.startsWith("62") ||
            strVal.startsWith("08") ||
            (strVal.startsWith("8") && digits.length >= 9)) &&
          digits.length >= 8 &&
          digits.length <= 15
        ) {
          raw = strVal;
          break;
        }
      }
    }
  }

  if (!raw) return "";

  let clean = raw.replace(/[\s\-\(\)\.]/g, "");
  if (clean.startsWith("+")) {
    clean = clean.slice(1);
  }
  if (clean.startsWith("08")) {
    clean = `628${clean.slice(2)}`;
  } else if (clean.startsWith("0")) {
    clean = `62${clean.slice(1)}`;
  } else if (clean.startsWith("8") && clean.length >= 9 && clean.length <= 14) {
    clean = `62${clean}`;
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
    ans.email ??
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
    requestId?: string;
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

  // Check if attendee voluntarily agreed to cover fee or if fee is passed
  const attendeeAgreedToCover =
    registration.payment_fee_voluntary_covered !== undefined
      ? registration.payment_fee_voluntary_covered
      : registration.payment_fee_bearer !== "organizer";

  const isFeeCoveredByAttendee =
    feeCalc.isPassedToAttendee && attendeeAgreedToCover && registration.payment_fee_bearer !== "organizer";

  if (feeCalc.feeAmount > 0 && isFeeCoveredByAttendee) {
    fees.push({
      label: feeCalc.feeLabel,
      type: "fixed",
      value: feeCalc.feeAmount,
      desc: feeCalc.feeDescription,
    });
  }

  const isProduction = resolvePaymentEnvironment(event, registration);

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
    requestId:
      options?.requestId ?? registration.payment_request_id ?? `REQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    isProduction,
  };
}

/**
 * Builds the DOKU Cancel Order payload from registration and event models.
 */
export function buildCancelPaymentPayload(
  registration: Partial<FirestoreRegistration>,
  event?: Partial<FirestoreEvent> | null,
  reason = "Cancelled order via GDG Jakarta Dashboard",
): DokuCancelOrderRequest {
  const answers = (registration.answers ?? {}) as Record<string, unknown>;
  const invoiceNumber =
    registration.payment_invoice_number ??
    (typeof answers.payment_invoice_number === "string" ? answers.payment_invoice_number : undefined) ??
    (typeof answers.invoice_number === "string" ? answers.invoice_number : undefined) ??
    "";

  const isProduction = resolvePaymentEnvironment(event, registration);

  const rawRequestId =
    (registration.payment_request_id && registration.payment_request_id.trim().length > 0
      ? registration.payment_request_id.trim()
      : undefined) ??
    (typeof answers.payment_request_id === "string" && answers.payment_request_id.trim().length > 0
      ? answers.payment_request_id.trim()
      : undefined) ??
    (typeof answers.requestId === "string" && answers.requestId.trim().length > 0
      ? answers.requestId.trim()
      : undefined) ??
    (invoiceNumber ? `REQ-${invoiceNumber}` : `REQ-${Date.now()}`);

  return {
    invoiceNumber,
    originalRequestId: rawRequestId,
    requestId: rawRequestId,
    reason,
    customer: {
      name: extractCustomerName(registration, answers),
      email: extractCustomerEmail(registration, answers),
      phone: extractCustomerPhone(registration, answers),
    },
    event: {
      id: event?.id ? String(event.id) : registration.event_id,
      title: event?.title ?? registration.event_title ?? "GDG Jakarta Event",
    },
    referenceId: registration.id,
    isProduction,
  };
}

/**
 * Resolves the n8n webhook URL for DOKU HTTP notifications.
 */
export function resolveDokuNotificationWebhookUrl(customBaseUrl?: string): string {
  const defaultFallback = "https://n8n.gdgjakarta.com/webhook/payment/doku/notifications";

  if (customBaseUrl && customBaseUrl.trim().length > 0) {
    const safeCustom = assertSafeWebhookUrl(customBaseUrl, "");
    if (safeCustom) {
      return safeCustom;
    }
  }

  if (process.env.N8N_DOKU_NOTIFICATION_WEBHOOK_URL) {
    return assertSafeWebhookUrl(process.env.N8N_DOKU_NOTIFICATION_WEBHOOK_URL.trim(), defaultFallback);
  }

  return defaultFallback;
}

/**
 * Evaluates whether a DOKU check status API response represents a successful/paid transaction.
 */
export function isDokuPaymentSuccess(res?: DokuCheckStatusResponse | null): boolean {
  if (!res) return false;
  const txStatus = res.transaction?.status?.toUpperCase()?.trim();
  const orderStatus = res.order?.status?.toUpperCase()?.trim();
  return txStatus === "SUCCESS" || txStatus === "PAID" || orderStatus === "SUCCESS" || orderStatus === "PAID";
}
