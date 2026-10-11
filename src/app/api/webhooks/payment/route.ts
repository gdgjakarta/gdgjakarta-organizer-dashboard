import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { updateRegistrationFromPayment } from "@/server/firestore-admin";
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
  status: z.enum(["pending", "approved", "registered", "rejected", "waitlisted", "attended"]).optional(),
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
});

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing API key." }, { status: 401 });
    }

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ error: "Invalid JSON body provided." }, { status: 400 });
    }

    const parsed = updatePaymentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const result = await updateRegistrationFromPayment(parsed.data);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    // Revalidate dashboard paths so organizers see updated attendee status in real-time
    try {
      await revalidateDashboardPath("/dashboard/events");
      await revalidateDashboardPath("/dashboard/organizer");
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
