import type {
  CertificateEngine,
  CertificateOverlayField,
  CertificateType,
  EventCertificateConfig,
  EventCertificateRecord,
  FirestoreRegistration,
} from "@/lib/firestore/types";

const DISQUALIFIED_REGISTRATION_STATUSES = new Set(["cancelled", "canceled", "rejected", "expired", "failed"]);

const PRESENTER_ROLE_LABELS: Record<string, string> = {
  speakers: "Speaker",
  mentors: "Mentor",
  facilitators: "Facilitator",
  panelists: "Panelist",
  judges: "Judge",
  moderators: "Moderator",
  hosts: "Host",
};

export const CERTIFICATE_PLACEHOLDERS = [
  "{{recipient_name}}",
  "{{event_name}}",
  "{{event_date}}",
  "{{role}}",
  "{{talk_title}}",
  "{{certificate_id}}",
  "{{issued_date}}",
  "{{verify_url}}",
  "{{verification_badge}}",
  "{{qr_code}}",
] as const;

/**
 * Extracts a Google Drive/Slides/Drawings file ID and auto-detects the template engine from a URL or raw ID.
 */
export function extractGoogleFileId(
  urlOrId: string | null | undefined,
): { fileId: string; detectedEngine?: CertificateEngine } | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;

  const slidesMatch = trimmed.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]{10,})/);
  if (slidesMatch) {
    return { fileId: slidesMatch[1], detectedEngine: "google_slides" };
  }

  const drawingMatch = trimmed.match(/docs\.google\.com\/drawings\/d\/([a-zA-Z0-9_-]{10,})/);
  if (drawingMatch) {
    return { fileId: drawingMatch[1], detectedEngine: "google_drawing" };
  }

  const driveFileMatch = trimmed.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]{10,})/);
  if (driveFileMatch) {
    return { fileId: driveFileMatch[1] };
  }

  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) {
    return { fileId: trimmed };
  }

  return null;
}

/**
 * Checks whether attendance certificates are currently unlocked for an event.
 */
export function isEventWrappedUpForCertificates(
  event: { status?: string; end_date?: string; certificate_config?: EventCertificateConfig } | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!event) return false;
  const cfg = event.certificate_config?.attendance;
  if (!cfg?.enabled || cfg.paused) return false;

  if (cfg.released_at && cfg.released_at.trim().length > 0) {
    return true;
  }

  const releaseMode = cfg.release_mode ?? "auto_on_event_end";
  if (releaseMode !== "auto_on_event_end") {
    return false;
  }

  if (event.status === "Completed") {
    return true;
  }

  const releaseAtMillis =
    typeof cfg.release_at_millis === "number" && Number.isFinite(cfg.release_at_millis)
      ? cfg.release_at_millis
      : event.end_date
        ? Date.parse(event.end_date)
        : Number.NaN;

  return Number.isFinite(releaseAtMillis) && nowMs >= releaseAtMillis;
}

/**
 * Checks main-event check-in eligibility (excludes cancelled/rejected/expired/failed).
 */
export function isRegistrationEligibleForAttendanceCertificate(
  reg: Pick<FirestoreRegistration, "is_checked_in" | "status"> | null | undefined,
): boolean {
  if (!reg) return false;
  const status = String(reg.status || "").toLowerCase();
  if (DISQUALIFIED_REGISTRATION_STATUSES.has(status)) return false;
  return Boolean(reg.is_checked_in) || status === "attended";
}

export function formatPresenterRoleLabel(role?: string | null): string {
  if (!role) return "Speaker";
  const key = String(role).toLowerCase();
  return PRESENTER_ROLE_LABELS[key] || role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Public certificate verification URL following the current environment origin (gdgjakarta.com in production).
 */
export function buildCertificateVerifyUrl(token: string): string {
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") || "https://gdgjakarta.com";
  return `${baseUrl}/certificates/${encodeURIComponent(token)}`;
}

export function buildCertificateCode(eventId: string, token: string): string {
  const year = new Date().getFullYear();
  const suffix = token
    .replace(/^cert_/, "")
    .slice(0, 6)
    .toUpperCase();
  const ev =
    eventId
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 4)
      .toUpperCase() || "EVT";
  return `GDGJKT-${year}-${ev}-${suffix}`;
}

export function buildLinkedInAddCertificationUrl(
  cert: Pick<EventCertificateRecord, "event_title" | "certificate_type" | "certificate_code" | "issued_at" | "token">,
): string {
  const titlePrefix = cert.certificate_type === "speaker" ? "Certificate of Appreciation" : "Certificate of Attendance";
  const issuedDate = cert.issued_at ? new Date(cert.issued_at) : new Date();
  const issueYear = Number.isNaN(issuedDate.getTime()) ? new Date().getFullYear() : issuedDate.getFullYear();
  const issueMonth = Number.isNaN(issuedDate.getTime()) ? new Date().getMonth() + 1 : issuedDate.getMonth() + 1;

  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: `${titlePrefix} — ${cert.event_title}`,
    organizationName: "GDG Jakarta",
    issueYear: String(issueYear),
    issueMonth: String(issueMonth),
    certId: cert.certificate_code || cert.token,
    certUrl: buildCertificateVerifyUrl(cert.token),
  });

  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export function formatCertificateDate(dateStr?: string | null): string {
  if (!dateStr) {
    return new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function buildCertificatePlaceholderMap(params: {
  recipientName: string;
  eventName: string;
  eventDate?: string | null;
  role: string;
  talkTitle?: string | null;
  certificateCode: string;
  issuedDate?: string | null;
  verifyUrl: string;
}): Record<string, string> {
  return {
    "{{recipient_name}}": params.recipientName,
    "{{event_name}}": params.eventName,
    "{{event_date}}": formatCertificateDate(params.eventDate),
    "{{role}}": params.role,
    "{{talk_title}}": params.talkTitle || "",
    "{{certificate_id}}": params.certificateCode,
    "{{certificateId}}": params.certificateCode,
    "{{certificate_code}}": params.certificateCode,
    "{{issued_date}}": formatCertificateDate(params.issuedDate),
    "{{verify_url}}": params.verifyUrl,
  };
}

/**
 * Default normalized (0..1) overlay fields tuned for a 4:3 (720 x 540 pt) Google Drawing background.
 */
export function buildDefaultOverlayFields(type: CertificateType): CertificateOverlayField[] {
  const base: CertificateOverlayField[] = [
    {
      key: "recipient_name",
      x: 0.1,
      y: 0.44,
      width: 0.8,
      font_size: 32,
      align: "center",
      bold: true,
      color: "#1a73e8",
    },
    {
      key: "event_name",
      x: 0.12,
      y: 0.56,
      width: 0.76,
      font_size: 16,
      align: "center",
      bold: true,
      color: "#202124",
    },
    {
      key: "event_date",
      x: 0.15,
      y: 0.63,
      width: 0.7,
      font_size: 12,
      align: "center",
      bold: false,
      color: "#5f6368",
    },
    {
      key: "certificate_id",
      x: 0.06,
      y: 0.91,
      width: 0.4,
      font_size: 9,
      align: "left",
      bold: false,
      color: "#5f6368",
    },
    {
      key: "qr_code",
      x: 0.86,
      y: 0.78,
      width: 0.09,
      font_size: 10,
      align: "center",
      bold: false,
      color: "#202124",
    },
  ];

  if (type === "speaker") {
    base.splice(1, 0, {
      key: "role",
      x: 0.2,
      y: 0.51,
      width: 0.6,
      font_size: 13,
      align: "center",
      bold: true,
      color: "#3c4043",
    });
  }

  return base;
}
