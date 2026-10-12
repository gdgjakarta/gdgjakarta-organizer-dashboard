"use server";

import { z } from "zod";

import { extractApiMessage } from "@/lib/utils";

const recipientItemSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  ticketType: z.string().optional(),
  status: z.string().optional(),
});

const bulkEmailSchema = z.object({
  eventId: z.string().min(1, "Event is required"),
  eventTitle: z.string().optional(),
  recipientSource: z.enum(["audience", "spreadsheet"]).default("audience"),
  audienceType: z.string().optional(),
  audienceLabel: z.string().optional(),
  spreadsheetUrl: z.string().url().optional().or(z.literal("")),
  sheetName: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  headerUrl: z.string().optional(),
  body: z.string().min(1, "Email body HTML is required"),
  recipients: z.array(recipientItemSchema).optional(),
});

export type BulkEmailInput = z.infer<typeof bulkEmailSchema>;

export async function sendEmailBlast(data: BulkEmailInput) {
  // Validate the incoming data securely on the server
  const parsed = bulkEmailSchema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error: `Invalid form data: ${errorMsg}` };
  }

  const { data: validData } = parsed;

  // Validation checks based on source
  if (validData.recipientSource === "spreadsheet") {
    if (!validData.spreadsheetUrl) {
      return { success: false, error: "Spreadsheet URL is required when using Google Sheets source." };
    }
    if (!validData.sheetName) {
      return { success: false, error: "Sheet Tab Name is required when using Google Sheets source." };
    }
  } else {
    // Audience source
    if (!validData.audienceType) {
      return { success: false, error: "Audience segment selection is required." };
    }
    if (!validData.recipients || validData.recipients.length === 0) {
      return { success: false, error: "No recipients found for the selected audience segment." };
    }
  }

  const webhookUrl = process.env.N8N_BULK_EMAIL_WEBHOOK_URL || "https://n8n.gdgjakarta.com/webhook/api/send-bulk-email";
  const apiKey =
    process.env.N8N_WEBHOOK_API_KEY ||
    process.env.EVENT_REGISTRATION_WEBHOOK_API_KEY ||
    process.env.N8N_AUTH_SECRET ||
    "";

  const totalCount = validData.recipients?.length ?? 0;

  const payload = {
    eventId: validData.eventId,
    eventTitle: validData.eventTitle || "",
    recipientSource: validData.recipientSource,
    audience: validData.audienceType || "",
    audienceLabel: validData.audienceLabel || "",
    spreadsheetUrl: validData.spreadsheetUrl || "",
    sheetName: validData.sheetName || "",
    subjectEmail: validData.subject,
    headerUrl:
      validData.headerUrl || "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png",
    bodyEmail: validData.body,
    totalRecipients: totalCount,
    recipients: validData.recipients || [],
  };

  console.log(
    `[sendEmailBlast] Dispatching bulk email request for event "${validData.eventId}" (${totalCount} recipients) to ${webhookUrl}...`,
  );

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "GDG-Jakarta-Dashboard/1.0",
    };

    if (apiKey) {
      headers["X-API-Key"] = apiKey;
      headers["x-api-key"] = apiKey;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let responseJson: unknown = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      // not JSON format
    }

    if (!response.ok) {
      console.error(`n8n Webhook Error (${response.status} ${response.statusText}):`, responseText);
      const cleanError = extractApiMessage(
        responseJson || responseText,
        `Bulk email service returned status ${response.status}.`,
      );
      return {
        success: false,
        error: cleanError,
      };
    }

    const cleanSuccessMessage = extractApiMessage(
      responseJson || responseText,
      `Successfully queued bulk email campaign for ${totalCount} recipients.`,
    );

    return {
      success: true,
      message: cleanSuccessMessage,
      totalRecipients: totalCount,
    };
  } catch (error) {
    console.error("[sendEmailBlast] Exception:", error);
    const cleanError = extractApiMessage(error, "An unexpected error occurred while dispatching bulk emails.");
    return { success: false, error: cleanError };
  }
}
