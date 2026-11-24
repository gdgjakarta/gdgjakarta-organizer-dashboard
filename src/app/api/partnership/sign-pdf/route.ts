import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { inspectResmiEMeteraiStatus, submitResmiEMeteraiStamp } from "@/lib/pdf/resmi-emeterai";
import { MAX_PDF_BYTES, MAX_PLACEMENTS, signPartnerPdfBuffer } from "@/lib/pdf/sign-pdf";
import { deleteMediaObject, uploadMediaObject } from "@/lib/r2/client";
import { sanitizeStorageName } from "@/lib/r2/utils";
import { getAuthenticatedSessionUser, isAuthorizedExecutiveOrganizerSession } from "@/server/auth-guard";
import { finalizeEMeteraiDocument } from "@/server/emeterai-finalizer";
import { getFirestoreDoc, patchFirestoreDocDetailed } from "@/server/firestore-admin";
import type {
  EMeteraiDocumentType,
  PartnerSignedDocument,
  PdfPlacement,
  SignatureInputMode,
} from "@/types/partner-signage";

import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

const MAX_ASSET_BYTES = 2 * 1024 * 1024; // 2 MB per PNG signature asset
const R2_PREFIX = "community-dashboard/partnership/signed-documents";

const placementSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum(["signature", "initials", "text_stamp", "emeterai"]),
  pageIndex: z.number().int().min(0).max(99),
  xPct: z.number().min(0).max(1),
  yPct: z.number().min(0).max(1),
  widthPct: z.number().gt(0).max(1),
  heightPct: z.number().gt(0).max(1),
  assetId: z.string().min(1).max(100).optional(),
  signerName: z.string().max(150).optional(),
  signerTitle: z.string().max(150).optional(),
  signedDateText: z.string().max(64).optional(),
  includeCertBadge: z.boolean().optional(),
  emeteraiCorner: z.enum(["top_left", "top_right", "bottom_left", "bottom_right"]).optional(),
});

const signPdfPayloadSchema = z.object({
  existingDocId: z.string().max(128).optional(),
  documentTitle: z.string().trim().min(1, "Document title is required").max(200),
  sponsorId: z.string().max(128).nullable().optional(),
  companyName: z.string().trim().min(1, "Partner / company name is required").max(200),
  contactName: z.string().trim().max(150).optional().default(""),
  contactEmail: z
    .string()
    .trim()
    .max(150)
    .refine((val) => val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "Invalid contact email")
    .optional()
    .default(""),
  eventId: z.string().max(128).nullable().optional(),
  eventTitle: z.string().trim().max(300).optional().default(""),
  signerName: z.string().trim().min(1, "Signer name is required").max(150),
  signerTitle: z.string().trim().max(150).optional().default("GDG Jakarta Organizer"),
  reason: z.string().trim().max(300).optional().default("Authorized Partnership Approval — GDG Jakarta"),
  location: z.string().trim().max(150).optional().default("Jakarta, Indonesia"),
  includeCertificatePage: z.boolean().default(false),
  emeteraiDocumentType: z
    .enum([
      "Surat Perjanjian",
      "Dokumen Transaksi",
      "Surat Keterangan",
      "Surat Kuasa",
      "Surat Pernyataan",
      "Dokumen Lainnya",
    ])
    .optional(),
  emeteraiCorner: z.enum(["top_left", "top_right", "bottom_left", "bottom_right"]).optional(),
  signatureMethodsUsed: z
    .array(z.enum(["initials", "upload", "draw", "template"]))
    .max(10)
    .default([]),
  placements: z.array(placementSchema).min(1, "Place at least one signature or stamp").max(MAX_PLACEMENTS),
});

function hasPdfMagicHeader(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 5) return false;
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  );
}

function hasPngMagicHeader(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 8) return false;
  return (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

/**
 * POST /api/partnership/sign-pdf
 * Signs an uploaded partner PDF with visual placements, optional audit page, and X.509 PKCS#7 e-certificate,
 * uploads the signed PDF to Cloudflare R2, optionally submits Resmi.ID e-Meterai stamping,
 * and stores verification metadata in Firestore.
 */
export async function POST(request: NextRequest) {
  if (!(await isAuthorizedExecutiveOrganizerSession())) {
    return NextResponse.json({ error: "Unauthorized: Executive Organizer privileges required" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const pdfEntry = formData.get("pdf");
    const payloadRaw = formData.get("payload");

    if (!(pdfEntry instanceof File)) {
      return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
    }
    if (pdfEntry.size === 0 || pdfEntry.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "PDF file must be between 1 byte and 15 MB." }, { status: 400 });
    }
    if (typeof payloadRaw !== "string") {
      return NextResponse.json({ error: "Missing signing payload JSON." }, { status: 400 });
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(payloadRaw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON in signing payload." }, { status: 400 });
    }

    const parsedPayload = signPdfPayloadSchema.safeParse(parsedJson);
    if (!parsedPayload.success) {
      const msg = parsedPayload.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const data = parsedPayload.data;

    const emeteraiPlacements = data.placements.filter((p) => p.kind === "emeterai");
    if (emeteraiPlacements.length > 1) {
      return NextResponse.json({ error: "Only 1 e-Meterai stamp can be placed per PDF." }, { status: 400 });
    }
    const hasEMeterai = emeteraiPlacements.length === 1;
    const emeteraiProviderStatus = hasEMeterai ? inspectResmiEMeteraiStatus() : null;
    if (hasEMeterai && (!emeteraiProviderStatus?.configured || emeteraiProviderStatus.mode === "unconfigured")) {
      return NextResponse.json(
        { error: "Resmi.ID e-Meterai is not configured (RESMI_API_KEY missing)." },
        { status: 400 },
      );
    }

    const pdfBytes = new Uint8Array(await pdfEntry.arrayBuffer());
    if (!hasPdfMagicHeader(pdfBytes)) {
      return NextResponse.json(
        { error: "Uploaded file is not a valid PDF document (%PDF- header missing)." },
        { status: 400 },
      );
    }

    // Collect deduplicated PNG signature assets referenced by placements
    const assets = new Map<string, Uint8Array>();
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("asset_")) continue;
      if (!(value instanceof File)) continue;
      const assetId = key.slice("asset_".length).trim();
      if (!assetId) continue;
      if (value.size === 0 || value.size > MAX_ASSET_BYTES) {
        return NextResponse.json({ error: `Signature asset '${assetId}' must be <= 2 MB.` }, { status: 400 });
      }
      const pngBytes = new Uint8Array(await value.arrayBuffer());
      if (!hasPngMagicHeader(pngBytes)) {
        return NextResponse.json({ error: `Signature asset '${assetId}' must be a valid PNG image.` }, { status: 400 });
      }
      assets.set(assetId, pngBytes);
    }

    const sessionUser = await getAuthenticatedSessionUser();
    const signerEmail = sessionUser?.email || "info@gdgjakarta.org";
    const signerUid = sessionUser?.id || "organizer";

    let existingDoc: PartnerSignedDocument | null = null;
    if (data.existingDocId?.trim()) {
      const rawExisting = await getFirestoreDoc("partner_signed_documents", data.existingDocId.trim());
      if (!rawExisting) {
        return NextResponse.json({ error: "Existing signed document not found." }, { status: 404 });
      }
      existingDoc = rawExisting as unknown as PartnerSignedDocument;
    }

    const token = existingDoc?.token || randomBytes(16).toString("hex");
    const docId = existingDoc?.id || `psgn_${token}`;
    const now = new Date().toISOString();

    const safeOriginalFileName = (pdfEntry.name || "partner-document.pdf").slice(0, 300);

    const signResult = await signPartnerPdfBuffer({
      pdfBytes,
      placements: data.placements as PdfPlacement[],
      assets,
      documentId: docId,
      token,
      documentTitle: data.documentTitle,
      originalFileName: safeOriginalFileName,
      companyName: data.companyName,
      signerName: data.signerName,
      signerTitle: data.signerTitle || "GDG Jakarta Organizer",
      signerEmail,
      reason: data.reason || "Authorized Partnership Approval — GDG Jakarta",
      location: data.location || "Jakarta, Indonesia",
      signedAtIso: now,
      includeCertificatePage: data.includeCertificatePage,
      signatureMethodsUsed: data.signatureMethodsUsed as SignatureInputMode[],
    });

    const baseSlug = sanitizeStorageName(data.documentTitle.replace(/\.pdf$/i, ""), false) || "partner-document";
    const versionSuffix = existingDoc ? `-${Date.now().toString(36)}` : "";
    const signedFileName = `${baseSlug}-signed-${token.slice(0, 16)}${versionSuffix}.pdf`;

    const uploadRes = await uploadMediaObject(R2_PREFIX, signedFileName, signResult.signedPdfBuffer, {
      contentType: "application/pdf",
      customMetadata: {
        documentId: docId,
        token,
        companyName: data.companyName.slice(0, 120),
        signedSha256: signResult.signedSha256,
        ecertStatus: signResult.ecertStatus,
        signerEmail,
      },
    });

    if (!uploadRes.success || !uploadRes.item) {
      return NextResponse.json(
        { error: uploadRes.error || "Failed to upload signed PDF to bucket storage." },
        { status: 500 },
      );
    }

    let emeteraiFields: Partial<PartnerSignedDocument> = {
      emeterai_status: "none",
    };

    if (
      hasEMeterai &&
      signResult.emeteraiPlacementRect &&
      emeteraiProviderStatus &&
      emeteraiProviderStatus.mode !== "unconfigured"
    ) {
      const docType: EMeteraiDocumentType = data.emeteraiDocumentType || "Surat Perjanjian";
      const placementWithCorner = {
        ...signResult.emeteraiPlacementRect,
        ...(data.emeteraiCorner && !signResult.emeteraiPlacementRect.corner ? { corner: data.emeteraiCorner } : {}),
      };

      const submitRes = await submitResmiEMeteraiStamp({
        pdfBytes: new Uint8Array(signResult.signedPdfBuffer),
        fileName: signedFileName,
        documentType: docType,
        placement: placementWithCorner,
        idempotencyKey: `${docId}-${Date.now()}`,
      });

      emeteraiFields = {
        emeterai_status: submitRes.status,
        emeterai_provider: "resmi_id",
        emeterai_mode: emeteraiProviderStatus.mode,
        ...(submitRes.requestId ? { emeterai_request_id: submitRes.requestId.slice(0, 150) } : {}),
        ...(submitRes.serialNumber ? { emeterai_serial_number: submitRes.serialNumber.slice(0, 128) } : {}),
        emeterai_doc_type: docType,
        emeterai_price_idr: submitRes.priceIdr,
        emeterai_placement: placementWithCorner,
        ...(submitRes.error ? { emeterai_error: submitRes.error.slice(0, 500) } : {}),
      };
    }

    const signedDocRecord: PartnerSignedDocument = {
      id: docId,
      token,
      document_title: data.documentTitle,
      original_file_name: safeOriginalFileName,
      signed_file_name: uploadRes.item.name.slice(0, 300),
      sponsor_id: data.sponsorId ?? null,
      company_name: data.companyName,
      contact_name: data.contactName || "",
      contact_email: data.contactEmail || "",
      event_id: data.eventId ?? null,
      event_title: data.eventTitle || "",
      signer_name: data.signerName,
      signer_title: data.signerTitle || "GDG Jakarta Organizer",
      signer_email: signerEmail,
      signer_uid: signerUid,
      signature_methods_used: data.signatureMethodsUsed as SignatureInputMode[],
      page_count: signResult.pageCount,
      placement_count: data.placements.length,
      include_certificate_page: data.includeCertificatePage,
      signed_pdf_url: uploadRes.item.url,
      signed_pdf_key: uploadRes.item.key,
      signed_pdf_size_bytes: signResult.signedPdfBuffer.byteLength,
      original_sha256: signResult.originalSha256,
      signed_sha256: signResult.signedSha256,
      ecert_status: signResult.ecertStatus,
      ecert_metadata: signResult.ecertMetadata,
      status: existingDoc?.status || "signed",
      email_status: existingDoc?.email_status || "not_sent",
      email_sent_at: existingDoc?.email_sent_at,
      email_recipient: existingDoc?.email_recipient,
      ...emeteraiFields,
      signed_at: now,
      created_at: existingDoc?.created_at || now,
      updated_at: now,
    };

    const saveRes = await patchFirestoreDocDetailed(
      "partner_signed_documents",
      docId,
      signedDocRecord as unknown as Record<string, unknown>,
    );

    if (!saveRes.ok) {
      // Roll back R2 upload so no orphaned file remains
      await deleteMediaObject(uploadRes.item.key).catch(() => undefined);
      return NextResponse.json(
        {
          error: `Failed to save signed document record in Firestore (${saveRes.status ?? "err"}): ${saveRes.error ?? "Unknown error"}`,
        },
        { status: 500 },
      );
    }

    if (existingDoc?.signed_pdf_key && existingDoc.signed_pdf_key !== uploadRes.item.key) {
      await deleteMediaObject(existingDoc.signed_pdf_key).catch(() => undefined);
    }

    let finalDoc = signedDocRecord;
    if (hasEMeterai && signedDocRecord.emeterai_status === "stamped" && signedDocRecord.emeterai_request_id) {
      const finalized = await finalizeEMeteraiDocument(docId, {
        status: "stamped",
        serialNumber: signedDocRecord.emeterai_serial_number,
      });
      if (finalized.ok && finalized.document) {
        finalDoc = finalized.document;
      }
    }

    revalidatePath("/dashboard/partnership");
    const verifyUrl = `https://gdgjakarta.com/partnership/signed-documents/${token}`;

    return NextResponse.json({
      success: true,
      document: finalDoc,
      verifyUrl,
    });
  } catch (err) {
    console.error("[Sign PDF API] Error signing partner PDF:", err);
    const message = err instanceof Error ? err.message : "Failed to process and sign PDF.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
