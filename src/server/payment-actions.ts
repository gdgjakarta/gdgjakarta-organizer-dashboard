"use server";

import { z } from "zod";

import {
  type CancelOrderDispatchResult,
  DEFAULT_PAYMENT_HEADER_EMAIL_URL,
  type DokuCancelOrderRequest,
  type DokuCancelOrderResponse,
  type DokuCheckStatusResponse,
  type DokuPaymentLinkRequest,
  type DokuPaymentLinkResponse,
  type DokuStatusCheckResult,
  isDokuPaymentSuccess,
  type PaymentDispatchResult,
  resolveCancelPaymentLinkWebhookUrl,
  resolveDokuNotificationWebhookUrl,
  resolvePaymentLinkWebhookUrl,
} from "@/lib/events/doku-payment";
import { assertSafeWebhookUrl } from "@/lib/security/webhook-validator";
import { extractApiMessage } from "@/lib/utils";
import {
  buildDokuCheckStatusHeaders,
  buildDokuNotificationHeaders,
  buildNotificationPayloadFromCheckStatus,
} from "@/server/doku-service";
import { findRegistrationDoc, updateRegistrationFromPayment } from "@/server/firestore-admin";
import { revalidateDashboardPath } from "@/server/server-actions";

const paymentItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Item name is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  price: z.number().min(0, "Price must be non-negative"),
  imageUrl: z.string().optional(),
  description: z.string().optional(),
  type: z.string().optional().default("Merchandise"),
});

const paymentFeeSchema = z.object({
  label: z.string().min(1, "Fee label is required"),
  type: z.enum(["fixed", "percent"]),
  value: z.number().min(0, "Fee value must be non-negative"),
  desc: z.string().optional(),
});

const dokuPaymentRequestSchema = z.object({
  customer: z.object({
    name: z.string().min(1, "Customer name is required"),
    email: z.string().email("Valid customer email is required"),
    phone: z.string().min(1, "Customer phone number is required"),
  }),
  event: z.object({
    id: z.string().optional(),
    title: z.string().min(1, "Event title is required"),
    headerEmailUrl: z
      .string()
      .optional()
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : DEFAULT_PAYMENT_HEADER_EMAIL_URL)),
    paymentDeadlineMinutes: z.number().int().positive().optional().default(1440),
  }),
  items: z.array(paymentItemSchema).min(1, "At least one item is required"),
  fees: z.array(paymentFeeSchema).optional(),
  payment: z
    .object({
      paymentMethodTypes: z.array(z.string()).optional().default(["QRIS"]),
      sendEmail: z.boolean().optional().default(true),
      emailTemplate: z.string().optional(),
    })
    .optional(),
  referenceId: z.string().optional(),
  requestId: z.string().optional(),
  isProduction: z.boolean().optional(),
});

export type DokuPaymentRequestInput = z.input<typeof dokuPaymentRequestSchema>;

/**
 * Server Action: Generates a DOKU payment link via the GDG Jakarta n8n Webhook API.
 * Dispatches to /webhook/api/generate-payment-link with HMAC / Header Authentication.
 */
export async function generatePaymentLinkAction(input: DokuPaymentRequestInput): Promise<PaymentDispatchResult> {
  const parsed = dokuPaymentRequestSchema.safeParse(input);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error: errorMsg };
  }

  const isProduction =
    parsed.data.isProduction !== undefined ? parsed.data.isProduction : process.env.NODE_ENV === "production";

  const itemsTotal = parsed.data.items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const feesTotal = (parsed.data.fees ?? []).reduce((acc, f) => {
    if (f.type === "fixed") return acc + f.value;
    if (f.type === "percent") return acc + Math.round((itemsTotal * f.value) / 100);
    return acc;
  }, 0);
  const totalAmount = itemsTotal + feesTotal;

  if (totalAmount <= 0) {
    console.log(
      `[DOKU Payment Action] Skipped generate payment link for ${parsed.data.customer.email}: Total amount is Rp 0 or free.`,
    );
    return {
      success: false,
      error: "Payment link cannot be generated for zero or free total amount.",
    };
  }

  const webhookUrl = assertSafeWebhookUrl(
    resolvePaymentLinkWebhookUrl(undefined, isProduction),
    "https://n8n.gdgjakarta.com/webhook/api/generate-payment-link",
  );
  const apiKey =
    process.env.N8N_PAYMENT_LINK_API_KEY || process.env.N8N_WEBHOOK_API_KEY || process.env.N8N_AUTH_SECRET || "";

  console.log(
    `[DOKU Payment Action] POST ${webhookUrl} (mode: ${isProduction ? "production" : "sandbox"}) for ${parsed.data.customer.email}...`,
  );

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "GDG-Jakarta-Dashboard/1.0",
    };

    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const payload: DokuPaymentLinkRequest = {
      customer: parsed.data.customer,
      event: parsed.data.event,
      items: parsed.data.items,
      fees: parsed.data.fees,
      payment: parsed.data.payment,
      referenceId: parsed.data.referenceId,
      requestId: parsed.data.requestId,
      isProduction,
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    let responseData: DokuPaymentLinkResponse | null = null;

    try {
      responseData = JSON.parse(responseText) as DokuPaymentLinkResponse;
    } catch {
      // response might not be valid JSON
    }

    if (!response.ok) {
      const errorMsg = responseData?.message ?? `n8n webhook error: HTTP ${response.status} ${response.statusText}`;
      console.error(`[DOKU Payment Action] Failed (HTTP ${response.status}):`, responseText);
      return {
        success: false,
        error: errorMsg,
        details: responseData ?? responseText,
      };
    }

    if (responseData && responseData.status === false) {
      return {
        success: false,
        error: responseData.message ? responseData.message : "Failed to generate payment link via DOKU.",
        details: responseData,
      };
    }

    const rawRes = responseData as Record<string, unknown> | null;
    const resolvedReqId =
      (typeof rawRes?.requestId === "string" && rawRes.requestId.trim()) ||
      (typeof rawRes?.originalRequestId === "string" && rawRes.originalRequestId.trim()) ||
      (typeof rawRes?.request_id === "string" && rawRes.request_id.trim()) ||
      (typeof rawRes?.original_request_id === "string" && rawRes.original_request_id.trim()) ||
      parsed.data.requestId;

    return {
      success: true,
      paymentUrl: responseData?.paymentUrl,
      invoiceNumber: responseData?.invoiceNumber,
      requestId: resolvedReqId,
      amount: responseData?.amount,
      expiredDatetime: responseData?.expiredDatetime,
      message: responseData?.message ?? "Payment link generated successfully.",
      details: responseData,
    };
  } catch (err: unknown) {
    console.error("[DOKU Payment Action] Network / Dispatch error:", err);
    const errorMsg = extractApiMessage(err, "Failed to connect to n8n payment webhook.");
    return {
      success: false,
      error: errorMsg,
      details: err,
    };
  }
}

const dokuCancelOrderRequestSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  originalRequestId: z.string().optional(),
  requestId: z.string().optional(),
  reason: z.string().optional(),
  customer: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  event: z
    .object({
      id: z.string().optional(),
      title: z.string().optional(),
    })
    .optional(),
  referenceId: z.string().optional(),
  isProduction: z.boolean().optional(),
});

export type DokuCancelOrderRequestInput = z.input<typeof dokuCancelOrderRequestSchema>;

/**
 * Server Action: Cancels an active DOKU checkout order via the GDG Jakarta n8n Webhook API.
 * Dispatches to /webhook/api/cancel-payment-link with HMAC / Header Authentication.
 */
export async function cancelPaymentLinkAction(input: DokuCancelOrderRequestInput): Promise<CancelOrderDispatchResult> {
  const parsed = dokuCancelOrderRequestSchema.safeParse(input);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error: errorMsg };
  }

  const isProduction =
    parsed.data.isProduction !== undefined ? parsed.data.isProduction : process.env.NODE_ENV === "production";

  const webhookUrl = assertSafeWebhookUrl(
    resolveCancelPaymentLinkWebhookUrl(undefined, isProduction),
    "https://n8n.gdgjakarta.com/webhook/api/cancel-payment-link",
  );
  const apiKey =
    process.env.N8N_PAYMENT_LINK_API_KEY || process.env.N8N_WEBHOOK_API_KEY || process.env.N8N_AUTH_SECRET || "";

  console.log(
    `[DOKU Cancel Payment Action] POST ${webhookUrl} (mode: ${isProduction ? "production" : "sandbox"}) for invoice ${parsed.data.invoiceNumber}...`,
  );

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "GDG-Jakarta-Dashboard/1.0",
    };

    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const resolvedRequestId =
      parsed.data.originalRequestId?.trim() || parsed.data.requestId?.trim() || `REQ-${parsed.data.invoiceNumber}`;

    const payload: DokuCancelOrderRequest & { requestId: string } = {
      invoiceNumber: parsed.data.invoiceNumber,
      originalRequestId: resolvedRequestId,
      requestId: resolvedRequestId,
      reason: parsed.data.reason ?? "Cancelled order via GDG Jakarta Dashboard",
      customer: parsed.data.customer,
      event: parsed.data.event,
      referenceId: parsed.data.referenceId,
      isProduction,
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    let responseData: DokuCancelOrderResponse | null = null;

    try {
      responseData = JSON.parse(responseText) as DokuCancelOrderResponse;
    } catch {
      // response might not be valid JSON
    }

    if (!response.ok) {
      const errorMsg = responseData?.message ?? `n8n webhook error: HTTP ${response.status} ${response.statusText}`;
      console.error(`[DOKU Cancel Payment Action] Failed (HTTP ${response.status}):`, responseText);
      return {
        success: false,
        error: errorMsg,
        details: responseData ?? responseText,
      };
    }

    if (responseData && responseData.status === false) {
      return {
        success: false,
        error: responseData.message ? responseData.message : "Failed to cancel order via DOKU.",
        details: responseData,
      };
    }

    return {
      success: true,
      invoiceNumber: responseData?.invoiceNumber ?? parsed.data.invoiceNumber,
      message: responseData?.message ?? "Order cancelled successfully.",
      details: responseData,
    };
  } catch (err: unknown) {
    console.error("[DOKU Cancel Payment Action] Network / Dispatch error:", err);
    const errorMsg = extractApiMessage(err, "Failed to connect to n8n cancel payment webhook.");
    return {
      success: false,
      error: errorMsg,
      details: err,
    };
  }
}

const checkPaymentStatusInputSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  eventId: z.string().optional(),
  registrationId: z.string().optional(),
  isProduction: z.boolean().optional(),
});

export type CheckPaymentStatusInput = z.input<typeof checkPaymentStatusInputSchema>;

/**
 * Server Action: Queries DOKU's Check Status API (GET /orders/v1/status/{invoiceNumber}).
 * If the transaction is confirmed SUCCESS / PAID:
 * 1. Dispatches DOKU HTTP notification to n8n (/webhook/payment/doku/notifications).
 * 2. Updates Firestore registration status to "paid_and_registered" and marks payment as "paid".
 * 3. Revalidates dashboard paths.
 */
export async function checkDokuPaymentStatusAction(input: CheckPaymentStatusInput): Promise<DokuStatusCheckResult> {
  const parsed = checkPaymentStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return {
      success: false,
      isPaid: false,
      invoiceNumber: input.invoiceNumber || "",
      dokuStatus: "ERROR",
      message: errorMsg,
      error: errorMsg,
    };
  }

  const { invoiceNumber, eventId } = parsed.data;

  // Resolve attendee & event info from Firestore if available
  let existingRegistration: Partial<FirestoreRegistration> | null = null;
  try {
    const doc = await findRegistrationDoc(invoiceNumber);
    if (doc?.data) {
      existingRegistration = doc.data;
    }
  } catch (err) {
    console.warn(`[DOKU Check Status] Could not resolve attendee for invoice ${invoiceNumber}:`, err);
  }

  // Determine production vs sandbox environment
  let isProduction = parsed.data.isProduction;
  if (isProduction === undefined) {
    if (existingRegistration?.payment_environment === "production") {
      isProduction = true;
    } else if (existingRegistration?.payment_environment === "sandbox") {
      isProduction = false;
    } else {
      isProduction = process.env.NODE_ENV === "production";
    }
  }

  const { url, headers, requestId } = buildDokuCheckStatusHeaders(invoiceNumber, { isProduction });

  console.log(
    `[DOKU Check Status] GET ${url} (mode: ${isProduction ? "production" : "sandbox"}, requestId: ${requestId})...`,
  );

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const dokuResponse = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await dokuResponse.text();
    let dokuData: DokuCheckStatusResponse | null = null;
    try {
      dokuData = JSON.parse(responseText) as DokuCheckStatusResponse;
    } catch {
      // Non-JSON response
    }

    if (!dokuResponse.ok) {
      const errorMsg =
        dokuData?.error?.message ??
        `DOKU Check Status API returned HTTP ${dokuResponse.status} ${dokuResponse.statusText}`;
      console.error(`[DOKU Check Status] HTTP ${dokuResponse.status} error:`, responseText);
      return {
        success: false,
        isPaid: false,
        invoiceNumber,
        dokuStatus: "ERROR",
        dokuResponse: dokuData ?? responseText,
        message: errorMsg,
        error: errorMsg,
      };
    }

    const txStatus = (dokuData?.transaction?.status ?? dokuData?.order?.status ?? "PENDING").toUpperCase().trim();
    const isPaid = isDokuPaymentSuccess(dokuData);
    const amount = dokuData?.order?.amount;
    const paymentChannel = dokuData?.channel?.id ?? dokuData?.service?.id ?? "QRIS";
    const paidAt = dokuData?.transaction?.date ?? dokuData?.order?.date ?? new Date().toISOString();
    const approvalCode = dokuData?.emoney_payment?.approval_code;

    let n8nDispatched = false;
    let n8nResult: unknown = null;

    if (isPaid) {
      console.log(`[DOKU Check Status] Invoice ${invoiceNumber} is SUCCESS/PAID. Dispatching to n8n webhook...`);

      const notificationPayload = buildNotificationPayloadFromCheckStatus(
        dokuData ?? {},
        invoiceNumber,
        existingRegistration,
      );

      const n8nWebhookUrl = resolveDokuNotificationWebhookUrl();
      const { headers: n8nHeaders, rawBody } = buildDokuNotificationHeaders(notificationPayload, {
        isProduction,
      });

      // Add API key if configured in environment
      const apiKey = process.env.PAYMENT_WEBHOOK_SECRET ?? process.env.N8N_WEBHOOK_API_KEY ?? "";
      if (apiKey) {
        n8nHeaders["x-api-key"] = apiKey;
      }

      try {
        const n8nController = new AbortController();
        const n8nTimeout = setTimeout(() => n8nController.abort(), 15000);

        const n8nRes = await fetch(n8nWebhookUrl, {
          method: "POST",
          headers: n8nHeaders,
          body: rawBody,
          signal: n8nController.signal,
        });

        clearTimeout(n8nTimeout);

        const n8nResText = await n8nRes.text();
        try {
          n8nResult = JSON.parse(n8nResText);
        } catch {
          n8nResult = n8nResText;
        }

        if (n8nRes.ok) {
          n8nDispatched = true;
          console.log(`[DOKU Check Status] Successfully forwarded to n8n:`, n8nResult);
        } else {
          console.warn(`[DOKU Check Status] n8n returned HTTP ${n8nRes.status}:`, n8nResText);
        }
      } catch (n8nErr) {
        console.error(`[DOKU Check Status] Failed to call n8n notification webhook:`, n8nErr);
        n8nResult = n8nErr instanceof Error ? n8nErr.message : String(n8nErr);
      }

      // Reconcile registration status in Firestore immediately
      try {
        await updateRegistrationFromPayment({
          invoiceNumber,
          status: "paid_and_registered",
          amount: amount ?? notificationPayload.order.amount,
          paymentChannel,
          paidAt,
        });
      } catch (dbErr) {
        console.error(`[DOKU Check Status] Failed to update Firestore registration:`, dbErr);
      }

      // Revalidate dashboard paths
      try {
        await revalidateDashboardPath("/dashboard/events");
        if (eventId) {
          await revalidateDashboardPath(`/dashboard/events/${eventId}`);
        }
      } catch {
        // Ignore revalidation in edge context
      }

      return {
        success: true,
        isPaid: true,
        invoiceNumber,
        dokuStatus: "SUCCESS",
        amount,
        paymentChannel,
        paidAt,
        approvalCode,
        dokuResponse: dokuData,
        n8nDispatched,
        n8nResult,
        message: n8nDispatched
          ? "Payment is confirmed SUCCESS! Attendee status has been updated and synced via n8n."
          : "Payment is confirmed SUCCESS! Attendee status updated in database.",
      };
    }

    // If not paid (PENDING, ORDER_EXPIRED, FAILED)
    let message = `Payment status is ${txStatus}.`;
    if (txStatus === "PENDING" || txStatus === "ORDER_GENERATED") {
      message = "Payment is still pending. The attendee has not completed the checkout yet.";
    } else if (txStatus === "ORDER_EXPIRED" || txStatus === "EXPIRED") {
      message = "Payment has expired. The attendee did not complete payment before the deadline.";
    } else if (txStatus === "FAILED") {
      message = "Payment failed or was declined by the issuer.";
    }

    return {
      success: true,
      isPaid: false,
      invoiceNumber,
      dokuStatus: txStatus,
      amount,
      paymentChannel,
      dokuResponse: dokuData,
      n8nDispatched: false,
      message,
    };
  } catch (err: unknown) {
    console.error(`[DOKU Check Status] Request error:`, err);
    const errorMsg = extractApiMessage(err, "Failed to connect to DOKU Check Status API.");
    return {
      success: false,
      isPaid: false,
      invoiceNumber,
      dokuStatus: "ERROR",
      message: errorMsg,
      error: errorMsg,
      dokuResponse: err,
    };
  }
}
