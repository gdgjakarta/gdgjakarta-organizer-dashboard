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
  sessionTitle: z.string().optional(),
  venueGuideUrl: z.string().optional(),
  vehicleTicketUrl: z.string().optional(),
  customEventPlaceholders: z.record(z.string(), z.string()).optional(),
  customAttendeePlaceholders: z.record(z.string(), z.string()).optional(),
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
    const sessionTitle = data.sessionTitle || "Keynote: Building Production AI Agents with Gemini";
    const eventVenueUrl =
      data.venueGuideUrl ||
      data.customEventPlaceholders?.EventVenueUrl ||
      data.customEventPlaceholders?.VenueGuideUrl ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${eventVenue} ${eventAddress}`.trim())}`;
    const vehicleTicketUrl =
      data.vehicleTicketUrl ||
      data.customEventPlaceholders?.VehicleTicketUrl ||
      "https://drive.google.com/file/d/sample-vehicle-ticket/view";

    // 3. Convert any legacy n8n expressions in subject/body first
    let cleanSubject = convertTemplateToCleanTokens(data.subject);
    let cleanBody = convertTemplateToCleanTokens(data.body);

    // 4. Interpolate Event Placeholders
    const replaceToken = (input: string, key: string, value: string) => {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return input.replace(new RegExp(`\\[\\[\\s*${escaped}\\s*\\]\\]`, "gi"), value);
    };

    const replaceEventPlaceholders = (text: string) => {
      let t = text;
      if (data.customEventPlaceholders) {
        for (const [key, val] of Object.entries(data.customEventPlaceholders)) {
          if (val !== undefined && val !== null && val !== "") {
            t = replaceToken(t, key, String(val));
          }
        }
      }
      t = replaceToken(t, "EventName", eventName);
      t = replaceToken(t, "EventDate", eventDate);
      t = replaceToken(t, "EventTime", eventTime);
      t = replaceToken(t, "EventVenue", eventVenue);
      t = replaceToken(t, "EventVenueUrl", eventVenueUrl);
      t = replaceToken(t, "VenueGuideUrl", eventVenueUrl);
      t = replaceToken(t, "EventAddress", eventAddress);
      t = replaceToken(t, "EventUrl", eventUrl);
      t = replaceToken(t, "EventBannerUrl", headerBannerUrl);
      t = replaceToken(t, "EventDescription", eventDesc);
      t = replaceToken(t, "SessionTitle", sessionTitle);
      t = replaceToken(t, "VehicleTicketUrl", vehicleTicketUrl);
      return t;
    };

    // 5. Interpolate Recipient Placeholders
    const replaceRecipientPlaceholders = (text: string) => {
      const venueTicketUrl =
        data.customAttendeePlaceholders?.VenueTicketUrl || "https://drive.google.com/file/d/sample-venue-ticket/view";
      let t = text;
      t = replaceToken(t, "Name", displayName);
      t = replaceToken(t, "FirstName", firstName);
      t = replaceToken(t, "LastName", lastName);
      t = replaceToken(t, "Email", data.recipientEmail);
      t = replaceToken(t, "TicketType", data.customAttendeePlaceholders?.TicketType || "Confirmed Entry Pass");
      t = replaceToken(t, "TicketCode", data.customAttendeePlaceholders?.TicketCode || "GDG-JKT-89241");
      t = replaceToken(t, "AttendeeId", data.customAttendeePlaceholders?.AttendeeId || "2793132");
      t = replaceToken(t, "CheckinStatus", data.customAttendeePlaceholders?.CheckinStatus || "Confirmed");
      t = replaceToken(t, "VenueTicketUrl", venueTicketUrl);

      if (data.customAttendeePlaceholders) {
        for (const [key, val] of Object.entries(data.customAttendeePlaceholders)) {
          if (val !== undefined && val !== null) {
            t = replaceToken(t, key, String(val));
          }
        }
      }
      return t;
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
