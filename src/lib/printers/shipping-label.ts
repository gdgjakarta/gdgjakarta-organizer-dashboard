import { parseMerchandiseVariations } from "@/lib/events/merchandise-helpers";
import { enqueuePrintJobAction } from "@/lib/firestore/actions";
import type { FirestoreEvent, FirestoreRegistration } from "@/lib/firestore/types";
import { printViaWorker } from "@/lib/printers/local-worker";
import { escapeHtml } from "@/lib/printers/name-fit";
import { generateQrSvgDataUrl } from "@/lib/printers/qr-svg";
import { buildPrintDocument } from "@/lib/printers/templates";

export interface ShippingLabelData {
  eventId: string;
  registrationId: string;
  attendeeId: string | number;
  recipientName: string;
  attendeeName?: string;
  email: string;
  whatsapp: string;
  shippingAddress: string;
  city: string;
  postalCode: string;
  notes?: string;
  mapsUrl?: string;
  itemsSummary?: string;
  courierType?: string;
  trackingNumber?: string;
}

export interface AvailableThermalPrinterTarget {
  key: string; // `${stationId}::${printerName}` or "auto"
  stationId: string;
  stationName: string;
  stationModel?: string;
  userEmail?: string;
  printerName: string;
  state: string;
  busy: boolean;
  isLocalWorker: boolean;
  stationRunning: boolean;
}

export function extractShippingLabelData(reg: FirestoreRegistration, event?: FirestoreEvent): ShippingLabelData | null {
  const req = reg.delivery_request;
  if (!req) return null;

  const recipientName = req.recipient_name?.trim() || reg.member_name?.trim() || "Recipient";
  const memberName = reg.member_name?.trim();
  const attendeeName = memberName && memberName.toLowerCase() !== recipientName.toLowerCase() ? memberName : undefined;

  const email =
    reg.member_email?.trim() || (typeof reg.answers?.email === "string" ? reg.answers.email.trim() : "") || "";

  const whatsapp =
    req.recipient_phone?.trim() ||
    (typeof reg.answers?.whatsapp === "string" ? reg.answers.whatsapp.trim() : "") ||
    (typeof reg.answers?.phone_number === "string" ? reg.answers.phone_number.trim() : "") ||
    "";

  const items = req.items && req.items.length > 0 ? req.items : (reg.selected_merchandise ?? []);
  const itemsSummary = items
    .map((m) => {
      const variations = parseMerchandiseVariations(m, reg.answers, event?.custom_questions);
      const varText = variations
        .map((v) => (v.value ? v.value : ""))
        .filter(Boolean)
        .join(", ");
      return `${m.quantity}x ${m.name}${varText ? ` (${varText})` : ""}`;
    })
    .join(" • ");

  return {
    eventId: String(event?.id ?? reg.event_id ?? ""),
    registrationId: reg.id,
    attendeeId: reg.bevy_attendee_id ?? reg.id,
    recipientName,
    attendeeName,
    email,
    whatsapp,
    shippingAddress: req.shipping_address ? req.shipping_address.trim() : "",
    city: req.city ? req.city.trim() : "",
    postalCode: req.postal_code ? req.postal_code.trim() : "",
    notes: req.notes?.trim() || undefined,
    mapsUrl: req.maps_url?.trim() || undefined,
    itemsSummary: itemsSummary || undefined,
    courierType: req.courier_type,
    trackingNumber: req.tracking_number,
  };
}

export const DEFAULT_SHIPPING_SAMPLE_DATA: ShippingLabelData = {
  eventId: "132640",
  registrationId: "sample-shipping-reg",
  attendeeId: "263443955",
  recipientName: "MUHAMMAD RAFLY ROBBANI",
  email: "muhammadraflyrbn@gmail.com",
  whatsapp: "081218942955",
  shippingAddress: "Bumi Mutiara Blok JJ5 no 32 Bojongkulur, Gunung Putri, Kabupaten Bogor",
  city: "Kabupaten Bogor",
  postalCode: "16969",
  notes: "",
  mapsUrl: "https://maps.google.com/?q=-6.3267,106.9565",
  itemsSummary: "1x DevFest T-Shirt 2026 (XL)",
  courierType: "Instant / Same Day",
  trackingNumber: "GDG-SHP-001",
};

/**
 * Generates core CSS dynamically sized to the configured paper roll dimensions and orientation.
 */
export function buildShippingLabelCoreCss(
  widthMm = 50,
  heightMm = 30,
  orientation: "portrait" | "landscape" = "landscape",
): string {
  const isPortrait = orientation === "portrait" || heightMm > widthMm;
  const baseW = isPortrait ? 30 : 50;
  const baseH = isPortrait ? 50 : 30;
  const scale = Math.max(0.7, Math.min(2.0, Math.min(widthMm / baseW, heightMm / baseH)));
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const padVMm = round1(1.8 * scale);
  const padHMm = round1(2.2 * scale);
  const labelGapMm = round1(0.4 * scale);
  const headerPadBottomMm = round1(0.5 * scale);
  const bodyGapMm = round1(1.5 * scale);
  const infoGapMm = round1(0.5 * scale);
  const destGapMm = round1(0.25 * scale);
  const itemsPadVMm = round1(0.4 * scale);
  const itemsPadHMm = round1(1.0 * scale);
  const namePt = round1(8.0 * scale);
  const contactPt = round1(5.5 * scale);
  const cityPt = round1(5.5 * scale);
  const addressPt = round1(5.2 * scale);
  const notePt = round1(4.0 * scale);
  const itemsPt = round1(5.0 * scale);
  const qrSizeMm = round1((isPortrait ? 17 : 15) * scale);
  const captionPt = round1(3.8 * scale);

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
        width: ${widthMm}mm;
        height: ${heightMm}mm;
        overflow: hidden;
        font-family: 'Google Sans', 'Google Sans Flex', Arial, sans-serif;
        background-color: #ffffff;
        color: #000000;
      }
      .shipping-label {
        width: 100%;
        height: 100%;
        padding: ${padVMm}mm ${padHMm}mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: ${labelGapMm}mm;
        overflow: hidden;
      }
      .shipping-recipient-block {
        flex: 0 0 auto;
        width: 100%;
        border-bottom: 0.25mm solid #000000;
        padding-bottom: ${headerPadBottomMm}mm;
      }
      .shipping-recipient-name {
        width: 100%;
        font-size: ${namePt}pt;
        font-weight: 700;
        line-height: 1.15;
        white-space: nowrap;
        overflow: hidden;
        text-transform: uppercase;
      }
      .shipping-contact {
        width: 100%;
        font-size: ${contactPt}pt;
        font-weight: 500;
        line-height: 1.2;
        margin-top: 0.2mm;
        white-space: nowrap;
        overflow: hidden;
      }
      .shipping-body {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: ${isPortrait ? "column" : "row"};
        align-items: stretch;
        justify-content: space-between;
        gap: ${bodyGapMm}mm;
        overflow: hidden;
      }
      .shipping-info-col {
        flex: 1 1 0%;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: ${infoGapMm}mm;
        overflow: hidden;
      }
      .shipping-dest-block {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: ${destGapMm}mm;
        overflow: hidden;
      }
      .shipping-city {
        font-size: ${cityPt}pt;
        font-weight: 700;
        line-height: 1.15;
        white-space: normal;
      }
      .shipping-address {
        font-size: ${addressPt}pt;
        font-weight: 400;
        line-height: 1.2;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .shipping-note {
        font-size: ${notePt}pt;
        font-style: italic;
        line-height: 1.15;
        white-space: normal;
        overflow-wrap: anywhere;
      }
      .shipping-items {
        flex: 0 0 auto;
        font-size: ${itemsPt}pt;
        font-weight: 700;
        line-height: 1.15;
        background-color: #000000;
        color: #ffffff;
        padding: ${itemsPadVMm}mm ${itemsPadHMm}mm;
        border-radius: 1.5px;
        align-self: flex-start;
        max-width: 100%;
        white-space: normal;
      }
      .shipping-contact:empty,
      .shipping-city:empty,
      .shipping-address:empty,
      .shipping-note:empty,
      .shipping-items:empty {
        display: none;
      }
      .shipping-qr-col {
        flex: ${isPortrait ? "0 0 auto" : `0 0 ${qrSizeMm}mm`};
        width: ${isPortrait ? "100%" : `${qrSizeMm}mm`};
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: ${isPortrait ? "center" : "flex-end"};
        gap: ${labelGapMm}mm;
      }
      .shipping-qr-box {
        width: ${qrSizeMm}mm;
        height: ${qrSizeMm}mm;
      }
      .shipping-qr-box img {
        width: 100%;
        height: 100%;
        display: block;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
        image-rendering: pixelated;
      }
      .shipping-qr-caption {
        font-size: ${captionPt}pt;
        font-weight: 700;
        letter-spacing: 0.4px;
        text-transform: uppercase;
        line-height: 1;
      }`;
}

/**
 * Generates the default editable HTML template for Merchandise Shipping Labels with `[[token]]` placeholders.
 */
export function buildDefaultShippingLabelTemplate(
  widthMm = 50,
  heightMm = 30,
  orientation: "portrait" | "landscape" = "landscape",
): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Shipping Label: [[recipientName]]</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Google+Sans+Flex:wght@100..900&display=block"
      rel="stylesheet"
    />
    <style>
${buildShippingLabelCoreCss(widthMm, heightMm, orientation)}
    </style>
  </head>
  <body>
    <div class="shipping-label">
      <div class="shipping-recipient-block">
        <div class="shipping-recipient-name" data-fit-name data-fit-lines="1">[[recipientName]]</div>
        <div class="shipping-contact">[[contactLine]]</div>
      </div>
      <div class="shipping-body">
        <div class="shipping-info-col">
          <div class="shipping-dest-block">
            <div class="shipping-city">[[cityLine]]</div>
            <div class="shipping-address">[[shippingAddress]]</div>
            <div class="shipping-note">[[notesLine]]</div>
          </div>
          <div class="shipping-items">[[itemsSummary]]</div>
        </div>
        [[mapsQr]]
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Synchronizes the <style> block inside a Shipping Label HTML template when paper dimensions or orientation change.
 */
export function syncShippingTemplateDimensions(
  html: string,
  widthMm: number,
  heightMm: number,
  orientation: "portrait" | "landscape",
): string {
  const trimmed = html?.trim() ?? "";
  if (!trimmed) {
    return buildDefaultShippingLabelTemplate(widthMm, heightMm, orientation);
  }
  const newCss = buildShippingLabelCoreCss(widthMm, heightMm, orientation);
  if (/<style[^>]*>[\s\S]*?<\/style>/i.test(trimmed)) {
    return trimmed.replace(/<style[^>]*>[\s\S]*?<\/style>/i, `<style>\n${newCss}\n    </style>`);
  }
  return buildDefaultShippingLabelTemplate(widthMm, heightMm, orientation);
}

export const DEFAULT_SHIPPING_LABEL_TEMPLATE = buildDefaultShippingLabelTemplate(50, 30, "landscape");

export function renderShippingLabelTemplate(
  templateHtml: string,
  data: ShippingLabelData,
  options?: {
    widthMm?: number;
    heightMm?: number;
    orientation?: "portrait" | "landscape";
  },
): string {
  const widthMm = options?.widthMm ?? 50;
  const heightMm = options?.heightMm ?? 30;
  const orientation = options?.orientation ?? "landscape";

  const recipientDisplay = data.attendeeName ? `${data.recipientName} (c/o ${data.attendeeName})` : data.recipientName;
  const cityLine = [data.city, data.postalCode ? `(${data.postalCode})` : ""].filter(Boolean).join(" ");
  const trimmedMapsUrl = data.mapsUrl?.trim() ?? "";
  const qrSvgUrl = trimmedMapsUrl.length > 0 ? generateQrSvgDataUrl(trimmedMapsUrl) : null;
  const mapsQrHtml = qrSvgUrl
    ? `<div class="shipping-qr-col"><div class="shipping-qr-box"><img src="${qrSvgUrl}" alt="Maps QR" /></div><div class="shipping-qr-caption">SCAN MAPS</div></div>`
    : "";

  const contactLine = [data.whatsapp ? `WA: ${data.whatsapp}` : "", data.email || ""].filter(Boolean).join(" • ");

  const replacements: Array<[string, string]> = [
    ["[[recipientName]]", escapeHtml(recipientDisplay)],
    ["[[contactLine]]", escapeHtml(contactLine)],
    ["[[whatsapp]]", escapeHtml(data.whatsapp || "")],
    ["[[whatsappLine]]", data.whatsapp ? `WA: ${escapeHtml(data.whatsapp)}` : ""],
    ["[[email]]", escapeHtml(data.email || "")],
    ["[[cityLine]]", escapeHtml(cityLine)],
    ["[[city]]", escapeHtml(data.city || "")],
    ["[[postalCode]]", escapeHtml(data.postalCode || "")],
    ["[[shippingAddress]]", escapeHtml(data.shippingAddress || "")],
    ["[[notes]]", escapeHtml(data.notes || "")],
    ["[[notesLine]]", data.notes ? `Note: ${escapeHtml(data.notes)}` : ""],
    ["[[itemsSummary]]", escapeHtml(data.itemsSummary || "")],
    ["[[courierType]]", escapeHtml(data.courierType || "")],
    ["[[trackingNumber]]", escapeHtml(data.trackingNumber || "")],
  ];

  let rendered = templateHtml;
  for (const [token, value] of replacements) {
    rendered = rendered.replaceAll(token, () => value);
  }
  rendered = rendered.replace(/\[\[\s*mapsQr\s*\]\]/gi, () => mapsQrHtml);

  const fitScript = `<script>
      (function () {
        function fitShippingLabel() {
          // Shrink single-line contact (WA • email) font size if it overflows horizontally
          var contacts = document.querySelectorAll(".shipping-contact");
          for (var i = 0; i < contacts.length; i++) {
            var el = contacts[i];
            if (!el.textContent || !el.textContent.trim()) continue;
            el.style.fontSize = "";
            var pt = parseFloat(getComputedStyle(el).fontSize) * 0.75 || 5.5;
            while (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && pt > 3.2) {
              pt = Math.round((pt - 0.25) * 100) / 100;
              el.style.fontSize = pt + "pt";
            }
          }
          var col = document.querySelector(".shipping-info-col");
          if (!col) return;
          var dest = col.querySelector(".shipping-dest-block");
          var scale = 1.0;
          col.style.zoom = "1";
          while (
            (col.scrollHeight > col.clientHeight + 1 || (dest && dest.scrollHeight > dest.clientHeight + 1)) &&
            scale > 0.55
          ) {
            scale = Math.round((scale - 0.03) * 100) / 100;
            col.style.zoom = String(scale);
          }
        }
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(fitShippingLabel);
        } else {
          window.addEventListener("load", fitShippingLabel);
        }
        setTimeout(fitShippingLabel, 120);
      })();
    </script>`;

  if (rendered.includes("</body>")) {
    rendered = rendered.replace("</body>", `${fitScript}\n  </body>`);
  }
  return buildPrintDocument(rendered, widthMm, heightMm, orientation);
}

export function buildShippingLabelHtml(
  data: ShippingLabelData,
  options?: {
    widthMm?: number;
    heightMm?: number;
    orientation?: "portrait" | "landscape";
    templateHtml?: string;
  },
): string {
  const widthMm = options?.widthMm ?? 50;
  const heightMm = options?.heightMm ?? 30;
  const orientation = options?.orientation ?? "landscape";
  const template = options?.templateHtml?.trim() || buildDefaultShippingLabelTemplate(widthMm, heightMm, orientation);
  return renderShippingLabelTemplate(template, data, { widthMm, heightMm, orientation });
}

export async function dispatchShippingLabelToThermal(params: {
  reg: FirestoreRegistration;
  event: FirestoreEvent;
  target: AvailableThermalPrinterTarget | "auto";
  widthMm?: number;
  heightMm?: number;
  orientation?: "portrait" | "landscape";
  templateHtml?: string;
}): Promise<{ mode: "direct" | "queued"; printerName?: string; stationName?: string }> {
  const { reg, event, target } = params;
  const data = extractShippingLabelData(reg, event);
  if (!data) {
    throw new Error("Missing delivery request details for this registration.");
  }

  const widthMm = params.widthMm ?? event.printer_config?.paper_width_mm ?? 50;
  const heightMm = params.heightMm ?? event.printer_config?.paper_height_mm ?? 30;
  const orientation = params.orientation ?? event.printer_config?.orientation ?? "landscape";
  const renderedHtml = buildShippingLabelHtml(data, {
    widthMm,
    heightMm,
    orientation,
    templateHtml: params.templateHtml,
  });

  const jobPayload = {
    event_id: String(event.id),
    attendee_id: data.attendeeId,
    registration_id: reg.id,
    member_name: data.recipientName,
    member_title: [data.whatsapp ? `WA: ${data.whatsapp}` : "", data.email].filter(Boolean).join(" • "),
    member_company: [data.city, data.postalCode ? `(${data.postalCode})` : ""].filter(Boolean).join(" "),
    qr_payload: data.mapsUrl || "",
    rendered_html: renderedHtml,
    paper_width_mm: widthMm,
    paper_height_mm: heightMm,
    orientation,
    job_type: "shipping_label" as const,
  };

  if (target !== "auto" && target.isLocalWorker && !target.stationRunning) {
    const result = await printViaWorker({
      jobId: `ship_${event.id}_${reg.id}_${Date.now()}`,
      attendeeName: data.recipientName,
      html: renderedHtml,
      widthMm,
      heightMm,
      printer: target.printerName,
    });
    await enqueuePrintJobAction(jobPayload, {
      printedBy: {
        stationId: target.stationId,
        stationName: target.stationName,
        printer: result.printer ?? target.printerName,
      },
    });
    return {
      mode: "direct",
      printerName: result.printer ?? target.printerName,
      stationName: target.stationName,
    };
  }

  const res = await enqueuePrintJobAction({
    ...jobPayload,
    ...(target !== "auto"
      ? {
          target_station_id: target.stationId,
          target_station_name: target.stationName,
          target_printer: target.printerName,
        }
      : {}),
  });

  if (!res.success) {
    throw new Error(res.error || "Failed to queue shipping label print job.");
  }

  return {
    mode: "queued",
    printerName: target !== "auto" ? target.printerName : undefined,
    stationName: target !== "auto" ? target.stationName : undefined,
  };
}
