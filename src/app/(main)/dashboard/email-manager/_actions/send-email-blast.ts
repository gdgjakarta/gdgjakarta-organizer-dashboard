"use server";

import { z } from "zod";

import { extractApiMessage } from "@/lib/utils";

const formSchema = z.object({
  eventId: z.string().min(1),
  spreadsheetUrl: z.string().url(),
  sheetName: z.string().min(1),
  subject: z.string().min(1),
  headerUrl: z.string().optional(),
  body: z.string().min(1),
});

export async function sendEmailBlast(data: z.infer<typeof formSchema>) {
  // Validate the incoming data securely on the server
  const parsedData = formSchema.safeParse(data);
  if (!parsedData.success) {
    return { success: false, error: "Invalid form data provided. Please check all required fields." };
  }

  const webhookUrl = "https://n8n.gdgjakarta.com/webhook/api/send-bulk-email";

  const payload = {
    eventId: parsedData.data.eventId,
    spreadsheetUrl: parsedData.data.spreadsheetUrl,
    sheetName: parsedData.data.sheetName,
    subjectEmail: parsedData.data.subject,
    headerUrl:
      parsedData.data.headerUrl ||
      "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png",
    bodyEmail: parsedData.data.body,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.N8N_WEBHOOK_API_KEY || "",
      },
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
        `Email blast service returned status ${response.status}.`,
      );
      return {
        success: false,
        error: cleanError,
      };
    }

    const cleanSuccessMessage = extractApiMessage(
      responseJson || responseText,
      "Email blast request was sent successfully.",
    );

    return {
      success: true,
      message: cleanSuccessMessage,
    };
  } catch (error) {
    console.error("[sendEmailBlast] Exception:", error);
    const cleanError = extractApiMessage(error, "An unexpected error occurred while connecting to the email service.");
    return { success: false, error: cleanError };
  }
}
