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

  const bodyPadMm = round1(1.0 * scale);
  const badgePadVMm = round1(1.0 * scale);
  const badgePadHMm = round1(1.5 * scale);
  const brandPt = round1(6.0 * scale);
  const pillPt = round1(4.2 * scale);
  const eventPt = round1(5.0 * scale);
  const namePt = round1(8.2 * scale);
  const titlePt = round1(5.2 * scale);
  const companyPt = round1(4.8 * scale);
  const refLabelPt = round1(4.2 * scale);
  const refCodePt = round1(4.6 * scale);
  const qrImgMm = round1((isPortrait ? 13 : 11.5) * scale);
  const qrSectionWidth = isPortrait ? "100%" : `${round1(qrImgMm + 1.8)}mm`;
  const scanHintPt = round1(3.6 * scale);

  return `      /* Force the printer to use ${widthMm}x${heightMm}mm paper size (${orientation}) */
      @page {
        size: ${widthMm}mm ${heightMm}mm ${orientation};
        margin: 0;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      body {
        margin: 0;
        padding: ${bodyPadMm}mm;
        width: ${widthMm}mm;
        height: ${heightMm}mm;
        overflow: hidden;
        font-family: 'Poppins', sans-serif;
        background-color: #ffffff;
        color: #202124;
      }

      .ticket-badge {
        width: 100%;
        height: 100%;
        padding: ${badgePadVMm}mm ${badgePadHMm}mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
        border: 1pt dashed #000000;
        border-radius: 4px;
        background-color: #ffffff;
        color: #000000;
      }

      .ticket-header {
        border-bottom: 0.75pt solid #000000;
        padding-bottom: 0.7mm;
        margin-bottom: 0.7mm;
      }

      .brand-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1mm;
      }

      .brand-title {
        font-size: ${brandPt}pt;
        font-weight: 800;
        letter-spacing: 0.5px;
        color: #000000;
      }

      .ticket-badge-pill {
        font-size: ${pillPt}pt;
        font-weight: 700;
        padding: 1px 4px;
        background-color: #000000;
        color: #ffffff;
        border-radius: 3px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        flex-shrink: 0;
      }

      .event-name {
        font-size: ${eventPt}pt;
        font-weight: 600;
        line-height: 1.15;
        color: #000000;
        white-space: normal;
        word-break: break-word;
        overflow-wrap: anywhere;
        margin-top: 0.4mm;
      }

      .ticket-body {
        display: flex;
        flex: 1;
        flex-direction: ${isPortrait ? "column" : "row"};
        justify-content: space-between;
        align-items: ${isPortrait ? "stretch" : "center"};
        gap: 1.5mm;
        min-height: 0;
      }

      .ticket-details {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .attendee-name {
        font-size: ${namePt}pt;
        font-weight: 800;
        line-height: 1.1;
        color: #000000;
        white-space: normal;
        word-break: break-word;
        overflow-wrap: anywhere;
        text-transform: capitalize;
      }

      .attendee-title {
        font-size: ${titlePt}pt;
        font-weight: 600;
        line-height: 1.15;
        color: #000000;
        margin-top: 0.5mm;
        white-space: normal;
        word-break: break-word;
        overflow-wrap: anywhere;
      }

      .attendee-company {
        font-size: ${companyPt}pt;
        line-height: 1.15;
        color: #000000;
        margin-top: 0.2mm;
        white-space: normal;
        word-break: break-word;
        overflow-wrap: anywhere;
      }

      .ref-pill {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2.5px;
        margin-top: 0.8mm;
        background-color: #ffffff;
        border: 0.5pt solid #000000;
        padding: 1px 3.5px;
        border-radius: 3px;
        width: fit-content;
        max-width: 100%;
      }

      .ref-label {
        font-size: ${refLabelPt}pt;
        font-weight: 700;
        color: #000000;
      }

      .ref-code {
        font-size: ${refCodePt}pt;
        font-family: 'Courier New', Courier, monospace;
        font-weight: 700;
        color: #000000;
        word-break: break-all;
      }

      .ticket-qr-section {
        width: ${qrSectionWidth};
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .qr-container {
        background-color: #ffffff;
        padding: 1px;
        border: 0.5pt solid #000000;
        border-radius: 4px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      }

      .qr-img {
        width: ${qrImgMm}mm;
        height: ${qrImgMm}mm;
        display: block;
        image-rendering: pixelated;
      }

      .scan-hint {
        font-size: ${scanHintPt}pt;
        font-weight: 700;
        letter-spacing: 0.3px;
        color: #000000;
        margin-top: 0.5mm;
        text-align: center;
      }`;
}

export const LABEL_CORE_CSS = buildLabelCoreCss(50, 30, "landscape");

export function buildDefaultLabelTemplate(
  widthMm = 50,
  heightMm = 30,
  orientation: "portrait" | "landscape" = "landscape",
): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Badge: [[EventName]]</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet" />
    <style>
${buildLabelCoreCss(widthMm, heightMm, orientation)}
    </style>
  </head>
  <body>
    <div class="ticket-badge">
      <div class="ticket-header">
        <div class="brand-row">
          <span class="brand-title">GDG JAKARTA</span>
          <span class="ticket-badge-pill">ENTRY PASS</span>
        </div>
        <div class="event-name">[[EventName]]</div>
      </div>

      <div class="ticket-body">
        <div class="ticket-details">
          <div class="attendee-name">[[Name]]</div>
          <div class="attendee-title">[[title]]</div>
          <div class="attendee-company">[[company]]</div>

          <div class="ref-pill">
            <span class="ref-label">REF:</span>
            <span class="ref-code">[[ticketCode]]</span>
          </div>
          <div class="ref-pill" style="margin-top: 0.4mm;">
            <span class="ref-label">ID:</span>
            <span class="ref-code">[[attendeeId]]</span>
          </div>
        </div>

        <div class="ticket-qr-section">
          <div class="qr-container">
            [[qr]]
          </div>
          <div class="scan-hint">SCAN TO VERIFY</div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export const DEFAULT_LABEL_TEMPLATE = buildDefaultLabelTemplate(50, 30, "landscape");

/**
 * Synchronizes the <style> block inside the HTML template when paper dimensions or orientation change.
 */
export function syncTemplateDimensions(
  html: string,
  widthMm: number,
  heightMm: number,
  orientation: "portrait" | "landscape",
): string {
  const full = ensureFullLabelHtml(html, widthMm, heightMm, orientation);
  const newCss = buildLabelCoreCss(widthMm, heightMm, orientation);
  if (/<style[^>]*>[\s\S]*?<\/style>/i.test(full)) {
    return full.replace(/<style[^>]*>[\s\S]*?<\/style>/i, `<style>\n${newCss}\n    </style>`);
  }
  return full;
}

/**
 * Upgrades a legacy body-only or earlier default template into the current full HTML document
 * with Google Font (Poppins), [[attendeeCode]], and paper sizing support.
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
    html.includes("text-overflow: ellipsis") ||
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
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet" />
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
 * Replace [[placeholder]] tokens with attendee & event values,
 * including answered questions from custom registration forms.
 */
export function renderLabelTemplate(template: string, data: LabelTemplateData): string {
  const qrImgTag = `<img src="${generateQrImageUrl(data.qrPayload)}" alt="QR Code" class="qr-img" />`;
  const attendeeName = data.name || "Attendee";
  const attendeeEmail = data.email || "";
  const eventTitle = data.eventTitle || "GDG Event";
  const eventDate = data.eventDate || "Date TBD";
  const eventTime = data.eventTime || "09:00 AM";
  const eventVenue = data.eventVenue || "Jakarta, Indonesia";
  const ticketCode = data.ticketCode || data.attendeeCode || `#${data.attendeeId}`;
  const sessionTrack = data.sessionTrack || "Full Session";
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
    [["[[title]]"], data.title || "Participant"],
    [["[[company]]"], data.company || "Community Member"],
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
