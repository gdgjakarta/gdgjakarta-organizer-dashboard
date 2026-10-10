"use server";

import { z } from "zod";

import {
  adjustBodyEmailForApprovedWebhook,
  buildRenderedEmailForAttendee,
  resolveRejectedTemplateKeyForEvent,
  splitFullName,
} from "@/lib/events/email-templates";
import type { FirestoreEvent } from "@/lib/firestore/types";
import { extractApiMessage } from "@/lib/utils";

/**
 * Resolves the webhook URL for send-email (reusable across interest, rejected hybrid/in-person/virtual).
 */
export function resolveSendEmailWebhookUrl(customBaseUrl?: string): string {
  if (process.env.N8N_SEND_EMAIL_WEBHOOK_URL) {
    return process.env.N8N_SEND_EMAIL_WEBHOOK_URL.trim();
  }
  if (process.env.N8N_SEND_INTEREST_EMAIL_WEBHOOK_URL) {
    const custom = process.env.N8N_SEND_INTEREST_EMAIL_WEBHOOK_URL.trim();
    if (custom.endsWith("/send-interest-email")) {
      return custom.replace(/\/send-interest-email$/, "/send-email");
    }
    return custom;
  }
  const base = (customBaseUrl ?? process.env.N8N_WEBHOOK_BASE_URL ?? "https://n8n.gdgjakarta.com")
    .trim()
    .replace(/\/+$/, "");

  if (base.endsWith("/send-email")) {
    return base;
  }
  if (base.endsWith("/send-interest-email")) {
    return base.replace(/\/send-interest-email$/, "/send-email");
  }
  if (base.endsWith("/webhook/api")) {
    return `${base}/send-email`;
  }
  if (base.endsWith("/webhook")) {
    return `${base}/api/send-email`;
  }
  if (base.endsWith("/api")) {
    return `${base.slice(0, -4)}/webhook/api/send-email`;
  }
  return `${base}/webhook/api/send-email`;
}

/**
 * Resolves the webhook URL for send-interest-email (legacy alias pointing to updated send-email).
 */
export function resolveSendInterestEmailWebhookUrl(customBaseUrl?: string): string {
  return resolveSendEmailWebhookUrl(customBaseUrl);
}

const sendEmailSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid recipient email is required"),
  subjectEmail: z.string().min(1, "Email subject is required"),
  bodyEmail: z.string().min(1, "Email body HTML is required"),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;

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
 * Dispatches an email request to n8n webhook API (api/send-email).
 * Reusable for interest email and rejected templates.
 * Matches:
 * curl -X POST "https://n8n.gdgjakarta.com/webhook/api/send-email" \
 *      -H "Content-Type: application/json" \
 *      -H "x-api-key: YOUR_API_KEY_HERE" \
 *      -d '{
 *        "first_name": "Jane",
 *        "last_name": "Doe",
 *        "email": "jane.doe@example.com",
 *        "subjectEmail": "Update regarding: GDG DevFest Jakarta",
 *        "bodyEmail": "<!DOCTYPE html>..."
 *      }'
 */
export async function sendEmailWebhookAction(data: SendEmailInput): Promise<EmailDispatchResult> {
  const safeData = {
    ...data,
    first_name: data.first_name.trim() || "Attendee",
    last_name: data.last_name.trim() || data.first_name.trim() || "-",
  };

  const parsed = sendEmailSchema.safeParse(safeData);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error: errorMsg };
  }

  const webhookUrl = resolveSendEmailWebhookUrl();
  const apiKey =
    process.env.N8N_WEBHOOK_API_KEY ||
    process.env.EVENT_REGISTRATION_WEBHOOK_API_KEY ||
    process.env.N8N_AUTH_SECRET ||
    "";

  console.log(`[Send Email Webhook] POST ${webhookUrl} to ${parsed.data.email}...`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "GDG-Jakarta-Dashboard/1.0",
    };

    if (apiKey) {
      headers["x-api-key"] = apiKey;
      headers["X-API-KEY"] = apiKey;
      headers["X-Api-Key"] = apiKey;
    }

    const payload = {
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
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
      console.error(`[Send Email Webhook] Error response (HTTP ${response.status}):`, responseText.slice(0, 500));

      const errorMessage = extractApiMessage(
        responseJson || responseText,
        `Email service returned HTTP status ${response.status}.`,
      );

      return {
        success: false,
        status: response.status,
        error: errorMessage,
        details: responseJson || responseText,
      };
    }

    console.log(`[Send Email Webhook] Succeeded for ${parsed.data.email}:`, responseText.slice(0, 200));

    const cleanSuccessMessage = extractApiMessage(responseJson || responseText, "Email sent successfully.");

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

    console.error("[Send Email Webhook] Exception:", errorMessage);

    return {
      success: false,
      error: errorMessage,
      details: error,
    };
  }
}

/**
 * Dispatches an interest email request to n8n webhook API.
 * Delegates to reusable sendEmailWebhookAction with guaranteed non-empty fields.
 */
export async function sendInterestEmailWebhookAction(data: SendInterestEmailInput): Promise<EmailDispatchResult> {
  const safeLastName = data.last_name?.trim() ? data.last_name.trim() : data.first_name.trim() || "-";
  return sendEmailWebhookAction({
    first_name: data.first_name.trim(),
    last_name: safeLastName,
    email: data.email,
    subjectEmail: data.subjectEmail,
    bodyEmail: data.bodyEmail,
  });
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
 * If template is 'interest' or any 'rejected_*', dispatches to /send-email.
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
  const safeFirstName = firstName || "Attendee";
  const safeLastName = lastName || firstName || "-";

  // If this is the registration interest template or any rejected template, use the reusable /send-email endpoint
  if (parsed.data.templateKey === "interest" || parsed.data.templateKey.startsWith("rejected")) {
    return await sendEmailWebhookAction({
      first_name: safeFirstName,
      last_name: safeLastName,
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

export interface RejectAttendeeInput {
  registrationId: string;
  eventId: string;
  attendeeName: string;
  attendeeEmail: string;
  reviewer?: {
    id?: string;
    name?: string;
    email?: string;
  };
  eventData?: FirestoreEvent;
}

export interface RejectAttendeeResult extends EmailDispatchResult {
  templateKey?: string;
}

/**
 * Server Action: Rejects an attendee and automatically sends the appropriate regret email via n8n send-email webhook.
 * Validates event type:
 * - Hybrid event -> uses "rejected_hybrid" template
 * - Virtual event -> uses "rejected_virtual" template
 * - In-Person event -> uses "rejected_non_hybrid" template
 */
export async function rejectAttendeeAction(input: RejectAttendeeInput): Promise<RejectAttendeeResult> {
  try {
    let event = input.eventData;
    if (!event) {
      const { getFirestoreEventById } = await import("@/lib/firestore/client");
      const fetched = await getFirestoreEventById(input.eventId);
      if (!fetched) {
        return { success: false, error: "Event not found." };
      }
      event = fetched;
    }

    const templateKey = resolveRejectedTemplateKeyForEvent(event);
    const rendered = buildRenderedEmailForAttendee({
      templateKey,
      attendee: {
        name: input.attendeeName,
        email: input.attendeeEmail,
      },
      event,
    });

    // 1. Dispatch rejection email to reusable n8n /send-email endpoint
    const emailResult = await sendEmailWebhookAction({
      first_name: rendered.firstName,
      last_name: rendered.lastName,
      email: input.attendeeEmail,
      subjectEmail: rendered.subjectEmail,
      bodyEmail: rendered.bodyEmail,
    });

    if (!emailResult.success) {
      console.error(`[Reject Attendee] Email dispatch failed for ${input.attendeeEmail}:`, emailResult.error);
      return {
        ...emailResult,
        templateKey,
      };
    }

    // 2. Persist status update in Firestore
    const { updateRegistrationStatusAction } = await import("@/lib/firestore/actions");
    const reviewerParam =
      input.reviewer?.id && input.reviewer?.name
        ? { id: input.reviewer.id, name: input.reviewer.name, email: input.reviewer.email }
        : undefined;
    await updateRegistrationStatusAction(input.registrationId, input.eventId, "rejected", reviewerParam);

    const friendlyTypeName =
      templateKey === "rejected_hybrid" ? "Hybrid" : templateKey === "rejected_virtual" ? "Virtual" : "In-Person";

    return {
      success: true,
      status: emailResult.status,
      templateKey,
      message: `Applicant rejected and ${friendlyTypeName} regret email sent.`,
      details: emailResult.details,
    };
  } catch (err) {
    console.error("[Reject Attendee] Exception:", err);
    const errorMsg = extractApiMessage(err, "Failed to reject applicant.");
    return {
      success: false,
      error: errorMsg,
      details: err,
    };
  }
}

export interface ResendInterestEmailInput {
  registrationId: string;
  eventId: string;
  attendeeName: string;
  attendeeEmail: string;
  eventData?: FirestoreEvent;
}

/**
 * Server Action: Resends the interest email for an attendee whose status is pending review.
 * Dispatches via reusable n8n /send-email webhook.
 */
export async function resendInterestEmailAction(input: ResendInterestEmailInput): Promise<EmailDispatchResult> {
  try {
    let event = input.eventData;
    if (!event) {
      const { getFirestoreEventById } = await import("@/lib/firestore/client");
      const fetched = await getFirestoreEventById(input.eventId);
      if (!fetched) {
        return { success: false, error: "Event not found." };
      }
      event = fetched;
    }

    const rendered = buildRenderedEmailForAttendee({
      templateKey: "interest",
      attendee: {
        name: input.attendeeName,
        email: input.attendeeEmail,
      },
      event,
    });

    const emailResult = await sendEmailWebhookAction({
      first_name: rendered.firstName,
      last_name: rendered.lastName,
      email: input.attendeeEmail,
      subjectEmail: rendered.subjectEmail,
      bodyEmail: rendered.bodyEmail,
    });

    if (!emailResult.success) {
      console.error(`[Resend Interest Email] Failed for ${input.attendeeEmail}:`, emailResult.error);
      return emailResult;
    }

    return {
      success: true,
      status: emailResult.status,
      message: `Interest email successfully resent to ${input.attendeeName} (${input.attendeeEmail}).`,
      details: emailResult.details,
    };
  } catch (err) {
    console.error("[Resend Interest Email] Exception:", err);
    const errorMsg = extractApiMessage(err, "Failed to resend interest email.");
    return {
      success: false,
      error: errorMsg,
      details: err,
    };
  }
}
