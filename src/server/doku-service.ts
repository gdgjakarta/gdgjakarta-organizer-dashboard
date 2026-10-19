import type { DokuCheckStatusResponse, DokuNotificationPayload } from "@/lib/events/doku-payment";
import type { FirestoreRegistration } from "@/lib/firestore/types";

import { createHash, createHmac, randomUUID } from "node:crypto";

export interface DokuCredentials {
  clientId: string;
  secretKey: string;
  baseUrl: string;
  isProduction: boolean;
}

/**
 * Resolves DOKU API credentials and endpoint base URL for the given environment.
 */
export function resolveDokuCredentials(isProduction?: boolean): DokuCredentials {
  const prod = isProduction ?? process.env.NODE_ENV === "production";

  if (prod) {
    const prodSecret =
      process.env.DOKU_PROD_SECRET_KEY?.trim() ||
      process.env.DOKU_SECRET_KEY?.trim() ||
      process.env.PAYMENT_WEBHOOK_SECRET?.trim() ||
      "";
    if (!prodSecret) {
      console.error("[DOKU Service] CRITICAL: Missing DOKU production secret key in environment variables.");
    }
    return {
      clientId: process.env.DOKU_PROD_CLIENT_ID?.trim() || process.env.DOKU_CLIENT_ID?.trim() || "",
      secretKey: prodSecret,
      baseUrl: process.env.DOKU_PROD_BASE_URL?.trim() || process.env.DOKU_BASE_URL?.trim() || "https://api.doku.com",
      isProduction: true,
    };
  }

  const devSecret =
    process.env.DOKU_DEV_SECRET_KEY?.trim() ||
    process.env.DOKU_SECRET_KEY?.trim() ||
    process.env.PAYMENT_WEBHOOK_SECRET?.trim() ||
    "";
  if (!devSecret) {
    console.warn("[DOKU Service] Warning: Missing DOKU development secret key in environment variables.");
  }
  return {
    clientId: process.env.DOKU_DEV_CLIENT_ID?.trim() || process.env.DOKU_CLIENT_ID?.trim() || "",
    secretKey: devSecret,
    baseUrl: process.env.DOKU_DEV_BASE_URL?.trim() || "https://api-sandbox.doku.com",
    isProduction: false,
  };
}
/**
 * Computes HMAC-SHA256 signature for DOKU HTTP headers.
 */
export function generateDokuSignature(component: string, secretKey: string): string {
  const hmac = createHmac("sha256", secretKey).update(component).digest("base64");
  return `HMACSHA256=${hmac}`;
}

/**
 * Computes SHA-256 digest in Base64 for DOKU POST requests.
 */
export function generateDokuDigest(bodyJson: string): string {
  return createHash("sha256").update(bodyJson).digest("base64");
}

/**
 * Constructs URL and headers for DOKU Check Status API (GET /orders/v1/status/{invoiceNumber}).
 */
export function buildDokuCheckStatusHeaders(
  invoiceNumber: string,
  options?: {
    isProduction?: boolean;
    requestId?: string;
    timestamp?: string;
  },
): { url: string; headers: Record<string, string>; requestId: string; timestamp: string } {
  const creds = resolveDokuCredentials(options?.isProduction);
  const cleanInvoice = invoiceNumber.trim();
  const requestId = options?.requestId?.trim() || randomUUID();
  const timestamp = options?.timestamp?.trim() || `${new Date().toISOString().slice(0, 19)}Z`;
  const requestTarget = `/orders/v1/status/${cleanInvoice}`;

  // Signature component for GET request (no Digest, newline-separated)
  const signatureComponent = `Client-Id:${creds.clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${requestTarget}`;
  const signature = generateDokuSignature(signatureComponent, creds.secretKey);

  const headers: Record<string, string> = {
    "Client-Id": creds.clientId,
    "Request-Id": requestId,
    "Request-Timestamp": timestamp,
    Signature: signature,
    "Content-Type": "application/json",
    "User-Agent": "GDG-Jakarta-Dashboard/1.0",
  };

  return {
    url: `${creds.baseUrl}${requestTarget}`,
    headers,
    requestId,
    timestamp,
  };
}

/**
 * Constructs headers and signed body for DOKU notification POST to n8n.
 */
export function buildDokuNotificationHeaders(
  body: unknown,
  options?: {
    isProduction?: boolean;
    requestId?: string;
    timestamp?: string;
    targetPath?: string;
  },
): { headers: Record<string, string>; rawBody: string; requestId: string; timestamp: string } {
  const creds = resolveDokuCredentials(options?.isProduction);
  const rawBody = typeof body === "string" ? body : JSON.stringify(body);
  const requestId = options?.requestId?.trim() || randomUUID();
  const timestamp = options?.timestamp?.trim() || `${new Date().toISOString().slice(0, 19)}Z`;
  const targetPath = options?.targetPath ?? "/webhook/payment/doku/notifications";

  const digest = generateDokuDigest(rawBody);

  // Component according to DOKU HTTP notification standard
  const signatureComponent = `Client-Id:${creds.clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${targetPath}\nDigest:${digest}`;
  const signature = generateDokuSignature(signatureComponent, creds.secretKey);

  const headers: Record<string, string> = {
    "Client-Id": creds.clientId,
    "Request-Id": requestId,
    "Request-Timestamp": timestamp,
    Signature: signature,
    "Content-Type": "application/json",
    Digest: digest,
    "User-Agent": "GDG-Jakarta-Dashboard/1.0",
  };

  return {
    headers,
    rawBody,
    requestId,
    timestamp,
  };
}

/**
 * Harmonizes a DOKU check status response with registration customer info into a standard notification payload.
 */
export function buildNotificationPayloadFromCheckStatus(
  dokuRes: DokuCheckStatusResponse,
  invoiceNumber: string,
  registration?: Partial<FirestoreRegistration> | null,
): DokuNotificationPayload {
  const answers = (registration?.answers ?? {}) as Record<string, unknown>;

  const customerName =
    dokuRes.customer?.name?.trim() ||
    registration?.member_name ||
    (typeof answers.full_name === "string" ? answers.full_name : "") ||
    "Attendee";

  const customerEmail =
    dokuRes.customer?.email?.trim() ||
    registration?.member_email ||
    (typeof answers.email === "string" ? answers.email : "") ||
    "";

  const customerPhone =
    dokuRes.customer?.phone?.trim() ||
    registration?.member_phone ||
    (typeof answers.whatsapp === "string" ? answers.whatsapp : "") ||
    (typeof answers.phone === "string" ? answers.phone : "") ||
    "";

  let amount = 0;
  if (typeof dokuRes.order?.amount === "number") {
    amount = dokuRes.order.amount;
  } else if (typeof registration?.payment_amount === "number") {
    amount = registration.payment_amount;
  }

  const now = `${new Date().toISOString().slice(0, 19)}Z`;

  // Build line items if missing from DOKU response
  let lineItems = dokuRes.additional_info?.line_items;
  if (!lineItems || lineItems.length === 0) {
    lineItems = [];
    if (registration?.ticket_name) {
      lineItems.push({
        sku: "TICKET-1",
        name: registration.ticket_name,
        type: "Ticket",
        price: String(registration.ticket_price ?? amount),
        quantity: 1,
        image_url: "",
      });
    }
    if (registration?.selected_merchandise && registration.selected_merchandise.length > 0) {
      for (const m of registration.selected_merchandise) {
        lineItems.push({
          sku: m.id ?? "MERCH",
          name: m.name,
          type: "Merchandise",
          price: String(m.price ?? 0),
          quantity: m.quantity ?? 1,
          image_url: "",
        });
      }
    }
  }

  return {
    service: {
      id: dokuRes.service?.id ?? "QRIS",
      name: dokuRes.service?.name ?? "QRIS",
    },
    acquirer: {
      id: dokuRes.acquirer?.id ?? "93600899",
      name: dokuRes.acquirer?.name ?? "DOKU",
    },
    issuer: {
      id: dokuRes.issuer?.id ?? "93600899",
      name: dokuRes.issuer?.name ?? "DOKU",
    },
    channel: {
      id: dokuRes.channel?.id ?? "QRIS_DOKU",
      name: dokuRes.channel?.name ?? "QRIS-DOKU",
    },
    customer: {
      doku_id: dokuRes.customer?.doku_id ?? "",
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
    },
    merchant: {
      name: dokuRes.merchant?.name ?? "GDG Jakarta",
      pan: dokuRes.merchant?.pan ?? "936008990000083603",
    },
    order: {
      invoice_number: dokuRes.order?.invoice_number ?? invoiceNumber,
      amount,
      tips: dokuRes.order?.tips ?? 0,
      terminal_id: dokuRes.order?.terminal_id ?? "A01",
    },
    emoney_payment: {
      account_id: dokuRes.emoney_payment?.account_id ?? "",
      approval_code: dokuRes.emoney_payment?.approval_code ?? "",
    },
    transaction: {
      status: dokuRes.transaction?.status?.toUpperCase() ?? "SUCCESS",
      date: dokuRes.transaction?.date ?? dokuRes.order?.date ?? now,
      original_request_id:
        dokuRes.transaction?.original_request_id ?? registration?.payment_request_id ?? `REQ-${invoiceNumber}`,
    },
    additional_info: {
      line_items: lineItems,
    },
  };
}
