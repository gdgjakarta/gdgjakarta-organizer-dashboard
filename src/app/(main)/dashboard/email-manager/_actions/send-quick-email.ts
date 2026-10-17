"use server";

import { z } from "zod";

import { splitFullName } from "@/lib/events/email-templates";
import { extractApiMessage } from "@/lib/utils";
import { sendEmailWebhookAction } from "@/server/email-template-actions";

import { convertTemplateToCleanTokens } from "../_components/template-utils";

const quickEmailSchema = z.object({
  eventId: z.string().min(1, "Target event is required"),
  eventTitle: z.string().optional(),
  recipientEmail: z.string().email("A valid recipient email address is required"),
  recipientName: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  headerUrl: z.string().optional(),
  body: z.string().min(1, "Email HTML body is required"),
  eventDetails: z
    .object({
      formattedDate: z.string().optional(),
      formattedTime: z.string().optional(),
      venueName: z.string().optional(),
      venueAddress: z.string().optional(),
      url: z.string().optional(),
      bannerUrl: z.string().optional(),
      descriptionShort: z.string().optional(),
      isVirtual: z.boolean().optional(),
    })
    .optional(),
});

export type QuickEmailInput = z.infer<typeof quickEmailSchema>;

export async function sendQuickEmail(input: QuickEmailInput) {
  const parsed = quickEmailSchema.safeParse(input);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error: `Invalid quick email data: ${errorMsg}` };
  }

  const { data } = parsed;

  try {
    // 1. Resolve Recipient Name (First & Last)
    const rawName = (data.recipientName || "").trim();
    const fallbackFromEmail = data.recipientEmail.split("@")[0] || "Attendee";
    const displayName = rawName || fallbackFromEmail;
    const { firstName: parsedFirst, lastName: parsedLast } = splitFullName(displayName);
    const firstName = parsedFirst || "Attendee";
    const lastName = parsedLast || parsedFirst || "-";

    // 2. Resolve Event Metadata
    const eventName = data.eventTitle || "GDG Jakarta Event";
    const eventDate = data.eventDetails?.formattedDate || "DATE TBD";
    const eventTime = data.eventDetails?.formattedTime || "";
    const eventVenue =
      data.eventDetails?.venueName || (data.eventDetails?.isVirtual ? "Virtual / Online" : "Jakarta, Indonesia");
    const eventAddress = data.eventDetails?.venueAddress || "";
    const eventUrl = data.eventDetails?.url || "https://gdg.community.dev/gdg-jakarta/";
    const headerBannerUrl =
      data.headerUrl?.trim() ||
      data.eventDetails?.bannerUrl ||
      "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png";
    const eventDesc = data.eventDetails?.descriptionShort || "";

    // 3. Convert any legacy n8n expressions in subject/body first
    let cleanSubject = convertTemplateToCleanTokens(data.subject);
    let cleanBody = convertTemplateToCleanTokens(data.body);

    // 4. Interpolate Event Placeholders
    const replaceEventPlaceholders = (text: string) => {
      return text
        .replaceAll("[[EventName]]", eventName)
        .replaceAll("[[EventDate]]", eventDate)
        .replaceAll("[[EventTime]]", eventTime)
        .replaceAll("[[EventVenue]]", eventVenue)
        .replaceAll("[[EventAddress]]", eventAddress)
        .replaceAll("[[EventUrl]]", eventUrl)
        .replaceAll("[[EventBannerUrl]]", headerBannerUrl)
        .replaceAll("[[EventDescription]]", eventDesc);
    };

    // 5. Interpolate Recipient Placeholders
    const replaceRecipientPlaceholders = (text: string) => {
      return text
        .replaceAll("[[Name]]", displayName)
        .replaceAll("[[FirstName]]", firstName)
        .replaceAll("[[LastName]]", lastName)
        .replaceAll("[[Email]]", data.recipientEmail)
        .replaceAll("[[TicketType]]", "Confirmed Entry Pass")
        .replaceAll("[[CheckinStatus]]", "Confirmed");
    };

    cleanSubject = replaceRecipientPlaceholders(replaceEventPlaceholders(cleanSubject));
    cleanBody = replaceRecipientPlaceholders(replaceEventPlaceholders(cleanBody));

    console.log(
      `[sendQuickEmail] Dispatching single email to ${data.recipientEmail} (${displayName}) via Send Email API...`,
    );

    // 6. Dispatch via Send Email API (api/send-email)
    const result = await sendEmailWebhookAction({
      first_name: firstName,
      last_name: lastName,
      email: data.recipientEmail,
      subjectEmail: cleanSubject,
      bodyEmail: cleanBody,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? "Failed to dispatch quick email.",
      };
    }

    return {
      success: true,
      message: `Quick email successfully sent to ${data.recipientEmail}.`,
    };
  } catch (error) {
    console.error("[sendQuickEmail] Exception:", error);
    const cleanError = extractApiMessage(error, "An unexpected error occurred while sending the email.");
    return { success: false, error: cleanError };
  }
}
