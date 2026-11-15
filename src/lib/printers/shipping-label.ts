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

export function buildShippingLabelHtml(
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

  const isPortrait = orientation === "portrait" || heightMm > widthMm;
  const baseW = isPortrait ? 30 : 50;
  const baseH = isPortrait ? 50 : 30;
  const scale = Math.max(0.7, Math.min(1.5, Math.min(widthMm / baseW, heightMm / baseH)));
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const padVMm = round1(1.8 * scale);
  const padHMm = round1(2.2 * scale);
  const namePt = round1(9.5 * scale);
  const contactPt = round1(5.2 * scale);
  const cityPt = round1(6.2 * scale);
  const addressPt = round1(5.2 * scale);
  const notePt = round1(4.6 * scale);
  const itemsPt = round1(4.6 * scale);
  const qrSizeMm = round1((isPortrait ? 18 : 16.5) * scale);
  const captionPt = round1(3.8 * scale);

  const trimmedMapsUrl = data.mapsUrl?.trim() ?? "";
  const hasMapsQr = trimmedMapsUrl.length > 0;
  const qrSvgUrl = hasMapsQr ? generateQrSvgDataUrl(trimmedMapsUrl) : null;

  const recipientDisplay = data.attendeeName ? `${data.recipientName} (c/o ${data.attendeeName})` : data.recipientName;

  const cityLine = [data.city, data.postalCode ? `(${data.postalCode})` : ""].filter(Boolean).join(" ");

  const rawHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Shipping Label: ${escapeHtml(data.recipientName)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Google+Sans+Flex:wght@100..900&display=block"
      rel="stylesheet"
    />
    <style>
      @page {
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
        width: ${widthMm}mm;
        height: ${heightMm}mm;
        padding: ${padVMm}mm ${padHMm}mm;
        display: flex;
        flex-direction: ${isPortrait ? "column" : "row"};
        align-items: stretch;
        justify-content: space-between;
        gap: 1.5mm;
        overflow: hidden;
      }
      .shipping-info-col {
        flex: 1 1 0%;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
      }
      .shipping-recipient-block {
        flex: 0 0 auto;
        border-bottom: 0.25mm solid #000000;
        padding-bottom: 0.7mm;
        margin-bottom: 0.7mm;
      }
      .shipping-recipient-name {
        font-size: ${namePt}pt;
        font-weight: 700;
        line-height: 1.15;
        white-space: normal;
        word-break: break-word;
        text-transform: uppercase;
      }
      .shipping-contact {
        font-size: ${contactPt}pt;
        font-weight: 500;
        line-height: 1.2;
        margin-top: 0.2mm;
        white-space: normal;
        overflow-wrap: anywhere;
      }
      .shipping-dest-block {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 0.25mm;
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
        padding: 0.4mm 1mm;
        border-radius: 1.5px;
        align-self: flex-start;
        max-width: 100%;
        white-space: normal;
      }
      .shipping-qr-col {
        flex: 0 0 ${qrSizeMm}mm;
        width: ${qrSizeMm}mm;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.4mm;
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
      }
    </style>
  </head>
  <body>
    <div class="shipping-label">
      <div class="shipping-info-col">
        <div>
          <div class="shipping-recipient-block">
            <div class="shipping-recipient-name">${escapeHtml(recipientDisplay)}</div>
            ${data.whatsapp ? `<div class="shipping-contact">WA: ${escapeHtml(data.whatsapp)}</div>` : ""}
            ${data.email ? `<div class="shipping-contact">${escapeHtml(data.email)}</div>` : ""}
          </div>
          <div class="shipping-dest-block">
            ${cityLine ? `<div class="shipping-city">${escapeHtml(cityLine)}</div>` : ""}
            ${data.shippingAddress ? `<div class="shipping-address">${escapeHtml(data.shippingAddress)}</div>` : ""}
            ${data.notes ? `<div class="shipping-note">Note: ${escapeHtml(data.notes)}</div>` : ""}
          </div>
        </div>
        ${data.itemsSummary ? `<div class="shipping-items">${escapeHtml(data.itemsSummary)}</div>` : ""}
      </div>
      ${
        hasMapsQr && qrSvgUrl
          ? `<div class="shipping-qr-col">
        <div class="shipping-qr-box"><img src="${qrSvgUrl}" alt="Maps QR" /></div>
        <div class="shipping-qr-caption">SCAN MAPS</div>
      </div>`
          : ""
      }
    </div>
    <script>
      (function () {
        function fitShippingLabel() {
          var nameEl = document.querySelector(".shipping-recipient-name");
          if (nameEl) {
            var pt = ${namePt};
            nameEl.style.fontSize = pt + "pt";
            var lh = parseFloat(getComputedStyle(nameEl).lineHeight) || pt * 1.33 * 1.15;
            while (nameEl.scrollHeight > lh * 2 + 2 && pt > 5.5) {
              pt = Math.round((pt - 0.5) * 10) / 10;
              nameEl.style.fontSize = pt + "pt";
              lh = parseFloat(getComputedStyle(nameEl).lineHeight) || pt * 1.33 * 1.15;
            }
          }
          var col = document.querySelector(".shipping-info-col");
          if (!col) return;
          var scale = 1.0;
          col.style.zoom = "1";
          while (col.scrollHeight > col.clientHeight && scale > 0.55) {
            scale = Math.round((scale - 0.03) * 100) / 100;
            col.style.zoom = String(scale);
          }
        }
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(fitShippingLabel);
        }
        window.addEventListener("DOMContentLoaded", fitShippingLabel);
        fitShippingLabel();
      })();
    </script>
  </body>
</html>`;

  return buildPrintDocument(rawHtml, widthMm, heightMm, orientation);
}

export async function dispatchShippingLabelToThermal(params: {
  reg: FirestoreRegistration;
  event: FirestoreEvent;
  target: AvailableThermalPrinterTarget | "auto";
  widthMm?: number;
  heightMm?: number;
  orientation?: "portrait" | "landscape";
}): Promise<{ mode: "direct" | "queued"; printerName?: string; stationName?: string }> {
  const { reg, event, target } = params;
  const data = extractShippingLabelData(reg, event);
  if (!data) {
    throw new Error("Missing delivery request details for this registration.");
  }

  const widthMm = params.widthMm ?? event.printer_config?.paper_width_mm ?? 50;
  const heightMm = params.heightMm ?? event.printer_config?.paper_height_mm ?? 30;
  const orientation = params.orientation ?? event.printer_config?.orientation ?? "landscape";
  const renderedHtml = buildShippingLabelHtml(data, { widthMm, heightMm, orientation });

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
