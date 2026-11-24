import {
  EMETERAI_DOCUMENT_TYPES,
  type EMeteraiDocumentType,
  type EMeteraiPlacementRect,
  type EMeteraiProviderStatus,
  RESMI_EMETERAI_PRICE_IDR,
} from "@/types/partner-signage";

import { createHmac, timingSafeEqual } from "node:crypto";

export { EMETERAI_DOCUMENT_TYPES, RESMI_EMETERAI_PRICE_IDR };

const DEFAULT_RESMI_API_BASE_URL = "https://docs.resmi.id/api/ext/v1";

function getResmiApiKey(): string {
  return process.env.RESMI_API_KEY?.trim() || "";
}

function getResmiBaseUrl(): string {
  const configured = process.env.RESMI_API_BASE_URL?.trim();
  return (configured || DEFAULT_RESMI_API_BASE_URL).replace(/\/+$/, "");
}

function normalizeResmiStatus(raw: unknown): "queued" | "processing" | "stamped" | "failed" {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value === "stamped" || value === "completed" || value === "success") return "stamped";
  if (value === "failed" || value === "error" || value === "rejected") return "failed";
  if (value === "queued" || value === "pending") return "queued";
  return "processing";
}

function constantTimeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function unwrapPayload(json: unknown): Record<string, unknown> {
  if (!json || typeof json !== "object") return {};
  const obj = json as Record<string, unknown>;
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return { ...obj, ...(obj.data as Record<string, unknown>) };
  }
  return obj;
}

/**
 * Inspects RESMI_API_KEY without exposing secret material to the client.
 */
export function inspectResmiEMeteraiStatus(): EMeteraiProviderStatus {
  const apiKey = getResmiApiKey();
  if (!apiKey) {
    return {
      configured: false,
      provider: "resmi_id",
      mode: "unconfigured",
      priceIdr: RESMI_EMETERAI_PRICE_IDR,
    };
  }

  const mode: "live" | "test" = apiKey.startsWith("dk_live_") ? "live" : "test";
  return {
    configured: true,
    provider: "resmi_id",
    mode,
    priceIdr: RESMI_EMETERAI_PRICE_IDR,
  };
}

export interface ResmiEMeteraiInfoResult {
  ok: boolean;
  priceIdr: number;
  error?: string;
}

/**
 * Fetches live e-Meterai pricing and availability metadata from Resmi.ID GET /emeterai/info.
 */
export async function getResmiEMeteraiInfo(): Promise<ResmiEMeteraiInfoResult> {
  const apiKey = getResmiApiKey();
  if (!apiKey) {
    return { ok: false, priceIdr: RESMI_EMETERAI_PRICE_IDR, error: "RESMI_API_KEY is not configured." };
  }

  try {
    const response = await fetch(`${getResmiBaseUrl()}/emeterai/info`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(4000) : undefined,
    });

    const json = await response.json().catch(() => ({}));
    const payload = unwrapPayload(json);
    if (!response.ok) {
      return {
        ok: false,
        priceIdr: RESMI_EMETERAI_PRICE_IDR,
        error: `HTTP ${response.status}`,
      };
    }

    const rawPrice = payload.price_idr ?? payload.price ?? payload.fee_idr;
    const priceIdr =
      typeof rawPrice === "number" && Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : RESMI_EMETERAI_PRICE_IDR;

    return { ok: true, priceIdr };
  } catch (err) {
    return {
      ok: false,
      priceIdr: RESMI_EMETERAI_PRICE_IDR,
      error: err instanceof Error ? err.message : "Failed to fetch Resmi.ID pricing info.",
    };
  }
}

export interface SubmitResmiEMeteraiResult {
  ok: boolean;
  requestId?: string;
  status: "queued" | "processing" | "stamped" | "failed";
  serialNumber?: string;
  priceIdr: number;
  statusCode?: number;
  error?: string;
}

/**
 * Submits a PDF document to Resmi.ID to apply an official PERURI e-Meterai stamp.
 */
export async function submitResmiEMeteraiStamp(params: {
  pdfBytes: Uint8Array;
  fileName: string;
  documentType: EMeteraiDocumentType;
  placement: EMeteraiPlacementRect;
  idempotencyKey: string;
}): Promise<SubmitResmiEMeteraiResult> {
  const apiKey = getResmiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: "failed",
      priceIdr: RESMI_EMETERAI_PRICE_IDR,
      error: "RESMI_API_KEY is not configured.",
    };
  }

  const baseUrl = getResmiBaseUrl();
  const formData = new FormData();
  const cleanBytes = new Uint8Array(params.pdfBytes);
  formData.append("file", new Blob([cleanBytes], { type: "application/pdf" }), params.fileName || "document.pdf");
  formData.append("document_type", params.documentType);
  formData.append("page", String(Math.max(1, Math.round(params.placement.page))));
  if (params.placement.corner) {
    formData.append("corner", params.placement.corner);
  } else {
    formData.append("x", String(Math.max(0, Math.round(params.placement.x))));
    formData.append("y", String(Math.max(0, Math.round(params.placement.y))));
  }

  try {
    const response = await fetch(`${baseUrl}/emeterai`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": params.idempotencyKey,
      },
      body: formData,
    });

    const json = await response.json().catch(() => ({}));
    const payload = unwrapPayload(json);

    if (!response.ok) {
      const rawMsg =
        (typeof payload.error === "string" && payload.error) ||
        (typeof payload.message === "string" && payload.message) ||
        `Resmi.ID rejected stamping request (HTTP ${response.status}).`;
      const msg = response.status === 402 ? `Insufficient Resmi.ID balance (HTTP 402). ${rawMsg}` : rawMsg;
      return {
        ok: false,
        status: "failed",
        priceIdr: RESMI_EMETERAI_PRICE_IDR,
        statusCode: response.status,
        error: msg,
      };
    }

    const requestId =
      (typeof payload.id === "string" && payload.id) ||
      (typeof payload.request_id === "string" && payload.request_id) ||
      undefined;

    const status = normalizeResmiStatus(payload.status);
    const serialNumber = typeof payload.serial_number === "string" ? payload.serial_number : undefined;
    const priceIdr =
      typeof payload.price_idr === "number" && Number.isFinite(payload.price_idr)
        ? payload.price_idr
        : RESMI_EMETERAI_PRICE_IDR;
    let error: string | undefined;
    if (status === "failed") {
      error = typeof payload.error === "string" ? payload.error : "Stamping failed.";
    }

    return {
      ok: status !== "failed",
      requestId,
      status,
      serialNumber,
      priceIdr,
      error,
    };
  } catch (err) {
    return {
      ok: false,
      status: "failed",
      priceIdr: RESMI_EMETERAI_PRICE_IDR,
      error: err instanceof Error ? err.message : "Network error while contacting Resmi.ID.",
    };
  }
}

export interface ResmiEMeteraiStatusResult {
  ok: boolean;
  status: "queued" | "processing" | "stamped" | "failed";
  serialNumber?: string;
  priceIdr?: number;
  error?: string;
}

/**
 * Fetches current stamping status for a Resmi.ID request.
 */
export async function getResmiEMeteraiStatus(requestId: string): Promise<ResmiEMeteraiStatusResult> {
  const apiKey = getResmiApiKey();
  if (!apiKey) {
    return { ok: false, status: "failed", error: "RESMI_API_KEY is not configured." };
  }
  if (!requestId.trim()) {
    return { ok: false, status: "failed", error: "Missing Resmi.ID request ID." };
  }

  try {
    const response = await fetch(`${getResmiBaseUrl()}/emeterai/${encodeURIComponent(requestId.trim())}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const json = await response.json().catch(() => ({}));
    const payload = unwrapPayload(json);

    if (!response.ok) {
      const msg =
        (typeof payload.error === "string" && payload.error) ||
        (typeof payload.message === "string" && payload.message) ||
        `Failed to fetch Resmi.ID status (HTTP ${response.status}).`;
      return { ok: false, status: "processing", error: msg };
    }

    const status = normalizeResmiStatus(payload.status);
    const serialNumber = typeof payload.serial_number === "string" ? payload.serial_number : undefined;
    const priceIdr =
      typeof payload.price_idr === "number" && Number.isFinite(payload.price_idr) ? payload.price_idr : undefined;
    const error =
      status === "failed"
        ? (typeof payload.error === "string" && payload.error) ||
          (typeof payload.message === "string" && payload.message) ||
          "PERURI e-Meterai stamping failed."
        : undefined;

    return { ok: true, status, serialNumber, priceIdr, error };
  } catch (err) {
    return {
      ok: false,
      status: "processing",
      error: err instanceof Error ? err.message : "Failed to poll Resmi.ID status.",
    };
  }
}

/**
 * Downloads the final e-Meterai stamped PDF bytes from Resmi.ID and validates its %PDF- header.
 */
export async function downloadResmiEMeteraiPdf(requestId: string): Promise<Uint8Array> {
  const apiKey = getResmiApiKey();
  if (!apiKey) {
    throw new Error("RESMI_API_KEY is not configured.");
  }

  const response = await fetch(`${getResmiBaseUrl()}/emeterai/${encodeURIComponent(requestId.trim())}/file`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to download stamped PDF from Resmi.ID (HTTP ${response.status}).`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (
    bytes.byteLength < 5 ||
    bytes[0] !== 0x25 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x44 ||
    bytes[3] !== 0x46 ||
    bytes[4] !== 0x2d
  ) {
    throw new Error("Downloaded Resmi.ID file is not a valid PDF (%PDF- header missing).");
  }

  return bytes;
}

/**
 * Verifies incoming Resmi.ID webhook authenticity against RESMI_WEBHOOK_SECRET
 * or N8N_WEBHOOK_API_KEY (when forwarded by n8n GDG Jakarta API Auth). Fail-closed.
 */
export function verifyResmiWebhookSignature(request: Request, rawBody: string): boolean {
  const secret = process.env.RESMI_WEBHOOK_SECRET?.trim();
  const n8nKey = process.env.N8N_WEBHOOK_API_KEY?.trim();
  if (!secret && !n8nKey) {
    console.warn(
      "[Resmi Webhook] Neither RESMI_WEBHOOK_SECRET nor N8N_WEBHOOK_API_KEY is configured; rejecting webhook.",
    );
    return false;
  }

  const directHeader =
    request.headers.get("x-webhook-secret")?.trim() ||
    request.headers.get("x-api-key")?.trim() ||
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ||
    "";

  if (directHeader && secret && constantTimeMatch(directHeader, secret)) {
    return true;
  }
  if (directHeader && n8nKey && constantTimeMatch(directHeader, n8nKey)) {
    return true;
  }

  const sigHeader =
    request.headers.get("x-resmi-signature")?.trim() || request.headers.get("x-signature")?.trim() || "";
  if (!sigHeader || !secret) return false;

  if (constantTimeMatch(sigHeader, secret)) {
    return true;
  }

  const normalizedSig = sigHeader.replace(/^sha256=/i, "").toLowerCase();
  const expectedHmac = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex").toLowerCase();
  return constantTimeMatch(normalizedSig, expectedHmac);
}
