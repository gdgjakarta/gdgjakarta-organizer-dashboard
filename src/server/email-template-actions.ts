"use server";

import { z } from "zod";

import { adjustBodyEmailForApprovedWebhook, splitFullName } from "@/lib/events/email-templates";
import { extractApiMessage } from "@/lib/utils";

/**
 * Resolves the webhook URL for send-interest-email.
 */
function resolveSendInterestEmailWebhookUrl(customBaseUrl?: string): string {
  if (process.env.N8N_SEND_INTEREST_EMAIL_WEBHOOK_URL) {
    return process.env.N8N_SEND_INTEREST_EMAIL_WEBHOOK_URL.trim();
  }
  const base = (customBaseUrl ?? process.env.N8N_WEBHOOK_BASE_URL ?? "https://n8n.gdgjakarta.com")
    .trim()
    .replace(/\/+$/, "");

  if (base.endsWith("/send-interest-email")) {
    return base;
  }
  if (base.endsWith("/webhook/api")) {
    return `${base}/send-interest-email`;
  }
  if (base.endsWith("/webhook")) {
    return `${base}/api/send-interest-email`;
  }
  if (base.endsWith("/api")) {
    return `${base.slice(0, -4)}/webhook/api/send-interest-email`;
  }
  return `${base}/webhook/api/send-interest-email`;
}

const sendInterestEmailSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional().default(""),
  email: z.string().email("Valid recipient email is required"),
  subjectEmail: z.string().min(1, "Email subject is required"),
  bodyEmail: z.string().min(1, "Email body HTML is required"),
});

export type SendInterestEmailInput = z.infer<typeof sendInterestEmailSchema>;

export interface EmailDispatchResult {
  success: boolean;
  status?: number;
  message?: string;
  error?: string;
  details?: unknown;
}

/**
 * Dispatches an interest email request to n8n webhook API.
 * Matches:
 * curl -X POST "https://n8n.gdgjakarta.com/webhook/api/send-interest-email" \
 *      -H "Content-Type: application/json" \
 *      -H "x-api-key: YOUR_API_KEY_HERE" \
 *      -d '{
 *        "first_name": "Jane",
 *        "last_name": "Doe",
 *        "email": "jane.doe@example.com",
 *        "subjectEmail": "Registration Received: GDG DevFest Jakarta",
 *        "bodyEmail": "<!DOCTYPE html>..."
 *      }'
 */
export async function sendInterestEmailWebhookAction(data: SendInterestEmailInput): Promise<EmailDispatchResult> {
  const parsed = sendInterestEmailSchema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error: errorMsg };
  }

  const webhookUrl = resolveSendInterestEmailWebhookUrl();
  const apiKey =
    process.env.N8N_WEBHOOK_API_KEY ||
    process.env.EVENT_REGISTRATION_WEBHOOK_API_KEY ||
    process.env.N8N_AUTH_SECRET ||
    "";

  console.log(`[Send Interest Email] POST ${webhookUrl} to ${parsed.data.email}...`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "GDG-Jakarta-Dashboard/1.0",
    };

    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const payload = {
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name || "",
      email: parsed.data.email,
      subjectEmail: parsed.data.subjectEmail,
      bodyEmail: parsed.data.bodyEmail,
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    let responseJson: unknown = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      // Non-JSON response
    }

    const bodyData = (Array.isArray(responseJson) ? responseJson[0] : responseJson) as
      | Record<string, unknown>
      | null
      | undefined;

    const hasStatusFalse =
      bodyData &&
      (bodyData.status === false ||
        bodyData.status === "false" ||
        bodyData.status === "error" ||
        bodyData.status === "failed" ||
        bodyData.success === false);

    if (!response.ok || hasStatusFalse) {
      console.error(`[Send Interest Email] Error response (HTTP ${response.status}):`, responseText.slice(0, 500));

      const errorMessage = extractApiMessage(
        responseJson || responseText,
        `Interest email service returned HTTP status ${response.status}.`,
      );

      return {
        success: false,
        status: response.status,
        error: errorMessage,
        details: responseJson || responseText,
      };
    }

    console.log(`[Send Interest Email] Succeeded for ${parsed.data.email}:`, responseText.slice(0, 200));

    const cleanSuccessMessage = extractApiMessage(
      responseJson || responseText,
      "Interest email request was sent successfully.",
    );

    return {
      success: true,
      status: response.status,
      message: cleanSuccessMessage,
      details: responseJson,
    };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    const errorMessage = isAbort
      ? "Webhook request timed out after 15 seconds."
      : extractApiMessage(error, "Failed to connect to email webhook service.");

    console.error("[Send Interest Email] Exception:", errorMessage);

    return {
      success: false,
      error: errorMessage,
      details: error,
    };
  }
}

const sendTemplateEmailRequestSchema = z.object({
  eventId: z.string().min(1),
  recipientEmail: z.string().email("Valid email is required"),
  recipientName: z.string().min(1, "Recipient name is required"),
  subjectEmail: z.string().min(1, "Subject is required"),
  bodyEmail: z.string().min(1, "Body HTML is required"),
  templateKey: z.string().min(1),
  eventName: z.string().optional(),
  headerEmailUrl: z.string().optional(),
  actionButtonUrl: z.string().optional(),
  bevyEventId: z.string().optional(),
  bevyChapterId: z.string().optional(),
  sessionName: z.string().optional(),
  sessionCapacity: z.number().optional(),
});

export type SendTemplateEmailRequestInput = z.infer<typeof sendTemplateEmailRequestSchema>;

/**
 * Server Action: Dispatches constructed template email directly via request.
 * If template is 'interest', dispatches to /send-interest-email.
 * Otherwise dispatches to /add-bevy-attendee or general webhook with subjectEmail and bodyEmail.
 */
export async function sendTemplateEmailRequestAction(
  data: SendTemplateEmailRequestInput,
): Promise<EmailDispatchResult> {
  const parsed = sendTemplateEmailRequestSchema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error: errorMsg };
  }

  const { firstName, lastName } = splitFullName(parsed.data.recipientName);

  // If this is the registration interest template, use the exact send-interest-email endpoint
  if (parsed.data.templateKey === "interest") {
    return await sendInterestEmailWebhookAction({
      first_name: firstName,
      last_name: lastName,
      email: parsed.data.recipientEmail,
      subjectEmail: parsed.data.subjectEmail,
      bodyEmail: parsed.data.bodyEmail,
    });
  }

  // For accepted or other templates, dispatch to add bevy attendee webhook API
  const base = (process.env.N8N_WEBHOOK_BASE_URL ?? "https://n8n.gdgjakarta.com").trim().replace(/\/+$/, "");
  const targetUrl = `${base}/webhook/api/add-bevy-attendee`;
  const apiKey =
    process.env.N8N_WEBHOOK_API_KEY ||
    process.env.EVENT_REGISTRATION_WEBHOOK_API_KEY ||
    process.env.N8N_AUTH_SECRET ||
    "";

  console.log(
    `[Send Template Email] POST ${targetUrl} (${parsed.data.templateKey}) to ${parsed.data.recipientEmail}...`,
  );

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "GDG-Jakarta-Dashboard/1.0",
    };

    if (apiKey) {
      headers["X-API-Key"] = apiKey;
      headers["x-api-key"] = apiKey;
    }

    const sessionName = parsed.data.sessionName || "Regular Ticket";
    const sessionCapacity = parsed.data.sessionCapacity || 100;
    const bodyEmailToSend =
      parsed.data.templateKey === "accepted"
        ? adjustBodyEmailForApprovedWebhook(parsed.data.bodyEmail)
        : parsed.data.bodyEmail;

    const payload = {
      email: parsed.data.recipientEmail,
      fullName: parsed.data.recipientName,
      status: parsed.data.templateKey === "accepted" ? "approved" : "rejected",
      bevyEventId: parsed.data.bevyEventId || parsed.data.eventId,
      bevyChapterId: parsed.data.bevyChapterId || process.env.BEVY_CHAPTER_ID || "642",
      sessionName,
      sessionCapacity,
      subjectEmail: parsed.data.subjectEmail,
      bodyEmail: bodyEmailToSend,
      // Optional backwards-compatible fields
      first_name: firstName,
      last_name: lastName,
      session: sessionName,
      eventName: parsed.data.eventName || "GDG Jakarta Event",
      eventHeaderEmailUrl:
        parsed.data.headerEmailUrl ||
        "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png",
      actionButtonUrl: parsed.data.actionButtonUrl || "https://gdg.community.dev/gdg-jakarta",
      templateKey: parsed.data.templateKey,
    };

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    let responseJson: unknown = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      // Non-JSON response
    }

    if (!response.ok) {
      console.error(`[Send Template Email] Error response (HTTP ${response.status}):`, responseText.slice(0, 500));
      const cleanError = extractApiMessage(
        responseJson || responseText,
        `Webhook service returned HTTP status ${response.status}.`,
      );
      return {
        success: false,
        status: response.status,
        error: cleanError,
        details: responseJson || responseText,
      };
    }

    const cleanSuccess = extractApiMessage(
      responseJson || responseText,
      `Email request for "${parsed.data.recipientName}" dispatched successfully.`,
    );

    return {
      success: true,
      status: response.status,
      message: cleanSuccess,
      details: responseJson,
    };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    const errorMessage = isAbort
      ? "Webhook request timed out after 15 seconds."
      : extractApiMessage(error, "Failed to connect to email webhook service.");

    console.error("[Send Template Email] Exception:", errorMessage);
    return {
      success: false,
      error: errorMessage,
      details: error,
    };
  }
}
