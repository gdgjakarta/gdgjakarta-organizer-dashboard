import { escapeHtml, initialsOf, injectNameFit, shortenName } from "./name-fit";
import { generateQrSvgDataUrl } from "./qr-svg";
import type { LabelTemplateData, PrinterConfig } from "./types";

/**
 * Generates core CSS dynamically sized to the configured paper roll dimensions and orientation.
 */
export function buildLabelCoreCss(
  widthMm = 50,
  heightMm = 30,
  orientation: "portrait" | "landscape" = "landscape",
): string {
  const isPortrait = orientation === "portrait" || heightMm > widthMm;
  const baseW = isPortrait ? 30 : 50;
  const baseH = isPortrait ? 50 : 30;
  const scale = Math.max(0.7, Math.min(1.5, Math.min(widthMm / baseW, heightMm / baseH)));
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const padVMm = round1(2.0 * scale);
  const padHMm = round1((isPortrait ? 2.0 : 2.5) * scale);
  const namePt = round1((isPortrait ? 12.0 : 16.0) * scale);
  const titlePt = round1((isPortrait ? 7.5 : 8.0) * scale);
  const companyPt = round1((isPortrait ? 6.5 : 6.8) * scale);
  const refCodePt = round1((isPortrait ? 5.5 : 6.0) * scale);
  const pillPt = round1((isPortrait ? 5.5 : 6.0) * scale);
  const eventPt = round1(5.0 * scale);
  const qrSizeMm = round1((isPortrait ? 18.0 : 15.5) * scale);

  return `      @page {
        size: ${widthMm}mm ${heightMm}mm;
        margin: 0;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        width: ${widthMm}mm;
        height: ${heightMm}mm;
        overflow: hidden;
        font-family: 'Google Sans', 'Google Sans Flex', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
        font-weight: 400;
        background-color: #ffffff;
        color: #000000;
        -webkit-font-smoothing: antialiased;
      }

      .ticket-badge {
        width: ${widthMm}mm;
        height: ${heightMm}mm;
        padding: ${padVMm}mm ${padHMm}mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: ${isPortrait ? "1.5mm" : "0.5mm"};
        overflow: hidden;
      }

      .attendee-name {
        flex: 0 0 auto;
        width: 100%;
        font-size: ${namePt}pt;
        font-weight: 400;
        line-height: 1.15;
        white-space: normal;
        overflow-wrap: break-word;
        word-break: break-word;
        text-transform: capitalize;
      }

      .ticket-body {
        flex: 1;
        min-height: 0;
        width: 100%;
        display: flex;
        flex-direction: ${isPortrait ? "column-reverse" : "row"};
        align-items: ${isPortrait ? "stretch" : "flex-end"};
        justify-content: space-between;
        gap: ${isPortrait ? "1.5mm" : "2mm"};
      }

      .ticket-details {
        flex: 1 1 0%;
        min-width: 0;
        width: ${isPortrait ? "100%" : "auto"};
        height: ${isPortrait ? "auto" : "100%"};
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: ${isPortrait ? "0.8mm" : "0.4mm"};
        overflow: hidden;
      }

      .attendee-title {
        font-size: ${titlePt}pt;
        font-family: 'Google Sans Flex', 'Google Sans', Arial, sans-serif;
        font-weight: 300;
        line-height: 1.12;
        white-space: normal;
        overflow-wrap: break-word;
        word-break: break-word;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
      }

      .attendee-company {
        font-size: ${companyPt}pt;
        font-family: 'Google Sans Flex', 'Google Sans', Arial, sans-serif;
        font-weight: 300;
        line-height: 1.12;
        margin-top: 0.3mm;
        white-space: normal;
        overflow-wrap: break-word;
        word-break: break-word;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
      }

      .attendee-title:empty,
      .attendee-company:empty {
        display: none;
      }

      .ticket-details > div:first-child {
        flex: 1 1 auto;
        min-height: 0;
        min-width: 0;
        overflow: hidden;
      }

      .ref-code {
        flex: 0 0 auto;
        font-size: ${refCodePt}pt;
        font-weight: 400;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.3px;
        line-height: 1.1;
        white-space: normal;
        overflow-wrap: break-word;
        word-break: break-word;
        align-self: flex-start;
      }

      .ticket-footer {
        flex: 0 0 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.3mm;
      }

      .ticket-badge-pill {
        align-self: flex-start;
        max-width: 100%;
        font-size: ${pillPt}pt;
        font-weight: 700;
        padding: 0.5mm 1.5mm;
        background-color: #000000;
        color: #ffffff;
        border-radius: 2px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        line-height: 1.1;
        white-space: normal;
        overflow-wrap: break-word;
        word-break: break-word;
      }

      .event-name {
        font-size: ${eventPt}pt;
        font-family: 'Google Sans Flex', 'Google Sans', Arial, sans-serif;
        font-weight: 300;
        line-height: 1.15;
        white-space: normal;
        overflow-wrap: break-word;
        word-break: break-word;
      }

      .ticket-qr-section {
        flex: 0 0 ${qrSizeMm}mm;
        width: ${qrSizeMm}mm;
        height: ${qrSizeMm}mm;
        align-self: ${isPortrait ? "center" : "flex-end"};
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .qr-container {
        width: 100%;
        height: 100%;
        display: block;
      }

      .qr-container svg,
      .qr-container img {
        width: 100%;
        height: 100%;
        display: block;
        shape-rendering: crispEdges;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
        image-rendering: pixelated;
      }`;
}

export const LABEL_CORE_CSS = buildLabelCoreCss(50, 30, "landscape");

export function buildDefaultLabelTemplate(
  widthMm = 50,
  heightMm = 30,
  orientation: "portrait" | "landscape" = "landscape",
): string {
  const isPortrait = orientation === "portrait" || heightMm > widthMm;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Badge: [[EventName]]</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Google+Sans+Flex:wght@100..900&display=block"
      rel="stylesheet"
    />
    <style>
${buildLabelCoreCss(widthMm, heightMm, orientation)}
    </style>
  </head>
  <body>
    <div class="ticket-badge">
      <div class="attendee-name" data-fit-lines="${isPortrait ? "2" : "1"}">[[Name]]</div>

      <div class="ticket-body">
        <div class="ticket-details">
          <div>
            <div class="attendee-title">[[title]]</div>
            <div class="attendee-company">[[company]]</div>
          </div>
          <div class="ref-code">[[ticketCode]]</div>
          <div class="ticket-footer">
            <span class="ticket-badge-pill">[[ticketName]]</span>
            <div class="event-name">[[EventName]]</div>
          </div>
        </div>

        <div class="ticket-qr-section">
          <div class="qr-container">[[qr]]</div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export const DEFAULT_LABEL_TEMPLATE = buildDefaultLabelTemplate(50, 30, "landscape");

/**
 * Synchronizes the <style> block and name-fit line count inside the HTML template when paper dimensions or orientation change.
 */
export function syncTemplateDimensions(
  html: string,
  widthMm: number,
  heightMm: number,
  orientation: "portrait" | "landscape",
): string {
  const isPortrait = orientation === "portrait" || heightMm > widthMm;
  let full = ensureFullLabelHtml(html, widthMm, heightMm, orientation);
  const newCss = buildLabelCoreCss(widthMm, heightMm, orientation);
  if (/<style[^>]*>[\s\S]*?<\/style>/i.test(full)) {
    full = full.replace(/<style[^>]*>[\s\S]*?<\/style>/i, `<style>\n${newCss}\n    </style>`);
  }
  // Allow 2 lines for attendee name in portrait so full names don't collapse into initials ("F. T.")
  full = full.replace(
    /(<div\b[^>]*class="[^"]*attendee-name[^"]*"[^>]*\bdata-fit-lines=")\d+(")/i,
    `$1${isPortrait ? "2" : "1"}$2`,
  );
  return full;
}

/**
 * Upgrades a legacy body-only or earlier default template into the current full HTML document
 * with Google Font (Google Sans), [[ticketCode]], and paper sizing support.
 */
export function ensureFullLabelHtml(
  html: string,
  widthMm = 50,
  heightMm = 30,
  orientation: "portrait" | "landscape" = "landscape",
): string {
  if (
    !html ||
    !html.trim() ||
    html.includes("border: 1.5pt dashed #1a73e8") ||
    html.includes("#[[attendeeId]]") ||
    html.includes('<span class="ref-code">[[attendeeCode]]</span>') ||
    (html.includes('<span class="ref-label">TICKET:</span>') && !html.includes("[[attendeeId]]"))
  ) {
    return buildDefaultLabelTemplate(widthMm, heightMm, orientation);
  }
  const trimmed = html.trim();
  if (trimmed.toLowerCase().startsWith("<!doctype") || trimmed.toLowerCase().startsWith("<html")) {
    return html;
  }
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Badge: [[EventName]]</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Google+Sans+Flex:wght@100..900&display=block"
      rel="stylesheet"
    />
    <style>
${buildLabelCoreCss(widthMm, heightMm, orientation)}
    </style>
  </head>
  <body>
${trimmed
  .split("\n")
  .map((line) => `    ${line}`)
  .join("\n")}
  </body>
</html>`;
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  enabled: true,
  paper_width_mm: 50,
  paper_height_mm: 30,
  orientation: "landscape",
  template_html: DEFAULT_LABEL_TEMPLATE,
  auto_print_on_checkin: true,
};

/**
 * Generate a high-contrast inline SVG QR code data URI for instant, offline-ready thermal printing.
 */
export function generateQrImageUrl(payload: string): string {
  return generateQrSvgDataUrl(payload);
}

function answerToHtml(value: unknown): string {
  return escapeHtml(Array.isArray(value) ? value.join(", ") : String(value ?? ""));
}

/**
 * Extracts the primary job role from multi-role strings (e.g. "Data Analyst, SAS Modeler, Software Developer" -> "Data Analyst")
 * while preserving compound roles like "UI/UX Designer" or "CI/CD Engineer".
 */
export function normalizeBadgeRole(role?: string | null): string {
  const trimmed = (role ?? "").trim();
  if (!trimmed) return "";
  const first = trimmed
    .split(/[,;|]|\s+\/\s+/)
    .map((part) => part.trim())
    .find(Boolean);
  return first || trimmed;
}

const COMPANY_ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bUniversitas\b/gi, "Univ."],
  [/\bInstitut\b/gi, "Inst."],
  [/\bKementerian\b/gi, "Kemen."],
  [/\bPoliteknik\b/gi, "Poltek."],
  [/\bSekolah Tinggi\b/gi, "ST"],
  [/\bPerseroan Terbatas\b/gi, "PT"],
];

/**
 * Abbreviates common long Indonesian institution prefixes when the company string is long (> 22 chars)
 * so it fits cleanly on a 50x30mm badge without losing clarity.
 */
export function abbreviateBadgeCompany(company?: string | null): string {
  let result = (company ?? "").replace(/\s+/g, " ").trim();
  if (result.length <= 22) return result;
  for (const [pattern, replacement] of COMPANY_ABBREVIATIONS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s+/g, " ").trim();
}

/**
 * Replace [[placeholder]] tokens with attendee & event values,
 * including answered questions from custom registration forms.
 */
export function renderLabelTemplate(template: string, data: LabelTemplateData): string {
  const qrImgTag = `<img src="${generateQrImageUrl(data.qrPayload)}" alt="QR Code" class="qr-img" />`;
  const attendeeName = data.name || "Attendee";
  const attendeeEmail = data.email || "";
  const badgeTitle = normalizeBadgeRole(data.title) || "Participant";
  const badgeCompany = abbreviateBadgeCompany(data.company) || "Community Member";
  const eventTitle = data.eventTitle || "GDG Event";
  const eventDate = data.eventDate || "Date TBD";
  const eventTime = data.eventTime || "09:00 AM";
  const eventVenue = data.eventVenue || "Jakarta, Indonesia";
  const ticketCode = data.ticketCode || data.attendeeCode || `#${data.attendeeId}`;
  const ticketType = data.ticketType || "Paid Pass";
  const ticketName = data.ticketName || "Regular";
  const sessionTrack = data.sessionTrack || "Main Event";
  const techStack = data.techStack || "";

  // Every value is HTML-escaped (and `[`/`]` too, so a value can never be re-read as a token).
  // Replacements use a function so `$&`-style sequences in values are inserted literally.
  const checkinTime =
    data.checkinTime || new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const tokenValues: Array<[string[], string]> = [
    [["[[name]]", "[[Name]]"], attendeeName],
    [["[[nameShort]]", "[[NameShort]]"], shortenName(attendeeName)],
    [["[[nameInitials]]", "[[NameInitials]]"], initialsOf(attendeeName)],
    [["[[email]]", "[[Email]]"], attendeeEmail],
    [["[[title]]"], badgeTitle],
    [["[[company]]"], badgeCompany],
    [["[[ticketType]]", "[[TicketType]]"], ticketType],
    [["[[ticketName]]", "[[TicketName]]"], ticketName],
    [["[[sessionTrack]]", "[[SessionTrack]]"], sessionTrack],
    [["[[techStack]]", "[[TechStack]]"], techStack],
    [["[[eventTitle]]", "[[EventName]]"], eventTitle],
    [["[[eventDate]]", "[[EventDate]]"], eventDate],
    [["[[eventTime]]", "[[EventTime]]"], eventTime],
    [["[[eventVenue]]", "[[EventVenue]]"], eventVenue],
    [["[[eventId]]"], String(data.eventId)],
    [["[[attendeeId]]", "[[AttendeeId]]"], String(data.attendeeId)],
    [
      [
        "[[ticketCode]]",
        "[[TicketCode]]",
        "[[refCode]]",
        "[[RefCode]]",
        "[[attendeeCode]]",
        "[[attendeCode]]",
        "[[AttendeeCode]]",
      ],
      ticketCode,
    ],
    [["[[qrPayload]]"], data.qrPayload],
    [["[[checkinTime]]"], checkinTime],
  ];

  let rendered = ensureFullLabelHtml(template);
  for (const [keys, value] of tokenValues) {
    const safeValue = escapeHtml(value);
    for (const key of keys) {
      rendered = rendered.replaceAll(key, () => safeValue);
    }
  }
  rendered = rendered.replace(/\[\[\s*qr\s*\]\]/gi, () => qrImgTag);

  // Dynamically interpolate answered questions from the registration form
  const answers: Record<string, unknown> = {
    ...(data.answers || {}),
  };

  // Also include top-level dynamic properties passed on data
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined && val !== null && !(key in answers)) {
      answers[key] = val;
    }
  }

  // Regex to match [[question_id]], [[question:id]], [[answers.id]], or [[Question Label]]
  rendered = rendered.replace(/\[\[([^\]]+)\]\]/g, (match, rawKey: string) => {
    const key = rawKey.trim();
    if (!key) return match;

    // Check direct match
    if (key in answers) {
      return answerToHtml(answers[key]);
    }

    // Check with prefixes stripped (e.g. [[question:id]], [[answers:id]], [[answers.id]], [[question.id]])
    const strippedPrefix = key.replace(/^(question:|answers:|question\.|answers\.)/i, "");
    if (strippedPrefix in answers) {
      return answerToHtml(answers[strippedPrefix]);
    }

    // Case-insensitive lookup against answers keys
    const lowerKey = key.toLowerCase();
    const lowerStripped = strippedPrefix.toLowerCase();
    for (const [ansKey, val] of Object.entries(answers)) {
      if (ansKey.toLowerCase() === lowerKey || ansKey.toLowerCase() === lowerStripped) {
        return answerToHtml(val);
      }
    }

    return match;
  });

  return rendered;
}

/**
 * Generates an isolated full HTML document with print @page CSS for the Clabel thermal printer.
 */
export function buildPrintDocument(
  renderedHtml: string,
  widthMm: number,
  heightMm: number,
  orientation: "portrait" | "landscape" = "landscape",
): string {
  const fullDoc = ensureFullLabelHtml(renderedHtml, widthMm, heightMm, orientation);
  const pageStyle = `
    <style id="clabel-print-page-rules">
      @page {
        size: ${widthMm}mm ${heightMm}mm ${orientation};
        margin: 0mm;
      }
      html, body {
        width: ${widthMm}mm !important;
        height: ${heightMm}mm !important;
        overflow: hidden !important;
        margin: 0 !important;
      }
    </style>`;

  // Shrink or abbreviate attendee names that do not fit (see name-fit.ts).
  const fitted = injectNameFit(fullDoc);
  if (fitted.includes("</head>")) {
    return fitted.replace("</head>", `${pageStyle}\n  </head>`);
  }
  return `${pageStyle}\n${fitted}`;
}
