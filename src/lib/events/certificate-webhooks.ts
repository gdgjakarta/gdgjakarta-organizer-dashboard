import { assertSafeWebhookUrl } from "@/lib/security/webhook-validator";

const MAX_CERTIFICATE_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

function resolveN8nApiEndpoint(envOverride: string | undefined, slug: string): string {
  const defaultFallback = `https://n8n.gdgjakarta.com/webhook/api/${slug}`;
  if (envOverride?.trim()) {
    return assertSafeWebhookUrl(envOverride.trim(), defaultFallback);
  }

  const base = (process.env.N8N_WEBHOOK_BASE_URL || "https://n8n.gdgjakarta.com/webhook/api")
    .trim()
    .replace(/\/+$/, "");

  let target: string;
  if (base.endsWith(`/${slug}`)) {
    target = base;
  } else if (base.endsWith("/webhook/api")) {
    target = `${base}/${slug}`;
  } else if (base.endsWith("/webhook")) {
    target = `${base}/api/${slug}`;
  } else if (base.endsWith("/api")) {
    target = `${base.slice(0, -4)}/webhook/api/${slug}`;
  } else {
    target = `${base}/webhook/api/${slug}`;
  }

  return assertSafeWebhookUrl(target, defaultFallback);
}

export function resolveGenerateCertificateWebhookUrl(): string {
  return resolveN8nApiEndpoint(process.env.N8N_GENERATE_CERTIFICATE_WEBHOOK_URL, "generate-certificate");
}

export function resolveSendCertificateEmailWebhookUrl(): string {
  return resolveN8nApiEndpoint(process.env.N8N_SEND_CERTIFICATE_EMAIL_WEBHOOK_URL, "send-certificate-email");
}

function getWebhookHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/pdf, application/json",
  };
  const apiKey = process.env.N8N_WEBHOOK_API_KEY?.trim();
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  return headers;
}

export interface GenerateCertificateWebhookPayload {
  mode: "google_slides" | "export_drawing_pdf";
  templateFileId: string;
  outputFileName: string;
  tempFolderId?: string | null;
  replacements?: Record<string, string>;
}

/**
 * Calls the n8n /webhook/api/generate-certificate endpoint and returns raw PDF bytes.
 * Supports both direct binary application/pdf responses and JSON { pdfBase64 } responses.
 */
export async function callGenerateCertificateWebhook(payload: GenerateCertificateWebhookPayload): Promise<Uint8Array> {
  const url = resolveGenerateCertificateWebhookUrl();
  const res = await fetch(url, {
    method: "POST",
    headers: getWebhookHeaders(),
    body: JSON.stringify(payload),
    signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(30_000) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Certificate generator webhook failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  let pdfBytes: Uint8Array;

  if (contentType.includes("application/json")) {
    const json = (await res.json()) as {
      success?: boolean;
      pdfBase64?: string;
      message?: string;
      error?: string;
    };
    if (json.success === false || !json.pdfBase64) {
      throw new Error(json.message || json.error || "Certificate generator did not return PDF data.");
    }
    pdfBytes = new Uint8Array(Buffer.from(json.pdfBase64, "base64"));
  } else {
    const ab = await res.arrayBuffer();
    pdfBytes = new Uint8Array(ab);
  }

  if (pdfBytes.byteLength === 0) {
    throw new Error("Certificate generator returned an empty PDF.");
  }
  if (pdfBytes.byteLength > MAX_CERTIFICATE_PDF_BYTES) {
    throw new Error("Generated certificate PDF exceeds the 10 MB limit.");
  }

  return pdfBytes;
}

export interface SendCertificateEmailWebhookPayload {
  first_name: string;
  last_name: string;
  email: string;
  subjectEmail: string;
  bodyEmail: string;
  attachmentUrl?: string;
  attachmentFileName?: string;
}

export async function callSendCertificateEmailWebhook(
  payload: SendCertificateEmailWebhookPayload,
): Promise<{ success: boolean; message?: string }> {
  const url = resolveSendCertificateEmailWebhookUrl();
  const res = await fetch(url, {
    method: "POST",
    headers: getWebhookHeaders(),
    body: JSON.stringify(payload),
    signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(25_000) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Send certificate email webhook failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const text = await res.text().catch(() => "");
  if (!text) return { success: true };

  try {
    const json = JSON.parse(text) as { success?: boolean; message?: string };
    if (json.success === false) {
      throw new Error(json.message || "n8n email workflow reported failure.");
    }
    return { success: true, message: json.message };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return { success: true };
    }
    throw err;
  }
}
