import { type NextRequest, NextResponse } from "next/server";

import { verifyResmiWebhookSignature } from "@/lib/pdf/resmi-emeterai";
import { stageEMeteraiWebhookResult } from "@/server/emeterai-finalizer";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/resmi-emeterai
 * Receives asynchronous Resmi.ID e-Meterai webhooks (emeterai.stamped / emeterai.failed),
 * verifies webhook signature, downloads stamped PDF to R2, and writes a staging manifest in R2.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!verifyResmiWebhookSignature(request, rawBody)) {
      return NextResponse.json({ error: "Unauthorized webhook signature." }, { status: 401 });
    }

    let parsed: unknown;
    try {
      parsed = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const root = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    const dataObj =
      root.data && typeof root.data === "object" && !Array.isArray(root.data)
        ? (root.data as Record<string, unknown>)
        : root;

    const eventName = typeof root.event === "string" ? root.event.toLowerCase() : "";
    const requestId =
      (typeof dataObj.id === "string" && dataObj.id.trim()) ||
      (typeof dataObj.request_id === "string" && dataObj.request_id.trim()) ||
      (typeof root.id === "string" && root.id.trim()) ||
      (typeof root.request_id === "string" && root.request_id.trim()) ||
      "";

    if (!requestId) {
      return NextResponse.json({ error: "Missing Resmi.ID request ID in webhook payload." }, { status: 400 });
    }

    const rawStatus = typeof dataObj.status === "string" ? dataObj.status.toLowerCase() : "";
    let statusHint: "stamped" | "failed" | undefined;
    if (eventName.includes("stamped") || rawStatus === "stamped" || rawStatus === "completed") {
      statusHint = "stamped";
    } else if (eventName.includes("failed") || rawStatus === "failed" || rawStatus === "error") {
      statusHint = "failed";
    }

    if (!statusHint) {
      return NextResponse.json({ ok: true, staged: false, requestId, ignored: true });
    }

    const serialNumber = typeof dataObj.serial_number === "string" ? dataObj.serial_number : undefined;
    const errorMsg =
      (typeof dataObj.error === "string" && dataObj.error) ||
      (typeof dataObj.message === "string" && dataObj.message) ||
      undefined;

    await stageEMeteraiWebhookResult({
      requestId,
      status: statusHint,
      serialNumber,
      error: errorMsg,
    });

    return NextResponse.json({ ok: true, staged: true, requestId, status: statusHint });
  } catch (err) {
    console.error("[Resmi Webhook] Error processing webhook:", err);
    const message = err instanceof Error ? err.message : "Failed to process Resmi.ID webhook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
