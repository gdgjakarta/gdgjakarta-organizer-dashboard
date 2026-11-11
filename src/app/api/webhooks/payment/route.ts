import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import {
  recordPaymentTransaction,
  updateMerchandiseOrderFromPayment,
  updateRegistrationFromPayment,
} from "@/server/firestore-admin";
import { revalidateDashboardPath } from "@/server/server-actions";

function isAuthorized(req: Request): boolean {
  const apiKey =
    req.headers.get("x-api-key") ||
    req.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();

  const validSecret =
    process.env.PAYMENT_WEBHOOK_SECRET?.trim() ||
    process.env.N8N_WEBHOOK_API_KEY?.trim() ||
    process.env.N8N_AUTH_SECRET?.trim();

  if (!validSecret) {
    console.warn("[Payment Webhook Update] No PAYMENT_WEBHOOK_SECRET or N8N_WEBHOOK_API_KEY set.");
    return false;
  }

  return apiKey === validSecret;
}

const updatePaymentSchema = z.object({
  invoiceNumber: z.string().min(1, "invoiceNumber is required"),
  status: z
    .enum([
      "pending",
      "approved",
      "registered",
      "rejected",
      "waitlisted",
      "attended",
      "waiting_for_payment",
      "paid_and_registered",
      "expired",
      "failed",
      "canceled",
      "cancelled",
    ])
    .optional(),
  bevyAttendeeId: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val) || null)
    .nullable()
    .optional(),
  attendeeCode: z.string().nullable().optional(),
  amount: z.number().optional(),
  paymentChannel: z.string().optional(),
  paidAt: z.string().optional(),
  errorReason: z.string().optional(),
  emailStatus: z.enum(["sent", "not_sent", "failed", "pending"]).optional(),
  emailRecipient: z.string().optional(),
  emailSentAt: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().optional(),
  customerPhone: z.string().optional(),
  issuer: z.string().optional(),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing API key." }, { status: 401 });
    }

    const rawBody = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!rawBody) {
      return NextResponse.json({ error: "Invalid JSON body provided." }, { status: 400 });
    }

    // Support both flattened and nested n8n webhook payload structures
    const bodyObj = (rawBody.body as Record<string, unknown> | undefined) ?? {};
    const orderObj = (bodyObj.order as Record<string, unknown> | undefined) ?? {};
    const customerObj = (bodyObj.customer as Record<string, unknown> | undefined) ?? {};
    const issuerObj = (bodyObj.issuer as Record<string, unknown> | undefined) ?? {};
    const txObj = (bodyObj.transaction as Record<string, unknown> | undefined) ?? {};

    const invoiceNumber = (
      (rawBody.invoiceNumber as string) ||
      (rawBody.invoice_number as string) ||
      (orderObj.invoice_number as string) ||
      ""
    ).trim();

    let resolvedAmount: number | undefined;
    if (typeof rawBody.amount === "number") {
      resolvedAmount = rawBody.amount;
    } else if (typeof orderObj.amount === "number") {
      resolvedAmount = orderObj.amount;
    }

    const rawCustomerName =
      (rawBody.customerName as string) ||
      (rawBody.customer_name as string) ||
      (typeof customerObj.name === "string" ? customerObj.name : "");
    const rawCustomerEmail =
      (rawBody.customerEmail as string) ||
      (rawBody.customer_email as string) ||
      (typeof customerObj.email === "string" ? customerObj.email : "");
    const rawCustomerPhone =
      (rawBody.customerPhone as string) ||
      (rawBody.customer_phone as string) ||
      (typeof customerObj.phone === "string" ? customerObj.phone : "");

    const normalizedData = {
      invoiceNumber,
      status: (rawBody.status as string) || (txObj.status === "SUCCESS" ? "paid_and_registered" : undefined),
      bevyAttendeeId: rawBody.bevyAttendeeId ?? rawBody.bevy_attendee_id,
      attendeeCode: (rawBody.attendeeCode as string) || (rawBody.attendee_code as string) || undefined,
      amount: resolvedAmount,
      paymentChannel:
        (rawBody.paymentChannel as string) ||
        (rawBody.payment_channel as string) ||
        (bodyObj.channel as { id?: string } | undefined)?.id ||
        (bodyObj.service as { id?: string } | undefined)?.id ||
        "QRIS",
      paidAt:
        (rawBody.paidAt as string) || (rawBody.paid_at as string) || (txObj.date as string) || new Date().toISOString(),
      errorReason: (rawBody.errorReason as string) || (rawBody.error_reason as string) || undefined,
      emailStatus: ((rawBody.emailStatus as string) || (rawBody.email_status as string) || "sent") as
        | "sent"
        | "not_sent"
        | "failed"
        | "pending",
      emailRecipient:
        (rawBody.emailRecipient as string) || (rawBody.email_recipient as string) || "payment@gdgjakarta.org",
      emailSentAt: (rawBody.emailSentAt as string) || (rawBody.email_sent_at as string) || new Date().toISOString(),
      customerName: rawCustomerName.trim() || undefined,
      customerEmail: rawCustomerEmail.trim() || undefined,
      customerPhone: rawCustomerPhone.trim() || undefined,
      issuer: (rawBody.issuer as string) || (issuerObj.name as string) || undefined,
      rawPayload: rawBody,
    };

    const parsed = updatePaymentSchema.safeParse(normalizedData);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    // Persist to unified payment_transactions collection
    await recordPaymentTransaction({
      invoice_number: parsed.data.invoiceNumber,
      customer_name: parsed.data.customerName || "Customer",
      customer_email: parsed.data.customerEmail || "",
      customer_phone: parsed.data.customerPhone || null,
      amount: parsed.data.amount || 0,
      issuer: parsed.data.issuer || "QRIS",
      payment_channel: parsed.data.paymentChannel || "QRIS",
      payment_status: parsed.data.errorReason ? "failed" : "paid",
      email_status: parsed.data.emailStatus || "sent",
      email_recipient: parsed.data.emailRecipient || "payment@gdgjakarta.org",
      email_sent_at: parsed.data.emailSentAt || new Date().toISOString(),
      transaction_date: parsed.data.paidAt || new Date().toISOString(),
      raw_payload: parsed.data.rawPayload || rawBody,
    });

    const result = await updateRegistrationFromPayment(parsed.data);

    if (!result.success) {
      // Reconcile as on-the-spot merchandise order if not an event registration
      const merchResult = await updateMerchandiseOrderFromPayment({
        invoiceNumber: parsed.data.invoiceNumber,
        amount: parsed.data.amount,
        paymentChannel: parsed.data.paymentChannel,
        paidAt: parsed.data.paidAt,
        errorReason: parsed.data.errorReason,
        emailStatus: parsed.data.emailStatus,
        emailRecipient: parsed.data.emailRecipient,
        emailSentAt: parsed.data.emailSentAt,
      });

      if (!merchResult.success) {
        // Even if not linked to a registration or merchandise order, the transaction is recorded in payment_transactions!
        try {
          await revalidateDashboardPath("/dashboard/payments");
        } catch {
          // ignore
        }
        return NextResponse.json(
          {
            success: true,
            warning: "Recorded in payment_transactions, but no matching registration or merchandise order found.",
            invoiceNumber: parsed.data.invoiceNumber,
          },
          { status: 200 },
        );
      }

      try {
        await revalidateDashboardPath("/dashboard/events");
        await revalidateDashboardPath("/dashboard/organizer");
        await revalidateDashboardPath("/dashboard/payments");
      } catch {
        // ignore revalidation error in edge contexts
      }

      return NextResponse.json({ success: true, order: merchResult.order }, { status: 200 });
    }

    // Revalidate dashboard paths so organizers see updated attendee status in real-time
    try {
      await revalidateDashboardPath("/dashboard/events");
      await revalidateDashboardPath("/dashboard/organizer");
      await revalidateDashboardPath("/dashboard/payments");
    } catch {
      // ignore revalidation error in edge contexts
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[Payment Webhook Update] Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
