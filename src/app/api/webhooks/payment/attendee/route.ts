import { type NextRequest, NextResponse } from "next/server";

import { getAttendeeByInvoiceNumber } from "@/server/firestore-admin";

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
    console.warn("[Payment Webhook Attendee] No PAYMENT_WEBHOOK_SECRET or N8N_WEBHOOK_API_KEY set.");
    return false;
  }

  return apiKey === validSecret;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing API key." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const invoiceNumber = searchParams.get("invoiceNumber");

    if (!invoiceNumber) {
      return NextResponse.json({ error: "Query parameter 'invoiceNumber' is required." }, { status: 400 });
    }

    const result = await getAttendeeByInvoiceNumber(invoiceNumber);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[Payment Webhook Attendee] Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
