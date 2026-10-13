"use server";

import { z } from "zod";

import {
  DEFAULT_PAYMENT_HEADER_EMAIL_URL,
  type DokuPaymentLinkRequest,
  type DokuPaymentLinkResponse,
  type PaymentDispatchResult,
  resolvePaymentLinkWebhookUrl,
} from "@/lib/events/doku-payment";
import { extractApiMessage } from "@/lib/utils";

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
  isProduction: z.boolean().optional(),
  webhookUrl: z.string().optional(),
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

  const webhookUrl = resolvePaymentLinkWebhookUrl(parsed.data.webhookUrl, isProduction);
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

    return {
      success: true,
      paymentUrl: responseData?.paymentUrl,
      invoiceNumber: responseData?.invoiceNumber,
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
