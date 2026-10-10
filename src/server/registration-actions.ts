"use server";

import {
  getDefaultTemplateByKey,
  getDefaultTemplateDataForType,
  interpolateTemplateHtml,
  interpolateTemplateSubject,
  splitFullName,
} from "@/lib/events/email-templates";
import {
  DEFAULT_GDG_CHECKIN_DEADLINE,
  DEFAULT_GDG_SESSION_CAPACITY,
  DEFAULT_GDG_SESSION_TIME,
  GDG_SESSION_CAPACITY_MAP,
  GDG_SESSION_CHECKIN_DEADLINE_MAP,
  GDG_SESSION_TIME_MAP,
} from "@/lib/events/registration-defaults";
import type { EventEmailTemplates } from "@/lib/firestore/types";

import { sendInterestEmailWebhookAction } from "./email-template-actions";

export interface RegistrationWebhookPayload {
  // Top-level compatibility fields for n8n workflows
  Session?: string;
  bevySessionName?: string;
  bevySessionTime?: string;
  bevyCheckinDeadline?: string;
  bevySessionLocation?: string;
  bevySessionLocationUrl?: string;
  venueCapacity?: number;

  event: {
    id: string;
    title: string;
    status: string;
    start_date?: string;
    end_date?: string;
    venue_name?: string;
    audience_type?: string;
    is_virtual?: boolean;
    webhook_url?: string;
    requires_approval?: boolean;
    curation_mode?: boolean;
    banner_url?: string;
    picture_url?: string;
    email_templates?: unknown;
  };
  registration: {
    id: string;
    status: string;
    registered_at: string;
    session_id?: string;
    session_title?: string;
    session_location?: string;
    session_location_url?: string;
    Session?: string;
    ticket_id?: string;
    ticket_name?: string;
    ticket_type?: string;
    ticket_price?: number;
    selected_merchandise?: unknown;
  };
  member: {
    id: string;
    name: string;
    email: string;
    role?: string;
    avatar?: string;
  };
  answers: Record<string, unknown>;
  timestamp: string;
}

export interface WebhookDispatchResult {
  success: boolean;
  dispatched: boolean;
  status?: number;
  message?: string;
  error?: string;
}

/**
 * Resolves the target Webhook URL for registration submissions.
 * Checks environment variables first, then event-level override.
 */
function resolveWebhookUrl(eventWebhookUrl?: string): string | null {
  const envUrl =
    process.env.EVENT_REGISTRATION_WEBHOOK_URL ||
    process.env.N8N_REGISTRATION_WEBHOOK_URL ||
    process.env.N8N_EVENT_REGISTRATION_WEBHOOK_URL ||
    process.env.N8N_WEBHOOK_URL ||
    process.env.REGISTRATION_WEBHOOK_URL;

  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim();
  }

  if (eventWebhookUrl && eventWebhookUrl.trim().length > 0) {
    return eventWebhookUrl.trim();
  }

  return null;
}

/**
 * Server Action: Dispatches registration payload to the designated Webhook API.
 * Automatically resolves session metadata matching GDG Jakarta n8n workflow rules:
 * - "Morning Session" (105 cap, 08:15 WIB - 12:00 WIB, deadline: 09:05 WIB)
 * - "Afternoon Session" (100 cap, 13:10 WIB - 16:55 WIB, deadline: 14:00 WIB)
 * - "Regular Ticket" (136 cap, 12:15 WIB - 17:00 WIB, deadline: 13:15 WIB)
 */
export async function dispatchRegistrationWebhookAction(
  payload: RegistrationWebhookPayload,
): Promise<WebhookDispatchResult> {
  const webhookUrl = resolveWebhookUrl(payload.event.webhook_url);
  const apiKey = process.env.EVENT_REGISTRATION_WEBHOOK_API_KEY || process.env.N8N_WEBHOOK_API_KEY || "";

  // 1. Resolve sessionKey matching n8n code logic
  const rawSession =
    payload.registration.session_title ??
    (payload.answers.Session as string | undefined) ??
    (payload.answers.session as string | undefined) ??
    "";

  let sessionKey = "Regular Ticket";
  if (rawSession) {
    if (rawSession.includes(",")) {
      sessionKey = rawSession.split(",")[0].trim();
    } else {
      sessionKey = rawSession.trim();
    }
  }

  // 2. Resolve metadata matching n8n workflow mapping
  const bevySessionName = sessionKey;
  const bevySessionTime = GDG_SESSION_TIME_MAP[sessionKey] ?? DEFAULT_GDG_SESSION_TIME;
  const bevyCheckinDeadline = GDG_SESSION_CHECKIN_DEADLINE_MAP[sessionKey] ?? DEFAULT_GDG_CHECKIN_DEADLINE;
  const venueCapacity = GDG_SESSION_CAPACITY_MAP[sessionKey] ?? DEFAULT_GDG_SESSION_CAPACITY;

  // 3. Build enriched payload with n8n-compatible Session properties
  const enrichedPayload: RegistrationWebhookPayload = {
    ...payload,
    Session: sessionKey,
    bevySessionName,
    bevySessionTime,
    bevyCheckinDeadline,
    bevySessionLocation: payload.registration.session_location,
    bevySessionLocationUrl: payload.registration.session_location_url,
    venueCapacity,
    registration: {
      ...payload.registration,
      session_title: payload.registration.session_title ?? sessionKey,
      Session: sessionKey,
    },
    answers: {
      ...payload.answers,
      Session: sessionKey,
    },
  };

  // 4. If event requires curation, automatically dispatch pre-constructed interest email to attendee
  const isCurationMode =
    payload.registration.status === "pending" ||
    Boolean(payload.event.requires_approval) ||
    Boolean(payload.event.curation_mode);

  if (isCurationMode) {
    try {
      const { firstName, lastName } = splitFullName(payload.member.name);
      const emailTemplates = payload.event.email_templates as EventEmailTemplates | undefined;
      const rawInterestHtml = emailTemplates?.interest ?? getDefaultTemplateByKey("interest");
      const rawInterestSubject =
        emailTemplates?.interest_subject ?? "Registration Received: {{ $('event-params').item.json.eventName }}";

      const simulatedData = getDefaultTemplateDataForType("interest", {
        id: payload.event.id,
        title: payload.event.title,
        status: payload.event.status as "Published" | "Draft" | "Completed" | "Canceled",
        start_date: payload.event.start_date ?? "",
        end_date: payload.event.end_date ?? "",
        requires_approval: true,
        total_registrations: 0,
        total_approved: 0,
        total_checked_in: 0,
        banner_url: payload.event.banner_url,
        picture_url: payload.event.picture_url,
        email_templates: emailTemplates,
        created_at: "",
        updated_at: "",
      });

      simulatedData.attendee = {
        name: payload.member.name,
        email: payload.member.email,
      };
      simulatedData.event.eventName = payload.event.title;
      const eventBanner = payload.event.banner_url ?? payload.event.picture_url;
      if (eventBanner) {
        simulatedData.event.headerEmailUrl = eventBanner;
      }

      const bodyEmail = interpolateTemplateHtml(rawInterestHtml, simulatedData);
      const subjectEmail = interpolateTemplateSubject(rawInterestSubject, simulatedData);

      void sendInterestEmailWebhookAction({
        first_name: firstName,
        last_name: lastName,
        email: payload.member.email,
        subjectEmail,
        bodyEmail,
      }).then((res) => {
        if (res.success) {
          console.log(`[Registration Curation Flow] Successfully sent interest email to ${payload.member.email}`);
        } else {
          console.warn(`[Registration Curation Flow] Failed to send interest email:`, res.error);
        }
      });
    } catch (err) {
      console.warn("[Registration Curation Flow] Failed to dispatch interest email:", err);
    }
  }

  if (!webhookUrl) {
    console.log(
      "[Registration Webhook] No webhook URL configured yet. Registration saved safely. Prepared payload:\n",
      JSON.stringify(enrichedPayload, null, 2),
    );
    return {
      success: true,
      dispatched: false,
      message: "Registration saved. Webhook URL not provided yet; payload logged on server.",
    };
  }

  console.log(`[Registration Webhook] Dispatching registration payload to ${webhookUrl}...`, {
    eventId: payload.event.id,
    memberEmail: payload.member.email,
    sessionKey,
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "GDG-Jakarta-Dashboard/1.0",
    };

    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(enrichedPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      console.warn(`[Registration Webhook] Webhook returned status ${response.status}:`, responseText.slice(0, 500));
      return {
        success: true,
        dispatched: true,
        status: response.status,
        error: `Webhook returned status ${response.status}: ${responseText.slice(0, 200)}`,
      };
    }

    console.log(`[Registration Webhook] Successfully delivered to ${webhookUrl} (Status: ${response.status})`);
    return {
      success: true,
      dispatched: true,
      status: response.status,
      message: "Webhook delivered successfully.",
    };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    let errorMsg = "Failed to dispatch webhook.";
    if (isAbort) {
      errorMsg = "Webhook delivery timed out after 10 seconds.";
    } else if (error instanceof Error) {
      errorMsg = error.message;
    }

    console.error("[Registration Webhook] Network error dispatching webhook:", errorMsg);

    // Registration itself succeeded; we return soft failure for the webhook call
    return {
      success: true,
      dispatched: false,
      error: errorMsg,
    };
  }
}

/**
 * Server Action: Sends a test ping to verify webhook connectivity from Organizer dashboard.
 */
export async function testRegistrationWebhookAction(targetUrl: string): Promise<WebhookDispatchResult> {
  const cleanUrl = targetUrl.trim();
  if (!cleanUrl) {
    return {
      success: false,
      dispatched: false,
      error: "Please provide a valid Webhook URL to test.",
    };
  }

  const apiKey = process.env.EVENT_REGISTRATION_WEBHOOK_API_KEY || process.env.N8N_WEBHOOK_API_KEY || "";

  const samplePayload: RegistrationWebhookPayload = {
    Session: "Morning Session",
    bevySessionName: "Morning Session",
    bevySessionTime: "08:15 WIB - 12:00 WIB (Morning Session)",
    bevyCheckinDeadline: "09:05 WIB",
    venueCapacity: 105,
    event: {
      id: "sample-event-01",
      title: "Road to DevFest 2026 - Sample Test Event",
      status: "Published",
      start_date: new Date().toISOString(),
      audience_type: "IN_PERSON",
      is_virtual: false,
      webhook_url: cleanUrl,
    },
    registration: {
      id: "sample-event-01_test-member-01",
      status: "approved",
      registered_at: new Date().toISOString(),
      session_id: "morning-session",
      session_title: "Morning Session",
      Session: "Morning Session",
    },
    member: {
      id: "test-member-01",
      name: "Test Participant",
      email: "test.attendee@gdgjakarta.org",
      role: "Member",
    },
    answers: {
      work_email: "test.attendee@gdgjakarta.org",
      whatsapp: "628123456789",
      gender: "Prefer not to say",
      company_or_institution: "GDG Jakarta Community",
      role_or_title: "Software Engineer",
      years_of_experience: "3 – 5 years",
      persona_description: "I'm a professional that works for a startup",
      primary_tech_stack: "TypeScript / JavaScript",
      genai_experience: ["Gemini API / Google AI Studio", "Cloud Run / Container Sandboxes / Vertex AI"],
      expectations: "Testing webhook pipeline integration from GDG Jakarta Dashboard",
      referral_source: "Community Platform (https://gdg.community.dev/gdg-jakarta)",
      terms_agreement: ["I agree to adhere to the GDG Community Guidelines and Code of Conduct."],
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "GDG-Jakarta-Dashboard/1.0-PingTest",
    };

    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }

    const res = await fetch(cleanUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(samplePayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        success: false,
        dispatched: true,
        status: res.status,
        error: `Webhook returned status HTTP ${res.status}: ${errText.slice(0, 150)}`,
      };
    }

    return {
      success: true,
      dispatched: true,
      status: res.status,
      message: `Webhook responded with HTTP ${res.status} OK!`,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to connect to webhook.";
    return {
      success: false,
      dispatched: false,
      error: errorMsg,
    };
  }
}

/**
 * Approved Attendee Webhook Payload
 * Matches standard n8n webhook API specification for GDG Jakarta:
 * POST /webhook/api/approved-attendee
 */
import type {
  ApproveAttendeeWebhookResult,
  ApprovedAttendeeWebhookPayload,
} from "@/lib/events/approved-attendee-webhook";
import { resolveApprovedAttendeeWebhookUrl } from "@/lib/events/approved-attendee-webhook";

export type { ApproveAttendeeWebhookResult, ApprovedAttendeeWebhookPayload };

/**
 * Server Action: Dispatches approved attendee notification to the n8n webhook API.
 * Uses N8N_WEBHOOK_API_KEY like member import.
 *
 * Endpoint: POST https://n8n.gdgjakarta.com/webhook/api/approved-attendee
 * Headers:
 *   Content-Type: application/json
 *   x-api-key: YOUR_API_KEY_HERE
 *
 * Payload:
 * {
 *   "email": "jane.doe@example.com",
 *   "fullName": "Jane Doe",
 *   "status": "approved",
 *   "bevyEventId": "12345",
 *   "bevyChapterId": "678",
 *   "sessionName": "Regular Ticket",
 *   "sessionCapacity": 100,
 *   "subjectEmail": "Your Official Ticket: GDG DevFest Jakarta",
 *   "bodyEmail": "<!DOCTYPE html>...<img src=\"data:image/png;base64,{{ $('Generate QR Code').item.json.qrCode }}\">...Ref: {{ $('Add Bevy Attendee API').item.json.attendee_code }}...</html>"
 * }
 */
export async function approveAttendeeWebhookAction(
  payload: ApprovedAttendeeWebhookPayload,
): Promise<ApproveAttendeeWebhookResult> {
  const customBaseUrl = process.env.N8N_WEBHOOK_BASE_URL ?? process.env.N8N_BASE_URL;
  let webhookUrl = resolveApprovedAttendeeWebhookUrl(customBaseUrl);

  if (!customBaseUrl) {
    const legacyUrl = process.env.N8N_APPROVED_ATTENDEE_WEBHOOK_URL ?? process.env.APPROVED_ATTENDEE_WEBHOOK_URL;
    if (legacyUrl) {
      webhookUrl = legacyUrl;
    }
  }

  const authHeaderName = process.env.N8N_WEBHOOK_HEADER_NAME ?? process.env.N8N_AUTH_HEADER_NAME ?? "x-api-key";

  const apiKey =
    process.env.N8N_WEBHOOK_API_KEY ??
    process.env.EVENT_REGISTRATION_WEBHOOK_API_KEY ??
    process.env.N8N_AUTH_SECRET ??
    "";

  console.log(`[Approved Attendee Webhook] Sending POST to ${webhookUrl}...`, {
    email: payload.email,
    fullName: payload.fullName,
    status: payload.status,
    bevyEventId: payload.bevyEventId,
    bevyChapterId: payload.bevyChapterId,
    sessionName: payload.sessionName,
    sessionCapacity: payload.sessionCapacity,
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "GDG-Jakarta-Dashboard/1.0",
    };

    if (apiKey) {
      headers[authHeaderName] = apiKey;
      headers["x-api-key"] = apiKey;
      headers["X-API-Key"] = apiKey;
    }

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

    // Response status is false means error with details in error message
    const hasStatusFalse =
      bodyData &&
      (bodyData.status === false ||
        bodyData.status === "false" ||
        bodyData.status === "error" ||
        bodyData.status === "failed" ||
        bodyData.success === false);

    if (!response.ok || hasStatusFalse) {
      console.error(
        `[Approved Attendee Webhook] Error response (HTTP ${response.status}):`,
        responseText.slice(0, 500),
      );

      let errorMessage = `Approved attendee webhook returned status ${response.status}.`;
      if (typeof bodyData?.message === "string") {
        errorMessage = bodyData.message;
      } else if (typeof bodyData?.error === "string") {
        errorMessage = bodyData.error;
      } else if (typeof bodyData?.errorMessage === "string") {
        errorMessage = bodyData.errorMessage;
      } else if (typeof bodyData?.details === "string") {
        errorMessage = bodyData.details;
      } else if (responseText && responseText.length < 300) {
        errorMessage = responseText;
      }

      return {
        success: false,
        status: response.status,
        error: errorMessage,
        details: responseJson || responseText,
      };
    }

    console.log(`[Approved Attendee Webhook] Succeeded for ${payload.email}:`, responseText.slice(0, 300));

    let successMessage = "Attendee approved successfully via webhook.";
    if (typeof bodyData?.message === "string") {
      successMessage = bodyData.message;
    } else if (typeof bodyData?.details === "string") {
      successMessage = bodyData.details;
    }

    return {
      success: true,
      status: response.status,
      message: successMessage,
      details: responseJson,
    };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    let errorMessage = "Failed to connect to approval webhook.";
    if (isAbort) {
      errorMessage = "Webhook request timed out after 15 seconds.";
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    console.error("[Approved Attendee Webhook] Exception occurred:", errorMessage);

    return {
      success: false,
      error: errorMessage,
      details: error,
    };
  }
}
