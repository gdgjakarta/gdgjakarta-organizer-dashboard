import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { P12Signer } from "@signpdf/signer-p12";
import { SignPdf } from "@signpdf/signpdf";
import forge from "node-forge";
import { degrees, PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb, StandardFonts } from "pdf-lib";

import { buildQrMatrix } from "@/lib/printers/qr-svg";
import type {
  EMeteraiPlacementRect,
  PdfPlacement,
  SignatureInputMode,
  SigningCertificateMetadata,
  SigningCertificateStatus,
} from "@/types/partner-signage";

import { mapViewportRectToPdf } from "./coordinate-transform";
import { createHash } from "node:crypto";

export const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_PDF_PAGES = 100;
export const MAX_PLACEMENTS = 200;

interface ParsedP12Details {
  p12Buffer: Buffer;
  passphrase: string;
  status: SigningCertificateStatus;
}

function toWinAnsiSafe(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014|\u2013/g, "-")
    .replace(/\u2022/g, "*")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function getAttrValue(attributes: forge.pki.CertificateField[], name: string): string | undefined {
  const field = attributes.find((attr) => attr.name === name || attr.shortName === name);
  return typeof field?.value === "string" ? field.value : undefined;
}

function parseP12Details(p12Buffer: Buffer, passphrase: string): ParsedP12Details {
  try {
    const derBuffer = forge.util.createBuffer(p12Buffer.toString("binary"));
    const p12Asn1 = forge.asn1.fromDer(derBuffer);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
    const keyBags =
      p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [];

    const privateKey = keyBags[0]?.key as forge.pki.rsa.PrivateKey | undefined;
    let cert: forge.pki.Certificate | undefined;

    for (const bag of certBags) {
      if (!bag?.cert) continue;
      if (privateKey) {
        const pubKey = bag.cert.publicKey as forge.pki.rsa.PublicKey;
        if (
          pubKey?.n &&
          pubKey?.e &&
          privateKey.n.compareTo(pubKey.n) === 0 &&
          privateKey.e.compareTo(pubKey.e) === 0
        ) {
          cert = bag.cert;
          break;
        }
      } else {
        cert = bag.cert;
        break;
      }
    }

    if (!cert || !privateKey) {
      return {
        p12Buffer,
        passphrase,
        status: {
          configured: false,
          isExpired: false,
          isSelfSigned: false,
          error: "PKCS#12 bundle does not contain a matching certificate and private key.",
        },
      };
    }

    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const md = forge.md.sha256.create();
    md.update(certDer);
    const fingerprintSha256 = md.digest().toHex().toUpperCase();

    const validFrom = cert.validity.notBefore.toISOString();
    const validTo = cert.validity.notAfter.toISOString();
    const isExpired = Date.now() > cert.validity.notAfter.getTime();
    const isSelfSigned = cert.isIssuer(cert);

    return {
      p12Buffer,
      passphrase,
      status: {
        configured: true,
        isExpired,
        isSelfSigned,
        subjectCn: getAttrValue(cert.subject.attributes, "commonName") || "GDG Jakarta",
        organization: getAttrValue(cert.subject.attributes, "organizationName"),
        issuerCn: getAttrValue(cert.issuer.attributes, "commonName") || "GDG Jakarta",
        serialNumber: cert.serialNumber.toUpperCase(),
        fingerprintSha256,
        validFrom,
        validTo,
      },
    };
  } catch (err) {
    return {
      p12Buffer,
      passphrase,
      status: {
        configured: false,
        isExpired: false,
        isSelfSigned: false,
        error: err instanceof Error ? err.message : "Failed to parse PKCS#12 certificate.",
      },
    };
  }
}

function resolveP12FromEnvOrOverride(
  p12Override?: { p12Buffer: Buffer; passphrase: string } | null,
): ParsedP12Details | null {
  if (p12Override === null) {
    return null;
  }
  if (p12Override) {
    return parseP12Details(p12Override.p12Buffer, p12Override.passphrase);
  }

  const rawBase64 = process.env.PDF_SIGNING_P12_BASE64?.trim();
  if (!rawBase64) {
    return null;
  }

  const passphrase = process.env.PDF_SIGNING_P12_PASSPHRASE ?? "";
  const p12Buffer = Buffer.from(rawBase64, "base64");
  if (!p12Buffer.length) {
    return null;
  }

  return parseP12Details(p12Buffer, passphrase);
}

/**
 * Inspects the configured X.509 .p12 e-certificate without exposing any private key material.
 */
export function inspectConfiguredCertificate(
  p12Override?: { p12Buffer: Buffer; passphrase: string } | null,
): SigningCertificateStatus {
  const parsed = resolveP12FromEnvOrOverride(p12Override);
  if (!parsed) {
    return {
      configured: false,
      isExpired: false,
      isSelfSigned: false,
    };
  }
  return parsed.status;
}

function transformLocalPoint(
  originX: number,
  originY: number,
  localX: number,
  localY: number,
  rotateDegrees: number,
): { x: number; y: number } {
  const rad = (rotateDegrees * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad));
  const sin = Math.round(Math.sin(rad));
  return {
    x: originX + localX * cos - localY * sin,
    y: originY + localX * sin + localY * cos,
  };
}

function truncateTextToFit(text: string, font: PDFFont, fontSize: number, maxWidth: number): string {
  const safe = toWinAnsiSafe(text);
  if (!safe || maxWidth <= 8) return "";
  if (font.widthOfTextAtSize(safe, fontSize) <= maxWidth) return safe;

  let trimmed = safe;
  while (trimmed.length > 1 && font.widthOfTextAtSize(`${trimmed}...`, fontSize) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed.length > 1 ? `${trimmed}...` : trimmed;
}

function drawTextStampPlacement(params: {
  page: PDFPage;
  rect: { x: number; y: number; width: number; height: number; rotateDegrees: number };
  placement: PdfPlacement;
  stampImage?: PDFImage;
  defaultSignerName: string;
  defaultSignerTitle: string;
  signedAtIso: string;
  fontRegular: PDFFont;
  fontBold: PDFFont;
}) {
  const {
    page,
    rect,
    placement,
    stampImage,
    defaultSignerName,
    defaultSignerTitle,
    signedAtIso,
    fontRegular,
    fontBold,
  } = params;
  const { x, y, width, height, rotateDegrees } = rect;
  const rot = degrees(rotateDegrees);

  page.drawRectangle({
    x,
    y,
    width,
    height,
    rotate: rot,
    color: rgb(0.97, 0.985, 1),
    borderColor: rgb(0.76, 0.84, 0.93),
    borderWidth: 0.85,
  });

  const accentWidth = Math.max(2.5, Math.min(4.5, width * 0.025));
  page.drawRectangle({
    x,
    y,
    width: accentWidth,
    height,
    rotate: rot,
    color: rgb(0.09, 0.45, 0.91),
  });

  const padX = accentWidth + Math.max(6, width * 0.05);
  const sigBoxW = stampImage ? width * 0.36 : 0;
  const availWidth = Math.max(20, width - padX - sigBoxW - 8);
  const baseFont = Math.max(6.5, Math.min(10.5, height * 0.19));
  const smallFont = Math.max(5.5, baseFont * 0.8);

  const signerName = placement.signerName?.trim() || defaultSignerName;
  const signerTitle = placement.signerTitle?.trim() || defaultSignerTitle;
  const signedDate =
    placement.signedDateText?.trim() ||
    new Date(signedAtIso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const lines: Array<{ text: string; font: PDFFont; size: number; color: ReturnType<typeof rgb> }> = [];
  if (placement.includeCertBadge !== false) {
    lines.push({
      text: "DIGITALLY SIGNED • GDG JAKARTA",
      font: fontBold,
      size: Math.max(5.2, smallFont * 0.92),
      color: rgb(0.05, 0.5, 0.3),
    });
  }
  lines.push({
    text: signerName,
    font: fontBold,
    size: baseFont,
    color: rgb(0.07, 0.09, 0.15),
  });
  if (signerTitle) {
    lines.push({
      text: signerTitle,
      font: fontRegular,
      size: smallFont,
      color: rgb(0.32, 0.38, 0.48),
    });
  }
  lines.push({
    text: `Signed: ${signedDate}`,
    font: fontRegular,
    size: smallFont,
    color: rgb(0.38, 0.44, 0.54),
  });

  const stepY = (height - 8) / Math.max(lines.length, 1);
  lines.forEach((line, idx) => {
    const localY = height - 6 - line.size - idx * stepY;
    if (localY < 3) return;
    const pt = transformLocalPoint(x, y, padX, localY, rotateDegrees);
    const safeText = truncateTextToFit(line.text, line.font, line.size, availWidth);
    if (!safeText) return;
    page.drawText(safeText, {
      x: pt.x,
      y: pt.y,
      size: line.size,
      font: line.font,
      color: line.color,
      rotate: rot,
    });
  });

  if (stampImage) {
    const maxW = Math.max(10, sigBoxW - 6);
    const maxH = Math.max(10, height - 8);
    const imgAspect = stampImage.width / Math.max(1, stampImage.height);
    let drawW = maxW;
    let drawH = drawW / Math.max(0.1, imgAspect);
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * imgAspect;
    }
    const localX = width - 6 - drawW;
    const localY = (height - drawH) / 2;
    const imgPt = transformLocalPoint(x, y, localX, localY, rotateDegrees);
    page.drawImage(stampImage, {
      x: imgPt.x,
      y: imgPt.y,
      width: drawW,
      height: drawH,
      rotate: rot,
    });
  }
}

function appendCertificateAuditPage(params: {
  pdfDoc: PDFDocument;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  documentId: string;
  token: string;
  documentTitle: string;
  originalFileName: string;
  companyName: string;
  originalPageCount: number;
  placementCount: number;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  signedAtIso: string;
  signatureMethodsUsed: SignatureInputMode[];
  originalSha256: string;
  ecertStatus: "signed_p12" | "hash_only";
  ecertMetadata?: SigningCertificateMetadata;
}) {
  const {
    pdfDoc,
    fontRegular,
    fontBold,
    documentId,
    token,
    documentTitle,
    originalFileName,
    companyName,
    originalPageCount,
    placementCount,
    signerName,
    signerTitle,
    signerEmail,
    signedAtIso,
    signatureMethodsUsed,
    originalSha256,
    ecertStatus,
    ecertMetadata,
  } = params;

  const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 42;
  const contentW = pageW - margin * 2;

  // Header Banner
  const headerH = 86;
  page.drawRectangle({
    x: 0,
    y: pageH - headerH,
    width: pageW,
    height: headerH,
    color: rgb(0.102, 0.451, 0.91),
  });

  page.drawText("GOOGLE DEVELOPER GROUP JAKARTA", {
    x: margin,
    y: pageH - 30,
    size: 9.5,
    font: fontBold,
    color: rgb(0.84, 0.91, 1),
  });
  page.drawText("Digital Signature Certificate & Audit Trail", {
    x: margin,
    y: pageH - 54,
    size: 18,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(
    ecertStatus === "signed_p12"
      ? "Protected with Embedded X.509 PKCS#7 Cryptographic E-Certificate"
      : "Protected with SHA-256 Tamper-Evident Integrity Seal",
    {
      x: margin,
      y: pageH - 72,
      size: 9.5,
      font: fontRegular,
      color: rgb(0.9, 0.95, 1),
    },
  );

  const drawSectionCard = (topY: number, height: number, title: string, rows: Array<[string, string]>) => {
    page.drawRectangle({
      x: margin,
      y: topY - height,
      width: contentW,
      height,
      color: rgb(0.985, 0.99, 0.996),
      borderColor: rgb(0.86, 0.89, 0.93),
      borderWidth: 1,
    });
    page.drawText(toWinAnsiSafe(title), {
      x: margin + 14,
      y: topY - 22,
      size: 11,
      font: fontBold,
      color: rgb(0.102, 0.451, 0.91),
    });
    page.drawLine({
      start: { x: margin + 14, y: topY - 30 },
      end: { x: margin + contentW - 14, y: topY - 30 },
      thickness: 0.75,
      color: rgb(0.88, 0.91, 0.95),
    });

    let cursorY = topY - 48;
    for (const [label, value] of rows) {
      page.drawText(toWinAnsiSafe(label), {
        x: margin + 14,
        y: cursorY,
        size: 8.5,
        font: fontBold,
        color: rgb(0.36, 0.42, 0.51),
      });
      const safeVal = truncateTextToFit(value || "-", fontRegular, 8.8, contentW - 180);
      page.drawText(safeVal, {
        x: margin + 165,
        y: cursorY,
        size: 8.8,
        font: fontRegular,
        color: rgb(0.08, 0.11, 0.17),
      });
      cursorY -= 19;
    }
  };

  let y = pageH - headerH - 24;

  drawSectionCard(y, 152, "1. Document Summary", [
    ["Document Title", documentTitle],
    ["Partner / Organization", companyName],
    ["Original File Name", originalFileName],
    ["Original Pages / Marks", `${originalPageCount} page(s) • ${placementCount} signature placement(s)`],
    ["Audit Record ID", documentId],
    ["Original PDF SHA-256", originalSha256],
  ]);
  y -= 168;

  const formattedDateWib = `${new Date(signedAtIso).toLocaleString("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })} WIB`;

  drawSectionCard(y, 134, "2. Signatory Details", [
    ["Authorized Signer", signerName],
    ["Role / Title", signerTitle || "GDG Jakarta Organizer"],
    ["Signer Email", signerEmail || "info@gdgjakarta.org"],
    ["Signed Timestamp", `${formattedDateWib} (${signedAtIso})`],
    ["Signature Methods", signatureMethodsUsed.join(", ") || "signature"],
  ]);
  y -= 150;

  drawSectionCard(
    y,
    172,
    "3. Cryptographic E-Certificate Details",
    ecertMetadata
      ? [
          ["Protection Standard", "Adobe PPKLite / PKCS#7 Detached (RSA-SHA256)"],
          ["Certificate Subject (CN)", ecertMetadata.subject_cn],
          ["Issuer (CN)", `${ecertMetadata.issuer_cn}${ecertMetadata.is_self_signed ? " (Self-Signed)" : ""}`],
          ["Serial Number", ecertMetadata.serial_number],
          ["Cert SHA-256 Fingerprint", ecertMetadata.fingerprint_sha256],
          ["Validity Window", `${ecertMetadata.valid_from.slice(0, 10)} to ${ecertMetadata.valid_to.slice(0, 10)}`],
          ["Signing Reason / Location", `${ecertMetadata.reason} (${ecertMetadata.location})`],
        ]
      : [
          ["Protection Standard", "SHA-256 Integrity Seal (X.509 .p12 secret not configured)"],
          ["Authority", "Google Developer Group Jakarta Dashboard"],
          ["Tamper Detection", "Verify exact PDF bytes against signed SHA-256 on gdgjakarta.com"],
          ["Original PDF SHA-256", originalSha256],
          ["Note", "Configure PDF_SIGNING_P12_BASE64 to embed PKCS#7 X.509 signatures."],
        ],
  );
  y -= 190;

  // Verification QR Card at bottom
  const verifyUrl = `https://gdgjakarta.com/partnership/signed-documents/${token}`;
  const qrBoxH = 128;
  page.drawRectangle({
    x: margin,
    y: y - qrBoxH,
    width: contentW,
    height: qrBoxH,
    color: rgb(0.955, 0.975, 1),
    borderColor: rgb(0.75, 0.84, 0.96),
    borderWidth: 1,
  });

  const qrMatrix = buildQrMatrix(verifyUrl);
  const qrBoxSize = 96;
  const qrOriginX = margin + 16;
  const qrOriginY = y - qrBoxH + 16;

  page.drawRectangle({
    x: qrOriginX,
    y: qrOriginY,
    width: qrBoxSize,
    height: qrBoxSize,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 0.75,
  });

  if (qrMatrix) {
    const n = qrMatrix.length;
    const quiet = 2;
    const cell = qrBoxSize / (n + quiet * 2);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qrMatrix[r][c]) {
          page.drawRectangle({
            x: qrOriginX + (c + quiet) * cell,
            y: qrOriginY + qrBoxSize - (r + quiet + 1) * cell,
            width: cell + 0.05,
            height: cell + 0.05,
            color: rgb(0.05, 0.07, 0.12),
          });
        }
      }
    }
  }

  const textX = qrOriginX + qrBoxSize + 18;
  page.drawText("Online Authenticity & Tamper Verification", {
    x: textX,
    y: y - 28,
    size: 11,
    font: fontBold,
    color: rgb(0.07, 0.1, 0.16),
  });
  page.drawText("Scan the QR code or open the URL below to verify the signed document's", {
    x: textX,
    y: y - 47,
    size: 8.8,
    font: fontRegular,
    color: rgb(0.3, 0.36, 0.45),
  });
  page.drawText("SHA-256 cryptographic digest and certificate metadata on gdgjakarta.com:", {
    x: textX,
    y: y - 60,
    size: 8.8,
    font: fontRegular,
    color: rgb(0.3, 0.36, 0.45),
  });
  page.drawText(truncateTextToFit(verifyUrl, fontBold, 8.2, contentW - qrBoxSize - 46), {
    x: textX,
    y: y - 82,
    size: 8.2,
    font: fontBold,
    color: rgb(0.102, 0.451, 0.91),
  });
  page.drawText("Any modification after signing invalidates both the X.509 signature and SHA-256 hash.", {
    x: textX,
    y: y - 103,
    size: 7.8,
    font: fontRegular,
    color: rgb(0.42, 0.48, 0.57),
  });
}

export interface SignPartnerPdfParams {
  pdfBytes: Uint8Array;
  placements: PdfPlacement[];
  assets: Map<string, Uint8Array>;
  documentId: string;
  token: string;
  documentTitle: string;
  originalFileName: string;
  companyName: string;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  reason: string;
  location: string;
  signedAtIso: string;
  includeCertificatePage: boolean;
  signatureMethodsUsed: SignatureInputMode[];
  p12Override?: { p12Buffer: Buffer; passphrase: string } | null;
}

export interface SignPartnerPdfResult {
  signedPdfBuffer: Buffer;
  originalSha256: string;
  signedSha256: string;
  originalPageCount: number;
  pageCount: number;
  ecertStatus: "signed_p12" | "hash_only";
  ecertMetadata?: SigningCertificateMetadata;
  emeteraiPlacementRect?: EMeteraiPlacementRect;
}

/**
 * Visually places signatures/initials/stamps onto a partner PDF, optionally appends an A4 Certificate
 * of Completion audit page with verification QR code, and embeds an X.509 PKCS#7 digital signature.
 */
export async function signPartnerPdfBuffer(params: SignPartnerPdfParams): Promise<SignPartnerPdfResult> {
  const {
    pdfBytes,
    placements,
    assets,
    documentId,
    token,
    documentTitle,
    originalFileName,
    companyName,
    signerName,
    signerTitle,
    signerEmail,
    reason,
    location,
    signedAtIso,
    includeCertificatePage,
    signatureMethodsUsed,
    p12Override,
  } = params;

  if (pdfBytes.byteLength === 0 || pdfBytes.byteLength > MAX_PDF_BYTES) {
    throw new Error("PDF file size must be between 1 byte and 15 MB.");
  }

  const header = Buffer.from(pdfBytes.subarray(0, 5)).toString("ascii");
  if (header !== "%PDF-") {
    throw new Error("Uploaded file does not have a valid %PDF- header.");
  }

  if (!placements.length || placements.length > MAX_PLACEMENTS) {
    throw new Error(`Placements count must be between 1 and ${MAX_PLACEMENTS}.`);
  }

  const originalSha256 = createHash("sha256").update(pdfBytes).digest("hex");

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  if (pdfDoc.isEncrypted) {
    throw new Error("This PDF is password-protected or encrypted. Please upload an unlocked PDF.");
  }

  const originalPageCount = pdfDoc.getPageCount();
  if (originalPageCount === 0 || originalPageCount > MAX_PDF_PAGES) {
    throw new Error(`PDF page count must be between 1 and ${MAX_PDF_PAGES}.`);
  }

  // Embed deduplicated PNG assets once per unique assetId
  const embeddedImages = new Map<string, PDFImage>();
  for (const [assetId, pngBytes] of assets.entries()) {
    const img = await pdfDoc.embedPng(pngBytes);
    embeddedImages.set(assetId, img);
  }

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let emeteraiPlacementRect: EMeteraiPlacementRect | undefined;

  for (const placement of placements) {
    if (placement.pageIndex < 0 || placement.pageIndex >= originalPageCount) {
      throw new Error(`Placement references out-of-range page index ${placement.pageIndex}.`);
    }

    const page = pdfDoc.getPage(placement.pageIndex);
    const cropBox = page.getCropBox();
    const rotationDegrees = page.getRotation().angle;
    const rect = mapViewportRectToPdf({
      cropBox,
      rotationDegrees,
      xPct: placement.xPct,
      yPct: placement.yPct,
      widthPct: placement.widthPct,
      heightPct: placement.heightPct,
    });

    if (placement.kind === "emeterai") {
      // PERURI/Resmi.ID stamps the official visual seal & QR code via API; only capture PDF-space coords here.
      emeteraiPlacementRect = {
        page: placement.pageIndex + 1,
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        ...(placement.emeteraiCorner ? { corner: placement.emeteraiCorner } : {}),
      };
      continue;
    }

    if (placement.kind === "text_stamp") {
      const stampImage = placement.assetId ? embeddedImages.get(placement.assetId) : undefined;
      drawTextStampPlacement({
        page,
        rect,
        placement,
        stampImage,
        defaultSignerName: signerName,
        defaultSignerTitle: signerTitle,
        signedAtIso,
        fontRegular,
        fontBold,
      });
    } else {
      if (!placement.assetId) {
        throw new Error(`Placement ${placement.id} is missing an assetId.`);
      }
      const img = embeddedImages.get(placement.assetId);
      if (!img) {
        throw new Error(`Signature image asset '${placement.assetId}' was not found in upload.`);
      }
      page.drawImage(img, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        rotate: degrees(rect.rotateDegrees),
      });
    }
  }

  const parsedP12 = resolveP12FromEnvOrOverride(p12Override);
  const canSignWithP12 = Boolean(parsedP12 && parsedP12.status.configured && !parsedP12.status.isExpired);

  const ecertMetadata: SigningCertificateMetadata | undefined =
    canSignWithP12 && parsedP12
      ? {
          subject_cn: parsedP12.status.subjectCn || "Google Developer Group Jakarta",
          organization: parsedP12.status.organization,
          issuer_cn: parsedP12.status.issuerCn || "Google Developer Group Jakarta",
          serial_number: parsedP12.status.serialNumber || "",
          fingerprint_sha256: parsedP12.status.fingerprintSha256 || "",
          valid_from: parsedP12.status.validFrom || signedAtIso,
          valid_to: parsedP12.status.validTo || signedAtIso,
          is_self_signed: parsedP12.status.isSelfSigned,
          reason,
          location,
        }
      : undefined;

  const ecertStatus: "signed_p12" | "hash_only" = canSignWithP12 ? "signed_p12" : "hash_only";

  if (includeCertificatePage) {
    appendCertificateAuditPage({
      pdfDoc,
      fontRegular,
      fontBold,
      documentId,
      token,
      documentTitle,
      originalFileName,
      companyName,
      originalPageCount,
      placementCount: placements.length,
      signerName,
      signerTitle,
      signerEmail,
      signedAtIso,
      signatureMethodsUsed,
      originalSha256,
      ecertStatus,
      ecertMetadata,
    });
  }

  pdfDoc.setTitle(toWinAnsiSafe(documentTitle));
  pdfDoc.setProducer("GDG Jakarta Organizer Dashboard");
  pdfDoc.setCreator("GDG Jakarta Partner Signage");
  pdfDoc.setModificationDate(new Date(signedAtIso));

  let signedPdfBuffer: Buffer;
  if (canSignWithP12 && parsedP12) {
    pdflibAddPlaceholder({
      pdfDoc,
      reason: toWinAnsiSafe(reason || "Authorized Partnership Approval — GDG Jakarta"),
      contactInfo: toWinAnsiSafe(signerEmail || "info@gdgjakarta.org"),
      name: toWinAnsiSafe(signerName),
      location: toWinAnsiSafe(location || "Jakarta, Indonesia"),
      signingTime: new Date(signedAtIso),
      signatureLength: 16384,
      appName: "GDG Jakarta Organizer Dashboard",
    });

    // Uncompressed xref table is required by @signpdf/signpdf byte-range calculation
    const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });
    const signer = new P12Signer(parsedP12.p12Buffer, {
      passphrase: parsedP12.passphrase,
    });
    const signPdf = new SignPdf();
    signedPdfBuffer = await signPdf.sign(Buffer.from(pdfWithPlaceholder), signer, new Date(signedAtIso));
  } else {
    const saved = await pdfDoc.save();
    signedPdfBuffer = Buffer.from(saved);
  }

  const signedSha256 = createHash("sha256").update(signedPdfBuffer).digest("hex");

  return {
    signedPdfBuffer,
    originalSha256,
    signedSha256,
    originalPageCount,
    pageCount: pdfDoc.getPageCount(),
    ecertStatus,
    ecertMetadata,
    emeteraiPlacementRect,
  };
}

/**
 * Cryptographically signs any raw PDF buffer using the Cloudflare Worker PKCS#7 X.509 secrets
 * (`PDF_SIGNING_P12_BASE64` + `PDF_SIGNING_P12_PASSPHRASE`), falling back gracefully to `hash_only` if unconfigured.
 */
export async function signRawPdfBytesWithEnvP12(
  pdfBytes: Uint8Array,
  options: {
    reason: string;
    signerName?: string;
    contactInfo?: string;
    location?: string;
  },
): Promise<{
  pdfBytes: Uint8Array;
  sha256: string;
  ecertStatus: "signed_p12" | "hash_only";
  ecertMetadata?: SigningCertificateMetadata;
}> {
  const signedAtIso = new Date().toISOString();
  const parsedP12 = resolveP12FromEnvOrOverride();
  const canSignWithP12 = Boolean(parsedP12 && parsedP12.status.configured && !parsedP12.status.isExpired);

  if (!canSignWithP12 || !parsedP12) {
    const sha256 = createHash("sha256").update(pdfBytes).digest("hex");
    return { pdfBytes, sha256, ecertStatus: "hash_only" };
  }

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const reason = options.reason || "Official Event Certificate — GDG Jakarta";
  const location = options.location || "Jakarta, Indonesia";

  pdflibAddPlaceholder({
    pdfDoc,
    reason: toWinAnsiSafe(reason),
    contactInfo: toWinAnsiSafe(options.contactInfo || "info@gdgjakarta.org"),
    name: toWinAnsiSafe(options.signerName || "GDG Jakarta"),
    location: toWinAnsiSafe(location),
    signingTime: new Date(signedAtIso),
    signatureLength: 16384,
    appName: "GDG Jakarta Organizer Dashboard",
  });

  const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });
  const signer = new P12Signer(parsedP12.p12Buffer, {
    passphrase: parsedP12.passphrase,
  });
  const signPdf = new SignPdf();
  const signedBuffer = await signPdf.sign(Buffer.from(pdfWithPlaceholder), signer, new Date(signedAtIso));
  const finalBytes = new Uint8Array(signedBuffer);
  const sha256 = createHash("sha256").update(finalBytes).digest("hex");

  return {
    pdfBytes: finalBytes,
    sha256,
    ecertStatus: "signed_p12",
    ecertMetadata: {
      subject_cn: parsedP12.status.subjectCn || "Google Developer Group Jakarta",
      organization: parsedP12.status.organization,
      issuer_cn: parsedP12.status.issuerCn || "Google Developer Group Jakarta",
      serial_number: parsedP12.status.serialNumber || "",
      fingerprint_sha256: parsedP12.status.fingerprintSha256 || "",
      valid_from: parsedP12.status.validFrom || signedAtIso,
      valid_to: parsedP12.status.validTo || signedAtIso,
      is_self_signed: parsedP12.status.isSelfSigned,
      reason,
      location,
    },
  };
}
