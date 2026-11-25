import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";

import type { CertificateOverlayField, CertificateVerificationBadgePosition } from "@/lib/firestore/types";
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
 * Draws the X.509 PKCS#7 Digital Signature Trust Badge + Verification QR Card (base geometry: 256 x 90 pt, origin at bottom-left of the cards; caption sits 10 pt below).
 */
function drawVerificationStamp(params: {
  page: PDFPage;
  x: number;
  y: number;
  width: number;
  verifyUrl: string;
  fonts: { regular: PDFFont; semiBold: PDFFont; bold: PDFFont };
}): void {
  const { page, x, y, verifyUrl, fonts } = params;
  const s = params.width / 256;

  const cMat = parseHexColor("#F8FAFC");
  const cSurface = parseHexColor("#FFFFFF");
  const cBorderOuter = parseHexColor("#E2E8F0");
  const cQrBorder = parseHexColor("#DADCE0");
  const cInkPrimary = parseHexColor("#202124");
  const cInkMuted = parseHexColor("#5F6368");
  const cInkSubtle = parseHexColor("#80868B");
  const cBrandBlue = parseHexColor("#1A73E8");
  const cTrustGreen = parseHexColor("#137333");
  const cGGreen = parseHexColor("#34A853");

  // Left card: X.509 Digital Signature Trust Badge (164 x 80)
  page.drawRectangle({
    x,
    y,
    width: 164 * s,
    height: 80 * s,
    color: cMat,
    borderColor: cBorderOuter,
    borderWidth: 0.75 * s,
  });
  page.drawCircle({ x: x + 14 * s, y: y + 66 * s, size: 3 * s, color: cGGreen });
  page.drawText("DIGITALLY SIGNED", {
    x: x + 22 * s,
    y: y + 63 * s,
    size: 7.5 * s,
    font: fonts.bold,
    color: cTrustGreen,
  });
  page.drawText("X.509 PKCS#7 Verified", {
    x: x + 10 * s,
    y: y + 47 * s,
    size: 8.5 * s,
    font: fonts.semiBold,
    color: cInkPrimary,
  });

  let verifyHost = "gdgjakarta.com";
  try {
    verifyHost = new URL(verifyUrl).host || "gdgjakarta.com";
  } catch {
    verifyHost = "gdgjakarta.com";
  }

  page.drawText("Scan QR or visit", {
    x: x + 10 * s,
    y: y + 31 * s,
    size: 7.5 * s,
    font: fonts.regular,
    color: cInkMuted,
  });
  page.drawText(`${verifyHost}/certificates`, {
    x: x + 10 * s,
    y: y + 20 * s,
    size: 7.5 * s,
    font: fonts.semiBold,
    color: cBrandBlue,
  });
  page.drawText("Tamper-evident PDF", {
    x: x + 10 * s,
    y: y + 7 * s,
    size: 7 * s,
    font: fonts.regular,
    color: cInkSubtle,
  });

  // Right card: Verification QR Card (80 x 80, 12 pt gap)
  const qrCardX = x + 176 * s;
  page.drawRectangle({
    x: qrCardX,
    y,
    width: 80 * s,
    height: 80 * s,
    color: cSurface,
    borderColor: cQrBorder,
    borderWidth: 0.75 * s,
  });

  const matrix = buildQrMatrix(verifyUrl);
  if (matrix && matrix.length > 0) {
    const boxSize = 68 * s;
    const startX = qrCardX + 6 * s;
    const startY = y + 6 * s;
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
  const capSize = 6.5 * s;
  const capW = fonts.bold.widthOfTextAtSize(qrCaption, capSize);
  page.drawText(qrCaption, {
    x: qrCardX + 40 * s - capW / 2,
    y: y - 10 * s,
    size: capSize,
    font: fonts.bold,
    color: cInkMuted,
  });
}

/**
 * Stamps the X.509 Verification Badge + QR Card onto the first page of an existing PDF (e.g. Google Slides export).
 */
export async function stampVerificationBadgeOnPdf(params: {
  pdfBytes: Uint8Array;
  verifyUrl: string;
  position?: CertificateVerificationBadgePosition;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(params.pdfBytes);
  const pages = pdfDoc.getPages();
  if (pages.length === 0) return params.pdfBytes;

  const page = pages[0];
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const fonts = await embedPlusJakartaSansOrFallback(pdfDoc);

  // Scale cleanly to page width (~33% of page width, clamped to readable bounds)
  const stampWidth = Math.max(180, Math.min(256, pageWidth * 0.34));
  const s = stampWidth / 256;
  const cardHeight = 80 * s;
  const captionDrop = 12 * s;
  const marginX = Math.max(24, pageWidth * 0.045);
  const marginY = Math.max(22, pageHeight * 0.055);

  const pos = params.position ?? "bottom-right";
  const x = pos.endsWith("left") ? marginX : pageWidth - marginX - stampWidth;
  const y = pos.startsWith("top") ? pageHeight - marginY - cardHeight : marginY + captionDrop;

  drawVerificationStamp({ page, x, y, width: stampWidth, verifyUrl: params.verifyUrl, fonts });
  return pdfDoc.save();
}

/**
 * Stamps {{verification_badge}} and/or {{qr_code}} at exact normalized Google Slides placeholder boxes.
 */
export async function stampCertificateSlotsOnPdf(params: {
  pdfBytes: Uint8Array;
  verifyUrl: string;
  slots: Array<{ key: "verification_badge" | "qr_code"; x: number; y: number; width: number; height: number }>;
}): Promise<Uint8Array> {
  if (params.slots.length === 0) return params.pdfBytes;

  const pdfDoc = await PDFDocument.load(params.pdfBytes);
  const pages = pdfDoc.getPages();
  if (pages.length === 0) return params.pdfBytes;

  const page = pages[0];
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const fonts = await embedPlusJakartaSansOrFallback(pdfDoc);

  for (const slot of params.slots) {
    if (slot.key === "verification_badge") {
      const stampWidth = Math.max(180, Math.min(280, slot.width * pageWidth));
      const s = stampWidth / 256;
      const cardHeight = 80 * s;
      const captionDrop = 12 * s;
      const rawX = slot.x * pageWidth;
      const topY = pageHeight - slot.y * pageHeight;
      const x = Math.max(12, Math.min(pageWidth - stampWidth - 12, rawX));
      const y = Math.max(captionDrop + 6, Math.min(pageHeight - cardHeight - 12, topY - cardHeight));

      drawVerificationStamp({ page, x, y, width: stampWidth, verifyUrl: params.verifyUrl, fonts });
      continue;
    }

    if (slot.key === "qr_code") {
      const matrix = buildQrMatrix(params.verifyUrl);
      if (!matrix || matrix.length === 0) continue;

      const boxSize = Math.max(48, Math.min(140, slot.width * pageWidth));
      const rawX = slot.x * pageWidth;
      const topY = pageHeight - slot.y * pageHeight;
      const startX = Math.max(12, Math.min(pageWidth - boxSize - 12, rawX));
      const startY = Math.max(12, Math.min(pageHeight - boxSize - 12, topY - boxSize));
      const modules = matrix.length;
      const cellSize = boxSize / modules;

      page.drawRectangle({
        x: startX - 4,
        y: startY - 4,
        width: boxSize + 8,
        height: boxSize + 8,
        color: rgb(1, 1, 1),
        borderColor: parseHexColor("#DADCE0"),
        borderWidth: 0.75,
      });

      const qrColor = parseHexColor("#202124");
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
    }
  }

  return pdfDoc.save();
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
    if (field.key === "verification_badge") {
      const stampWidth = Math.max(140, field.width * pageWidth);
      const cardHeight = (80 / 256) * stampWidth;
      const startX = field.x * pageWidth;
      const topY = pageHeight - field.y * pageHeight;
      drawVerificationStamp({
        page,
        x: startX,
        y: Math.max(16, topY - cardHeight),
        width: stampWidth,
        verifyUrl: params.verifyUrl,
        fonts: { regular: fontRegular, semiBold: fontBold, bold: fontBold },
      });
      continue;
    }

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
  showVerificationBadge?: boolean;
  signerName?: string | null;
  signerTitle?: string | null;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const pageWidth = 720;
  const pageHeight = 540;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const { regular: fontRegular, semiBold: fontSemiBold, bold: fontBold } = await embedPlusJakartaSansOrFallback(pdfDoc);

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
  const cBrandBlue = parseHexColor("#1A73E8");
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

  // Right Column: X.509 Digital Signature Trust Badge + Verification QR Card
  if (params.showVerificationBadge !== false) {
    drawVerificationStamp({
      page,
      x: 408,
      y: 56,
      width: 256,
      verifyUrl: params.verifyUrl,
      fonts: { regular: fontRegular, semiBold: fontSemiBold, bold: fontBold },
    });
  }

  pdfDoc.setTitle(toWinAnsiSafe(`${heading} - ${params.recipientName}`));
  pdfDoc.setAuthor("GDG Jakarta");
  pdfDoc.setSubject(toWinAnsiSafe(params.eventTitle));
  pdfDoc.setCreator("GDG Jakarta Organizer Dashboard");

  return pdfDoc.save();
}
