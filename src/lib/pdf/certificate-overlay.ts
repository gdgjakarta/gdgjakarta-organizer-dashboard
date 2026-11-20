import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, rgb, StandardFonts } from "pdf-lib";

import type { CertificateOverlayField } from "@/lib/firestore/types";
import { buildQrMatrix } from "@/lib/printers/qr-svg";

const PLUS_JAKARTA_SANS_URLS = {
  regular: "https://cdn.jsdelivr.net/gh/tokotype/PlusJakartaSans@master/fonts/ttf/PlusJakartaSans-Regular.ttf",
  semiBold: "https://cdn.jsdelivr.net/gh/tokotype/PlusJakartaSans@master/fonts/ttf/PlusJakartaSans-SemiBold.ttf",
  bold: "https://cdn.jsdelivr.net/gh/tokotype/PlusJakartaSans@master/fonts/ttf/PlusJakartaSans-Bold.ttf",
} as const;

let cachedJakartaFonts: { regular: Uint8Array; semiBold: Uint8Array; bold: Uint8Array } | null = null;

async function fetchFontBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, {
    signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(5_000) : undefined,
  });
  if (!res.ok) throw new Error(`Font fetch failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

async function embedPlusJakartaSansOrFallback(pdfDoc: PDFDocument): Promise<{
  regular: PDFFont;
  semiBold: PDFFont;
  bold: PDFFont;
}> {
  try {
    if (!cachedJakartaFonts) {
      const [regular, semiBold, bold] = await Promise.all([
        fetchFontBytes(PLUS_JAKARTA_SANS_URLS.regular),
        fetchFontBytes(PLUS_JAKARTA_SANS_URLS.semiBold),
        fetchFontBytes(PLUS_JAKARTA_SANS_URLS.bold),
      ]);
      cachedJakartaFonts = { regular, semiBold, bold };
    }
    pdfDoc.registerFontkit(fontkit);
    const [regular, semiBold, bold] = await Promise.all([
      pdfDoc.embedFont(cachedJakartaFonts.regular, { subset: true }),
      pdfDoc.embedFont(cachedJakartaFonts.semiBold, { subset: true }),
      pdfDoc.embedFont(cachedJakartaFonts.bold, { subset: true }),
    ]);
    return { regular, semiBold, bold };
  } catch {
    // Graceful fallback to built-in Helvetica if Google Fonts CDN or fontkit is unavailable
    const [regular, bold] = await Promise.all([
      pdfDoc.embedFont(StandardFonts.Helvetica),
      pdfDoc.embedFont(StandardFonts.HelveticaBold),
    ]);
    return { regular, semiBold: bold, bold };
  }
}

function toWinAnsiSafe(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014|\u2013/g, "-")
    .replace(/\u2022/g, "*")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function parseHexColor(hex?: string): ReturnType<typeof rgb> {
  const clean = (hex || "#202124").replace(/^#/, "").trim();
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
    const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
    const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
    return rgb(r, g, b);
  }
  return rgb(0.125, 0.129, 0.141);
}

/**
 * Stamps text fields and optional vector QR code onto a Google Drawing PDF background.
 * shortcut: uses pdf-lib StandardFonts (Helvetica) instead of @pdf-lib/fontkit to avoid variable-font & workerd ESM issues; upgrade if Cloudflare Workers supports static TTF subsetting cleanly.
 */
export async function renderCertificateOverlayPdf(params: {
  backgroundPdfBytes: Uint8Array;
  fields: CertificateOverlayField[];
  values: Record<string, string>;
  verifyUrl: string;
  metadata?: {
    title?: string;
    subject?: string;
  };
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(params.backgroundPdfBytes);
  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    throw new Error("Background PDF has no pages.");
  }

  const page = pages[0];
  const { width: pageWidth, height: pageHeight } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const field of params.fields) {
    if (field.key === "qr_code" || field.key === "qrCode") {
      const matrix = buildQrMatrix(params.verifyUrl);
      if (!matrix || matrix.length === 0) continue;

      const boxSize = Math.max(24, field.width * pageWidth);
      const startX = field.x * pageWidth;
      const topY = pageHeight - field.y * pageHeight;
      const startY = topY - boxSize;
      const modules = matrix.length;
      const cellSize = boxSize / modules;

      // White quiet-zone background
      page.drawRectangle({
        x: startX - 3,
        y: startY - 3,
        width: boxSize + 6,
        height: boxSize + 6,
        color: rgb(1, 1, 1),
      });

      const qrColor = parseHexColor(field.color || "#202124");
      for (let row = 0; row < modules; row++) {
        for (let col = 0; col < modules; col++) {
          if (matrix[row][col] === 1) {
            page.drawRectangle({
              x: startX + col * cellSize,
              y: startY + (modules - 1 - row) * cellSize,
              width: cellSize + 0.15,
              height: cellSize + 0.15,
              color: qrColor,
            });
          }
        }
      }
      continue;
    }

    const rawVal = params.values[field.key] ?? params.values[`{{${field.key}}}`] ?? "";
    const text = toWinAnsiSafe(rawVal).trim();
    if (!text) continue;

    const font = field.bold ? fontBold : fontRegular;
    const maxWidth = Math.max(40, field.width * pageWidth);
    let fontSize = Math.max(8, Math.min(72, field.font_size || 18));

    // Auto-shrink font size so long recipient names never overflow the configured width
    let textWidth = font.widthOfTextAtSize(text, fontSize);
    while (textWidth > maxWidth && fontSize > 9) {
      fontSize -= 0.5;
      textWidth = font.widthOfTextAtSize(text, fontSize);
    }

    const boxLeft = field.x * pageWidth;
    let drawX = boxLeft;
    if (field.align === "center") {
      drawX = boxLeft + (maxWidth - textWidth) / 2;
    } else if (field.align === "right") {
      drawX = boxLeft + (maxWidth - textWidth);
    }

    // Convert normalized top-left Y to PDF bottom-left baseline
    const drawY = pageHeight - field.y * pageHeight - fontSize * 0.85;

    page.drawText(text, {
      x: Math.max(8, drawX),
      y: Math.max(8, drawY),
      size: fontSize,
      font,
      color: parseHexColor(field.color),
    });
  }

  if (params.metadata?.title) {
    pdfDoc.setTitle(toWinAnsiSafe(params.metadata.title));
  }
  pdfDoc.setAuthor("GDG Jakarta");
  if (params.metadata?.subject) {
    pdfDoc.setSubject(toWinAnsiSafe(params.metadata.subject));
  }
  pdfDoc.setCreator("GDG Jakarta Organizer Dashboard");

  return pdfDoc.save();
}

/**
 * Generates a built-in, general-purpose GDG Jakarta 4:3 (720 x 540 pt) certificate PDF
 * when no Google Slides or Google Drawing template URL is configured.
 */
export async function renderBuiltInCertificatePdf(params: {
  type: "attendance" | "speaker";
  recipientName: string;
  eventTitle: string;
  eventDate: string;
  role: string;
  talkTitle?: string | null;
  certificateCode: string;
  issuedDate: string;
  verifyUrl: string;
  signerName?: string | null;
  signerTitle?: string | null;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const pageWidth = 720;
  const pageHeight = 540;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const { regular: fontRegular, semiBold: fontSemiBold, bold: fontBold } =
    await embedPlusJakartaSansOrFallback(pdfDoc);

  // Palette tokens (GDG Jakarta Executive 4:3 Spec)
  const cMat = parseHexColor("#F8FAFC");
  const cSurface = parseHexColor("#FFFFFF");
  const cSubtle = parseHexColor("#F8F9FA");
  const cBorderOuter = parseHexColor("#E2E8F0");
  const cBorderHairline = parseHexColor("#E8EAED");
  const cBorderRule = parseHexColor("#BDC1C6");
  const cQrBorder = parseHexColor("#DADCE0");
  const cInkPrimary = parseHexColor("#202124");
  const cInkBody = parseHexColor("#3C4043");
  const cInkMuted = parseHexColor("#5F6368");
  const cInkSubtle = parseHexColor("#80868B");
  const cBrandBlue = parseHexColor("#1A73E8");
  const cTrustGreen = parseHexColor("#137333");
  const cGBlue = parseHexColor("#4285F4");
  const cGRed = parseHexColor("#EA4335");
  const cGYellow = parseHexColor("#FBBC04");
  const cGGreen = parseHexColor("#34A853");

  // A. Frame & Google 4-Color Precision Bar
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: cMat });
  page.drawRectangle({
    x: 20,
    y: 20,
    width: 680,
    height: 500,
    color: cSurface,
    borderColor: cBorderOuter,
    borderWidth: 1,
  });
  page.drawRectangle({
    x: 28,
    y: 28,
    width: 664,
    height: 484,
    borderColor: cBorderHairline,
    borderWidth: 0.5,
  });
  page.drawRectangle({ x: 20, y: 516, width: 170, height: 4, color: cGBlue });
  page.drawRectangle({ x: 190, y: 516, width: 170, height: 4, color: cGRed });
  page.drawRectangle({ x: 360, y: 516, width: 170, height: 4, color: cGYellow });
  page.drawRectangle({ x: 530, y: 516, width: 170, height: 4, color: cGGreen });

  const drawCentered = (
    raw: string,
    y: number,
    size: number,
    font: PDFFont,
    color: ReturnType<typeof rgb>,
    maxW = 580,
    minSize = 9,
  ): { width: number; size: number } => {
    const text = toWinAnsiSafe(raw).trim();
    if (!text) return { width: 0, size };
    let s = size;
    let w = font.widthOfTextAtSize(text, s);
    while (w > maxW && s > minSize) {
      s -= 0.5;
      w = font.widthOfTextAtSize(text, s);
    }
    page.drawText(text, { x: (pageWidth - w) / 2, y, size: s, font, color });
    return { width: w, size: s };
  };

  // B. Header / Brand Lockup
  const dots = [
    { x: 345, color: cGBlue },
    { x: 355, color: cGRed },
    { x: 365, color: cGYellow },
    { x: 375, color: cGGreen },
  ];
  for (const dot of dots) {
    page.drawCircle({ x: dot.x, y: 484, size: 2.8, color: dot.color });
  }
  drawCentered("GOOGLE DEVELOPER GROUP JAKARTA", 464, 9.5, fontSemiBold, cInkMuted);
  page.drawLine({ start: { x: 332, y: 452 }, end: { x: 388, y: 452 }, thickness: 0.75, color: cQrBorder });

  // C. Title Hierarchy
  const heading = params.type === "speaker" ? "Certificate of Appreciation" : "Certificate of Attendance";
  drawCentered(heading, 414, 30, fontBold, cInkPrimary);
  drawCentered("PROUDLY PRESENTED TO", 386, 9, fontSemiBold, cInkMuted);

  // D. Recipient Name Focal Treatment & 4-Color Micro-Divider
  drawCentered(params.recipientName, 336, 34, fontBold, cBrandBlue, 560, 18);
  page.drawLine({ start: { x: 180, y: 321 }, end: { x: 312, y: 321 }, thickness: 0.75, color: cBorderHairline });
  page.drawRectangle({ x: 320, y: 320, width: 20, height: 2, color: cGBlue });
  page.drawRectangle({ x: 340, y: 320, width: 20, height: 2, color: cGRed });
  page.drawRectangle({ x: 360, y: 320, width: 20, height: 2, color: cGYellow });
  page.drawRectangle({ x: 380, y: 320, width: 20, height: 2, color: cGGreen });
  page.drawLine({ start: { x: 408, y: 321 }, end: { x: 540, y: 321 }, thickness: 0.75, color: cBorderHairline });

  // E. Body Copy & Conditional Speaker Session Pill
  const introLine =
    params.type === "speaker"
      ? `in recognition of their valuable contribution as ${params.role} at`
      : "for attending and actively participating in";
  drawCentered(introLine, 286, 12.5, fontRegular, cInkBody, 560);
  drawCentered(params.eventTitle, 256, 18, fontBold, cInkPrimary, 580, 13);

  const talkText = params.type === "speaker" ? params.talkTitle?.trim() : "";
  if (talkText) {
    const pillLabel = toWinAnsiSafe(`Session: "${talkText}"`);
    let pillSize = 11;
    let pillW = fontSemiBold.widthOfTextAtSize(pillLabel, pillSize);
    while (pillW > 520 && pillSize > 9.5) {
      pillSize -= 0.5;
      pillW = fontSemiBold.widthOfTextAtSize(pillLabel, pillSize);
    }
    const boxW = pillW + 24;
    page.drawRectangle({
      x: 360 - boxW / 2,
      y: 223,
      width: boxW,
      height: 22,
      color: cSubtle,
      borderColor: cBorderHairline,
      borderWidth: 0.75,
    });
    page.drawText(pillLabel, { x: 360 - pillW / 2, y: 230, size: pillSize, font: fontSemiBold, color: cInkBody });
    drawCentered(`Hosted by GDG Jakarta  •  ${params.eventDate}`, 198, 11, fontRegular, cInkMuted);
  } else {
    drawCentered(`Hosted by GDG Jakarta  •  ${params.eventDate}`, 226, 11.5, fontRegular, cInkMuted);
  }

  // F. Footer Divider & 2-Column Footer
  page.drawLine({ start: { x: 56, y: 166 }, end: { x: 664, y: 166 }, thickness: 0.75, color: cBorderHairline });

  // Left Column: Signer Block & Metadata
  const signerName = toWinAnsiSafe(params.signerName?.trim() || "GDG Jakarta Organizer Team");
  const signerTitle = toWinAnsiSafe(params.signerTitle?.trim() || "Google Developer Group Jakarta");
  page.drawLine({ start: { x: 56, y: 124 }, end: { x: 244, y: 124 }, thickness: 0.75, color: cBorderRule });
  page.drawText(signerName, { x: 56, y: 107, size: 11, font: fontBold, color: cInkPrimary });
  page.drawText(signerTitle, { x: 56, y: 93, size: 9.5, font: fontRegular, color: cInkMuted });
  page.drawText(toWinAnsiSafe(`Certificate ID: ${params.certificateCode}`), {
    x: 56,
    y: 66,
    size: 8.5,
    font: fontSemiBold,
    color: cInkBody,
  });
  page.drawText(toWinAnsiSafe(`Issued: ${params.issuedDate}  •  gdgjakarta.com`), {
    x: 56,
    y: 53,
    size: 8,
    font: fontRegular,
    color: cInkMuted,
  });

  // Right Column: X.509 Digital Signature Trust Badge
  page.drawRectangle({
    x: 408,
    y: 56,
    width: 164,
    height: 80,
    color: cMat,
    borderColor: cBorderOuter,
    borderWidth: 0.75,
  });
  page.drawCircle({ x: 422, y: 122, size: 3, color: cGGreen });
  page.drawText("DIGITALLY SIGNED", { x: 430, y: 119, size: 7.5, font: fontBold, color: cTrustGreen });
  page.drawText("X.509 PKCS#7 Verified", { x: 418, y: 103, size: 8.5, font: fontSemiBold, color: cInkPrimary });
  let verifyHost = "gdgjakarta.com";
  try {
    verifyHost = new URL(params.verifyUrl).host || "gdgjakarta.com";
  } catch {
    verifyHost = "gdgjakarta.com";
  }

  page.drawText("Scan QR or visit", { x: 418, y: 87, size: 7.5, font: fontRegular, color: cInkMuted });
  page.drawText(`${verifyHost}/certificates`, { x: 418, y: 76, size: 7.5, font: fontSemiBold, color: cBrandBlue });
  page.drawText("Tamper-evident PDF", { x: 418, y: 63, size: 7, font: fontRegular, color: cInkSubtle });

  // Right Column: Verification QR Card
  page.drawRectangle({
    x: 584,
    y: 56,
    width: 80,
    height: 80,
    color: cSurface,
    borderColor: cQrBorder,
    borderWidth: 0.75,
  });
  const matrix = buildQrMatrix(params.verifyUrl);
  if (matrix && matrix.length > 0) {
    const boxSize = 68;
    const startX = 590;
    const startY = 62;
    const modules = matrix.length;
    const cellSize = boxSize / modules;

    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        if (matrix[row][col] === 1) {
          page.drawRectangle({
            x: startX + col * cellSize,
            y: startY + (modules - 1 - row) * cellSize,
            width: cellSize + 0.15,
            height: cellSize + 0.15,
            color: cInkPrimary,
          });
        }
      }
    }
  }
  const qrCaption = "SCAN TO VERIFY";
  const capW = fontBold.widthOfTextAtSize(qrCaption, 6.5);
  page.drawText(qrCaption, { x: 624 - capW / 2, y: 46, size: 6.5, font: fontBold, color: cInkMuted });

  pdfDoc.setTitle(toWinAnsiSafe(`${heading} - ${params.recipientName}`));
  pdfDoc.setAuthor("GDG Jakarta");
  pdfDoc.setSubject(toWinAnsiSafe(params.eventTitle));
  pdfDoc.setCreator("GDG Jakarta Organizer Dashboard");

  return pdfDoc.save();
}
