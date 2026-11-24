import { revalidatePath } from "next/cache";

import { downloadResmiEMeteraiPdf, getResmiEMeteraiStatus } from "@/lib/pdf/resmi-emeterai";
import { deleteMediaObject, getMediaBucket, uploadMediaObject } from "@/lib/r2/client";
import type { PartnerSignedDocument } from "@/types/partner-signage";

import { getFirestoreDoc, patchFirestoreDoc } from "./firestore-admin";
import { createHash } from "node:crypto";

const R2_PREFIX = "community-dashboard/partnership/signed-documents";
const EMETERAI_STAGING_PREFIX = "community-dashboard/partnership/emeterai-staging";

export interface StagedEMeteraiManifest {
  requestId: string;
  status: "stamped" | "failed";
  serialNumber?: string;
  stagedPdfKey?: string;
  stagedPdfUrl?: string;
  stagedFileName?: string;
  stagedSizeBytes?: number;
  stagedSha256?: string;
  stampedAt?: string;
  error?: string;
}

function sanitizeRequestId(requestId: string): string {
  return requestId
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 128);
}

function getStagingManifestKey(requestId: string): string {
  return `${EMETERAI_STAGING_PREFIX}/${sanitizeRequestId(requestId)}.json`;
}

function safeRevalidate(token?: string) {
  try {
    revalidatePath("/dashboard/partnership");
    if (token) {
      revalidatePath(`/partnership/signed-documents/${token}`);
    }
  } catch {
    // Revalidation can safely no-op outside standard Next.js request scopes
  }
}

/**
 * Reads a staged Resmi.ID webhook completion manifest from Cloudflare R2, if present.
 */
export async function readStagedEMeteraiManifest(requestId: string): Promise<StagedEMeteraiManifest | null> {
  const safeId = sanitizeRequestId(requestId);
  if (!safeId) return null;

  try {
    const bucket = await getMediaBucket();
    const obj = await bucket.get(getStagingManifestKey(safeId));
    if (!obj) return null;
    const text = await obj.text();
    const parsed = JSON.parse(text) as StagedEMeteraiManifest;
    if (!parsed || typeof parsed !== "object" || (parsed.status !== "stamped" && parsed.status !== "failed")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Stages a Resmi.ID webhook outcome directly into Cloudflare R2 without touching Firestore,
 * allowing authenticated organizer polling and public verification lookups to consume it safely.
 */
export async function stageEMeteraiWebhookResult(params: {
  requestId: string;
  status: "stamped" | "failed";
  serialNumber?: string;
  error?: string;
}): Promise<StagedEMeteraiManifest> {
  const safeId = sanitizeRequestId(params.requestId);
  if (!safeId) {
    throw new Error("Invalid Resmi.ID requestId.");
  }

  const existing = await readStagedEMeteraiManifest(params.requestId);
  if (existing?.status === "stamped") {
    return existing;
  }

  const bucket = await getMediaBucket();
  const manifestKey = getStagingManifestKey(params.requestId);
  const now = new Date().toISOString();

  let manifest: StagedEMeteraiManifest;

  if (params.status === "stamped") {
    const stampedBytes = await downloadResmiEMeteraiPdf(params.requestId);
    const stagedSha256 = createHash("sha256").update(stampedBytes).digest("hex");
    const fileName = `emeterai-${safeId}.pdf`;

    const uploadRes = await uploadMediaObject(R2_PREFIX, fileName, Buffer.from(stampedBytes), {
      contentType: "application/pdf",
      customMetadata: {
        emeteraiRequestId: params.requestId,
        emeteraiSerial: (params.serialNumber || "").slice(0, 64),
        signedSha256: stagedSha256,
      },
    });

    if (!uploadRes.success || !uploadRes.item) {
      throw new Error(uploadRes.error || "Failed to upload stamped e-Meterai PDF to R2.");
    }

    manifest = {
      requestId: params.requestId,
      status: "stamped",
      serialNumber: params.serialNumber || "",
      stagedPdfKey: uploadRes.item.key,
      stagedPdfUrl: uploadRes.item.url,
      stagedFileName: uploadRes.item.name.slice(0, 300),
      stagedSizeBytes: stampedBytes.byteLength,
      stagedSha256,
      stampedAt: now,
    };
  } else {
    manifest = {
      requestId: params.requestId,
      status: "failed",
      error: (params.error || "PERURI e-Meterai stamping failed.").slice(0, 500),
    };
  }

  await bucket.put(manifestKey, JSON.stringify(manifest), {
    httpMetadata: { contentType: "application/json" },
  });

  return manifest;
}

export interface FinalizeEMeteraiResult {
  ok: boolean;
  document?: PartnerSignedDocument;
  error?: string;
}

/**
 * Idempotently checks staged R2 webhook manifests first, then Resmi.ID status API,
 * finalizing the PERURI-stamped PDF in R2 and updating Firestore (authenticated organizer context).
 */
export async function finalizeEMeteraiDocument(
  docId: string,
  webhookHint?: { status?: string; serialNumber?: string; error?: string },
): Promise<FinalizeEMeteraiResult> {
  const cleanDocId = docId.trim();
  if (!cleanDocId) {
    return { ok: false, error: "Missing document ID." };
  }

  const rawDoc = await getFirestoreDoc("partner_signed_documents", cleanDocId);
  if (!rawDoc) {
    return { ok: false, error: "Signed document record not found." };
  }

  const doc = rawDoc as unknown as PartnerSignedDocument;

  if (!doc.emeterai_request_id || doc.emeterai_status === "stamped" || doc.emeterai_status === "none") {
    return { ok: true, document: doc };
  }

  const now = new Date().toISOString();
  const manifestKey = getStagingManifestKey(doc.emeterai_request_id);
  const staged = await readStagedEMeteraiManifest(doc.emeterai_request_id);

  if (staged?.status === "stamped" && staged.stagedPdfKey && staged.stagedPdfUrl && staged.stagedSha256) {
    const updates: Partial<PartnerSignedDocument> = {
      signed_pdf_url: staged.stagedPdfUrl,
      signed_pdf_key: staged.stagedPdfKey,
      signed_file_name: staged.stagedFileName || doc.signed_file_name,
      signed_pdf_size_bytes: staged.stagedSizeBytes || doc.signed_pdf_size_bytes,
      signed_sha256: staged.stagedSha256,
      emeterai_status: "stamped",
      emeterai_serial_number: (staged.serialNumber || doc.emeterai_serial_number || "").slice(0, 128),
      emeterai_stamped_at: staged.stampedAt || now,
      emeterai_error: "",
      updated_at: now,
    };

    const savedOk = await patchFirestoreDoc(
      "partner_signed_documents",
      doc.id,
      updates as unknown as Record<string, unknown>,
    );

    if (!savedOk) {
      return { ok: false, document: doc, error: "Failed to persist staged e-Meterai PDF metadata in Firestore." };
    }

    if (doc.signed_pdf_key && doc.signed_pdf_key !== staged.stagedPdfKey) {
      await deleteMediaObject(doc.signed_pdf_key).catch(() => undefined);
    }
    await deleteMediaObject(manifestKey).catch(() => undefined);

    safeRevalidate(doc.token);
    return { ok: true, document: { ...doc, ...updates } };
  }

  if (staged?.status === "failed") {
    const updates: Partial<PartnerSignedDocument> = {
      emeterai_status: "failed",
      emeterai_error: (staged.error || "PERURI e-Meterai stamping failed.").slice(0, 500),
      updated_at: now,
    };
    const savedOk = await patchFirestoreDoc(
      "partner_signed_documents",
      doc.id,
      updates as unknown as Record<string, unknown>,
    );
    if (savedOk) {
      await deleteMediaObject(manifestKey).catch(() => undefined);
    }
    safeRevalidate(doc.token);
    return { ok: true, document: { ...doc, ...updates } };
  }

  // Fallback: poll Resmi.ID directly when no webhook staging manifest is present
  const statusRes = await getResmiEMeteraiStatus(doc.emeterai_request_id);

  let resolvedStatus: "queued" | "processing" | "stamped" | "failed" = statusRes.status;
  let resolvedSerial = statusRes.serialNumber || webhookHint?.serialNumber || doc.emeterai_serial_number;
  let resolvedError = statusRes.error || webhookHint?.error;

  if (!statusRes.ok && webhookHint?.status === "stamped") {
    resolvedStatus = "stamped";
    resolvedSerial = webhookHint.serialNumber || doc.emeterai_serial_number;
  } else if (!statusRes.ok && webhookHint?.status === "failed") {
    resolvedStatus = "failed";
    resolvedError = webhookHint.error || statusRes.error;
  }

  if (resolvedStatus === "stamped") {
    const stampedBytes = await downloadResmiEMeteraiPdf(doc.emeterai_request_id);
    const stampedSha256 = createHash("sha256").update(stampedBytes).digest("hex");

    const baseName = (doc.signed_file_name || "partner-document-signed.pdf").replace(/\.pdf$/i, "");
    const stampedFileName = baseName.endsWith("-emeterai") ? `${baseName}.pdf` : `${baseName}-emeterai.pdf`;

    const uploadRes = await uploadMediaObject(R2_PREFIX, stampedFileName, Buffer.from(stampedBytes), {
      contentType: "application/pdf",
      customMetadata: {
        documentId: doc.id,
        token: doc.token,
        companyName: doc.company_name.slice(0, 120),
        signedSha256: stampedSha256,
        ecertStatus: doc.ecert_status,
        emeteraiSerial: (resolvedSerial || "").slice(0, 64),
        signerEmail: doc.signer_email,
      },
    });

    if (!uploadRes.success || !uploadRes.item) {
      return {
        ok: false,
        document: doc,
        error: uploadRes.error || "Failed to upload e-Meterai stamped PDF to R2 storage.",
      };
    }

    const updates: Partial<PartnerSignedDocument> = {
      signed_pdf_url: uploadRes.item.url,
      signed_pdf_key: uploadRes.item.key,
      signed_file_name: uploadRes.item.name.slice(0, 300),
      signed_pdf_size_bytes: stampedBytes.byteLength,
      signed_sha256: stampedSha256,
      emeterai_status: "stamped",
      emeterai_serial_number: (resolvedSerial || "").slice(0, 128),
      emeterai_stamped_at: now,
      emeterai_error: "",
      updated_at: now,
    };

    const savedOk = await patchFirestoreDoc(
      "partner_signed_documents",
      doc.id,
      updates as unknown as Record<string, unknown>,
    );

    if (!savedOk) {
      await deleteMediaObject(uploadRes.item.key).catch(() => undefined);
      return { ok: false, document: doc, error: "Failed to persist stamped PDF metadata in Firestore." };
    }

    if (doc.signed_pdf_key && doc.signed_pdf_key !== uploadRes.item.key) {
      await deleteMediaObject(doc.signed_pdf_key).catch(() => undefined);
    }

    safeRevalidate(doc.token);
    return {
      ok: true,
      document: { ...doc, ...updates },
    };
  }

  if (resolvedStatus === "failed") {
    const updates: Partial<PartnerSignedDocument> = {
      emeterai_status: "failed",
      emeterai_error: (resolvedError || "PERURI e-Meterai stamping failed.").slice(0, 500),
      updated_at: now,
    };

    await patchFirestoreDoc("partner_signed_documents", doc.id, updates as unknown as Record<string, unknown>);
    safeRevalidate(doc.token);

    return {
      ok: true,
      document: { ...doc, ...updates },
    };
  }

  if (resolvedStatus !== doc.emeterai_status) {
    const updates: Partial<PartnerSignedDocument> = {
      emeterai_status: resolvedStatus,
      updated_at: now,
    };
    await patchFirestoreDoc("partner_signed_documents", doc.id, updates as unknown as Record<string, unknown>);
    safeRevalidate(doc.token);
    return {
      ok: true,
      document: { ...doc, ...updates },
    };
  }

  return { ok: true, document: doc };
}
