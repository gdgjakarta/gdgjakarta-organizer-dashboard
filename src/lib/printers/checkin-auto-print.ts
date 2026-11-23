import { DEFAULT_COMBINED_QUESTIONS } from "@/lib/events/registration-defaults";
import { enqueuePrintJobAction, fetchPrinterConfigAction } from "@/lib/firestore/actions";
import type { CustomQuestion, FirestoreRegistration } from "@/lib/firestore/types";
import { DEFAULT_LABEL_TEMPLATE, renderLabelTemplate } from "@/lib/printers/templates";
import type { PrinterConfig } from "@/lib/printers/types";

function getAnswerDisplay(
  reg: FirestoreRegistration,
  keys: string[],
  questions?: CustomQuestion[],
  labelKeywords?: string[],
): string {
  if (!reg.answers) return "";
  for (const key of keys) {
    const val = reg.answers[key];
    if (Array.isArray(val) && val.length > 0) return val.join(", ");
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  if (labelKeywords && labelKeywords.length > 0) {
    for (const [qId, val] of Object.entries(reg.answers)) {
      if (qId === "session_id" || qId === "session_title" || qId === "session" || qId === "bevy_user_id") continue;
      const strVal = Array.isArray(val) ? val.join(", ") : typeof val === "string" ? val.trim() : "";
      if (!strVal) continue;
      const customLabel = questions?.find((q) => q.id.toLowerCase() === qId.toLowerCase())?.label ?? "";
      const defaultLabel =
        DEFAULT_COMBINED_QUESTIONS.find((q) => q.id.toLowerCase() === qId.toLowerCase())?.label ?? "";
      const haystack = `${qId} ${customLabel} ${defaultLabel}`.toLowerCase();
      if (labelKeywords.some((kw) => haystack.includes(kw))) {
        return strVal;
      }
    }
  }
  return "";
}

export function getRegistrantOrg(reg: FirestoreRegistration, questions?: CustomQuestion[]): string {
  return getAnswerDisplay(
    reg,
    [
      "company_or_institution",
      "institution",
      "company",
      "organization",
      "university",
      "company_name",
      "institution_name",
      "school",
      "instansi",
      "kampus",
      "perusahaan",
    ],
    questions,
    [
      "institution",
      "company",
      "organization",
      "university",
      "school",
      "employer",
      "instansi",
      "kampus",
      "perusahaan",
      "universitas",
    ],
  );
}

export function getRegistrantRole(reg: FirestoreRegistration, questions?: CustomQuestion[]): string {
  return getAnswerDisplay(
    reg,
    [
      "role_or_title",
      "job_title",
      "current_role",
      "job_role",
      "role",
      "position",
      "occupation",
      "profession",
      "pekerjaan",
      "jabatan",
      "persona_description",
      "title",
    ],
    questions,
    ["role", "title", "position", "occupation", "job", "profession", "pekerjaan", "jabatan"],
  );
}

export function buildDeterministicCheckInJobId(eventId: string | number, registrationId: string): string {
  const cleanEvent = String(eventId).replace(/[^a-zA-Z0-9_-]/g, "_");
  const cleanReg = String(registrationId).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `job_${cleanEvent}_${cleanReg}`;
}

export interface EnqueueCheckInBadgeParams {
  eventId: string;
  eventTitle?: string;
  registration: FirestoreRegistration;
  attendeeIdOverride?: string | number | null;
  questions?: CustomQuestion[];
  /**
   * When provided (e.g. from the QR Scanner's local toggle), overrides the saved `auto_print_on_checkin` flag.
   * When omitted (e.g. from the Registrants table check-in switch or background watcher), uses the event/system
   * `auto_print_on_checkin` flag.
   */
  forceAutoPrint?: boolean;
  /**
   * Manual print/reprint trigger (e.g. "Print Badge" button on Registrants list or Application Dossier).
   * Bypasses `auto_print_on_checkin` / `enabled` guards and creates a fresh job document every time.
   */
  forceNewJob?: boolean;
}

/**
 * Universal Check-In Auto-Print Enqueue:
 * Called whenever an attendee's main check-in transitions to `is_checked_in: true` (from QR Scanner, Registrants
 * table toggle, Applicant Detail dialog, or the running Print Station check-in watcher), or manually via `forceNewJob`.
 * Uses a deterministic job ID (`job_${eventId}_${registrationId}`) for check-in auto-print so concurrent callers never
 * enqueue duplicate labels, and stores the exact paper dimensions (`paper_width_mm`, `paper_height_mm`, `orientation`)
 * on the job document.
 */
export async function enqueueCheckInBadgeIfEnabled({
  eventId,
  eventTitle,
  registration,
  attendeeIdOverride,
  questions,
  forceAutoPrint,
  forceNewJob,
}: EnqueueCheckInBadgeParams): Promise<{ enqueued: boolean; jobId?: string; error?: string }> {
  try {
    let eventPrinterCfg: Partial<PrinterConfig> | null = null;
    let resolvedEventTitle = eventTitle;
    let resolvedQuestions = questions;

    try {
      const { getFirestoreEventById } = await import("@/lib/firestore/client");
      const evDoc = await getFirestoreEventById(String(eventId));
      if (evDoc?.printer_config) {
        eventPrinterCfg = evDoc.printer_config;
      }
      if (!resolvedEventTitle && evDoc?.title) {
        resolvedEventTitle = evDoc.title;
      }
      if (!resolvedQuestions && evDoc?.custom_questions) {
        resolvedQuestions = evDoc.custom_questions;
      }
    } catch (err) {
      console.warn("[CheckInAutoPrint] Could not fetch event printer config:", err);
    }

    const cfgRes = await fetchPrinterConfigAction();
    const systemPrinterCfg = cfgRes.success && cfgRes.config ? cfgRes.config : null;

    if (!forceNewJob) {
      // Respect explicit disablement
      if (eventPrinterCfg && eventPrinterCfg.enabled === false) {
        return { enqueued: false };
      }
      if (!eventPrinterCfg && systemPrinterCfg && systemPrinterCfg.enabled === false) {
        return { enqueued: false };
      }

      // Check whether auto_print_on_checkin is enabled (unless caller explicitly forced it via scanner switch)
      const configuredAutoPrint =
        eventPrinterCfg?.auto_print_on_checkin ?? systemPrinterCfg?.auto_print_on_checkin ?? false;
      const shouldAutoPrint = forceAutoPrint !== undefined ? forceAutoPrint : configuredAutoPrint;
      if (!shouldAutoPrint) {
        return { enqueued: false };
      }
    }

    const templateToUse = eventPrinterCfg?.template_html || systemPrinterCfg?.template_html || DEFAULT_LABEL_TEMPLATE;
    const widthMm = eventPrinterCfg?.paper_width_mm ?? systemPrinterCfg?.paper_width_mm ?? 50;
    const heightMm = eventPrinterCfg?.paper_height_mm ?? systemPrinterCfg?.paper_height_mm ?? 30;
    const orientation = eventPrinterCfg?.orientation ?? systemPrinterCfg?.orientation ?? "landscape";

    const finalAttendeeId = attendeeIdOverride || registration.bevy_attendee_id || registration.id;
    const resolvedRole = getRegistrantRole(registration, resolvedQuestions) || "Participant";
    const resolvedCompany = getRegistrantOrg(registration, resolvedQuestions) || "GDG Community";
    const resolvedTicketCode = registration.attendee_code || `#${finalAttendeeId}`;
    const resolvedTicketType =
      registration.ticket_type === "free"
        ? "Free RSVP"
        : registration.ticket_type === "commitment_fee"
          ? "Commitment Fee"
          : registration.ticket_type === "paid" || registration.ticket_price
            ? "Paid Pass"
            : "Paid Pass";
    const resolvedTicketName = registration.ticket_name || registration.ticket_tier || "Regular";
    const qrPayload = `${eventId}:${finalAttendeeId}`;
    const attendeeName = String(
      registration.member_name ||
        registration.answers?.full_name ||
        registration.answers?.["Full Name"] ||
        registration.answers?.Name ||
        registration.member_email ||
        "Attendee",
    );

    const renderedHtml = renderLabelTemplate(templateToUse, {
      name: attendeeName,
      email: registration.member_email || undefined,
      title: resolvedRole,
      company: resolvedCompany,
      ticketType: resolvedTicketType,
      ticketName: resolvedTicketName,
      sessionTrack:
        (registration.answers?.session_title as string) ||
        (registration.answers?.Session as string) ||
        (registration.answers?.session as string) ||
        registration.session_title ||
        undefined,
      eventTitle: resolvedEventTitle || `Event #${eventId}`,
      eventId,
      attendeeId: finalAttendeeId,
      ticketCode: resolvedTicketCode,
      attendeeCode: resolvedTicketCode,
      qrPayload,
      answers: registration.answers || {},
    });

    const deterministicId = buildDeterministicCheckInJobId(eventId, registration.id);
    const res = await enqueuePrintJobAction(
      {
        event_id: String(eventId),
        attendee_id: finalAttendeeId,
        registration_id: registration.id,
        member_name: attendeeName,
        member_title: resolvedRole,
        member_company: resolvedCompany,
        qr_payload: qrPayload,
        rendered_html: renderedHtml,
        paper_width_mm: widthMm,
        paper_height_mm: heightMm,
        orientation,
        job_type: "badge",
      },
      forceNewJob ? { forceNewJob: true } : { deterministicId },
    );

    return { enqueued: res.success, jobId: res.jobId, error: res.error };
  } catch (err) {
    console.warn("[CheckInAutoPrint] Failed to enqueue check-in badge:", err);
    return { enqueued: false, error: err instanceof Error ? err.message : "Failed to queue badge print." };
  }
}
